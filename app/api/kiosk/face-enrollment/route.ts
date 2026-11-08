import { workspaceAccess } from '@/lib/workspace-access';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { employees, employeeFaces, faceChallenges, kioskAttempts, workspaces } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';
import { scanFrames, faceAvailable, FaceInputError } from '@/lib/face-engine.mjs';
import { FACE_MODEL, sealFace, openFace, matchesFace, consistentFaces } from '@/lib/face-policy.mjs';
import { hashToken } from '@/lib/password.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'An administrator must sign in first.' }, 401);
  if ((await workspaceAccess(user))?.role !== 'admin') return json({ error: 'Administrator access required.' }, 403);
  return json({ ready: await faceAvailable() });
}
export async function POST(request: Request) {
  if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  try {
    const user = await getCurrentUser(); if (!user) return json({ error: 'An administrator must sign in first.' }, 401);
    const access = await workspaceAccess(user);
    if (access?.role !== 'admin') return json({ error: 'Administrator access required.' }, 403);
    const body = await readJSON(request, 700000);
    if (typeof body.employeeId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.employeeId) || !['enroll', 'remove'].includes(String(body.action))) return json({ error: 'Choose an employee and a valid enrollment action.' }, 400);
    const employeeId = body.employeeId;
    const db = getDb();
    const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.ownerId, access.ownerId), eq(employees.id, employeeId))).limit(1);
    if (!employee) return json({ error: 'Employee not found.' }, 404);
    if (body.action === 'remove') {
      await db.transaction(async tx => {
        await tx.select().from(workspaces).where(eq(workspaces.ownerId, access.ownerId)).limit(1).for('update');
        const currentAccess = await workspaceAccess(user, tx);
        if (currentAccess?.role !== 'admin' || currentAccess.ownerId !== access.ownerId) throw new RequestError('Administrator access required.', 403);
        await tx.delete(employeeFaces).where(and(eq(employeeFaces.ownerId, access.ownerId), eq(employeeFaces.employeeId, employeeId)));
        await tx.delete(faceChallenges).where(and(eq(faceChallenges.ownerId, access.ownerId), eq(faceChallenges.employeeId, employeeId)));
        await tx.delete(kioskAttempts).where(eq(kioskAttempts.key, hashToken(`kiosk-face|${access.ownerId}|${employeeId}`)));
      });
      return json({ message: 'Face enrollment removed. PIN entry is still available if a PIN is set.' });
    }
    if (body.consent !== true) return json({ error: 'Confirm that the employee agrees to face enrollment.' }, 400);
    if (!await faceAvailable()) return json({ error: 'Run setup-windows.cmd to prepare face recognition.' }, 503);
    const scanned = await scanFrames(body.images), samples = scanned.map(frame => frame.descriptor);
    if (!consistentFaces(samples)) return json({ error: 'All enrollment frames must show the same person. Try again.' }, 400);
    const template = sealFace(samples, access.ownerId, employeeId);
    return await db.transaction(async tx => {
      await tx.select().from(workspaces).where(eq(workspaces.ownerId, access.ownerId)).limit(1).for('update');
        const currentAccess = await workspaceAccess(user, tx);
        if (currentAccess?.role !== 'admin' || currentAccess.ownerId !== access.ownerId) throw new RequestError('Administrator access required.', 403);
      const [current] = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.ownerId, access.ownerId), eq(employees.id, employeeId))).limit(1);
      if (!current) return json({ error: 'Employee not found.' }, 404);
      const others = await tx.select().from(employeeFaces).where(eq(employeeFaces.ownerId, access.ownerId));
      for (const other of others) {
        if (other.employeeId !== employeeId && other.model === FACE_MODEL && matchesFace(samples, openFace(other.template, access.ownerId, other.employeeId))) return json({ error: 'This face is already enrolled for another employee. Check the employee assignment before continuing.' }, 409);
      }
      const updatedAt = new Date().toISOString();
      await tx.insert(employeeFaces).values({ employeeId, ownerId: access.ownerId, template, model: FACE_MODEL, updatedAt }).onDuplicateKeyUpdate({ set: { template, model: FACE_MODEL, updatedAt } });
      await tx.delete(faceChallenges).where(and(eq(faceChallenges.ownerId, access.ownerId), eq(faceChallenges.employeeId, employeeId)));
      await tx.delete(kioskAttempts).where(eq(kioskAttempts.key, hashToken(`kiosk-face|${access.ownerId}|${employeeId}`)));
      return json({ message: 'Face enrolled. The camera images were discarded.' });
    });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof FaceInputError) return json({ error: error.message }, 400);
    console.error('Face enrollment failed', error instanceof Error ? error.name : 'server error');
    return json({ error: 'Could not save face enrollment. Check setup and the database, then retry.' }, 500);
  }
}
