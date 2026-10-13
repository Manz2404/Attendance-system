import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const FACE_MODEL = 'face-api-1.7.15-tiny-128';
export const FACE_DISTANCE = 0.5;
export function faceChallengeHash(token, kind) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !['IN', 'OUT'].includes(kind)) throw new Error('Invalid face challenge.');
  return createHash('sha256').update(`face-kiosk|${kind}|${token}`).digest('hex');
}
export function validDescriptor(value) {
  return Array.isArray(value) && value.length === 128 && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 2)
    && value.reduce((s, n) => s + n * n, 0) > 0.01;
}
export function faceDistance(a, b) {
  if (!validDescriptor(a) || !validDescriptor(b)) return Infinity;
  return Math.sqrt(a.reduce((s, n, i) => s + (n - b[i]) ** 2, 0));
}
export function matchesFace(samples, enrolled) {
  return Array.isArray(samples) && samples.length === 3 && Array.isArray(enrolled) && enrolled.length === 3
    && samples.every(sample => enrolled.some(reference => faceDistance(sample, reference) <= FACE_DISTANCE));
}
export function consistentFaces(samples) {
  return Array.isArray(samples) && samples.length === 3 && samples.every(validDescriptor)
    && samples.every(sample => faceDistance(samples[0], sample) <= FACE_DISTANCE);
}
export function motionPassed(poses) {
  return Array.isArray(poses) && poses.length === 3 && poses.every(p => typeof p === 'number' && Number.isFinite(p))
    && Math.abs(poses[1] - poses[0]) >= 0.06 && Math.abs(poses[2] - poses[0]) <= 0.055;
}
export function faceKey(value = process.env.FACE_ENCRYPTION_KEY) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('Run setup-windows.cmd to configure the face-enrollment encryption key.');
  return Buffer.from(value, 'hex');
}
export function sealFace(samples, ownerId, employeeId, key = faceKey()) {
  if (!consistentFaces(samples)) throw new Error('All three enrollment images must show the same person.');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${FACE_MODEL}|${ownerId}|${employeeId}`));
  const data = Buffer.concat([cipher.update(JSON.stringify(samples), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`;
}
export function openFace(encoded, ownerId, employeeId, key = faceKey()) {
  const parts = typeof encoded === 'string' ? encoded.split('.') : [];
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Invalid face template. Enroll this employee again.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
  decipher.setAAD(Buffer.from(`${FACE_MODEL}|${ownerId}|${employeeId}`));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
  const samples = JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8'));
  if (!consistentFaces(samples)) throw new Error('Invalid face template. Enroll this employee again.');
  return samples;
}
