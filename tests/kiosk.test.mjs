import test from 'node:test';
import assert from 'node:assert/strict';
import { validPin, hashPin, verifyPin, verifyPassword } from '../lib/password.mjs';
import { kioskWorkday, existingClockIn, clockOutState, kioskPunchKind, attemptWindow } from '../lib/kiosk-policy.ts';

const office = { id: 'office', name: 'Office', startTime: '09:00', endTime: '18:00', weekdays: '1,2,3,4,5', breakMinutes: 60, graceMinutes: 10 };
const night = { ...office, startTime: '22:00', endTime: '06:00' };
const staff = { active: true, startDate: '2026-10-01', endDate: null };
test('PINs retain leading zeros and reject numeric, partial or non-digit values', () => {
  assert.equal(validPin('001234'), true);
  for (const pin of ['12345', '1234567', '12a456', '１２３４５６', ' 123456', 123456, null]) assert.equal(validPin(pin), false);
});
test('each kiosk PIN has a salted hash and cannot authenticate as an administrator password', async () => {
  const a = await hashPin('001234'), b = await hashPin('001234');
  assert.notEqual(a, b); assert.ok(!a.includes('001234'));
  assert.equal(await verifyPin('001234', a), true);
  assert.equal(await verifyPin('123400', a), false);
  assert.equal(await verifyPin('001234', ''), false);
  assert.equal(await verifyPassword('001234', a), false);
  await assert.rejects(hashPin('1234'), /six-digit/);
});
test('kiosk employment validation covers inactive, future and ended employees', () => {
  const now = '2026-10-12T01:00:00.000Z';
  assert.equal(kioskWorkday(staff, now, office), '2026-10-12');
  assert.equal(kioskWorkday({ ...staff, active: false }, now, office), null);
  assert.equal(kioskWorkday({ ...staff, startDate: '2026-10-13' }, now, office), null);
  assert.equal(kioskWorkday({ ...staff, endDate: '2026-10-11' }, now, office), null);
  assert.equal(kioskWorkday({ ...staff, endDate: '2026-10-12' }, now, office), '2026-10-12');
});
test('overnight clock-ins use the shift workday for employment and duplicate checks', () => {
  const events = [{ kind: 'IN', timestamp: '2026-10-11T14:00:00.000Z' }, { kind: 'OUT', timestamp: '2026-10-11T22:00:00.000Z' }];
  const day = kioskWorkday(staff, '2026-10-11T19:00:00.000Z', night);
  assert.equal(day, '2026-10-11');
  assert.equal(existingClockIn(events, day, night).timestamp, events[0].timestamp);
  assert.equal(existingClockIn(events, '2026-10-12', night), null);
  assert.equal(kioskWorkday({ ...staff, startDate: '2026-10-12' }, '2026-10-11T19:00:00.000Z', night), null);
});
test('repeat clock-ins return the first IN, never an OUT or another workday', () => {
  const events = [{ kind: 'OUT', timestamp: '2026-10-12T00:30:00.000Z' }, { kind: 'IN', timestamp: '2026-10-12T02:00:00.000Z' }, { kind: 'IN', timestamp: '2026-10-12T01:00:00.000Z' }, { kind: 'IN', timestamp: '2026-10-11T01:00:00.000Z' }];
  assert.equal(existingClockIn(events, '2026-10-12', office).timestamp, '2026-10-12T01:00:00.000Z');
  assert.equal(existingClockIn(events.filter(e => e.kind === 'OUT'), '2026-10-12', office), null);
});
test('five failed PINs lock the employee for exactly the current 15-minute window', () => {
  const attempt = { failures: 5, windowStart: '2026-10-12T01:00:00.000Z' };
  assert.equal(attemptWindow(attempt, '2026-10-12T01:14:59.999Z', 5, 900000).limited, true);
  assert.deepEqual(attemptWindow(attempt, '2026-10-12T01:15:00.000Z', 5, 900000), { limited: false, count: 0, start: '2026-10-12T01:15:00.000Z' });
  assert.equal(attemptWindow({ ...attempt, failures: 4 }, '2026-10-12T01:01:00.000Z', 5, 900000).limited, false);
});

test('kiosk events default to IN for older clients and strictly validate explicit choices', () => {
  assert.equal(kioskPunchKind(undefined), 'IN'); assert.equal(kioskPunchKind('IN'), 'IN'); assert.equal(kioskPunchKind('OUT'), 'OUT');
  for (const kind of [null, 'out', ' OUT', 'DELETE', true, 1, {}]) assert.equal(kioskPunchKind(kind), null);
});
test('clock-out needs a same-workday clock-in and ignores orphan OUT records', () => {
  const clockIn = { kind: 'IN', timestamp: '2026-10-12T01:00:00.000Z' };
  const orphan = { kind: 'OUT', timestamp: '2026-10-12T00:30:00.000Z' };
  assert.deepEqual(clockOutState([], '2026-10-12', office), { clockIn: null, clockOut: null });
  assert.deepEqual(clockOutState([orphan], '2026-10-12', office), { clockIn: null, clockOut: null });
  assert.deepEqual(clockOutState([clockIn, orphan], '2026-10-12', office), { clockIn, clockOut: null });
  assert.deepEqual(clockOutState([clockIn], '2026-10-13', office), { clockIn: null, clockOut: null });
});
test('a completed pair returns its saved OUT for repeats instead of an unrelated orphan OUT', () => {
  const clockIn = { kind: 'IN', timestamp: '2026-10-12T01:00:00.000Z' };
  const clockOut = { kind: 'OUT', timestamp: '2026-10-12T10:00:00.000Z' };
  const orphan = { kind: 'OUT', timestamp: '2026-10-12T11:00:00.000Z' };
  assert.deepEqual(clockOutState([orphan, clockOut, clockIn], '2026-10-12', office), { clockIn: null, clockOut });
});
test('an administrator can reopen a session after lunch and kiosk OUT closes that open session', () => {
  const first = { kind: 'IN', timestamp: '2026-10-12T01:00:00.000Z' };
  const lunch = { kind: 'OUT', timestamp: '2026-10-12T04:00:00.000Z' };
  const afternoon = { kind: 'IN', timestamp: '2026-10-12T05:00:00.000Z' };
  const duplicate = { kind: 'IN', timestamp: '2026-10-12T05:01:00.000Z' };
  assert.deepEqual(clockOutState([duplicate, lunch, afternoon, first], '2026-10-12', office), { clockIn: afternoon, clockOut: lunch });
});
test('overnight checkout completes the prior night and does not close another workday', () => {
  const clockIn = { kind: 'IN', timestamp: '2026-10-11T14:00:00.000Z' };
  const clockOut = { kind: 'OUT', timestamp: '2026-10-11T22:00:00.000Z' };
  assert.deepEqual(clockOutState([clockIn], '2026-10-11', night), { clockIn, clockOut: null });
  assert.deepEqual(clockOutState([clockIn, clockOut], '2026-10-11', night), { clockIn: null, clockOut });
  assert.deepEqual(clockOutState([clockIn, clockOut], '2026-10-12', night), { clockIn: null, clockOut: null });
});
