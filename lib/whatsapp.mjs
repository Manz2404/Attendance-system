export function normalizePhone(value) {
  if (value === '' || value === null) return null;
  if (typeof value !== 'string' || value.length > 40 || !/^[+0-9 ()-]+$/.test(value)) throw new Error('Enter a valid WhatsApp phone number.');
  let number = value.replace(/[ ()-]/g, '');
  if (number.startsWith('+')) number = number.slice(1);
  else if (number.startsWith('00')) number = number.slice(2);
  else if (number.startsWith('0')) number = '60' + number.slice(1);
  if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error('Use a country code, for example +60123456789.');
  return number;
}
export function whatsappLink(phone, name, workspace) {
  const number = normalizePhone(phone);
  if (!number) return null;
  const message = `Hi ${name}, ini admin ${workspace}. Saya ingin menghubungi anda berkenaan kehadiran kerja.`;
  return 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
}
