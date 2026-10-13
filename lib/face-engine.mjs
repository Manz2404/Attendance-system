import { createRequire } from 'node:module';
import { readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { faceKey, validDescriptor } from './face-policy.mjs';

const require = createRequire(import.meta.url);
const models = ['tiny_face_detector', 'face_landmark_68_tiny', 'face_recognition'];
let enginePromise, queued = 0, tail = Promise.resolve();
export class FaceInputError extends Error {}
export async function faceAvailable() {
  try {
    faceKey();
    const directory = dirname(require.resolve('@vladmandic/face-api/package.json'));
    for (const name of models) { await access(join(directory, 'model', `${name}_model-weights_manifest.json`)); await access(join(directory, 'model', `${name}_model.bin`)); }
    require.resolve('jpeg-js');
    require.resolve('@tensorflow/tfjs');
    require.resolve('@tensorflow/tfjs-backend-wasm');
    await access(join(directory, 'dist', 'face-api.node-wasm.js'));
    return true;
  } catch { return false; }
}
async function engine() {
  if (!enginePromise) enginePromise = (async () => {
    const directory = dirname(require.resolve('@vladmandic/face-api/package.json'));
    // The Node WASM distribution uses ordinary tfjs (no native TensorFlow addon).
    // Select its pure-JS CPU backend; WASM is registered by this distribution but is not required to scan.
    const api = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    await api.tf.setBackend('cpu'); await api.tf.ready();
    const nets = [api.nets.tinyFaceDetector, api.nets.faceLandmark68TinyNet, api.nets.faceRecognitionNet];
    for (let i = 0; i < models.length; i++) {
      const manifest = JSON.parse(await readFile(join(directory, 'model', `${models[i]}_model-weights_manifest.json`), 'utf8'));
      const weights = {};
      for (const group of manifest) {
        const buffers = [];
        for (const file of group.paths) {
          if (typeof file !== 'string' || !/^[a-z0-9_.-]+\.bin$/i.test(file)) throw new Error('Invalid face model manifest.');
          buffers.push(await readFile(join(directory, 'model', file)));
        }
        const bytes = Buffer.concat(buffers);
        Object.assign(weights, api.tf.io.decodeWeights(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), group.weights));
      }
      nets[i].loadFromWeightMap(weights);
    }
    return api;
  })().catch(error => { enginePromise = undefined; throw error; });
  return enginePromise;
}
export function imageBytes(image) {
  if (typeof image !== 'string' || image.length > 220000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)) throw new FaceInputError('Use a camera JPEG frame smaller than 160 KB.');
  const bytes = Buffer.from(image.slice('data:image/jpeg;base64,'.length), 'base64');
  if (bytes.length < 100 || bytes.length > 160000 || bytes[0] !== 255 || bytes[1] !== 216) throw new FaceInputError('Invalid camera image. Please scan again.');
  return bytes;
}
async function describe(bytes) {
  const jpeg = require('jpeg-js');
  let decoded;
  try { decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 0.4, maxMemoryUsageInMB: 32, tolerantDecoding: false }); }
  catch { throw new FaceInputError('Invalid or oversized camera image. Please scan again.'); }
  if (decoded.width < 160 || decoded.height < 120 || decoded.width > 640 || decoded.height > 480) throw new FaceInputError('Use a camera frame between 160×120 and 640×480 pixels.');
  const api = await engine();
  const rgb = new Int32Array(decoded.width * decoded.height * 3);
  for (let p = 0; p < decoded.width * decoded.height; p++) for (let c = 0; c < 3; c++) rgb[p * 3 + c] = decoded.data[p * 4 + c];
  const tensor = api.tf.tensor3d(rgb, [decoded.height, decoded.width, 3], 'int32');
  try {
    const faces = await api.detectAllFaces(tensor, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.6 })).withFaceLandmarks(true).withFaceDescriptors();
    if (faces.length !== 1) throw new FaceInputError(faces.length ? 'Only one person should be in the camera frame.' : 'No clear face detected. Face the camera and improve the lighting.');
    const face = faces[0], box = face.detection.box;
    if (box.width < 55 || box.height < 55) throw new FaceInputError('Move closer to the camera.');
    const descriptor = Array.from(face.descriptor);
    if (!validDescriptor(descriptor)) throw new FaceInputError('Could not read your face. Please scan again.');
    const points = face.landmarks.positions, width = Math.abs(points[45].x - points[36].x);
    if (width < 12) throw new FaceInputError('Face the camera more directly.');
    const pose = (points[30].x - (points[36].x + points[45].x) / 2) / width;
    return { descriptor, pose };
  } finally { tensor.dispose(); }
}
export async function scanFrames(images) {
  if (!Array.isArray(images) || images.length !== 3) throw new FaceInputError('Capture three camera frames.');
  const bytes = images.map(imageBytes);
  if (queued >= 4) throw new FaceInputError('The face scanner is busy. Wait a moment or use your PIN.');
  queued++;
  const previous = tail; let release;
  tail = new Promise(resolve => { release = resolve; });
  await previous;
  try { const results = []; for (const image of bytes) results.push(await describe(image)); return results; }
  finally { queued--; release(); }
}
