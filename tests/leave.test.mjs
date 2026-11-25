import test from 'node:test';
import assert from 'node:assert/strict';
import { leaveDays, units, balance, overlaps, mayReview, defaultLeavePolicy } from '../lib/leave.ts';
test('working days exclude rest days and holidays; calendar days include them',()=>{
 assert.equal(units(leaveDays('2026-11-20','2026-11-23','full','1,2,3,4,5',false,['2026-11-23'])),2);
 assert.equal(units(leaveDays('2026-11-20','2026-11-23','full','1,2,3,4,5',true,['2026-11-23'])),8);
 assert.throws(()=>leaveDays('2026-12-31','2027-01-01','full','1',true,[]));
 assert.throws(()=>leaveDays('2026-02-30','2026-02-30','full','1',true,[]));
 assert.throws(()=>leaveDays('2026-11-21','2026-11-22','full','1,2,3,4,5',false,[]));
});
test('half days overlap correctly and cannot span multiple dates',()=>{
 const am=leaveDays('2026-11-23','2026-11-23','am','1',false,[]),pm=leaveDays('2026-11-23','2026-11-23','pm','1',false,[]);
 assert.equal(units(am),1);assert.equal(overlaps(am,pm),false);assert.equal(overlaps(am,am),true);
 assert.equal(overlaps(am,leaveDays('2026-11-23','2026-11-23','full','1',false,[])),true);
 assert.throws(()=>leaveDays('2026-11-23','2026-11-24','am','1,2',false,[]));
});
test('balances reserve pending and cancellation-pending leave without double counting',()=>{
 const r={id:'r',employeeId:'e',type:'annual',year:2026,requestedBy:'u',days:[{date:'2026-11-23',units:2,part:'full'}]};
 const requests=['approved','pending','cancel_requested','cancelled','rejected'].map(status=>({...r,status}));
 assert.deepEqual(balance(requests,'e','annual',2026,20),{entitlement:10,used:2,pending:1,available:7});
 assert.equal(balance(requests,'other','annual',2026,20).available,10);
 assert.equal(balance(requests,'e','annual',2027,20).available,10);
});
test('approvers cannot approve their own or another manager’s staff requests',()=>{
 const r={id:'r',employeeId:'e',requestedBy:'u',type:'annual',year:2026,days:[],status:'pending'};
 const p={...defaultLeavePolicy,managers:{e:'manager'}};
 assert.equal(mayReview('staff','manager','managerEmployee',r,p),true);
 assert.equal(mayReview('staff','other',null,r,p),false);
 assert.equal(mayReview('admin','u',null,r,p),false);
 assert.equal(mayReview('hr','hr','e',r,p),false);
 assert.equal(mayReview('hr','hr',null,r,p),true);
});
