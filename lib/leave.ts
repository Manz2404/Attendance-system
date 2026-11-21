export const leaveTypes = ['annual', 'inpatient', 'outpatient', 'maternity', 'exam', 'mc'] as const;
export type LeaveType = typeof leaveTypes[number];
export const leaveLabels: Record<LeaveType, string> = { annual: 'Annual leave', inpatient: 'Inpatient', outpatient: 'Outpatient', maternity: 'Maternity', exam: 'Exam', mc: 'MC leave' };
export type LeavePolicy = { calendar: LeaveType[]; attachment: LeaveType[]; holidays: string[]; managers: Record<string, string> };
export const defaultLeavePolicy: LeavePolicy = { calendar: ['inpatient', 'maternity'], attachment: ['inpatient', 'outpatient', 'mc'], holidays: [], managers: {} };
export type LeaveDay = { date: string; units: number; part: 'full' | 'am' | 'pm' };
export type LeaveRecord = { id: string; employeeId: string; type: LeaveType; year: number; days: LeaveDay[]; status: string; requestedBy: string };
export function validDate(value: unknown): value is string {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const d = new Date(value + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function leaveDays(start: string, end: string, part: string, weekdays: string, calendar: boolean, holidays: string[]): LeaveDay[] {
 if (!validDate(start) || !validDate(end) || end < start || start.slice(0,4) !== end.slice(0,4)) throw new Error('Choose valid dates within one calendar year. Split requests that cross years.');
 if (!['full','am','pm'].includes(part) || part !== 'full' && start !== end) throw new Error('Half-day leave must be for a single date.');
 const result: LeaveDay[] = [];
 for (let d = new Date(start + 'T00:00:00Z'); d.toISOString().slice(0,10) <= end; d.setUTCDate(d.getUTCDate()+1)) {
  const date = d.toISOString().slice(0,10);
  if (calendar || weekdays.split(',').includes(String(d.getUTCDay())) && !holidays.includes(date)) result.push({date, units: part === 'full' ? 2 : 1, part: part as LeaveDay['part']});
 }
 if (!result.length) throw new Error('There are no chargeable days in this date range.');
 return result;
}
export function units(days: LeaveDay[]) { return days.reduce((n,d) => n+d.units,0); }
export function reserved(status: string) { return ['pending','approved','cancel_requested'].includes(status); }
export function balance(records: LeaveRecord[], employeeId: string, type: LeaveType, year: number, entitlement: number) {
 const own = records.filter(r => r.employeeId === employeeId && r.type === type && r.year === year);
 const used = own.filter(r=> ['approved','cancel_requested'].includes(r.status)).reduce((n,r)=> n+units(r.days),0);
 const pending = own.filter(r=>r.status==='pending').reduce((n,r)=>n+units(r.days),0);
 return { entitlement: entitlement/2, used: used/2, pending: pending/2, available: (entitlement-used-pending)/2 };
}
export function overlaps(a: LeaveDay[], b: LeaveDay[]) { return a.some(x=>b.some(y=>x.date===y.date && (x.part==='full'||y.part==='full'||x.part===y.part))); }
export function mayReview(role: string, userId: string, employeeId: string | null, request: LeaveRecord, policy: LeavePolicy) {
 return request.requestedBy !== userId && request.employeeId !== employeeId && (role==='admin'||role==='hr'||policy.managers[request.employeeId]===userId);
}
