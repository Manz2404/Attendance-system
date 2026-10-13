import { randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb } from '@/db';
import { employees, employeeFaces, faceChallenges, kioskAttempts, kioskSessions, schedules, workspaces } from '@/db/schema';
import { getKioskSession } from '@/lib/kiosk-session';
import { hashToken } from '@/lib/password.mjs';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';
import { scanFrames, faceAvailable, FaceInputError } from '@/lib/face-engine.mjs';
import { FACE_MODEL, openFace, matchesFace, motionPassed } from '@/lib/face-policy.mjs';
import { kioskWorkday, attemptWindow } from '@/lib/kiosk-policy';
import { saveKioskClockIn } from '@/lib/kiosk-punch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const locked = () => json({ code: 'KIOSK_DISCONNECTED', error: 'This kiosk is not connected. Ask an administrator to start kiosk mode.' }, 401);
export async function POST(request: Request) {
  if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  try {
    const session = await getKioskSession(); if (!session) return locked();
    const body = await readJSON(request, 700000);
    if (typeof body.employeeId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.employeeId) || !['challenge', 'scan'].includes(String(body.action))) return json({ error: 'Choose an employee before scanning.' }, 400);
    const employeeId = body.employeeId;
    if (!await faceAvailable()) return json({ error: 'Face scanning is not ready. Ask the administrator to run setup or use your PIN.' }, 503);
    const db = getDb(), key = hashToken(`kiosk-face|${session.ownerId}|${employeeId}`);
    if (body.action === 'challenge') {
      return await db.transaction(async tx => {
        await tx.select().from(workspaces).where(eq(workspaces.ownerId, session.ownerId)).limit(1).for('update');
        const now = new Date().toISOString();
        const [activeSession] = await tx.select().from(kioskSessions).where(and(eq(kioskSessions.tokenHash, session.tokenHash), eq(kioskSessions.ownerId, session.ownerId), gt(kioskSessions.expiresAt, now))).limit(1);
        if (!activeSession) return locked();
        const [employee] = await tx.select().from(employees).where(and(eq(employees.id, employeeId), eq(employees.ownerId, session.ownerId))).limit(1);
        const [profile] = await tx.select().from(employeeFaces).where(and(eq(employeeFaces.employeeId, employeeId), eq(employeeFaces.ownerId, session.ownerId), eq(employeeFaces.model, FACE_MODEL))).limit(1);
        if (!employee?.active || !profile) return json({ error: 'This employee has no available face enrollment. Use a PIN or ask the administrator.' }, 400);
        const stationKey = hashToken(`kiosk-face-station|${session.tokenHash}`);
        for (const attemptKey of [key, stationKey]) await tx.insert(kioskAttempts).values({ key: attemptKey, failures: 0, windowStart: now }).onDuplicateKeyUpdate({ set: { key: attemptKey } });
        const [attempt] = await tx.select().from(kioskAttempts).where(eq(kioskAttempts.key, key)).limit(1);
        if (attemptWindow(attempt, now, 5, 900000).limited) return json({ error: 'Too many failed face scans. Wait 15 minutes or use your PIN.' }, 429);
        const [station] = await tx.select().from(kioskAttempts).where(eq(kioskAttempts.key, stationKey)).limit(1);
        const rate = attemptWindow(station, now, 12, 60000);
        if (rate.limited) return json({ error: 'The scanner is busy. Wait one minute or use your PIN.' }, 429);
        await tx.update(kioskAttempts).set({ failures: rate.count + 1, windowStart: rate.start }).where(eq(kioskAttempts.key, stationKey));
        await tx.delete(faceChallenges).where(lt(faceChallenges.expiresAt, now));
        await tx.delete(faceChallenges).where(and(eq(faceChallenges.kioskTokenHash, session.tokenHash), eq(faceChallenges.employeeId, employeeId)));
        const token = randomBytes(32).toString('hex');
        await tx.insert(faceChallenges).values({ tokenHash: hashToken(token), kioskTokenHash: session.tokenHash, ownerId: session.ownerId, employeeId, expiresAt: new Date(Date.now() + 90000).toISOString() });
        return json({ challenge: token });
      });
    }
    if (typeof body.challenge !== 'string' || !/^[a-f0-9]{64}$/.test(body.challenge)) return json({ error: 'Start a new face scan.' }, 400);
    const challengeHash = hashToken(body.challenge);
    // Consume before processing the images. The same scan cannot be replayed, even after a rejected match.
    const claimed = await db.transaction(async tx => {
      await tx.select().from(workspaces).where(eq(workspaces.ownerId, session.ownerId)).limit(1).for('update');
      const [challenge] = await tx.select().from(faceChallenges).where(and(eq(faceChallenges.tokenHash, challengeHash), eq(faceChallenges.ownerId, session.ownerId), eq(faceChallenges.employeeId, employeeId), eq(faceChallenges.kioskTokenHash, session.tokenHash), gt(faceChallenges.expiresAt, new Date().toISOString()))).limit(1);
      if (!challenge) return false;
      await tx.delete(faceChallenges).where(eq(faceChallenges.tokenHash, challengeHash));
      return true;
    });
    if (!claimed) return json({ error: 'This scan has expired or was already used. Start a new scan.' }, 409);
    let scanned: Awaited<ReturnType<typeof scanFrames>> | null = null;
    let frameError = '';
    try { scanned = await scanFrames(body.images); }
    catch (error) { if (error instanceof FaceInputError) frameError = error.message; else throw error; }
    return await db.transaction(async tx => {
      await tx.select().from(workspaces).where(eq(workspaces.ownerId, session.ownerId)).limit(1).for('update');
      const now = new Date().toISOString();
      const [activeSession] = await tx.select().from(kioskSessions).where(and(eq(kioskSessions.tokenHash, session.tokenHash), eq(kioskSessions.ownerId, session.ownerId), gt(kioskSessions.expiresAt, now))).limit(1);
      if (!activeSession) return locked();
      const [employee] = await tx.select().from(employees).where(and(eq(employees.ownerId, session.ownerId), eq(employees.id, employeeId))).limit(1);
      const [profile] = await tx.select().from(employeeFaces).where(and(eq(employeeFaces.ownerId, session.ownerId), eq(employeeFaces.employeeId, employeeId))).limit(1);
      const [schedule] = employee ? await tx.select().from(schedules).where(and(eq(schedules.ownerId, session.ownerId), eq(schedules.id, employee.scheduleId))).limit(1) : [];
      const [attempt] = await tx.select().from(kioskAttempts).where(eq(kioskAttempts.key, key)).limit(1);
      const rate = attemptWindow(attempt ?? { failures: 0, windowStart: now }, now, 5, 900000);
      if (rate.limited) return json({ error: 'Too many failed face scans. Wait 15 minutes or use your PIN.' }, 429);
      const day = employee && schedule ? kioskWorkday(employee, now, schedule) : null;
      const matched = !!scanned && profile?.model === FACE_MODEL && matchesFace(scanned.map(f => f.descriptor), openFace(profile.template, session.ownerId, employeeId));
      const moving = !!scanned && motionPassed(scanned.map(f => f.pose));
      if (!employee || !day || !matched || !moving) {
        await tx.insert(kioskAttempts).values({ key, failures: rate.count + 1, windowStart: rate.start }).onDuplicateKeyUpdate({ set: { failures: rate.count + 1, windowStart: rate.start } });
        return json({ error: frameError || (!moving ? 'Follow the head-turn instructions, then try again. You can also use your PIN.' : 'Face did not match this employee. Try again or use your PIN.') }, 400);
      }
      await tx.update(kioskAttempts).set({ failures: 0, windowStart: now }).where(eq(kioskAttempts.key, key));
      return json(await saveKioskClockIn(tx, session.ownerId, employee, day, schedule, now, 'face'));
    });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    console.error('Face clock-in failed', error instanceof Error ? error.name : 'server error');
    return json({ error: 'Could not complete face scanning. Please retry or use your PIN.' }, 500);
  }
}
