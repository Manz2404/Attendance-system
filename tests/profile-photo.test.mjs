import test from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import { normalizeProfilePhoto } from '../lib/profile-photo.mjs';
const photo = (width, height) => 'data:image/jpeg;base64,' + jpeg.encode({width,height,data:Buffer.alloc(width*height*4,255)},80).data.toString('base64');
test('profile photos round trip as small JPEGs; removal is explicit', () => {
  const saved = normalizeProfilePhoto(photo(160,160));
  const decoded = jpeg.decode(Buffer.from(saved.split(',')[1], 'base64'));
  assert.equal(decoded.width,160); assert.equal(decoded.height,160);
  assert.equal(normalizeProfilePhoto(''),null); assert.equal(normalizeProfilePhoto(null),null);
});
test('reject URLs, SVG, malformed, oversized and wrong-sized photos', () => {
  for(const input of [undefined, 1, 'https://example.com/a.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,YWJj', 'x'.repeat(60001), photo(161,160)]) {
    assert.throws(() => normalizeProfilePhoto(input));
  }
});
