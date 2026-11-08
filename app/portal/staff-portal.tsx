'use client';
import { useEffect, useState } from 'react';
import ThemeToggle from '../theme-toggle';
import { dateMY, dateLabel, timeMY, monthDates, recordsForDay, durationLabel, type Employee, type Schedule, type Punch, type Workspace } from '@/lib/attendance';
type PortalData = { name: string; employee: Employee; schedules: Schedule[]; punches: Punch[] };
export default function StaffPortal() {
 const [data, setData] = useState<PortalData | null>(null), [error, setError] = useState(''), [month, setMonth] = useState(dateMY().slice(0, 7)), [updated, setUpdated] = useState('');
 useEffect(() => {
  let stopped = false, pending = false;
  const controller = new AbortController();
  async function load() {
   if (pending || stopped || document.visibilityState !== 'visible') return;
   pending = true;
   try {
    const response = await fetch('/api/portal', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
    if (response.status === 401 || response.status === 403) { window.location.assign('/'); return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load attendance.');
    if (!stopped) { setData(result); setError(''); setUpdated(new Date().toISOString()); }
   } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Connection failed. Retrying automatically.'); }
   finally { pending = false; }
  }
  load(); const timer = setInterval(load, 15000);
  document.addEventListener('visibilitychange', load); window.addEventListener('online', load);
  return () => { stopped = true; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load); window.removeEventListener('online', load); };
 }, []);
 const workspace: Workspace | null = data ? { name: data.name, employees: [{ ...data.employee, deviceUserId: null, createdAt: '' }], schedules: data.schedules, punches: data.punches.map(p => ({ ...p, note: '', deviceId: null })), devices: [], today: dateMY() } : null;
 const records = workspace && /^\d{4}-\d{2}$/.test(month) ? monthDates(month, dateMY()).filter(d => d <= dateMY()).flatMap(d => recordsForDay(workspace, d)) : [];
 const worked = records.reduce((total, r) => total + r.paidMinutes, 0);
 const shift = data?.schedules[0];
 return <main className="member-page">
  <header className="member-header"><strong>hadir. <span className="muted">Staff portal</span></strong><div className="member-actions"><ThemeToggle /><a className="button secondary" href="/logout">Sign out</a></div></header>
  {error && <p className="error-banner" role="alert">{error} Retrying automatically.</p>}
  {!data ? <section className="card empty-state"><h1>Opening your attendance…</h1></section> : <>
   <section className="card staff-welcome">{data.employee.profilePhoto ? <img src={data.employee.profilePhoto} alt="" className="staff-photo" /> : <span className="staff-photo staff-initials">{data.employee.name.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span>}<div><div className="eyebrow">{data.name}</div><h1>Hello, {data.employee.name}</h1><p>{data.employee.code} · {data.employee.department}</p><p>{shift ? shift.name + ' · ' + shift.startTime + '–' + shift.endTime : 'No schedule assigned'} · Malaysia time</p></div></section>
   <div className="page-header"><div><h2>My attendance</h2><p>Your own records, updated every 15 seconds.</p></div><label>Month<input type="month" required value={month} max={dateMY().slice(0, 7)} onChange={e => setMonth(e.target.value)} /></label></div>
   <div className="access-role-grid"><section className="card"><p>Days clocked in</p><h2>{records.filter(r => r.clockIn).length}</h2></section><section className="card"><p>Late arrivals</p><h2>{records.filter(r => r.lateMinutes > 0).length}</h2></section><section className="card"><p>Recorded paid hours</p><h2>{durationLabel(worked)}</h2></section></div>
   <section className="card"><div className="table-scroll"><table><thead><tr><th>Work date</th><th>Clock in</th><th>Clock out</th><th>Status</th><th>Paid hours</th></tr></thead><tbody>{records.slice().reverse().map(r => <tr key={r.date}><td>{dateLabel(r.date)}</td><td>{timeMY(r.clockIn)}</td><td>{timeMY(r.clockOut)}</td><td>{r.status}</td><td>{durationLabel(r.paidMinutes)}</td></tr>)}</tbody></table>{!records.length && <div className="empty-state">No attendance dates for this month.</div>}</div></section>
   <p className="info-note">Need a correction? Contact your Admin or HR. Clock-in and clock-out continue through your kiosk.</p>
   {updated && <p className="muted">Last synced {timeMY(updated)} MYT</p>}
  </>}
 </main>;
}
