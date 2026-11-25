// Log diagnostic codes only: database messages can include SQL and personal data.
export function logServerError(operation: string, error: unknown) {
  const value = error && typeof error === 'object' ? error as { name?: unknown; code?: unknown } : {};
  const safe = (input: unknown) => typeof input === 'string' && /^[A-Za-z0-9_]+$/.test(input) ? input.slice(0,80) : 'Unknown';
  console.error(`[${operation}]`, { type: safe(value.name), code: safe(value.code) });
}
