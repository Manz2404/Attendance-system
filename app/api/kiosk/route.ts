import { and, eq, asc, gt, or, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { employees, employeePins, employeeFaces, workspaces, schedules, kioskAttempts, kioskSessions } from '@/db/schema';
import { getKioskSession } from '@/lib/kiosk-session';
import { hashToken, validPin, verifyPin } from '@/lib/password.mjs';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';
import { faceAvailable } from '@/lib/face-engine.mjs';
import { saveKioskPunch } from '@/lib/kiosk-punch';
import { kioskWorkday, kioskPunchKind, attemptWindow } from '@/lib/kiosk-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const locked = () => json({ code: 'KIOSK_DISCONNECTED', error: 'This kiosk is not connected. Ask an administrator to start kiosk mode.' }, 401);
export async function GET() {
  try {
    const session = await getKioskSession();
    if (!session) return locked();
    const db = getDb(), now = new Date().toISOString();
    const [ws, staff, shifts] = await Promise.all([
      db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.ownerId, session.ownerId)).limit(1),
      db.select({ id: employees.id, name: employees.name, code: employees.code, scheduleId: employees.scheduleId, active: employees.active, startDate: employees.startDate, endDate: employees.endDate, pin: employeePins.employeeId, face: employeeFaces.employeeId })
        .from(employees).leftJoin(employeePins, and(eq(employeePins.employeeId, employees.id), eq(employeePins.ownerId, session.ownerId))).leftJoin(employeeFaces, and(eq(employeeFaces.employeeId, employees.id), eq(employeeFaces.ownerId, session.ownerId)))
        .where(and(eq(employees.ownerId, session.ownerId), eq(employees.active, true), or(isNotNull(employeePins.employeeId), isNotNull(employeeFaces.employeeId)))).orderBy(asc(employees.name)),
      db.select().from(schedules).where(eq(schedules.ownerId, session.ownerId)),
    ]);
    // Only names, codes and available methods reach the kiosk, never templates, hashes or attendance history.
    return json({ name: ws[0]?.name ?? 'Attendance', now, faceReady: await faceAvailable(), employees: staff.filter(e => kioskWorkday(e, now, shifts.find(s => s.id === e.scheduleId)))
      .map(({ id, name, code, pin, face }) => ({ id, name, code, hasPin: !!pin, hasFace: !!face })) });
  } catch (error) {
    console.error('Kiosk read failed', error instanceof Error ? error.name : 'server error');
    return json({ error: 'Could not load the kiosk. Check the database and run setup-windows.cmd.' }, 500);
  }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  try {
    const session = await getKioskSession();
    if (!session) return locked();
    const body = await readJSON(request, 4096);
    if (typeof body.employeeId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.employeeId) || !validPin(body.pin)) {
      return json({ error: 'Choose your name and enter your six-digit PIN.' }, 400);
    }
    const employeeId = body.employeeId, pin = body.pin;
    const kind = kioskPunchKind(body.kind);
    if (!kind) return json({ error: 'Choose Clock in or Clock out.' }, 400);
    return await getDb().transaction(async db => {
      // Match the administrator write lock: resets, revocation and simultaneous taps cannot race a punch.
      const [ws] = await db.select({ id: workspaces.ownerId }).from(workspaces).where(eq(workspaces.ownerId, session.ownerId)).limit(1).for('update');
      if (!ws) return locked();
      const now = new Date().toISOString();
      const [validSession] = await db.select({ id: kioskSessions.tokenHash }).from(kioskSessions)
        .where(and(eq(kioskSessions.tokenHash, session.tokenHash), eq(kioskSessions.ownerId, session.ownerId), gt(kioskSessions.expiresAt, now))).limit(1);
      if (!validSession) return locked();
      const userKey = hashToken(`kiosk-pin|${session.ownerId}|${employeeId}`);
      const stationKey = hashToken(`kiosk-station|${session.tokenHash}`);
      for (const key of [stationKey, userKey]) {
        await db.insert(kioskAttempts).values({ key, failures: 0, windowStart: now }).onDuplicateKeyUpdate({ set: { key } });
      }
      const [station] = await db.select().from(kioskAttempts).where(eq(kioskAttempts.key, stationKey)).limit(1).for('update');
      const stationWindow = attemptWindow(station, now, 60, 60000);
      if (stationWindow.limited) return json({ error: 'This kiosk is busy. Wait one minute and try again.' }, 429);
      await db.update(kioskAttempts).set({ failures: stationWindow.count + 1, windowStart: stationWindow.start }).where(eq(kioskAttempts.key, stationKey));
      const [attempt] = await db.select().from(kioskAttempts).where(eq(kioskAttempts.key, userKey)).limit(1).for('update');
      const pinWindow = attemptWindow(attempt, now, 5, 15 * 60000);
      if (pinWindow.limited) return json({ error: 'Too many incorrect PINs for this employee. Try again in 15 minutes or ask the administrator to reset the PIN.' }, 429);
      const [employee] = await db.select().from(employees).where(and(eq(employees.ownerId, session.ownerId), eq(employees.id, employeeId))).limit(1);
      const [credentials] = await db.select({ pinHash: employeePins.pinHash }).from(employeePins)
        .where(and(eq(employeePins.ownerId, session.ownerId), eq(employeePins.employeeId, employeeId))).limit(1);
      const correct = await verifyPin(pin, credentials?.pinHash ?? '');
      const [schedule] = employee ? await db.select().from(schedules).where(and(eq(schedules.ownerId, session.ownerId), eq(schedules.id, employee.scheduleId))).limit(1) : [];
      const day = employee && schedule ? kioskWorkday(employee, now, schedule) : null;
      if (!correct || !day || !employee) {
        await db.update(kioskAttempts).set({ failures: pinWindow.count + 1, windowStart: pinWindow.start }).where(eq(kioskAttempts.key, userKey));
        return json({ error: 'The name or PIN is incorrect, or this employee is unavailable. Please try again or ask the administrator.' }, 401);
      }
      await db.update(kioskAttempts).set({ failures: 0, windowStart: now }).where(eq(kioskAttempts.key, userKey));
      const result = await saveKioskPunch(db, session.ownerId, employee, day, schedule, now, 'kiosk', kind);
      return json(result.body, result.status);
    });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    console.error('Kiosk attendance failed', error instanceof Error ? error.name : 'server error');
    return json({ error: 'Could not save attendance. Please retry; repeated submissions do not add another record.' }, 500);
  }
}
