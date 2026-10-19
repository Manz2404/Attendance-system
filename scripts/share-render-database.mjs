import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { databaseOptions, loadLocalEnvironment, explainError } from './database.mjs';
import { LAPTOP_PORT, tunnelOptions } from '../lib/tailscale-tunnel.mjs';

const exec = promisify(execFile);
export function laptopServeArguments(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT must be a valid port number.');
  return ['serve', '--bg', `--tcp=${LAPTOP_PORT}`, `tcp://127.0.0.1:${port}`];
}

async function shareDatabase() {
  const windowsBinary = join(process.env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe');
  const binary = process.platform === 'win32' && existsSync(windowsBinary) ? windowsBinary : 'tailscale';
  const run = args => exec(binary, args, { timeout: 30000, maxBuffer: 64 * 1024 });
  if (process.argv.includes('--stop')) {
    await run(['serve', `--tcp=${LAPTOP_PORT}`, 'off']);
    console.log(`Stopped the private MySQL forwarder on Tailscale port ${LAPTOP_PORT}.`);
    return;
  }
  loadLocalEnvironment();
  const options = databaseOptions();
  if (!['127.0.0.1', 'localhost', '::1'].includes(options.host)) throw new Error('Run this helper on the MySQL laptop with DB_HOST=127.0.0.1 in its existing .env.');
  const { stdout } = await run(['ip', '-4']);
  const host = stdout.trim();
  tunnelOptions({ LAPTOP_TAILSCALE_IP: host });
  const { default: mysql } = await import('mysql2/promise');
  const { checkDatabase } = await import('./check-db.mjs');
  let connection;
  try {
    connection = await mysql.createConnection({ ...options, host: '127.0.0.1' });
    await checkDatabase(connection);
  } finally { await connection?.end(); }
  await run(laptopServeArguments(options.port));
  console.log(`Private MySQL forwarder enabled. Set LAPTOP_TAILSCALE_IP=${host} in Render.`);
  console.log(`Tailscale port ${LAPTOP_PORT} forwards to local MySQL port ${options.port}. Existing records stay on this laptop.`);
  console.log('Keep MySQL, Tailscale and this laptop running. The helper window can be closed.');
  console.log('To stop forwarding: connect-render-database.cmd --stop');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  shareDatabase().catch(error => {
    if (error.code === 'ENOENT') console.error('Install Tailscale on this laptop and sign in to the same tailnet you will use for Render.');
    else if (error.cmd) console.error('Tailscale could not configure the forwarder. Check that it is signed in and that your Tailscale account allows Serve; try the helper in an administrator Command Prompt.');
    else console.error(explainError(error));
    process.exitCode = 1;
  });
}
