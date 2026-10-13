import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_MODEL, faceKey, sealFace, openFace, validDescriptor, faceDistance, matchesFace, consistentFaces, motionPassed } from '../lib/face-policy.mjs';
import { imageBytes, FaceInputError } from '../lib/face-engine.mjs';

const base = Array(128).fill(0.1), samples = [base, base.map(n => n + 0.002), base.map(n => n - 0.002)];
test('face templates are authenticated, randomized and bound to employee and workspace', () => {
  const key = faceKey('1'.repeat(64)), a = sealFace(samples, 'owner', 'employee', key), b = sealFace(samples, 'owner', 'employee', key);
  assert.notEqual(a, b); assert.ok(!a.includes(JSON.stringify(base)));
  assert.deepEqual(openFace(a, 'owner', 'employee', key), samples);
  assert.throws(() => openFace(a, 'another-owner', 'employee', key));
  assert.throws(() => openFace(a, 'owner', 'another-employee', key));
  assert.throws(() => openFace(a, 'owner', 'employee', faceKey('2'.repeat(64))));
  const parts = a.split('.'); parts[2] = Buffer.alloc(16).toString('base64');
  assert.throws(() => openFace(parts.join('.'), 'owner', 'employee', key));
});
test('face matching rejects a different person, malformed vectors and inconsistent enrollment', () => {
  assert.equal(validDescriptor(base), true); assert.equal(validDescriptor(Array(128).fill(0)), false);
  assert.equal(validDescriptor(base.slice(1)), false); assert.equal(validDescriptor([...base.slice(1), NaN]), false);
  assert.equal(faceDistance(base, base), 0); assert.equal(faceDistance(base, []), Infinity);
  assert.equal(matchesFace(samples, samples), true);
  assert.equal(matchesFace([Array(128).fill(0.3), base, base], samples), false);
  assert.equal(consistentFaces([base, Array(128).fill(0.3), base]), false);
  assert.equal(matchesFace([base], samples), false);
  assert.equal(FACE_MODEL, 'face-api-1.7.15-tiny-128');
});
test('motion check requires a head turn and a return to the starting pose', () => {
  assert.equal(motionPassed([0, 0.09, 0.02]), true); assert.equal(motionPassed([0, -0.09, -0.02]), true);
  for (const poses of [[0,0,0], [0,0.03,0.01], [0,0.1,0.2], [0,Infinity,0], [0,0.1]]) assert.equal(motionPassed(poses), false);
});
test('camera payload validation rejects oversized or non-JPEG data before inference', () => {
  const jpeg = Buffer.alloc(150); jpeg[0] = 255; jpeg[1] = 216;
  assert.equal(imageBytes('data:image/jpeg;base64,'+jpeg.toString('base64')).length, 150);
  for (const value of ['', 'data:image/png;base64,AAAA', 'data:image/jpeg;base64,not-valid!', 'data:image/jpeg;base64,'+Buffer.alloc(160001).toString('base64'), 123]) assert.throws(() => imageBytes(value), FaceInputError);
  assert.throws(() => faceKey('missing')); assert.throws(() => faceKey('x'.repeat(64)));
});
