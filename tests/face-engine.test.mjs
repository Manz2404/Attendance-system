import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { faceAvailable, scanFrames, FaceInputError } from '../lib/face-engine.mjs';

test('local model files and the CPU detector run on an actual JPEG', async () => {
  const before = process.env.FACE_ENCRYPTION_KEY;
  process.env.FACE_ENCRYPTION_KEY = '1'.repeat(64);
  try {
    assert.equal(await faceAvailable(), true);
    const require = createRequire(import.meta.url), jpeg = require('jpeg-js');
    const rgba = Buffer.alloc(400*300*4, 255);
    const frame = 'data:image/jpeg;base64,'+jpeg.encode({width:400,height:300,data:rgba},80).data.toString('base64');
    await assert.rejects(scanFrames([frame,frame,frame]), error => error instanceof FaceInputError && /No clear face/.test(error.message));
  } finally { if (before === undefined) delete process.env.FACE_ENCRYPTION_KEY; else process.env.FACE_ENCRYPTION_KEY = before; }
});
