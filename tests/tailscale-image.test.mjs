// Run inside Dockerfile.render-laptop's image, not the ordinary npm test suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const exec = promisify(execFile);
test('pinned Tailscale binaries run as non-root without a TUN device', { timeout: 20000 }, async () => {
  assert.notEqual(process.getuid(), 0);
  const version = await exec('tailscale', ['version']); assert.match(version.stdout, /^1\.104\.1\b/);
  const help = await exec('tailscale', ['nc', '--help']); assert.match(help.stdout + help.stderr, /tailscale nc <hostname-or-IP> <port>/);
  const directory = await mkdtemp(join(tmpdir(), 'hadir-image-test-'));
  const socket = join(directory, 'tailscaled.sock');
  const daemon = spawn('tailscaled', ['--tun=userspace-networking', '--state=mem:', `--socket=${socket}`], { stdio: ['ignore', 'ignore', 'pipe'] });
  let diagnostics = '';
  daemon.stderr.on('data', data => { diagnostics = (diagnostics + data).slice(-16000); });
  let failure;
  daemon.on('error', error => { failure = error; });
  try {
    let status;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (failure) throw failure;
      assert.equal(daemon.exitCode, null, `userspace daemon must keep running: ${diagnostics}`);
      try { const result = await exec('tailscale', [`--socket=${socket}`, 'status', '--json'], { timeout: 1000 }); status = JSON.parse(result.stdout); }
      catch (error) { try { status = JSON.parse(error.stdout); } catch {} }
      if (status?.BackendState) break;
      await delay(200);
    }
    assert.equal(status?.BackendState, 'NeedsLogin', diagnostics);
  } finally {
    if (daemon.exitCode === null && !daemon.signalCode) {
      const closed = once(daemon, 'close'); daemon.kill('SIGTERM'); await closed;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
