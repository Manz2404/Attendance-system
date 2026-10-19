import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { loginAttempts, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { accountDetails, AccountInputError, accountCreationEnabled, validCreationKey } from '@/lib/account-creation.mjs';
import { databaseErrorCode, databaseFailure } from '@/lib/database-error.mjs';
import { hashToken, verifyPassword } from '@/lib/password.mjs';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';
import { createAdmin } from '@/scripts/admin.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  try {
    const body = await readJSON(request, 4096);
    const account = accountDetails(body);
    const creator = await getCurrentUser();
    if (creator) {
      if (typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > 256) {
        return json({ error: 'Enter your current administrator password to add a user.' }, 400);
      }
      // Re-authenticate the administrator without changing their existing session.
      // The failure limit is separate from normal sign-in and persists in MySQL.
      const db = getDb(), key = hashToken(`create-account|${creator.userId}`), now = new Date().toISOString();
      const outcome = await db.transaction(async tx => {
        await tx.insert(loginAttempts).values({ key, failures: 0, windowStart: now }).onDuplicateKeyUpdate({ set: { key } });
        const [attempt] = await tx.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1).for('update');
        const recent = Date.parse(now) - Date.parse(attempt.windowStart) < 15 * 60000;
        if (recent && attempt.failures >= 5) return 'limited';
        const [user] = await tx.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, creator.userId)).limit(1);
        const correct = await verifyPassword(body.currentPassword, user?.passwordHash ?? '');
        await tx.update(loginAttempts).set({ failures: correct ? 0 : (recent ? attempt.failures : 0) + 1, windowStart: recent && !correct ? attempt.windowStart : now }).where(eq(loginAttempts.key, key));
        return correct ? 'allowed' : 'denied';
      });
      if (outcome === 'limited') return json({ error: 'Too many failed password checks. Try adding a user again in 15 minutes.' }, 429);
      if (outcome !== 'allowed') return json({ error: 'Your current administrator password is incorrect.' }, 401);
    } else {
      if (!accountCreationEnabled()) return json({ error: 'Account creation requires an administrator. Sign in to add a user, or ask your administrator for an account creation code.' }, 403);
      if (!validCreationKey(body.creationKey)) return json({ error: 'The account creation code is incorrect.' }, 403);
    }

    const connection = await getDb().$client.getConnection();
    try { await createAdmin(connection, account); }
    finally { connection.release(); }
    // Do not sign into the new account or replace the creator's session.
    return json({ message: 'Account created. The new user can now sign in.', username: account.username }, 201);
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof AccountInputError) return json({ error: error.message }, 400);
    if (databaseErrorCode(error) === 'ER_DUP_ENTRY' || error instanceof Error && error.message.startsWith('This username already exists.')) {
      return json({ error: 'That username is already in use. Choose another username.' }, 409);
    }
    console.error('Account creation failed:', databaseErrorCode(error));
    return json(databaseFailure(error), 503);
  }
}
