import { and, eq, gte, lt } from 'drizzle-orm';
import type { Connection } from '@/db';
import { punches } from '@/db/schema';
import { addDays, localInstant, type Schedule } from '@/lib/attendance';
import { existingClockIn } from '@/lib/kiosk-policy';

export async function saveKioskClockIn(db: Connection, ownerId: string, employee: { id: string; name: string }, day: string, schedule: Schedule | undefined, now: string, source: 'kiosk' | 'face') {
  const logs = await db.select({ timestamp: punches.timestamp, kind: punches.kind }).from(punches)
    .where(and(eq(punches.ownerId, ownerId), eq(punches.employeeId, employee.id), gte(punches.timestamp, localInstant(day, '00:00')), lt(punches.timestamp, localInstant(addDays(day, 2), '00:00'))));
  const existing = existingClockIn(logs, day, schedule);
  if (existing) return { message: 'You have already clocked in for this workday.', already: true, name: employee.name, timestamp: existing.timestamp, workday: day };
  await db.insert(punches).values({ id: crypto.randomUUID(), ownerId, employeeId: employee.id, timestamp: now, kind: 'IN', source, deviceId: null,
    note: source === 'face' ? 'Webcam face scan clock-in' : 'PIN kiosk clock-in', dedupeKey: `${employee.id}|${now}|IN`, createdAt: now });
  return { message: 'Clock-in saved.', already: false, name: employee.name, timestamp: now, workday: day };
}
