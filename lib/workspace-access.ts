import { and, eq } from 'drizzle-orm';
import { getDb, type Connection } from '@/db';
import { employees, workspaceMembers } from '@/db/schema';
export type WorkspaceRole = 'admin' | 'hr' | 'staff';
export type WorkspaceAccess = { ownerId: string; role: WorkspaceRole; employeeId: string | null; isOwner: boolean };
export async function workspaceAccess(user: { userId: string }, db: Connection = getDb()): Promise<WorkspaceAccess | null> {
 const [member] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.userId)).limit(1);
 // Accounts created before memberships remain owners of their original workspace.
 if (!member) return { ownerId: user.userId, role: 'admin', employeeId: null, isOwner: true };
 if (!member.active) return null;
 if (member.role === 'staff') {
   if (!member.employeeId) return null;
   const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, member.employeeId), eq(employees.ownerId, member.ownerId), eq(employees.active, true))).limit(1);
   if (!employee) return null;
 }
 return { ownerId: member.ownerId, role: member.role, employeeId: member.employeeId, isOwner: false };
}
export function canManageAttendance(access: WorkspaceAccess | null) { return access?.role === 'admin' || access?.role === 'hr'; }
export function canWriteWorkspace(role: WorkspaceRole, action: string) {
 return role === 'admin' || role === 'hr' && ['employee', 'schedule', 'punch', 'import', 'delete-punch'].includes(action);
}
