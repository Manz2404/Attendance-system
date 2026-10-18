import test from 'node:test';
import assert from 'node:assert/strict';
import { serverOptions } from '../lib/server-options.mjs';

test('local startup keeps loopback, configured LAN access and the existing HTTP cookie setting', () => {
  const local = serverOptions({ COOKIE_SECURE: 'false' });
  assert.equal(local.host, '127.0.0.1'); assert.equal(local.port, 3000); assert.equal(local.mode, 'start');
  assert.equal(local.env.COOKIE_SECURE, 'false'); assert.equal(local.cloud, false);
  const lan = serverOptions({ HADIR_BIND_HOST: '0.0.0.0', PORT: '4321' }, 'dev');
  assert.equal(lan.host, '0.0.0.0'); assert.equal(lan.port, 4321); assert.equal(lan.mode, 'dev');
});

test('cloud startup uses the assigned port and public listener with secure cookies despite local defaults', () => {
  const original = { PORT: '8080', HADIR_BIND_HOST: '127.0.0.1', COOKIE_SECURE: 'false', NODE_ENV: 'development', FACE_ENCRYPTION_KEY: '1'.repeat(64), DB_HOST: 'mysql.railway.internal' };
  const result = serverOptions(original, 'cloud');
  assert.equal(result.host, '0.0.0.0'); assert.equal(result.port, 8080); assert.equal(result.mode, 'start'); assert.equal(result.cloud, true);
  assert.equal(result.env.COOKIE_SECURE, 'true'); assert.equal(result.env.NODE_ENV, 'production');
  assert.equal(result.env.FACE_ENCRYPTION_KEY, original.FACE_ENCRYPTION_KEY); assert.equal(result.env.DB_HOST, original.DB_HOST);
  assert.equal(original.COOKIE_SECURE, 'false'); assert.equal(original.NODE_ENV, 'development');
});

test('cloud startup refuses an absent or malformed face key and invalid listen ports', () => {
  for (const key of [undefined, '', 'a'.repeat(63), 'g'.repeat(64), 'replace-this-key']) {
    assert.throws(() => serverOptions({ FACE_ENCRYPTION_KEY: key }, 'cloud'), /FACE_ENCRYPTION_KEY/);
  }
  for (const port of ['invalid', '0', '-1', '65536', '3000 & calc']) {
    assert.throws(() => serverOptions({ PORT: port, FACE_ENCRYPTION_KEY: 'a'.repeat(64) }, 'cloud'), /PORT/);
  }
});
