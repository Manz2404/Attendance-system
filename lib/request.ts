export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // Browser writes must be same origin. Non-browser tools need a session token.
  return !origin || origin === new URL(request.url).origin;
}
export async function readJSON(request: Request, limit = 300000): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new RequestError('Send a JSON request.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('Invalid request.', 400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new RequestError('The request is too large. Use at most 1,000 rows.', 413); }
    chunks.push(next.value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RequestError('Invalid JSON request.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('Invalid request.', 400);
  return body as Record<string, unknown>;
}
export class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
