import { and, eq, desc, lt, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
 const user = await getCurrentUser();
 if (!user) return json({ error: 'Please sign in.' }, 401);
 const access = await workspaceAccess(user);
 if (access?.role !== 'admin') return json({ error: 'Administrator access required.' }, 403);
 const cursor = new URL(request.url).searchParams.get('cursor');
 let before;
 if (cursor) {
  const [time, id] = cursor.split('|');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time) || !/^[a-f0-9-]{36}$/.test(id ?? '')) return json({ error: 'Invalid cursor.' }, 400);
  before = or(lt(auditLogs.createdAt, time), and(eq(auditLogs.createdAt, time), lt(auditLogs.id, id)));
 }
 const rows = await getDb().select().from(auditLogs).where(and(eq(auditLogs.ownerId, access.ownerId), before)).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(51);
 const entries = rows.slice(0, 50), last = entries.at(-1);
 return json({ entries, nextCursor: rows.length > 50 && last ? last.createdAt + '|' + last.id : null });
}
