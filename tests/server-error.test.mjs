import test from 'node:test';
import assert from 'node:assert/strict';
import { logServerError } from '../lib/server-error.ts';
test('server diagnostics keep error codes without SQL, messages or personal data',()=>{
 const original=console.error;const entries=[];
 try {
  console.error=(...args)=>entries.push(args);
  logServerError('profile.load',{name:'Error',code:'ER_NO_SUCH_TABLE',message:'secret personal data',sql:'SELECT private'});
  assert.deepEqual(entries,[['[profile.load]',{type:'Error',code:'ER_NO_SUCH_TABLE'}]]);
 } finally {console.error=original;}
});
