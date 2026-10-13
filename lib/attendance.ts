export const TIMEZONE = 'Asia/Kuala_Lumpur';
export type Schedule = { id: string; name: string; startTime: string; endTime: string; breakMinutes: number; graceMinutes: number; weekdays: string };
export type Employee = { id: string; code: string; name: string; department: string; scheduleId: string; deviceUserId: string | null; active: boolean; isSample: boolean; startDate: string; endDate: string | null; createdAt: string; kioskPinSet?: boolean; faceEnrolled?: boolean };
export type Punch = { id: string; employeeId: string; timestamp: string; kind: 'IN' | 'OUT'; source: 'manual' | 'csv' | 'sample' | 'kiosk' | 'face'; deviceId: string | null; note: string };
export type Device = { id: string; name: string; brand: string; model: string; serialNumber: string | null; method: string };
export type Workspace = { name: string; employees: Employee[]; schedules: Schedule[]; punches: Punch[]; devices: Device[]; today: string };
export type Status = 'Present' | 'Late' | 'Absent' | 'On duty' | 'Missing punch' | 'Off day' | 'Scheduled' | 'Not clocked in';
export type DailyRecord = { employee: Employee; schedule?: Schedule; date: string; clockIn: string | null; clockOut: string | null; status: Status; lateMinutes: number; paidMinutes: number; overtimeMinutes: number; issues: string[]; events: Punch[]; open: boolean; scheduled: boolean };

export function dateMY(value: string | Date = new Date()) { return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10); }
export function addDays(date: string, amount: number) { return new Date(Date.parse(date + 'T12:00:00Z') + amount * 86400000).toISOString().slice(0, 10); }
export function localInstant(date: string, time: string) { return new Date(`${date}T${time}:00+08:00`).toISOString(); }
export function minuteOfDay(time: string) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
export function shiftDuration(schedule: Schedule) { const start = minuteOfDay(schedule.startTime), end = minuteOfDay(schedule.endTime); return end > start ? end - start : 1440 - start + end; }
export function timeMY(timestamp: string | null) { return timestamp ? new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp)) : '—'; }
export function dateLabel(date: string, long = false) { return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00+08:00')); }
export function durationLabel(minutes: number) { return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60).toString().padStart(2, '0')}m`; }
export function workDate(punch: Pick<Punch, 'timestamp'>, schedule?: Schedule) {
  const date = dateMY(punch.timestamp);
  if (schedule && minuteOfDay(schedule.endTime) < minuteOfDay(schedule.startTime)) {
    const minutes = minuteOfDay(timeMY(punch.timestamp));
    // Morning punches belong to the previous night's shift, including a two-hour checkout window.
    if (minutes <= Math.min(minuteOfDay(schedule.endTime) + 120, minuteOfDay(schedule.startTime) - 1)) return addDays(date, -1);
  }
  return date;
}

export function summarizeDay(employee: Employee, date: string, all: Punch[], schedule?: Schedule, now = new Date()): DailyRecord {
  const events = all.filter(p => p.employeeId === employee.id && workDate(p, schedule) === date).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const scheduled = !!schedule && schedule.weekdays.split(',').includes(String(weekday)) && date >= employee.startDate && (!employee.endDate || date <= employee.endDate);
  const overnight = !!schedule && minuteOfDay(schedule.endTime) < minuteOfDay(schedule.startTime);
  const shiftStart = schedule ? Date.parse(localInstant(date, schedule.startTime)) : 0;
  const shiftEnd = schedule ? Date.parse(localInstant(overnight ? addDays(date, 1) : date, schedule.endTime)) : 0;
  let pending: Punch | null = null, worked = 0, clockIn: string | null = null, clockOut: string | null = null;
  let completedStart: string | null = null, completedEnd: string | null = null;
  const issues: string[] = [];
  for (const event of events) {
    if (event.kind === 'IN') {
      clockIn ??= event.timestamp;
      if (pending) issues.push('Repeated clock-in without a clock-out');
      else pending = event;
    } else {
      if (!pending) issues.push('Clock-out without a clock-in');
      else {
        completedStart ??= pending.timestamp;
        completedEnd = event.timestamp;
        worked += Math.max(0, Math.floor((Date.parse(event.timestamp) - Date.parse(pending.timestamp)) / 60000));
        clockOut = event.timestamp;
        pending = null;
      }
    }
  }
  if (pending && now.getTime() > shiftEnd) issues.push('Clock-out is missing');
  const lateMinutes = scheduled && clockIn && schedule && Date.parse(clockIn) > shiftStart + schedule.graceMinutes * 60000 ? Math.max(0, Math.round((Date.parse(clockIn) - shiftStart) / 60000)) : 0;
  const completedSpan = completedStart && completedEnd ? Math.floor((Date.parse(completedEnd) - Date.parse(completedStart)) / 60000) : 0;
  const recordedGaps = Math.max(0, completedSpan - worked);
  const breakToDeduct = worked ? Math.max(0, (schedule?.breakMinutes ?? 0) - recordedGaps) : 0;
  const paidMinutes = Math.max(0, worked - breakToDeduct);
  const scheduledMinutes = schedule ? shiftDuration(schedule) - schedule.breakMinutes : 0;
  let status: Status;
  if (!events.length) status = !scheduled ? 'Off day' : now.getTime() < shiftStart ? 'Scheduled' : now.getTime() <= shiftEnd ? 'Not clocked in' : 'Absent';
  else status = issues.length ? 'Missing punch' : lateMinutes ? 'Late' : pending ? 'On duty' : 'Present';
  return { employee, schedule, date, events, clockIn, clockOut: pending ? null : clockOut, open: !!pending, status, scheduled, lateMinutes, paidMinutes, overtimeMinutes: Math.max(0, paidMinutes - scheduledMinutes), issues };
}

export function recordsForDay(data: Workspace, date: string, now = new Date()) { return data.employees.filter(e => e.startDate <= date && (!e.endDate || date <= e.endDate) && (e.active || !!e.endDate)).map(e => summarizeDay(e, date, data.punches, data.schedules.find(s => s.id === e.scheduleId), now)); }
export function monthDates(month: string, today: string) {
  const start = month + '-01', end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const dates: string[] = [];
  for (let d = start; d <= end && d <= today; d = addDays(d, 1)) dates.push(d);
  return dates;
}
export function csvCell(value: string | number) {
  let text = String(value);
  // Protect exported spreadsheets from interpreting employee-supplied strings as formulas.
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else if (quoted || !value.length) quoted = !quoted; else throw new Error('Unexpected quote in CSV.'); }
    else if (c === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value.trim()); if (row.some(v => v)) rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (quoted) throw new Error('CSV contains an unclosed quote.');
  row.push(value.trim()); if (row.some(v => v)) rows.push(row);
  return rows;
}
