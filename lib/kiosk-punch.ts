import { and, eq, gte, lt } from 'drizzle-orm';
import type { Connection } from '@/db';
import { punches } from '@/db/schema';
import { addDays, localInstant, type Schedule } from '@/lib/attendance';
import { existingClockIn, clockOutState } from '@/lib/kiosk-policy';

type KioskPunchResult = { status: 200; body: { message: string; already: boolean; kind: 'IN' | 'OUT'; name: string; timestamp: string; workday: string } }
  | { status: 409; body: { error: string } };

export async function saveKioskPunch(db: Connection, ownerId: string, employee: { id: string; name: string }, day: string, schedule: Schedule | undefined, now: string, source: 'kiosk' | 'face', kind: 'IN' | 'OUT'): Promise<KioskPunchResult> {
  const logs = await db.select({ timestamp: punches.timestamp, kind: punches.kind }).from(punches)
    .where(and(eq(punches.ownerId, ownerId), eq(punches.employeeId, employee.id), gte(punches.timestamp, localInstant(day, '00:00')), lt(punches.timestamp, localInstant(addDays(day, 2), '00:00'))));
  const state = clockOutState(logs, day, schedule);
  const existing = kind === 'IN' ? existingClockIn(logs, day, schedule) : state.clockIn ? null : state.clockOut;
  const action = kind === 'IN' ? 'in' : 'out';
  if (existing) return { status: 200, body: { message: `You have already clocked ${action} for this workday.`, already: true, kind, name: employee.name, timestamp: existing.timestamp, workday: day } };
  // Return business errors so callers still commit their authentication and station-rate counters.
  if (kind === 'OUT' && !state.clockIn) return { status: 409, body: { error: 'No clock-in was found for this workday. Clock in first, or ask the administrator to correct a missing record.' } };
  if (kind === 'OUT' && state.clockIn && state.clockIn.timestamp >= now) return { status: 409, body: { error: 'Clock-out must be after the saved clock-in. Check the clock-in time or retry in a moment.' } };
  await db.insert(punches).values({ id: crypto.randomUUID(), ownerId, employeeId: employee.id, timestamp: now, kind, source, deviceId: null,
    note: `${source === 'face' ? 'Webcam face scan' : 'PIN kiosk'} clock-${action}`, dedupeKey: `${employee.id}|${now}|${kind}`, createdAt: now });
  return { status: 200, body: { message: `Clock-${action} saved.`, already: false, kind, name: employee.name, timestamp: now, workday: day } };
}
