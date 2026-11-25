import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfile} from '../lib/staff-profile.ts';
test('personal fields cannot include job or permission changes',()=>{
 assert.throws(()=>validateProfile({title:'Director'}));
 assert.throws(()=>validateProfile({role:'admin'}));
 assert.throws(()=>validateProfile({email:'bad'}));
 assert.throws(()=>validateProfile({address:'x'.repeat(501)}));
 assert.equal(validateProfile({preferredName:' Arman '}).preferredName,'Arman');
});
test('job fields validate real dates and exclude personal data',()=>{
 assert.throws(()=>validateProfile({probationEnd:'2027-02-30'},true));
 assert.throws(()=>validateProfile({phone:'123'},true));
 assert.equal(validateProfile({probationEnd:'2028-02-29',title:'Engineer'},true).title,'Engineer');
});
