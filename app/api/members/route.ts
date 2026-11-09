import { writeAudit } from '@/lib/audit';
import { and, eq, asc } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, sessions, employees, workspaces, workspaceMembers } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import { hashPassword, validPassword, validUsername } from '@/lib/password.mjs';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';
import { databaseErrorCode } from '@/lib/database-error.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
 const user = await getCurrentUser();
 if (!user) return json({ error: 'Please sign in.' }, 401);
 const access = await workspaceAccess(user);
 if (access?.role !== 'admin') return json({ error: 'Administrator access required.' }, 403);
 const db = getDb();
 const members = await db.select({ userId: users.id, username: users.username, name: users.name, role: workspaceMembers.role, active: workspaceMembers.active, employeeId: workspaceMembers.employeeId })
   .from(workspaceMembers).innerJoin(users, eq(users.id, workspaceMembers.userId)).where(eq(workspaceMembers.ownerId, access.ownerId)).orderBy(asc(users.name));
 const [owner] = await db.select({ userId: users.id, username: users.username, name: users.name }).from(users).where(eq(users.id, access.ownerId)).limit(1);
 const staff = await db.select({ id: employees.id, name: employees.name, code: employees.code, active: employees.active }).from(employees).where(eq(employees.ownerId, access.ownerId)).orderBy(asc(employees.name));
 return json({ currentUserId: user.userId, members: [...(owner ? [{ ...owner, role: 'admin', active: true, employeeId: null, isOwner: true }] : []), ...members.map(m => ({ ...m, isOwner: false }))], employees: staff });
}
export async function POST(request: Request) {
 if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
 const user = await getCurrentUser();
 if (!user) return json({ error: 'Please sign in.' }, 401);
 try {
  const access = await workspaceAccess(user);
  if (access?.role !== 'admin') return json({ error: 'Administrator access required.' }, 403);
  const body = await readJSON(request, 4096);
  if (body.action !== 'create' && body.action !== 'update') return json({ error: 'Invalid action.' }, 400);
  if (body.role !== 'admin' && body.role !== 'hr' && body.role !== 'staff') return json({ error: 'Choose Admin, HR or Staff.' }, 400);
  const role = body.role;
  if (typeof body.active !== 'boolean') return json({ error: 'Choose an account status.' }, 400);
  const employeeId = role === 'staff' && typeof body.employeeId === 'string' ? body.employeeId : null;
  if (role === 'staff' && !employeeId) return json({ error: 'Link staff access to an employee.' }, 400);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) return json({ error: 'Enter a name of up to 120 characters.' }, 400);
  if (body.action === 'create' && !validUsername(username)) return json({ error: 'Use a username of 3–80 lowercase letters, numbers, dots, underscores, @ or hyphens.' }, 400);
  const changingPassword = body.action === 'create' || body.password !== undefined && body.password !== '';
  if (changingPassword && !validPassword(body.password)) return json({ error: 'Use a password with 12–256 characters.' }, 400);
  const passwordHash = changingPassword ? await hashPassword(body.password) : undefined;
  return await getDb().transaction(async db => {
   const [ws] = await db.select().from(workspaces).where(eq(workspaces.ownerId, access.ownerId)).limit(1).for('update');
   if (!ws) return json({ error: 'Open the dashboard once to initialize the workspace.' }, 400);
   const current = await workspaceAccess(user, db);
   if (current?.role !== 'admin' || current.ownerId !== access.ownerId) return json({ error: 'Administrator access required.' }, 403);
   if (employeeId) {
    const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.ownerId, access.ownerId), eq(employees.id, employeeId))).limit(1);
    if (!employee) return json({ error: 'Choose an employee in this workspace.' }, 400);
   }
   if (body.action === 'create') {
    const userId = crypto.randomUUID(), createdAt = new Date().toISOString();
    await db.insert(users).values({ id: userId, username, name, passwordHash: passwordHash!, createdAt });
    await db.insert(workspaceMembers).values({ userId, ownerId: access.ownerId, employeeId, role, active: body.active as boolean, createdAt });
    await writeAudit(db, access.ownerId, user.userId, 'member-created', userId, 'Role: ' + role + '; active: ' + body.active + '; linked employee: ' + (employeeId ?? 'none'));
    return json({ message: 'Login created in this workspace.' }, 201);
   }
   if (typeof body.userId !== 'string' || body.userId === user.userId || body.userId === access.ownerId) return json({ error: 'You cannot change your own access or the workspace owner.' }, 400);
   const [member] = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.ownerId, access.ownerId), eq(workspaceMembers.userId, body.userId))).limit(1);
   if (!member) return json({ error: 'Account not found in this workspace.' }, 404);
   await db.update(workspaceMembers).set({ role, employeeId, active: body.active as boolean }).where(eq(workspaceMembers.userId, member.userId));
   await db.update(users).set({ name, ...(passwordHash ? { passwordHash } : {}) }).where(eq(users.id, member.userId));
   await db.delete(sessions).where(eq(sessions.userId, member.userId));
   await writeAudit(db, access.ownerId, user.userId, 'member-updated', member.userId, 'Role: ' + member.role + ' → ' + role + '; active: ' + member.active + ' → ' + body.active + '; employee: ' + (member.employeeId ?? 'none') + ' → ' + (employeeId ?? 'none') + '; password reset: ' + Boolean(passwordHash));
   return json({ message: 'Access updated. This user must sign in again.' });
  });
 } catch (error) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  if (databaseErrorCode(error) === 'ER_DUP_ENTRY') return json({ error: 'That username or employee already has a login.' }, 409);
  console.error('Member update failed', error instanceof Error ? error.name : 'server error');
  return json({ error: 'Could not save access. Check database setup and retry.' }, 500);
 }
}
