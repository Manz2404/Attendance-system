import { timingSafeEqual } from 'node:crypto';
import { hashToken, validPassword, validUsername } from './password.mjs';

export class AccountInputError extends Error {}

export function accountDetails(body) {
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!validUsername(username)) throw new AccountInputError('Use a username with 3–80 letters, numbers, dots, underscores, @ or hyphens.');
  if (!name || name.length > 120) throw new AccountInputError('Enter a display name with 1–120 characters.');
  if (!validPassword(body.password)) throw new AccountInputError('Use a password with 12–256 characters.');
  if (body.password !== body.confirmPassword) throw new AccountInputError('The new passwords do not match.');
  return { username, name, password: body.password };
}

export function accountCreationEnabled(key = process.env.ACCOUNT_CREATION_KEY) {
  return typeof key === 'string' && /^[a-z0-9_-]{32,256}$/i.test(key);
}

export function validCreationKey(candidate, configured = process.env.ACCOUNT_CREATION_KEY) {
  if (!accountCreationEnabled(configured) || typeof candidate !== 'string' || candidate.length > 256) return false;
  return timingSafeEqual(Buffer.from(hashToken(candidate), 'hex'), Buffer.from(hashToken(configured), 'hex'));
}
