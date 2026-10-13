import { get } from 'node:http';

export function localApplicationURL(port) {
  const value = Number(port);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('PORT in .env must be 1–65535.');
  return `http://127.0.0.1:${value}/`;
}

export function bindHost(value = '127.0.0.1') {
  if (value !== '127.0.0.1' && value !== '0.0.0.0') throw new Error('HADIR_BIND_HOST in .env must be 127.0.0.1 or 0.0.0.0.');
  return value;
}

export function probeApplication(address, timeoutMs = 1200) {
  return new Promise(resolve => {
    const req = get(new URL('/api/launcher-status', address), { agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 2048) { resolve('occupied'); response.destroy(); }
      });
      response.on('error', () => resolve('occupied'));
      response.on('end', () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body).application === 'hadir-attendance' ? 'ready' : 'occupied'); }
        catch { resolve('occupied'); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('The server did not respond.')));
    req.on('error', error => resolve(error.code === 'ECONNREFUSED' ? 'stopped' : 'occupied'));
  });
}

export async function waitForApplication(address, { timeoutMs = 60000, pollMs = 250, stopped = () => false } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (stopped()) throw new Error('The attendance server stopped before it was ready. Review the message above.');
    if (await probeApplication(address, Math.min(1200, timeoutMs)) === 'ready') return;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  throw new Error('The attendance server did not become ready. Check the messages above and run setup-windows.cmd if needed.');
}
