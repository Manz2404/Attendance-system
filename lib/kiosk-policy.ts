import { workDate, type Employee, type Punch, type Schedule } from './attendance.ts';

export function kioskWorkday(employee: Pick<Employee, 'active' | 'startDate' | 'endDate'>, timestamp: string, schedule?: Schedule) {
  const day = workDate({ timestamp }, schedule);
  return employee.active && day >= employee.startDate && (!employee.endDate || day <= employee.endDate) ? day : null;
}

export function existingClockIn(events: Pick<Punch, 'timestamp' | 'kind'>[], day: string, schedule?: Schedule) {
  return events.filter(p => p.kind === 'IN' && workDate(p, schedule) === day)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0] ?? null;
}

export function kioskPunchKind(value: unknown): 'IN' | 'OUT' | null {
  return value === undefined ? 'IN' : value === 'IN' || value === 'OUT' ? value : null;
}

export function clockOutState(events: Pick<Punch, 'timestamp' | 'kind'>[], day: string, schedule?: Schedule) {
  const ordered = events.filter(p => workDate(p, schedule) === day).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let clockIn: Pick<Punch, 'timestamp' | 'kind'> | null = null;
  let clockOut: Pick<Punch, 'timestamp' | 'kind'> | null = null;
  for (const event of ordered) {
    if (event.kind === 'IN') clockIn ??= event;
    else if (clockIn) { clockOut = event; clockIn = null; }
  }
  return { clockIn, clockOut };
}

export function attemptWindow(attempt: { failures: number; windowStart: string }, now: string, limit: number, windowMs: number) {
  const recent = Date.parse(now) - Date.parse(attempt.windowStart) < windowMs;
  return { limited: recent && attempt.failures >= limit, count: recent ? attempt.failures : 0, start: recent ? attempt.windowStart : now };
}
