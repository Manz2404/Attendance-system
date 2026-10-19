import { createServer, isIPv4 } from 'node:net';

export const RELAY_PORT = 3307;
export const LAPTOP_PORT = 13306;

export function tunnelOptions(env) {
  const host = env.LAPTOP_TAILSCALE_IP || '';
  const parts = host.split('.').map(Number);
  if (!isIPv4(host) || parts[0] !== 100 || parts[1] < 64 || parts[1] > 127) {
    throw new Error('Set LAPTOP_TAILSCALE_IP to your laptop\'s Tailscale IPv4 address (100.64.0.0–100.127.255.255).');
  }
  const port = Number(env.LAPTOP_TAILSCALE_PORT || LAPTOP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('LAPTOP_TAILSCALE_PORT must be a valid port number.');
  return { host, port };
}

// Userspace Tailscale does not add an OS network interface. Each local MySQL
// connection needs its own `tailscale nc` stream through tailscaled's socket.
export async function startDatabaseRelay({ dial, port = RELAY_PORT, maxConnections = 32 }) {
  const connections = new Set();
  let closing = false;
  const server = createServer(socket => {
    socket.on('error', () => {});
    if (closing || connections.size >= maxConnections) { socket.destroy(); return; }
    let child;
    try { child = dial(); } catch { socket.destroy(); return; }
    const connection = { socket, child };
    connections.add(connection);
    const dispose = () => {
      if (!connections.delete(connection)) return;
      socket.destroy();
      child.stdin.destroy();
      child.stdout.destroy();
      child.kill('SIGTERM');
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 1000);
      timer.unref();
      child.once('close', () => clearTimeout(timer));
    };
    child.on('error', dispose);
    child.on('close', dispose);
    child.stdin.on('error', dispose);
    child.stdout.on('error', dispose);
    socket.once('close', dispose);
    socket.setNoDelay(true);
    socket.pipe(child.stdin);
    child.stdout.pipe(socket);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  return {
    port: server.address().port,
    close: async () => {
      closing = true;
      const done = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      for (const { socket } of connections) socket.destroy();
      await done;
    },
  };
}
