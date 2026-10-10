import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, hashToken, validUsername, validPassword } from '../lib/password.mjs';
import { allowedOrigin, readJSON, RequestError } from '../lib/request.ts';
import { databaseOptions } from '../scripts/database.mjs';

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
test('browser writes reject a different origin, including a different port', () => {
  for (const origin of ['http://evil.example', 'http://127.0.0.1:4000', 'null']) assert.equal(allowedOrigin(new Request('http://127.0.0.1:3000/api', { headers: { origin } })), false);
  assert.equal(allowedOrigin(new Request('http://127.0.0.1:3000/api', { headers: { origin: 'http://127.0.0.1:3000' } })), true);
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
