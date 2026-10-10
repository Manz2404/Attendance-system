import { cookies } from 'next/headers';
import { and, eq, gt, lt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { getDb } from '@/db';
import { users, sessions } from '@/db/schema';
import { hashToken } from './password.mjs';

const cookieName = 'hadir_session';
export async function getCurrentUser() {
  const cookie = (await cookies()).get(cookieName)?.value;
  if (!cookie || !/^[a-f0-9]{64}$/.test(cookie)) return null;
  const [row] = await getDb().select({ userId: users.id, username: users.username, fullName: users.name })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(cookie)), gt(sessions.expiresAt, new Date().toISOString()))).limit(1);
  return row ?? null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex'), now = new Date();
  const expires = new Date(now.getTime() + 8 * 3600000);
  const db = getDb();
  await db.transaction(async tx => {
    await tx.delete(sessions).where(lt(sessions.expiresAt, now.toISOString()));
    await tx.insert(sessions).values({ tokenHash: hashToken(token), userId, createdAt: now.toISOString(), expiresAt: expires.toISOString() });
  });
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', expires });
}
export async function destroySession() {
  const jar = await cookies(), token = jar.get(cookieName)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(cookieName);
}
