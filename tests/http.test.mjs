import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';

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
  const signIn = async (host, origin) => {
    // Invalid credentials reach validation without reading or changing any database.
    const response = await fetch(`${address}/api/auth/login`, {
      method: 'POST', headers: { host, origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ab', password: 'http-regression-probe' }),
      signal: AbortSignal.timeout(10000),
    });
    return { status: response.status, data: await response.json() };
  };
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
    if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.race([stopped, delay(4000)]);
    if (child.exitCode === null) {
      child.kill('SIGKILL');
      await Promise.race([stopped, delay(4000)]);
    }
  }
});
