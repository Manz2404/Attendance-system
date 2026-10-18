import { bindHost, localApplicationURL } from './launcher.mjs';

export function serverOptions(environment, command = 'start') {
  const port = Number(environment.PORT || 3000);
  localApplicationURL(port);
  const cloud = command === 'cloud';
  if (cloud && !/^[a-f0-9]{64}$/i.test(environment.FACE_ENCRYPTION_KEY || '')) {
    throw new Error('Set FACE_ENCRYPTION_KEY to a private 64-character hexadecimal key before cloud startup. When moving existing face enrollments, use the same key from your current .env.');
  }
  return {
    cloud,
    port,
    mode: command === 'dev' ? 'dev' : 'start',
    host: bindHost(cloud ? '0.0.0.0' : environment.HADIR_BIND_HOST || '127.0.0.1'),
    env: cloud ? { ...environment, NODE_ENV: 'production', COOKIE_SECURE: 'true' } : { ...environment },
  };
}
