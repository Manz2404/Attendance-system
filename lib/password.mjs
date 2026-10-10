import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function validUsername(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9._@-]{2,79}$/.test(value); }
export function validPassword(value) { return typeof value === 'string' && value.length >= 12 && value.length <= 256; }
export async function hashPassword(password) {
  if (!validPassword(password)) throw new Error('Use a password with 12–256 characters.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, parameters);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const parts = typeof encoded === 'string' ? encoded.split('$') : [];
  const valid = parts.length === 3 && parts[0] === 'scrypt-v1' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  const salt = valid ? parts[1] : '00000000000000000000000000000000';
  const expected = valid ? Buffer.from(parts[2], 'hex') : Buffer.alloc(64);
  const actual = await scrypt(password, salt, 64, parameters);
  return timingSafeEqual(actual, expected) && valid;
}
export function hashToken(value) { return createHash('sha256').update(value).digest('hex'); }
