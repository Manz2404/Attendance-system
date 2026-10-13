import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { workspaces, employees, employeePins, sessions, kioskSessions } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { hashToken } from '@/lib/password.mjs';
import { kioskCookie } from '@/lib/kiosk-session';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'An administrator must sign in first.' }, 401);
    const body = await readJSON(request, 4096);
    if (body.action !== 'start' && body.action !== 'revoke') return json({ error: 'Choose a valid kiosk action.' }, 400);
    const jar = await cookies(), now = new Date(), createdAt = now.toISOString();
    const token = randomBytes(32).toString('hex'), expires = new Date(now.getTime() + 30 * 86400000);
    const outcome = await getDb().transaction(async db => {
      const [ws] = await db.select().from(workspaces).where(eq(workspaces.ownerId, user.userId)).limit(1).for('update');
      if (!ws) return 'missing';
      if (body.action === 'revoke') {
        await db.delete(kioskSessions).where(eq(kioskSessions.ownerId, user.userId));
        return 'revoked';
      }
      const [ready] = await db.select({ id: employees.id }).from(employees).innerJoin(employeePins, eq(employeePins.employeeId, employees.id))
        .where(and(eq(employees.ownerId, user.userId), eq(employeePins.ownerId, user.userId), eq(employees.active, true))).limit(1);
      if (!ready) return 'no-pins';
      await db.delete(kioskSessions).where(lt(kioskSessions.expiresAt, createdAt));
      const old = jar.get(kioskCookie)?.value;
      if (old) await db.delete(kioskSessions).where(and(eq(kioskSessions.ownerId, user.userId), eq(kioskSessions.tokenHash, hashToken(old))));
      await db.insert(kioskSessions).values({ tokenHash: hashToken(token), ownerId: user.userId, createdAt, expiresAt: expires.toISOString() });
      const adminToken = jar.get('hadir_session')?.value;
      if (adminToken) await db.delete(sessions).where(and(eq(sessions.userId, user.userId), eq(sessions.tokenHash, hashToken(adminToken))));
      return 'started';
    });
    if (outcome === 'missing') return json({ error: 'Initialize your workspace first.' }, 400);
    if (outcome === 'no-pins') return json({ error: 'Set a PIN for at least one active employee first.' }, 400);
    if (outcome === 'revoked') return json({ message: 'All kiosk browsers have been disconnected.' });
    jar.set(kioskCookie, token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', path: '/', expires });
    jar.delete('hadir_session');
    return json({ message: 'Kiosk started. Administrator signed out.', path: '/kiosk' });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    console.error('Kiosk setup failed', error instanceof Error ? error.name : 'server error');
    return json({ error: 'Could not set up the kiosk. Check the database and run setup-windows.cmd.' }, 500);
  }
}
