import { and, eq, inArray, asc } from 'drizzle-orm';
import { getDb, type Connection } from '@/db';
import { workspaces, employees, schedules, devices, punches, employeePins, kioskAttempts } from '@/db/schema';
import { hashPin, validPin, hashToken } from '@/lib/password.mjs';
import { getCurrentUser } from '@/lib/auth';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';
import { dateMY, addDays, localInstant, minuteOfDay, shiftDuration, workDate, type Schedule } from '@/lib/attendance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function first<T>(query: PromiseLike<T[]>) { return (await query)[0]; }
class InputError extends Error {}
function field(value: unknown, label: string, max = 120, optional = false): string {
  if (value === undefined || value === null || value === '') { if (optional) return ''; throw new InputError(`${label} is required.`); }
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new InputError(`${label} must be 1–${max} characters.`);
  return value.trim();
}
function dateField(value: unknown) {
  const date = field(value, 'Date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date) throw new InputError('Enter a valid date.');
  return date;
}
function timeField(value: unknown, label: string) { const t = field(value, label, 5); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new InputError(`${label} must be a valid time.`); return t; }
function numberField(value: unknown, label: string, max: number) { if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) throw new InputError(`${label} must be between 0 and ${max}.`); return value; }
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const user = await getCurrentUser(); if (!user) return json({ error: 'Please sign in to continue.' }, 401);
  try {
    const db = getDb(), owner = user.userId;
    const [ws, staff, shifts, logs, hardware, pins] = await Promise.all([
      db.select().from(workspaces).where(eq(workspaces.ownerId, owner)).limit(1),
      db.select().from(employees).where(eq(employees.ownerId, owner)).orderBy(asc(employees.name)),
      db.select().from(schedules).where(eq(schedules.ownerId, owner)),
      db.select().from(punches).where(eq(punches.ownerId, owner)).orderBy(asc(punches.timestamp)),
      db.select().from(devices).where(eq(devices.ownerId, owner)),
      db.select({ employeeId: employeePins.employeeId }).from(employeePins).where(eq(employeePins.ownerId, owner)),
    ]);
    const hasPin = new Set(pins.map(p => p.employeeId));
    return json({ initialized: !!ws[0], name: ws[0]?.name ?? 'My workspace', employees: staff.map(e => ({ ...e, kioskPinSet: hasPin.has(e.id) })), schedules: shifts, punches: logs, devices: hardware, today: dateMY() });
  } catch (error) { console.error('Attendance read failed', error instanceof Error ? error.name : 'server error'); return json({ error: 'Could not load your workspace. Please try again.' }, 500); }
}

async function initialize(db: Connection, owner: string) {
  const existing = await first(db.select().from(workspaces).where(eq(workspaces.ownerId, owner)).limit(1));
  if (existing) return;
  const now = new Date().toISOString();
  await db.insert(workspaces).values({ ownerId: owner, name: 'My workspace', createdAt: now }).onDuplicateKeyUpdate({ set: { ownerId: owner } });
  await db.insert(schedules).values({ id: `default-${owner}`, ownerId: owner, name: 'Office hours', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, weekdays: '1,2,3,4,5' }).onDuplicateKeyUpdate({ set: { ownerId: owner } });
}

async function addSample(db: Connection, owner: string) {
  const already = await first(db.select().from(employees).where(and(eq(employees.ownerId, owner), eq(employees.isSample, true))).limit(1));
  if (already) throw new InputError('Sample employees already exist. Remove the sample data before loading it again.');
  const shift = await first(db.select().from(schedules).where(eq(schedules.ownerId, owner)).limit(1));
  if (!shift) throw new InputError('Create a schedule first.');
  const now = new Date(), today = dateMY(now), createdAt = now.toISOString();
  const sampleTeam = [['Aina Rahman', 'People & culture'], ['Daniel Lim', 'Engineering'], ['Farah Idris', 'Design'], ['Harith Azman', 'Customer support'], ['Maya Tan', 'Finance'], ['Ravi Kumar', 'Customer support'], ['Sofia Hassan', 'Operations'], ['Jason Lee', 'Engineering']];
  const team = sampleTeam.map(([name, department], i) => ({ id: crypto.randomUUID(), ownerId: owner, code: `DEMO-${String(i + 1).padStart(3, '0')}`, name, department, scheduleId: shift.id, deviceUserId: null, active: true, isSample: true, startDate: addDays(today, -30), createdAt }));
  const codes = await db.select({ code: employees.code }).from(employees).where(eq(employees.ownerId, owner));
  if (team.some(t => codes.some(c => c.code === t.code))) throw new InputError('DEMO employee codes are already in use. Rename those codes before loading samples.');
  const logs: (typeof punches.$inferInsert)[] = [];
  const overnight = minuteOfDay(shift.endTime) < minuteOfDay(shift.startTime);
  for (let d = -13; d <= 0; d++) {
    const date = addDays(today, d), dow = new Date(date + 'T12:00:00Z').getUTCDay();
    if (d !== 0 && !shift.weekdays.split(',').includes(String(dow))) continue;
    team.forEach((employee, i) => {
      if ((i + Math.abs(d)) % 11 === 7) return;
      const start = Date.parse(localInstant(date, shift.startTime)) + [0, 6, 24, -7, 3, 18, -2, 4][i] * 60000;
      const end = Date.parse(localInstant(overnight ? addDays(date, 1) : date, shift.endTime)) + (i % 3) * 12 * 60000;
      for (const [kind, milliseconds] of [['IN', start], ['OUT', end]] as const) {
        if (milliseconds > now.getTime() || (d === -1 && i === 2 && kind === 'OUT')) continue;
        const timestamp = new Date(milliseconds).toISOString();
        logs.push({ id: crypto.randomUUID(), ownerId: owner, employeeId: employee.id, timestamp, kind, source: 'sample', deviceId: null, note: 'Sample attendance record', dedupeKey: `${employee.id}|${timestamp}|${kind}`, createdAt });
      }
    });
  }
  await db.insert(employees).values(team);
  for (let i = 0; i < logs.length; i += 100) await db.insert(punches).values(logs.slice(i, i + 100));
  return { message: 'Sample workspace loaded.', count: logs.length };
}

export async function POST(request: Request) {
  const user = await getCurrentUser(); if (!user) return json({ error: 'Please sign in to continue.' }, 401);
  if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Send a JSON request.' }, 415);
  try {
    const body = await readJSON(request);
    const action = field(body.action, 'Action', 30), owner = user.userId;
    return await getDb().transaction(async db => {
    if (action === 'initialize') { await initialize(db, owner); return json({ message: 'Workspace ready.' }); }
    // Serialize writes per workspace, including duplicate checks and CSV imports.
    const ws = await first(db.select().from(workspaces).where(eq(workspaces.ownerId, owner)).limit(1).for('update'));
    if (!ws) throw new InputError('Initialize your workspace first.');
    if (action === 'employee-pin' || action === 'remove-employee-pin') {
      const employeeId = field(body.employeeId, 'Employee', 36);
      const employee = await first(db.select({ id: employees.id }).from(employees).where(and(eq(employees.ownerId, owner), eq(employees.id, employeeId))).limit(1));
      if (!employee) throw new InputError('Employee not found.');
      if (action === 'employee-pin') {
        if (!validPin(body.pin)) throw new InputError('Use a six-digit PIN.');
        const pinHash = await hashPin(body.pin), updatedAt = new Date().toISOString();
        await db.insert(employeePins).values({ employeeId, ownerId: owner, pinHash, updatedAt }).onDuplicateKeyUpdate({ set: { pinHash, updatedAt } });
      } else await db.delete(employeePins).where(and(eq(employeePins.ownerId, owner), eq(employeePins.employeeId, employeeId)));
      await db.delete(kioskAttempts).where(eq(kioskAttempts.key, hashToken(`kiosk-pin|${owner}|${employeeId}`)));
      return json({ message: action === 'employee-pin' ? 'Kiosk PIN saved.' : 'Kiosk PIN removed.' });
    }
    if (action === 'sample') return json(await addSample(db, owner));
    if (action === 'clear-sample') {
      const sample = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.ownerId, owner), eq(employees.isSample, true)));
      await db.delete(punches).where(and(eq(punches.ownerId, owner), eq(punches.source, 'sample')));
      if (sample.length) {
        await db.delete(punches).where(and(eq(punches.ownerId, owner), inArray(punches.employeeId, sample.map(e => e.id))));
        await db.delete(employees).where(and(eq(employees.ownerId, owner), eq(employees.isSample, true)));
      }
      return json({ message: 'Sample employees and their punches removed. Your other records are kept.' });
    }
    if (action === 'workspace') { await db.update(workspaces).set({ name: field(body.name, 'Workspace name', 80) }).where(eq(workspaces.ownerId, owner)); return json({ message: 'Workspace updated.' }); }
    if (action === 'employee') {
      const id = field(body.id, 'Employee ID', 80, true), scheduleId = field(body.scheduleId, 'Schedule', 80);
      const shift = await first(db.select().from(schedules).where(and(eq(schedules.ownerId, owner), eq(schedules.id, scheduleId))).limit(1));
      if (!shift) throw new InputError('Select a valid schedule.');
      const code = field(body.code, 'Employee code', 30).toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) throw new InputError('Employee code must start with a letter or number and can contain hyphens and underscores.');
      if (typeof body.active !== 'boolean') throw new InputError('Select a valid employee status.');
      const startDate = dateField(body.startDate), endDate = body.active ? null : dateField(body.endDate);
      if (endDate && endDate < startDate) throw new InputError('Last working day cannot be before the start date.');
      const values = { code, name: field(body.name, 'Employee name'), department: field(body.department, 'Department', 80), scheduleId, deviceUserId: field(body.deviceUserId, 'Device user ID', 60, true) || null, startDate, endDate, active: body.active };
      const duplicate = await first(db.select().from(employees).where(and(eq(employees.ownerId, owner), eq(employees.code, code))).limit(1));
      if (duplicate && duplicate.id !== id) throw new InputError('This employee code is already used.');
      if (id) {
        const employee = await first(db.select().from(employees).where(and(eq(employees.ownerId, owner), eq(employees.id, id))).limit(1));
        if (!employee) throw new InputError('Employee not found.');
        const existingLogs = await db.select({ timestamp: punches.timestamp }).from(punches).where(and(eq(punches.ownerId, owner), eq(punches.employeeId, id)));
        if (existingLogs.some(p => { const d = workDate(p, shift); return d < startDate || (!!endDate && d > endDate); })) throw new InputError('Employment dates must cover this employee’s existing attendance records.');
        await db.update(employees).set(values).where(and(eq(employees.ownerId, owner), eq(employees.id, id)));
      } else await db.insert(employees).values({ ...values, id: crypto.randomUUID(), ownerId: owner, isSample: false, createdAt: new Date().toISOString() });
      return json({ message: id ? 'Employee updated.' : 'Employee added.' });
    }
    if (action === 'schedule') {
      const id = field(body.id, 'Schedule ID', 80, true), startTime = timeField(body.startTime, 'Start time'), endTime = timeField(body.endTime, 'End time');
      if (startTime === endTime) throw new InputError('Start and end times must be different.');
      const weekdays = body.weekdays;
      if (!Array.isArray(weekdays) || !weekdays.length || weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new InputError('Select at least one workday.');
      const values = { name: field(body.name, 'Schedule name', 80), startTime, endTime, breakMinutes: numberField(body.breakMinutes, 'Unpaid break', 240), graceMinutes: numberField(body.graceMinutes, 'Grace period', 120), weekdays: [...new Set(weekdays)].sort().join(',') };
      if (values.breakMinutes >= shiftDuration({ ...values, id: id || 'new' } as Schedule)) throw new InputError('Break must be shorter than the shift.');
      if (id) {
        const found = await first(db.select().from(schedules).where(and(eq(schedules.ownerId, owner), eq(schedules.id, id))).limit(1));
        if (!found) throw new InputError('Schedule not found.');
        await db.update(schedules).set(values).where(and(eq(schedules.ownerId, owner), eq(schedules.id, id)));
      } else await db.insert(schedules).values({ ...values, id: crypto.randomUUID(), ownerId: owner });
      return json({ message: 'Schedule saved.' });
    }
    if (action === 'device') {
      const methods = ['Not selected', 'Push / ADMS', 'SDK / local gateway', 'CSV export'];
      const method = field(body.method, 'Connection method', 30); if (!methods.includes(method)) throw new InputError('Select a valid connection method.');
      await db.insert(devices).values({ id: crypto.randomUUID(), ownerId: owner, name: field(body.name, 'Device name', 80), brand: field(body.brand, 'Brand', 60), model: field(body.model, 'Model', 80), serialNumber: field(body.serialNumber, 'Serial number', 100, true) || null, method, createdAt: new Date().toISOString() });
      return json({ message: 'Device registered. Hardware integration is still required.' });
    }
    if (action === 'remove-device') {
      const id = field(body.id, 'Device ID', 80);
      const log = await first(db.select().from(punches).where(and(eq(punches.ownerId, owner), eq(punches.deviceId, id))).limit(1));
      if (log) throw new InputError('A device with linked attendance records cannot be removed.');
      await db.delete(devices).where(and(eq(devices.ownerId, owner), eq(devices.id, id)));
      return json({ message: 'Device removed.' });
    }
    if (action === 'punch' || action === 'import') {
      const rows = action === 'punch' ? [body] : body.rows;
      if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw new InputError('Provide 1–1,000 attendance records.');
      const staff = await db.select().from(employees).where(eq(employees.ownerId, owner));
      const shifts = await db.select().from(schedules).where(eq(schedules.ownerId, owner));
      const seen = new Set<string>(), now = new Date().toISOString();
      const values = rows.map((row, i) => {
        if (!row || typeof row !== 'object') throw new InputError(`Row ${i + 1}: invalid record.`);
        const code = field(row.code, `Row ${i + 1}: employee code`, 30).toUpperCase(), employee = staff.find(e => e.code === code);
        if (!employee) throw new InputError(`Row ${i + 1}: employee ${code} was not found.`);
        const rawTime = field(row.timestamp, `Row ${i + 1}: timestamp`, 40);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(rawTime) || isNaN(Date.parse(rawTime))) throw new InputError(`Row ${i + 1}: use an ISO timestamp with a timezone, for example 2026-10-10T09:00:00+08:00.`);
        dateField(rawTime.slice(0, 10));
        const timestamp = new Date(rawTime).toISOString();
        if (Date.parse(timestamp) > Date.now() + 60000) throw new InputError(`Row ${i + 1}: attendance cannot be in the future.`);
        const attendanceDate = workDate({ timestamp }, shifts.find(s => s.id === employee.scheduleId));
        if (attendanceDate < employee.startDate) throw new InputError(`Row ${i + 1}: attendance is before the employee's start date.`);
        if (employee.endDate && attendanceDate > employee.endDate) throw new InputError(`Row ${i + 1}: attendance is after the employee's last working day.`);
        if (row.kind !== 'IN' && row.kind !== 'OUT') throw new InputError(`Row ${i + 1}: event must be IN or OUT.`);
        const key = `${employee.id}|${timestamp}|${row.kind}`;
        if (seen.has(key)) return null; seen.add(key);
        return { id: crypto.randomUUID(), ownerId: owner, employeeId: employee.id, timestamp, kind: row.kind as 'IN' | 'OUT', source: action === 'punch' ? 'manual' as const : 'csv' as const, deviceId: null, note: field(row.note, 'Note', 240, true), dedupeKey: key, createdAt: now };
      }).filter((row): row is NonNullable<typeof row> => !!row);
      const existing = await db.select({ dedupeKey: punches.dedupeKey }).from(punches).where(eq(punches.ownerId, owner));
      const existingKeys = new Set(existing.map(p => p.dedupeKey));
      const fresh = values.filter(v => !existingKeys.has(v.dedupeKey));
      for (let i = 0; i < fresh.length; i += 100) await db.insert(punches).values(fresh.slice(i, i + 100));
      const added = fresh.length;
      const skipped = rows.length - added;
      return json({ message: `${added} record${added !== 1 ? 's' : ''} saved. ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped.`, added, skipped });
    }
    if (action === 'delete-punch') {
      const id = field(body.id, 'Record ID', 80);
      await db.delete(punches).where(and(eq(punches.ownerId, owner), eq(punches.id, id)));
      return json({ message: 'Attendance record removed.' });
    }
    throw new InputError('Unknown action.');
    });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    if (error instanceof InputError) return json({ error: error.message }, 400);
    if (error && typeof error === 'object' && ('code' in error && error.code === 'ER_DUP_ENTRY' || 'cause' in error && error.cause && typeof error.cause === 'object' && 'code' in error.cause && error.cause.code === 'ER_DUP_ENTRY')) return json({ error: 'This code or record already exists. Refresh and try again.' }, 409);
    console.error('Attendance update failed', error instanceof Error ? error.name : 'server error');
    return json({ error: 'Could not save your changes. Please try again.' }, 500);
  }
}
