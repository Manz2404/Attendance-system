import jpeg from 'jpeg-js';

// Store only small decoded and re-encoded JPEGs, never arbitrary URLs or SVG.
export function normalizeProfilePhoto(value) {
  if (value === '' || value === null) return null;
  if (typeof value !== 'string' || value.length > 60000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Choose a valid profile photo.');
  }
  try {
    const decoded = jpeg.decode(Buffer.from(value.split(',')[1], 'base64'), {
      useTArray: true, maxResolutionInMP: 0.1, maxMemoryUsageInMB: 16,
    });
    if (decoded.width !== 160 || decoded.height !== 160) throw new Error('Invalid size');
    return 'data:image/jpeg;base64,' + jpeg.encode(decoded, 80).data.toString('base64');
  } catch {
    throw new Error('The profile photo could not be read. Please choose another image.');
  }
}
