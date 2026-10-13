import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { kioskSessions } from '@/db/schema';
import { hashToken } from '@/lib/password.mjs';

export const kioskCookie = 'hadir_kiosk';
export async function getKioskSession() {
  const token = (await cookies()).get(kioskCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [session] = await getDb().select({ tokenHash: kioskSessions.tokenHash, ownerId: kioskSessions.ownerId })
    .from(kioskSessions).where(and(eq(kioskSessions.tokenHash, hashToken(token)), gt(kioskSessions.expiresAt, new Date().toISOString()))).limit(1);
  return session ?? null;
}
