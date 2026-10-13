import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { request } from 'node:http';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { probeApplication } from '../lib/launcher.mjs';

const require = createRequire(import.meta.url);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

test('production server accepts the browser Host without allowing other origins', { timeout: 90000 }, async t => {
  if (!existsSync('.next/BUILD_ID')) throw new Error('Run npm run build before test:http.');
  const port = await availablePort(), address = `http://127.0.0.1:${port}`;
  // Start the actual Next server with the same loopback binding as serve.mjs.
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '', startError;
  const record = chunk => { output = (output + chunk.toString()).slice(-16000); };
  child.stdout.on('data', record); child.stderr.on('data', record);
  child.on('error', error => { startError = error; });
  const stopped = new Promise(resolve => child.once('close', resolve));
  const signIn = (host, origin) => new Promise((resolve, reject) => {
    // Invalid credentials reach validation without reading or changing any database.
    const body = JSON.stringify({ username: 'ab', password: 'http-regression-probe' });
    // fetch overrides a supplied Host with its connection address. Native HTTP
    // keeps the browser Host while connecting directly to the IPv4 listener.
    const req = request(`${address}/api/auth/login`, {
      method: 'POST', headers: { host, origin, 'Content-Type': 'application/json' },
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, data: JSON.parse(text) }); }
        catch (error) { reject(error); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('HTTP login test timed out.')));
    req.on('error', reject); req.end(body);
  });
  try {
    const deadline = Date.now() + 45000;
    let ready = false;
    while (Date.now() < deadline) {
      if (startError || child.exitCode !== null) throw new Error(`Server could not start: ${startError?.message || output}`);
      try {
        const response = await fetch(`${address}/api/auth/login`, { signal: AbortSignal.timeout(2000) });
        ready = response.status === 405;
        await response.arrayBuffer();
        if (ready) break;
      } catch { /* The loopback listener may not be ready yet. */ }
      await delay(200);
    }
    assert.ok(ready, `Production server did not become ready.\n${output}`);
    await t.test('desktop launcher recognizes and reuses the running production server', async () => {
      assert.equal(await probeApplication(address), 'ready');
      const response = await fetch(`${address}/api/launcher-status`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { application: 'hadir-attendance' });
      const result = await promisify(execFile)(process.execPath, ['scripts/launch.mjs', '--no-browser'], { env: { ...process.env, PORT: String(port), HADIR_BIND_HOST: '127.0.0.1' }, timeout: 10000 });
      assert.match(result.stdout, /already running/); assert.match(result.stdout, new RegExp(`127\\.0\\.0\\.1:${port}`));
      assert.equal(child.exitCode, null);
    });
    for (const hostname of ['localhost', '127.0.0.1']) {
      await t.test(`same-origin browser POST works through ${hostname}`, async () => {
        const result = await signIn(`${hostname}:${port}`, `http://${hostname}:${port}`);
        assert.equal(result.status, 400, JSON.stringify(result));
        assert.equal(result.data.error, 'Enter a valid username and password.');
      });
    }
    await t.test('different hosts, ports, schemes and opaque origins are rejected', async () => {
      for (const origin of ['http://evil.example', `http://localhost:${port === 65535 ? port - 1 : port + 1}`, `https://localhost:${port}`, `http://127.0.0.1:${port}`, 'null']) {
        const result = await signIn(`localhost:${port}`, origin);
        assert.equal(result.status, 403, JSON.stringify({ origin, result }));
        assert.equal(result.data.error, 'This request is not allowed.');
      }
    });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await Promise.race([stopped, delay(4000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await Promise.race([stopped, delay(4000)]);
    }
  }
});
