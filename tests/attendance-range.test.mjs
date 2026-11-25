import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceRange } from '../lib/attendance-range.ts';
test('bounded default and explicit historical ranges retain overnight boundary punches', () => {
 const range=attendanceRange(new URLSearchParams('from=2026-01-31&to=2026-02-01'));
 assert.equal(range.from,'2026-01-29T16:00:00.000Z');
 assert.equal(range.until,'2026-02-02T16:00:00.000Z');
 assert.equal(attendanceRange(undefined,'2026-11-25').start,'2026-10-25');
});
test('invalid, reversed and unbounded ranges are rejected',()=>{
 for(const query of ['from=2026-02-30','from=bad','to=bad','from=2026-11-25&to=2026-11-24','from=2020-01-01&to=2026-11-25']) assert.throws(()=>attendanceRange(new URLSearchParams(query)));
});
