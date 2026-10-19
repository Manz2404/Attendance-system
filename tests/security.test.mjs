import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, hashToken, validUsername, validPassword } from '../lib/password.mjs';
import { allowedOrigin, readJSON, RequestError } from '../lib/request.ts';
import { databaseOptions } from '../scripts/database.mjs';
import { accountDetails, AccountInputError, accountCreationEnabled, validCreationKey } from '../lib/account-creation.mjs';
import { databaseErrorCode, databaseFailure } from '../lib/database-error.mjs';

test('password hashes use separate salts and never contain the password', async () => {
  const password = 'a long local password!';
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a, b); assert.ok(!a.includes(password));
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword('wrong password', a), false);
  assert.equal(await verifyPassword(password, ''), false);
  assert.equal(await verifyPassword('x'.repeat(257), a), false);
});
test('usernames and administrator passwords have useful limits', () => {
  assert.equal(validUsername('arman'), true); assert.equal(validUsername('a@example.com'), true);
  for (const name of ['ab', 'Arman', '../admin', 'a b', 'a'.repeat(81)]) assert.equal(validUsername(name), false);
  assert.equal(validPassword('123456789012'), true); assert.equal(validPassword('short'), false);
});
test('session hashes cannot expose raw bearer tokens', () => {
  const token = 'a'.repeat(64);
  assert.match(hashToken(token), /^[a-f0-9]{64}$/); assert.notEqual(hashToken(token), token);
});
test('browser account creation validates identity, strong passwords and confirmation', () => {
  const body = { username: '  Arman.New  ', name: '  New Admin 🧑‍💻  ', password: 'new account password!', confirmPassword: 'new account password!' };
  assert.deepEqual(accountDetails(body), { username: 'arman.new', name: 'New Admin 🧑‍💻', password: body.password });
  for (const change of [{ username: '../admin' }, { name: '  ' }, { name: 'x'.repeat(121) }, { password: 'short', confirmPassword: 'short' }, { password: 'x'.repeat(257) }, { confirmPassword: 'different password!' }]) {
    assert.throws(() => accountDetails({ ...body, ...change }), AccountInputError);
  }
});
test('anonymous account creation is disabled without a suitable separate code', () => {
  for (const key of [undefined, '', 'short', 'a'.repeat(31), 'a'.repeat(257), 'a b'.repeat(20)]) {
    assert.equal(accountCreationEnabled(key), false); assert.equal(validCreationKey('anything', key), false);
  }
  const code = 'a'.repeat(64);
  assert.equal(accountCreationEnabled(code), true); assert.equal(validCreationKey(code, code), true);
  for (const candidate of [undefined, null, 42, 'b'.repeat(64), code + ' ', 'a'.repeat(257)]) assert.equal(validCreationKey(candidate, code), false);
});
test('database errors explain failed connections and missing setup without exposing credentials', () => {
  const error = { message: 'private-host secret-password secret-sql', cause: { code: 'ECONNREFUSED', message: 'another secret' } };
  assert.equal(databaseErrorCode(error), 'ECONNREFUSED');
  const failure = databaseFailure(error);
  assert.equal(failure.errorCode, 'DATABASE_UNAVAILABLE'); assert.match(failure.error, /private connection/);
  assert.doesNotMatch(JSON.stringify(failure), /secret-password|private-host|secret-sql|setup-windows/);
  assert.equal(databaseFailure({ cause: { code: 'ER_NO_SUCH_TABLE' } }).errorCode, 'DATABASE_SETUP_REQUIRED');
  assert.equal(databaseFailure({ code: 'ER_ACCESS_DENIED_ERROR' }).errorCode, 'DATABASE_ACCESS_DENIED');
  assert.equal(databaseErrorCode(null), 'DATABASE_ERROR');
});
test('browser writes reject a different origin, including a different port', () => {
  for (const origin of ['http://evil.example', 'http://127.0.0.1:4000', 'null']) assert.equal(allowedOrigin(new Request('http://127.0.0.1:3000/api', { headers: { origin } })), false);
  assert.equal(allowedOrigin(new Request('http://127.0.0.1:3000/api', { headers: { origin: 'http://127.0.0.1:3000' } })), true);
});
test('browser origin follows the HTTP Host when Next uses its bind address in the request URL', () => {
  const request = (host, origin, url = 'http://127.0.0.1:3000/api') => new Request(url, { headers: { host, origin } });
  assert.equal(allowedOrigin(request('localhost:3000', 'http://localhost:3000')), true);
  assert.equal(allowedOrigin(request('127.0.0.1:3000', 'http://127.0.0.1:3000')), true);
  assert.equal(allowedOrigin(request('localhost:3010', 'http://localhost:3010', 'http://127.0.0.1:3010/api')), true);
  assert.equal(allowedOrigin(request('localhost:80', 'http://localhost', 'http://127.0.0.1/api')), true);
  for (const origin of ['http://127.0.0.1:3000', 'http://localhost:4000', 'https://localhost:3000', 'http://evil.example', 'null', '']) {
    assert.equal(allowedOrigin(request('localhost:3000', origin)), false, origin);
  }
  assert.equal(allowedOrigin(new Request('http://127.0.0.1:3000/api', { headers: { host: '127.0.0.1:3000', origin: 'http://evil.example', 'x-forwarded-host': 'evil.example' } })), false);
});
test('invalid Host authorities are rejected and requests without Origin retain their existing behavior', () => {
  for (const host of ['', 'localhost:3000/path', 'localhost:3000@evil.example', 'localhost:3000?x=y', 'localhost:3000#fragment', 'localhost:3000\\@evil.example', 'localhost:3000, evil.example', 'localhost:bad']) {
    assert.equal(allowedOrigin(new Request('http://127.0.0.1:3000/api', { headers: { host, origin: 'http://127.0.0.1:3000' } })), false, host);
  }
  assert.equal(allowedOrigin(new Request('http://127.0.0.1:3000/api')), true);
});
test('JSON reader limits bytes, validates objects and accepts a normal request', async () => {
  const request = body => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.deepEqual(await readJSON(request('{"action":"initialize"}')), { action: 'initialize' });
  await assert.rejects(readJSON(request('[1,2]')), error => error instanceof RequestError && error.status === 400);
  await assert.rejects(readJSON(request('broken')), error => error.status === 400);
  await assert.rejects(readJSON(request('{"a":"😀😀😀"}'), 15), error => error.status === 413);
});
test('MySQL settings validate examples and never use unverified TLS', () => {
  const keys = ['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','DB_SSL','DB_SSL_CA'];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'local_admin', DB_PASSWORD: '', DB_NAME: 'attendance_system', DB_SSL: 'true', DB_SSL_CA: '' });
    assert.equal(databaseOptions().ssl.rejectUnauthorized, true);
    process.env.DB_SSL = 'false'; assert.equal(databaseOptions().ssl, undefined);
    process.env.DB_PORT = 'incorrect'; assert.throws(databaseOptions, /DB_PORT/);
    process.env.DB_PORT = '3306'; process.env.DB_USER = 'your_mysql_user'; assert.throws(databaseOptions, /Edit DB_HOST/);
  } finally { for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; } }
});
