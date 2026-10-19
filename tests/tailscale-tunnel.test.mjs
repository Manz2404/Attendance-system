import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { startDatabaseRelay, tunnelOptions, RELAY_PORT } from '../lib/tailscale-tunnel.mjs';
import { applicationEnvironment } from '../scripts/render-laptop.mjs';
import { laptopServeArguments } from '../scripts/share-render-database.mjs';

test('tunnel accepts only a Tailscale IPv4 target and valid TCP port', () => {
  assert.deepEqual(tunnelOptions({ LAPTOP_TAILSCALE_IP: '100.75.136.72' }), { host: '100.75.136.72', port: 13306 });
  assert.deepEqual(tunnelOptions({ LAPTOP_TAILSCALE_IP: '100.127.255.255', LAPTOP_TAILSCALE_PORT: '14306' }), { host: '100.127.255.255', port: 14306 });
  for (const host of [undefined, '127.0.0.1', '100.63.255.255', '100.128.0.1', '100.75.136.999', '100.75.136.72; echo key', 'example.com', '::1']) assert.throws(() => tunnelOptions({ LAPTOP_TAILSCALE_IP: host }), /LAPTOP_TAILSCALE_IP/);
  for (const port of ['0', '-1', '65536', 'a', '13306;echo key']) assert.throws(() => tunnelOptions({ LAPTOP_TAILSCALE_IP: '100.64.0.1', LAPTOP_TAILSCALE_PORT: port }), /LAPTOP_TAILSCALE_PORT/);
});

test('Render app uses only the local relay, keeps its original face key, and does not receive the VPN auth key', () => {
  const original = { DB_HOST: 'old-host', DB_PORT: '3306', DB_USER: 'attendance', DB_PASSWORD: 'private', DB_NAME: 'attendance_system', DB_SSL: 'true', DB_SSL_CA: '/nonexistent/certificate', FACE_ENCRYPTION_KEY: 'a'.repeat(64), TS_AUTHKEY: 'tskey-auth-test', PORT: '10000' };
  const env = applicationEnvironment(original);
  assert.equal(env.DB_HOST, '127.0.0.1'); assert.equal(env.DB_PORT, String(RELAY_PORT)); assert.equal(env.DB_SSL, 'false');
  assert.equal(env.TS_AUTHKEY, undefined); assert.equal(env.DB_SSL_CA, undefined);
  assert.equal(env.FACE_ENCRYPTION_KEY, original.FACE_ENCRYPTION_KEY); assert.equal(env.DB_PASSWORD, original.DB_PASSWORD);
  assert.equal(env.COOKIE_SECURE, 'true'); assert.equal(original.TS_AUTHKEY, 'tskey-auth-test'); assert.equal(original.DB_HOST, 'old-host');
  assert.throws(() => applicationEnvironment({ ...original, DB_NAME: '' }), /DB_NAME/);
  assert.throws(() => applicationEnvironment({ ...original, FACE_ENCRYPTION_KEY: '' }), /FACE_ENCRYPTION_KEY/);
  assert.deepEqual(laptopServeArguments(3308), ['serve', '--bg', '--tcp=13306', 'tcp://127.0.0.1:3308']);
  assert.throws(() => laptopServeArguments('3306;echo secret'), /DB_PORT/);
});

test('relay forwards server-first binary traffic on independent connections and closes its children', { timeout: 10000 }, async () => {
  const children = [];
  const relay = await startDatabaseRelay({ port: 0, dial: () => {
    const child = spawn(process.execPath, ['-e', 'process.stdout.write(Buffer.from([10,0,255,128]));process.stdin.pipe(process.stdout)'], { stdio: ['pipe', 'pipe', 'ignore'] });
    children.push(child); return child;
  } });
  const sockets = [];
  try {
    await Promise.all([Buffer.from([0, 1, 254, 255]), Buffer.from([128, 0, 2, 10])].map(async payload => {
      const socket = createConnection({ host: '127.0.0.1', port: relay.port }); sockets.push(socket);
      const expected = Buffer.concat([Buffer.from([10, 0, 255, 128]), payload]);
      await new Promise((resolve, reject) => {
        let received = Buffer.alloc(0);
        socket.on('error', reject);
        socket.on('data', chunk => {
          received = Buffer.concat([received, chunk]);
          if (received.length === 4) socket.write(payload);
          if (received.length >= expected.length) { assert.deepEqual(received, expected); resolve(); }
        });
      });
    }));
    assert.equal(children.length, 2);
    const closed = children.map(child => once(child, 'close'));
    await relay.close();
    await Promise.all(closed);
    assert.ok(children.every(child => child.exitCode !== null || child.signalCode));
  } finally { for (const socket of sockets) socket.destroy(); if (children.some(child => child.exitCode === null && !child.signalCode)) await relay.close(); }
});

test('relay closes failed peers and limits simultaneous processes', { timeout: 10000 }, async () => {
  let spawned = 0;
  const relay = await startDatabaseRelay({ port: 0, maxConnections: 1, dial: () => { spawned++; return spawn(process.execPath, ['-e', 'process.stdin.resume()'], { stdio: ['pipe', 'pipe', 'ignore'] }); } });
  const first = createConnection({ host: '127.0.0.1', port: relay.port });
  first.on('error', () => {});
  await once(first, 'connect');
  const second = createConnection({ host: '127.0.0.1', port: relay.port }); second.on('error', () => {});
  await new Promise(resolve => second.once('close', resolve));
  assert.equal(spawned, 1);
  first.destroy();
  await relay.close();
  const failed = await startDatabaseRelay({ port: 0, dial: () => spawn(process.execPath, ['-e', 'process.exit(1)'], { stdio: ['pipe', 'pipe', 'ignore'] }) });
  const peer = createConnection({ host: '127.0.0.1', port: failed.port }); peer.on('error', () => {});
  await new Promise(resolve => peer.once('close', resolve));
  await failed.close();
});
