export const personalFields = {preferredName:'Preferred name',email:'Personal email',phone:'Personal contact number',address:'Home address',emergencyName:'Emergency contact name',emergencyPhone:'Emergency contact number'};
export const jobFields = {title:'Job title',employmentType:'Employment type',location:'Work location',manager:'Reporting manager',workEmail:'Work email',probationEnd:'Probation end date'};
export function validateProfile(value:unknown, job=false):Record<string,string> {
 if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid details.');
 const fields=job?jobFields:personalFields; const input=value as Record<string,unknown>; const result:Record<string,string>={};
 if(Object.keys(input).some(k=>!Object.hasOwn(fields,k))) throw new Error('Unsupported field.');
 for(const key of Object.keys(fields)) {
  const v=input[key]??''; if(typeof v!=='string'||v.length>(key==='address'?500:120)) throw new Error('A field is too long or invalid.');
  result[key]=v.trim();
  if(result[key]&&/email/i.test(key)&&! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result[key])) throw new Error('Enter a valid email address.');
 }
 if(result.probationEnd&&(!/^\d{4}-\d{2}-\d{2}$/.test(result.probationEnd)||Number.isNaN(Date.parse(result.probationEnd))||new Date(result.probationEnd).toISOString().slice(0,10)!==result.probationEnd)) throw new Error('Enter a valid probation date.');
 return result;
}
