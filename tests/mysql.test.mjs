import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import mysql from 'mysql2/promise';
import { databaseOptions, loadLocalEnvironment } from '../scripts/database.mjs';
import { migrate } from '../scripts/migrate.mjs';
import { checkDatabase } from '../scripts/check-db.mjs';
import { createAdmin } from '../scripts/admin.mjs';
import { hashToken } from '../lib/password.mjs';
import { dateMY, addDays, localInstant } from '../lib/attendance.ts';

loadLocalEnvironment();
test('MySQL migrations, controller transactions and local authentication', async t => {
  // This suite creates test data. It refuses a user's regular attendance database.
  if (!/^hadir_test_[a-z0-9_]+$/.test(process.env.DB_NAME || '')) throw new Error('Use a disposable database named hadir_test_<name> to run test:mysql.');
  const connection = await mysql.createConnection(databaseOptions());
  const runtime = resolve('.test-runtime'); await mkdir(runtime, { recursive: true });
  const routePath = resolve(runtime, 'workspace.mjs'), loginPath = resolve(runtime, 'login.mjs'), authPath = resolve(runtime, 'auth.mjs');
  const authMock = { name: 'mock-account', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: 'mock-auth', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export async function getCurrentUser(){return globalThis.__authUser ?? null;} export async function createSession(id){globalThis.__createdSession=id;}', loader: 'js' }));
  } };
  const cookiesMock = { name: 'mock-cookies', setup(builder) {
    builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'mock-cookies', namespace: 'test' }));
    builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export async function cookies(){return globalThis.__cookieStore;}', loader: 'js' }));
  } };
  const shared = { bundle: true, platform: 'node', format: 'esm', packages: 'external', tsconfig: 'tsconfig.json' };
  await build({ ...shared, entryPoints: ['app/api/workspace/route.ts'], outfile: routePath, plugins: [authMock] });
  await build({ ...shared, entryPoints: ['app/api/auth/login/route.ts'], outfile: loginPath, plugins: [authMock] });
  await build({ ...shared, entryPoints: ['lib/auth.ts'], outfile: authPath, plugins: [cookiesMock] });
  const route = await import(pathToFileURL(routePath)), login = await import(pathToFileURL(loginPath)), auth = await import(pathToFileURL(authPath));
  const post = async (body, headers = {}) => {
    const response = await route.POST(new Request('http://127.0.0.1:3000/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
    return { status: response.status, data: await response.json() };
  };
  const get = async () => { const response = await route.GET(); return { status: response.status, data: await response.json() }; };
  const signIn = async (username, password, headers = {}) => {
    const response = await login.POST(new Request('http://127.0.0.1:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ username, password }) }));
    return { status: response.status, data: await response.json() };
  };
  let owner, second, schedule, employee;
  const password = 'integration-test-password!', day = addDays(dateMY(), -7);
  const inTime = localInstant(day, '09:00'), outTime = localInstant(day, '18:00');
  try {
    await t.test('the configured MySQL version supports InnoDB and utf8mb4', async () => {
      const server = await checkDatabase(connection);
      console.log('Integration database:', server.version);
      if (process.env.EXPECT_DB_VERSION) assert.ok(server.version.startsWith(process.env.EXPECT_DB_VERSION), `Expected ${process.env.EXPECT_DB_VERSION}, got ${server.version}`);
    });
    await t.test('schema creates once and migration reruns safely', async () => {
      assert.equal(await migrate(connection), true); assert.equal(await migrate(connection), false);
      const [tables] = await connection.query('SHOW TABLES'); assert.equal(tables.length, 9);
    });
    await t.test('administrator credentials are hashed and existing users are protected', async () => {
      await createAdmin(connection, { username: 'integration', name: 'Integration Admin', password });
      await createAdmin(connection, { username: 'second', name: 'Second Admin', password });
      const [accounts] = await connection.query('SELECT id, username, password_hash FROM hadir_users');
      owner = accounts.find(a => a.username === 'integration').id; second = accounts.find(a => a.username === 'second').id;
      assert.ok(accounts.every(a => a.password_hash.startsWith('scrypt-v1$') && a.password_hash !== password));
      await assert.rejects(createAdmin(connection, { username: 'integration', name: 'Changed', password }), /already exists/);
    });
    await t.test('workspace reads and writes need authentication', async () => {
      globalThis.__authUser = null;
      assert.equal((await get()).status, 401); assert.equal((await post({ action: 'initialize' })).status, 401);
      globalThis.__authUser = { userId: owner, fullName: 'Integration Admin' };
    });
    await t.test('workspace initialization is idempotent, including concurrent calls', async () => {
      const results = await Promise.all([post({ action: 'initialize' }), post({ action: 'initialize' })]);
      assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
      const result = await get(); assert.equal(result.data.schedules.length, 1); schedule = result.data.schedules[0];
    });
    await t.test('employee creation, booleans, uniqueness and schedule validation', async () => {
      const body = { action: 'employee', code: 'EMP-001', name: 'Test Employee 🧑‍💻', department: 'Support', scheduleId: schedule.id, deviceUserId: '', active: true, startDate: addDays(day, -30) };
      assert.equal((await post(body)).status, 200); assert.equal((await post(body)).status, 400);
      assert.equal((await post({ ...body, code: 'EMP-002', scheduleId: 'unknown' })).status, 400);
      employee = (await get()).data.employees[0]; assert.equal(employee.active, true); assert.equal(employee.isSample, false); assert.equal(employee.name, body.name);
    });
    await t.test('invalid imports leave every row unsaved', async () => {
      const result = await post({ action: 'import', rows: [{ code: employee.code, timestamp: inTime, kind: 'IN' }, { code: 'UNKNOWN', timestamp: outTime, kind: 'OUT' }] });
      assert.equal(result.status, 400); assert.equal((await get()).data.punches.length, 0);
    });
    await t.test('normalized timestamps and concurrent imports cannot duplicate punches', async () => {
      const rows = [{ code: employee.code, timestamp: inTime, kind: 'IN' }, { code: employee.code, timestamp: outTime, kind: 'OUT' }];
      const results = await Promise.all([post({ action: 'import', rows }), post({ action: 'import', rows })]);
      assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
      assert.equal(results.reduce((n, r) => n + r.data.added, 0), 2);
      const alternative = inTime.replace('Z', '+00:00');
      assert.equal((await post({ action: 'punch', code: employee.code, timestamp: alternative, kind: 'IN' })).data.added, 0);
    });
    await t.test('future punches and invalid calendar dates are rejected', async () => {
      assert.equal((await post({ action: 'punch', code: employee.code, timestamp: localInstant(addDays(dateMY(), 2), '09:00'), kind: 'IN' })).status, 400);
      assert.equal((await post({ action: 'punch', code: employee.code, timestamp: '2026-02-30T09:00:00+08:00', kind: 'IN' })).status, 400);
    });
    await t.test('employment dates cannot hide existing attendance', async () => {
      assert.equal((await post({ action: 'employee', ...employee, startDate: addDays(day, 1) })).status, 400);
    });
    await t.test('a thousand-row import persists in one transaction', async () => {
      const rows = Array.from({ length: 1000 }, (_, i) => ({ code: employee.code, timestamp: new Date(Date.parse(inTime) + (i + 1) * 1000).toISOString(), kind: i % 2 ? 'OUT' : 'IN' }));
      const result = await post({ action: 'import', rows }); assert.equal(result.status, 200); assert.equal(result.data.added, 1000);
    });
    await t.test('different administrators cannot read or alter each other’s records', async () => {
      const logs = (await get()).data.punches;
      globalThis.__authUser = { userId: second, fullName: 'Second Admin' };
      assert.equal((await post({ action: 'initialize' })).status, 200);
      assert.equal((await get()).data.employees.length, 0); assert.equal((await get()).data.punches.length, 0);
      assert.equal((await post({ action: 'delete-punch', id: logs[0].id })).status, 200);
      globalThis.__authUser = { userId: owner, fullName: 'Integration Admin' };
      assert.equal((await get()).data.punches.length, 1002);
    });
    await t.test('sample cleanup preserves the user’s team and attendance', async () => {
      assert.equal((await post({ action: 'sample' })).status, 200); assert.equal((await get()).data.employees.length, 9);
      assert.equal((await post({ action: 'clear-sample' })).status, 200);
      const result = await get(); assert.equal(result.data.employees.length, 1); assert.equal(result.data.punches.length, 1002);
    });
    await t.test('device registration stores details without inventing connectivity', async () => {
      assert.equal((await post({ action: 'device', name: 'Future device', brand: 'Undecided', model: 'Undecided', method: 'Not selected' })).status, 200);
      assert.equal((await get()).data.devices[0].method, 'Not selected');
    });
    await t.test('cross-origin writes and oversized requests are rejected', async () => {
      assert.equal((await post({ action: 'workspace', name: 'Intruder' }, { origin: 'http://evil.example' })).status, 403);
      assert.equal((await post({ action: 'import', rows: [], padding: 'x'.repeat(300000) })).status, 413);
    });
    await t.test('failed logins have generic errors and a persistent attempt limit', async () => {
      for (let i = 0; i < 5; i++) assert.equal((await signIn('second', 'incorrect-password')).status, 401);
      assert.equal((await signIn('second', password)).status, 429);
      assert.equal((await signIn('integration', password)).status, 200); assert.equal(globalThis.__createdSession, owner);
    });
    await t.test('browser credentials work on localhost and 127.0.0.1 while other origins are rejected', async () => {
      for (const host of ['localhost:3000', '127.0.0.1:3000']) {
        assert.equal((await signIn('integration', password, { host, origin: `http://${host}` })).status, 200);
        assert.equal(globalThis.__createdSession, owner);
      }
      assert.equal((await signIn('integration', password, { host: 'localhost:3000', origin: 'http://evil.example' })).status, 403);
    });
    await t.test('sessions are hashed, expire and are revoked on logout', async () => {
      const jar = new Map(); globalThis.__cookieStore = { get: key => jar.get(key), set: (key, value, options) => jar.set(key, { value, ...options }), delete: key => jar.delete(key) };
      await auth.createSession(owner);
      const cookie = jar.get('hadir_session'); assert.equal(cookie.httpOnly, true); assert.equal(cookie.sameSite, 'lax');
      const [[row]] = await connection.execute('SELECT token_hash FROM hadir_sessions WHERE user_id = ?', [owner]);
      assert.equal(row.token_hash, hashToken(cookie.value)); assert.notEqual(row.token_hash, cookie.value);
      assert.equal((await auth.getCurrentUser()).userId, owner);
      await connection.execute('UPDATE hadir_sessions SET expires_at = ? WHERE user_id = ?', ['2000-01-01T00:00:00.000Z', owner]);
      assert.equal(await auth.getCurrentUser(), null);
      await auth.destroySession(); assert.equal(jar.has('hadir_session'), false);
    });
    await t.test('administrator password reset preserves attendance and revokes sessions', async () => {
      await auth.createSession(owner);
      await createAdmin(connection, { username: 'integration', name: 'Integration', password: 'replacement-test-password!' }, true);
      assert.equal(await auth.getCurrentUser(), null);
      assert.equal((await signIn('integration', password)).status, 401);
      assert.equal((await signIn('integration', 'replacement-test-password!')).status, 200);
      assert.equal((await get()).data.punches.length, 1002);
    });
    await t.test('records persist after closing and reopening a database connection', async () => {
      const other = await mysql.createConnection(databaseOptions());
      try { const [[row]] = await other.execute('SELECT COUNT(*) AS count FROM hadir_punches WHERE owner_id = ?', [owner]); assert.equal(row.count, 1002); }
      finally { await other.end(); }
    });
  } finally { await connection.end(); await globalThis.hadirDb?.$client.end(); delete globalThis.hadirDb; }
});
