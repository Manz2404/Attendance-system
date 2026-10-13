import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { localApplicationURL, bindHost, probeApplication, waitForApplication } from '../lib/launcher.mjs';

const run = promisify(execFile);
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return localApplicationURL(server.address().port);
}
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

test('launcher URLs retain custom ports and reject malformed ports or bind hosts', () => {
  assert.equal(localApplicationURL('4321'), 'http://127.0.0.1:4321/');
  assert.equal(localApplicationURL(80), 'http://127.0.0.1:80/');
  for (const port of [0, -1, 65536, 'invalid', 3000.5, '3000 & calc']) assert.throws(() => localApplicationURL(port), /PORT/);
  assert.equal(bindHost(), '127.0.0.1'); assert.equal(bindHost('0.0.0.0'), '0.0.0.0');
  for (const host of ['example.com', '127.0.0.1 & calc', '::', '']) assert.throws(() => bindHost(host), /HADIR_BIND_HOST/);
});
test('launcher identifies Hadir, refuses a different application, and detects a closed listener', async () => {
  let application = 'hadir-attendance';
  const server = createServer((req, res) => { assert.equal(req.url, '/api/launcher-status'); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ application })); });
  const address = await listen(server);
  try {
    assert.equal(await probeApplication(address), 'ready');
    application = 'another-application'; assert.equal(await probeApplication(address), 'occupied');
  } finally { await close(server); }
  assert.equal(await probeApplication(address), 'stopped');
});
test('launcher waits through startup and surfaces a server failure without opening another application', async () => {
  let ready = false;
  const server = createServer((req, res) => { res.statusCode = ready ? 200 : 503; res.end(JSON.stringify({ application: ready ? 'hadir-attendance' : 'starting' })); });
  const address = await listen(server);
  try {
    const timer = setTimeout(() => { ready = true; }, 60);
    await waitForApplication(address, { timeoutMs: 1000, pollMs: 10 }); clearTimeout(timer);
    await assert.rejects(waitForApplication(address, { stopped: () => true }), /stopped before it was ready/);
    ready = false;
    await assert.rejects(waitForApplication(address, { timeoutMs: 60, pollMs: 10 }), /did not become ready/);
  } finally { await close(server); }
});
test('launcher rejects non-JSON and oversized responses', async () => {
  let body = '<html>Another app</html>';
  const server = createServer((req, res) => res.end(body));
  const address = await listen(server);
  try {
    assert.equal(await probeApplication(address), 'occupied');
    body = 'x'.repeat(3000); assert.equal(await probeApplication(address), 'occupied');
  } finally { await close(server); }
});
test('Windows desktop shortcut targets the project launcher and handles folder spaces', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'Hadir desktop '));
  const project = join(directory, 'Project with spaces & links'), desktop = join(directory, 'Desktop folder');
  try {
    await mkdir(project, { recursive: true });
    await writeFile(join(project, 'create-desktop-shortcut.cmd'), await readFile('create-desktop-shortcut.cmd'));
    await writeFile(join(project, 'start-windows.cmd'), '@echo off\r\nexit /b 0\r\n');
    await run('cmd.exe', ['/d', '/s', '/c', 'create-desktop-shortcut.cmd --quiet'], { cwd: project, env: { ...process.env, HADIR_SHORTCUT_DIRECTORY: desktop }, timeout: 15000 });
    const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut((Join-Path $env:HADIR_SHORTCUT_DIRECTORY 'Hadir Attendance.lnk')); @{target=$link.TargetPath;directory=$link.WorkingDirectory}|ConvertTo-Json -Compress"], { env: { ...process.env, HADIR_SHORTCUT_DIRECTORY: desktop }, timeout: 15000 });
    const shortcut = JSON.parse(result.stdout.trim());
    // Windows can expand a short TEMP path (RUNNER~1) when saving a shortcut.
    assert.equal((await realpath(shortcut.target)).toLowerCase(), (await realpath(join(project, 'start-windows.cmd'))).toLowerCase());
    assert.equal((await realpath(shortcut.directory)).toLowerCase(), (await realpath(project)).toLowerCase());
    const forwarder = await readFile('Hadir-Attendance.url', 'utf8'); assert.match(forwarder, /^\[InternetShortcut\]\r?\nURL=http:\/\/127\.0\.0\.1:3000\//);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
