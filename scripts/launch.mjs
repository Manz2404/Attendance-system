import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadLocalEnvironment } from './database.mjs';
import { localApplicationURL, bindHost, probeApplication, waitForApplication } from '../lib/launcher.mjs';

loadLocalEnvironment();
let child, startError;

async function openBrowser(address) {
  if (process.argv.includes('--no-browser') || process.platform !== 'win32') { console.log(`Open ${address} in your browser.`); return; }
  // The address contains only a fixed loopback host and a validated numeric port.
  await new Promise((resolve, reject) => {
    const browser = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${address}"`], { stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true });
    browser.once('error', reject);
    browser.once('close', code => code === 0 ? resolve() : reject(new Error('Could not open the browser.')));
  });
}

try {
  const port = Number(process.env.PORT || 3000), address = localApplicationURL(port), host = bindHost(process.env.HADIR_BIND_HOST || '127.0.0.1'), state = await probeApplication(address);
  if (state === 'occupied') throw new Error(`The port at ${address} is in use but did not identify a ready Hadir server. If Hadir is busy, wait and retry; after updates, close the old server window and run setup-windows.cmd.`);
  if (state === 'stopped') {
    const require = createRequire(import.meta.url);
    console.log('Starting Hadir Attendance… Keep this window open while using the system.');
    child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', host, '--port', String(port)], { stdio: 'inherit', env: process.env });
    child.on('error', error => { startError = error; console.error(error.message); });
    child.on('exit', code => { if (!process.exitCode) process.exitCode = code ?? 0; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
    try { await waitForApplication(address, { stopped: () => !!startError || child.exitCode !== null || child.signalCode !== null }); }
    catch (error) {
      // A second click may have started Hadir while this launch was waiting for the port.
      if (await probeApplication(address) !== 'ready') throw error;
      process.exitCode = 0; console.log('Another launch already started Hadir. Reusing its link…');
    }
  } else console.log('Hadir Attendance is already running. Opening its link…');
  try { await openBrowser(address); }
  catch { console.log(`The server is ready. Open ${address} manually if your browser did not open.`); process.exitCode = 1; }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not launch Hadir Attendance.');
  if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  process.exitCode = 1;
}
