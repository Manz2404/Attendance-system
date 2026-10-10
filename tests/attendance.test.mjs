import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDay, localInstant, workDate, recordsForDay, monthDates, parseCSV, csvCell } from '../lib/attendance.ts';
const day = '2026-10-09';
const shift = { id: 'day', name: 'Office', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, weekdays: '1,2,3,4,5' };
const employee = { id: 'e1', code: 'EMP-001', name: 'Test Employee', department: 'Support', scheduleId: shift.id, deviceUserId: null, active: true, isSample: false, startDate: '2026-01-01', endDate: null, createdAt: '2026-01-01T00:00:00Z' };
function punch(kind, time, date = day) { return { id: kind + time, employeeId: employee.id, timestamp: localInstant(date, time), kind, source: 'manual', deviceId: null, note: '' }; }
function summary(events, schedule = shift, now = new Date('2026-10-10T12:00:00+08:00')) { return summarizeDay(employee, day, events, schedule, now); }

test('continuous shift deducts one break and produces eight paid hours', () => {
  const r = summary([punch('IN', '09:00'), punch('OUT', '18:00')]);
  assert.equal(r.paidMinutes, 480); assert.equal(r.status, 'Present'); assert.equal(r.overtimeMinutes, 0);
});
test('split sessions do not deduct an already recorded lunch break twice', () => {
  const r = summary([punch('IN', '09:00'), punch('OUT', '12:00'), punch('IN', '13:00'), punch('OUT', '18:00')]);
  assert.equal(r.paidMinutes, 480);
});
test('grace period suppresses lateness within ten minutes', () => {
  const r = summary([punch('IN', '09:07'), punch('OUT', '18:00')]);
  assert.equal(r.status, 'Present'); assert.equal(r.lateMinutes, 0);
});
test('lateness beyond grace records full delay from scheduled start', () => {
  const r = summary([punch('IN', '09:24'), punch('OUT', '18:00')]);
  assert.equal(r.status, 'Late'); assert.equal(r.lateMinutes, 24); assert.equal(r.paidMinutes, 456);
});
test('unpaired previous-day clock-in has no invented working hours', () => {
  const r = summary([punch('IN', '09:00')]);
  assert.equal(r.status, 'Missing punch'); assert.equal(r.paidMinutes, 0); assert.equal(r.clockOut, null);
});
test('an open session during the current shift remains on duty', () => {
  const r = summary([punch('IN', '09:01')], shift, new Date('2026-10-09T16:00:00+08:00'));
  assert.equal(r.status, 'On duty'); assert.equal(r.open, true); assert.equal(r.issues.length, 0);
});
test('clock-out without clock-in is flagged for review', () => {
  const r = summary([punch('OUT', '18:00')]); assert.equal(r.status, 'Missing punch'); assert.equal(r.paidMinutes, 0);
});
test('repeated clock-ins are flagged and never inflate worked time', () => {
  const r = summary([punch('IN', '09:00'), punch('IN', '09:20'), punch('OUT', '18:00')]);
  assert.equal(r.status, 'Missing punch'); assert.equal(r.paidMinutes, 480);
});
test('overnight checkout belongs to previous shift date', () => {
  const night = { ...shift, startTime: '20:00', endTime: '08:00' };
  const events = [punch('IN', '20:00'), punch('OUT', '08:00', '2026-10-10')];
  const r = summary(events, night); assert.equal(r.events.length, 2); assert.equal(r.paidMinutes, 660); assert.equal(r.status, 'Present');
  assert.equal(workDate(events[1], night), day);
});
test('future days are scheduled, and off days are never marked absent', () => {
  assert.equal(summarizeDay(employee, '2026-10-12', [], shift, new Date('2026-10-10T12:00:00+08:00')).status, 'Scheduled');
  assert.equal(summarizeDay(employee, '2026-10-10', [], shift).status, 'Off day');
});
test('inactive employee keeps historic attendance without later absences', () => {
  const former = { ...employee, active: false, endDate: day };
  const data = { name: 'test', employees: [former], schedules: [shift], punches: [], devices: [], today: '2026-10-10' };
  assert.equal(recordsForDay(data, day).length, 1); assert.equal(recordsForDay(data, '2026-10-12').length, 0);
  assert.equal(summarizeDay(former, '2026-10-12', [], shift).scheduled, false);
});
test('monthly dates stop at today and before an employee is employed', () => {
  assert.equal(monthDates('2026-10', '2026-10-10').length, 10); assert.equal(monthDates('2026-11', '2026-10-10').length, 0);
  assert.equal(summarizeDay({ ...employee, startDate: '2026-10-15' }, day, [], shift).scheduled, false);
});
test('CSV parser handles BOM, quoted commas, multiline fields and escaped quotes', () => {
  assert.deepEqual(parseCSV('\uFEFFemployee_code,note\r\nEMP-001,"hello, \"\"team\"\"\nnext line"\r\n'), [['employee_code', 'note'], ['EMP-001', 'hello, "team"\nnext line']]);
  assert.throws(() => parseCSV('a,"broken'), /unclosed quote/);
});
test('exported user text cannot become a spreadsheet formula', () => {
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"'); assert.equal(csvCell('a"b'), '"a""b"');
});
