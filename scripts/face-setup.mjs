import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { faceKey } from '../lib/face-policy.mjs';
import { faceAvailable } from '../lib/face-engine.mjs';

export async function setupFaces() {
  if (!process.env.FACE_ENCRYPTION_KEY) {
    const key = randomBytes(32).toString('hex');
    appendFileSync('.env', `\n# Keep this key with your database backup; changing it requires face re-enrollment.\nFACE_ENCRYPTION_KEY=${key}\n`, { mode: 0o600 });
    process.env.FACE_ENCRYPTION_KEY = key;
    console.log('Created private face-template encryption key in .env.');
  }
  faceKey();
  if (!await faceAvailable()) throw new Error('Face recognition models are missing. Run npm install, then setup again.');
  console.log('Local face-recognition models are ready.');
}
