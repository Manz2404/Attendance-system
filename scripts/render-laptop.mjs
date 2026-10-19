import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { databaseOptions } from './database.mjs';
import { serverOptions } from '../lib/server-options.mjs';
import { RELAY_PORT, startDatabaseRelay, tunnelOptions } from '../lib/tailscale-tunnel.mjs';

const exec = promisify(execFile);

export function applicationEnvironment(environment) {
  const env = { ...environment, DB_HOST: '127.0.0.1', DB_PORT: String(RELAY_PORT), DB_SSL: 'false' };
  delete env.TS_AUTHKEY;
  delete env.DB_SSL_CA;
  databaseOptions(env);
  return serverOptions(env, 'cloud').env;
}

export async function startRenderLaptop() {
  const target = tunnelOptions(process.env);
  const env = applicationEnvironment(process.env);
  const authKey = process.env.TS_AUTHKEY?.trim();
  if (!authKey || authKey.length > 2048 || /\s/.test(authKey)) throw new Error('Set TS_AUTHKEY in Render to a reusable, ephemeral Tailscale auth key from your laptop\'s tailnet.');
  delete process.env.TS_AUTHKEY;
  const directory = await mkdtemp(join(tmpdir(), 'hadir-tailscale-'));
  const socket = join(directory, 'tailscaled.sock');
  const keyFile = join(directory, 'auth-key');
  // The VPN tools do not need database credentials, application keys or TS_AUTHKEY.
  const vpnEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SSL_CERT_FILE', 'SSL_CERT_DIR'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  const children = new Set();
  const controller = new AbortController();
  let relay;
  let stopping = false;
  let resolveExit;
  const exited = new Promise(resolve => { resolveExit = resolve; });
  const stop = (code = 0) => { if (!stopping) { stopping = true; controller.abort(); resolveExit(code); } };
  const onSignal = () => stop(0);
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
  const launch = (command, args, options, label) => {
    const child = spawn(command, args, options);
    children.add(child);
    child.once('error', () => { console.error(`${label} could not start.`); stop(1); });
    child.once('exit', () => { children.delete(child); if (!stopping) { console.error(`${label} stopped.`); stop(1); } });
    return child;
  };
  const cli = (args, timeout = 12000) => exec('tailscale', [`--socket=${socket}`, ...args], { env: vpnEnv, timeout, signal: controller.signal, maxBuffer: 128 * 1024 });
  try {
    await writeFile(keyFile, authKey, { mode: 0o600 });
    launch('tailscaled', ['--tun=userspace-networking', '--state=mem:', `--socket=${socket}`], { env: vpnEnv, stdio: 'ignore' }, 'Tailscale daemon');
    let daemonReady = false;
    for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
      try { const result = await cli(['status', '--json'], 1000); JSON.parse(result.stdout); daemonReady = true; }
      catch (error) { try { JSON.parse(error.stdout); daemonReady = true; } catch {} }
      if (daemonReady) break;
      await delay(250);
    }
    if (stopping) return await exited;
    if (!daemonReady) throw new Error('Tailscale daemon did not become ready. Check the Docker image and restart the service.');
    try {
      await cli(['up', `--auth-key=file:${keyFile}`, '--hostname=hadir-render', '--accept-dns=false', '--accept-routes=false', '--shields-up', '--timeout=45s'], 50000);
    } catch { if (stopping) return await exited; throw new Error('Tailscale could not authenticate. Check TS_AUTHKEY, device approval and your tailnet policy in Tailscale Admin.'); }
    finally { await rm(keyFile, { force: true }); }
    if (stopping) return await exited;
    relay = await startDatabaseRelay({ dial: () => spawn('tailscale', [`--socket=${socket}`, 'nc', target.host, String(target.port)], { env: vpnEnv, stdio: ['pipe', 'pipe', 'ignore'] }) });
    console.log(`Private database tunnel ready for ${target.host}:${target.port}. Checking MySQL without changing records.`);
    try {
      await exec(process.execPath, ['scripts/check-db.mjs'], { env, timeout: 20000, signal: controller.signal, maxBuffer: 64 * 1024 });
    } catch {
      if (stopping) return await exited;
      throw new Error('Laptop MySQL check failed. Keep the laptop, MySQL and Tailscale online; run connect-render-database.cmd; verify LAPTOP_TAILSCALE_IP, DB_USER, DB_PASSWORD and DB_NAME in Render.');
    }
    if (stopping) return await exited;
    console.log('Laptop MySQL connection verified. Starting Hadir Attendance.');
    // Launch Next directly so container shutdown reaches the actual web process.
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const options = serverOptions(env, 'cloud');
    launch(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', options.host, '--port', String(options.port)], { env, stdio: 'inherit' }, 'Attendance server');
    return await exited;
  } finally {
    stopping = true;
    await relay?.close();
    for (const child of children) child.kill('SIGTERM');
    await Promise.all([...children].map(child => new Promise(resolve => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
      child.once('close', () => { clearTimeout(timer); resolve(); });
    })));
    await rm(directory, { recursive: true, force: true });
    process.removeListener('SIGTERM', onSignal);
    process.removeListener('SIGINT', onSignal);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await startRenderLaptop(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
