
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, whatsappLink } from '../lib/whatsapp.mjs';
test('normalize local and international phone numbers', () => {
 for (const phone of ['012-345 6789','+60 (12) 3456789','0060123456789','60123456789']) assert.equal(normalizePhone(phone),'60123456789');
 assert.equal(normalizePhone('+44 7700 900123'),'447700900123');
 assert.equal(normalizePhone(''),null);
 for (const invalid of ['abc','+60+123456789','123','https://evil.test',{},'1'.repeat(16)]) assert.throws(()=>normalizePhone(invalid));
});
test('WhatsApp links encode a draft and cannot change the destination host', () => {
 const link=new URL(whatsappLink('0123456789','Aina & Ali','Office #1'));
 assert.equal(link.origin,'https://wa.me'); assert.equal(link.pathname,'/60123456789');
 assert.equal(link.searchParams.get('text'),'Hi Aina & Ali, ini admin Office #1. Saya ingin menghubungi anda berkenaan kehadiran kerja.');
 assert.equal(whatsappLink(null,'A','B'),null);
});
