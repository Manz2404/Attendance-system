import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, loginAttempts } from '@/db/schema';
import { createSession } from '@/lib/auth';
import { hashToken, validUsername, verifyPassword } from '@/lib/password.mjs';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  try {
    const body = await readJSON(request, 4096);
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = body.password;
    if (!validUsername(username) || typeof password !== 'string' || !password || password.length > 256) return json({ error: 'Enter a valid username and password.' }, 400);
    const db = getDb(), key = hashToken(username), now = new Date().toISOString();
    const outcome = await db.transaction(async tx => {
      await tx.insert(loginAttempts).values({ key, failures: 0, windowStart: now }).onDuplicateKeyUpdate({ set: { key } });
      const [attempt] = await tx.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1).for('update');
      const recent = Date.parse(now) - Date.parse(attempt.windowStart) < 15 * 60000;
      if (recent && attempt.failures >= 5) return { limited: true, userId: null };
      const [user] = await tx.select().from(users).where(eq(users.username, username)).limit(1);
      const correct = await verifyPassword(password, user?.passwordHash ?? '');
      await tx.update(loginAttempts).set({ failures: correct ? 0 : (recent ? attempt.failures : 0) + 1, windowStart: recent && !correct ? attempt.windowStart : now }).where(eq(loginAttempts.key, key));
      return { limited: false, userId: correct && user ? user.id : null };
    });
    if (outcome.limited) return json({ error: 'Too many failed attempts. Try again in 15 minutes.' }, 429);
    if (!outcome.userId) return json({ error: 'Incorrect username or password.' }, 401);
    await createSession(outcome.userId);
    return json({ message: 'Signed in.' });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    console.error('Sign-in failed:', error instanceof Error && 'code' in error ? error.code : 'server error');
    return json({ error: 'Could not sign in. Check your database connection and run setup-windows.cmd.' }, 500);
  }
}
