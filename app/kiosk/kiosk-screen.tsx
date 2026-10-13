'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Delete, LoaderCircle, LockKeyhole, RefreshCw } from 'lucide-react';
import ThemeToggle from '../theme-toggle';
import { dateMY, dateLabel, timeMY } from '@/lib/attendance';

type Roster = { name: string; now: string; employees: { id: string; name: string; code: string }[] };
type Success = { name: string; timestamp: string; already: boolean; message: string };
export default function KioskScreen() {
  const [roster, setRoster] = useState<Roster | null>(null), [locked, setLocked] = useState(false), [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState(''), [pin, setPin] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [success, setSuccess] = useState<Success | null>(null), [now, setNow] = useState<string | null>(null);
  const clock = useRef({ server: 0, client: 0 }), sending = useRef(false), select = useRef<HTMLSelectElement>(null), pinInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/kiosk', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) { setLocked(response.status === 401); throw new Error(data.error || 'Could not load the kiosk.'); }
      setLocked(false); setRoster(data); setError('');
      clock.current = { server: Date.parse(data.now), client: Date.now() }; setNow(data.now);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection failed. Please retry.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { if (clock.current.server) setNow(new Date(clock.current.server + Date.now() - clock.current.client).toISOString()); }, 1000);
    const refresh = setInterval(() => { if (!sending.current) load(); }, 60000);
    return () => { clearInterval(timer); clearInterval(refresh); };
  }, [load]);
  function reset() { setSuccess(null); setEmployeeId(''); setPin(''); setError(''); setTimeout(() => select.current?.focus(), 0); }
  useEffect(() => { if (!success) return; const timer = setTimeout(reset, 5000); return () => clearTimeout(timer); }, [success]);
  useEffect(() => { if (!pin || busy) return; const timer = setTimeout(() => { setPin(''); setEmployeeId(''); }, 30000); return () => clearTimeout(timer); }, [pin, busy]);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (sending.current || !employeeId || pin.length !== 6) return;
    sending.current = true; setBusy(true); setError('');
    const credentials = { employeeId, pin }; setPin('');
    try {
      const response = await fetch('/api/kiosk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials), signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (!response.ok) { if (data.code === 'KIOSK_DISCONNECTED') setLocked(true); throw new Error(data.error || 'Could not save attendance.'); }
      setSuccess(data); setEmployeeId('');
    } catch (e) { setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Connection timed out. Try again; another clock-in will not be added.'); pinInput.current?.focus(); }
    finally { sending.current = false; setBusy(false); }
  }
  return <main className="kiosk-screen">
    <header className="kiosk-header"><div className="auth-brand">hadir<span>.</span></div><div><span className="kiosk-workspace">{roster?.name ?? 'Attendance kiosk'}</span><ThemeToggle /></div></header>
    <section className="kiosk-card">
      <div className="kiosk-clock"><span><Clock3 size={16} />Malaysia time · GMT+8</span><strong>{now ? timeMY(now) : '—'}</strong><p>{now ? dateLabel(dateMY(now), true) : 'Connecting to your workspace…'}</p></div>
      {loading ? <div className="kiosk-state"><LoaderCircle className="spin" size={32} /><p>Loading kiosk…</p></div> : locked ? <div className="kiosk-state"><LockKeyhole size={35} /><h1>Kiosk setup required</h1><p>{error}</p><a className="button primary" href="/login">Administrator sign-in<ArrowRight size={17} /></a></div> : success ? <div className="kiosk-state kiosk-success" role="status" aria-live="polite"><CheckCircle2 size={52} /><h1>{success.already ? 'Already clocked in' : 'You’re clocked in.'}</h1><strong>{success.name}</strong><p>{timeMY(success.timestamp)} MYT · {dateLabel(dateMY(success.timestamp), true)}</p><span>Ready for the next person in 5 seconds.</span><button className="button secondary" onClick={reset}>Next person<ArrowRight size={17} /></button></div> : <>
      <div className="kiosk-heading"><div className="eyebrow">START YOUR WORKDAY</div><h1>Clock in</h1><p>Choose your name and enter your six-digit PIN.</p></div>
      {!roster ? <div className="kiosk-state"><p role="alert">{error}</p><button className="button secondary" onClick={load}><RefreshCw size={17} />Retry connection</button></div> : !roster.employees.length ? <div className="kiosk-state"><p>No employees are ready to clock in. Ask the administrator to check active staff, start dates and PINs.</p></div> : <form className="kiosk-form" onSubmit={submit}>
        <label>Your name<select ref={select} value={employeeId} required disabled={busy} onChange={e => { setEmployeeId(e.target.value); setPin(''); setError(''); pinInput.current?.focus(); }}><option value="">Choose your name…</option>{roster.employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.code}</option>)}</select></label>
        <label>Your PIN<input ref={pinInput} type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} required value={pin} disabled={busy || !employeeId} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="Six-digit PIN" aria-describedby="kiosk-pin-help" /></label>
        <div className="kiosk-keypad" aria-label="PIN keypad">{['1','2','3','4','5','6','7','8','9','clear','0','delete'].map(key => <button type="button" key={key} disabled={busy || !employeeId} aria-label={key === 'delete' ? 'Delete last digit' : key === 'clear' ? 'Clear PIN' : key} onClick={() => setPin(p => key === 'clear' ? '' : key === 'delete' ? p.slice(0, -1) : (p + key).slice(0, 6))}>{key === 'delete' ? <Delete size={23} /> : key === 'clear' ? 'Clear' : key}</button>)}</div>
        <p id="kiosk-pin-help" className="kiosk-hint">Forgot your PIN? Ask your administrator to reset it.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="button primary kiosk-submit" disabled={busy || !employeeId || pin.length !== 6}>{busy ? <LoaderCircle size={20} className="spin" /> : <ArrowRight size={20} />}{busy ? 'Saving clock-in…' : 'Clock in'}</button>
      </form>}</>}
    </section><footer className="kiosk-footer"><span>Attendance, made clear.</span><a href="/login">Administrator sign-in</a></footer>
  </main>;
}
