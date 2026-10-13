import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  serverExternalPackages: ['mysql2', '@vladmandic/face-api', '@tensorflow/tfjs', '@tensorflow/tfjs-backend-wasm', 'jpeg-js'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
    ] }];
  },
};
export default nextConfig;
