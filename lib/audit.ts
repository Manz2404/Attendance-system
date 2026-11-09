import { eq } from 'drizzle-orm';
import type { Connection } from '@/db';
import { auditLogs, users } from '@/db/schema';
// Call inside the same transaction as the change: both commit or both roll back.
// Only explicit summaries are accepted. Never pass request bodies or credentials.
export async function writeAudit(db: Connection, ownerId: string, actorId: string, action: string, target: string, details: string) {
 const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, actorId)).limit(1);
 await db.insert(auditLogs).values({ id: crypto.randomUUID(), ownerId, actorId, actorName: actor?.name ?? 'Administrator',
 action: action.slice(0, 60), target: target.slice(0, 120), details: details.slice(0, 2000), createdAt: new Date().toISOString() });
}
