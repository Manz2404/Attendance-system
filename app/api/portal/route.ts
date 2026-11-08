import { and, eq, asc } from 'drizzle-orm';
import { getDb } from '@/db';
import { employees, employeePhotos, punches, schedules, workspaces } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
 const user = await getCurrentUser();
 if (!user) return json({ error: 'Please sign in.' }, 401);
 const access = await workspaceAccess(user);
 if (access?.role !== 'staff' || !access.employeeId) return json({ error: 'Active staff access required.' }, 403);
 const db = getDb();
 // Identity comes only from the authenticated membership, never a query parameter.
 const [employee] = await db.select({ id: employees.id, name: employees.name, code: employees.code, department: employees.department, scheduleId: employees.scheduleId, startDate: employees.startDate, endDate: employees.endDate, active: employees.active, isSample: employees.isSample }).from(employees).where(and(eq(employees.ownerId, access.ownerId), eq(employees.id, access.employeeId))).limit(1);
 if (!employee) return json({ error: 'Employee not found.' }, 403);
 const [logs, shifts, photos, workspace] = await Promise.all([
  db.select({ id: punches.id, employeeId: punches.employeeId, timestamp: punches.timestamp, kind: punches.kind, source: punches.source }).from(punches).where(and(eq(punches.ownerId, access.ownerId), eq(punches.employeeId, access.employeeId))).orderBy(asc(punches.timestamp)),
  db.select().from(schedules).where(and(eq(schedules.ownerId, access.ownerId), eq(schedules.id, employee.scheduleId))).limit(1),
  db.select({ photo: employeePhotos.photo }).from(employeePhotos).where(and(eq(employeePhotos.ownerId, access.ownerId), eq(employeePhotos.employeeId, access.employeeId))).limit(1),
  db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.ownerId, access.ownerId)).limit(1),
 ]);
 return json({ name: workspace[0]?.name ?? 'My workspace', employee: { ...employee, profilePhoto: photos[0]?.photo ?? null }, punches: logs, schedules: shifts });
}
