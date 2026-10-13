'use client';

import { useState, type FormEvent } from 'react';
import { Check, KeyRound, LoaderCircle, Monitor, ShieldCheck, Trash2 } from 'lucide-react';
import FaceSettings from './face-settings';
import type { Employee } from '@/lib/attendance';

export default function KioskSettings({ employees, busy, save, onSaved }: { employees: Employee[]; busy: boolean; onSaved: () => Promise<void>; save: (body: Record<string, unknown>, close?: boolean) => Promise<boolean> }) {
  const [employeeId, setEmployeeId] = useState(''), [pin, setPin] = useState(''), [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [working, setWorking] = useState(false), [revoke, setRevoke] = useState(false), [remove, setRemove] = useState(false);
  const employee = employees.find(e => e.id === employeeId);
  const ready = employees.filter(e => e.active && (e.kioskPinSet || e.faceEnrolled)).length;
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    if (!employeeId || !/^[0-9]{6}$/.test(pin)) { setError('Choose an employee and enter a six-digit PIN.'); return; }
    if (pin !== confirm) { setError('The two PINs do not match.'); return; }
    if (await save({ action: 'employee-pin', employeeId, pin }, false)) { setPin(''); setConfirm(''); setMessage('PIN saved. Share it privately with this employee.'); }
  }
  async function station(action: 'start' | 'revoke') {
    if (busy || working) return;
    setWorking(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/kiosk/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (response.status === 401) { window.location.assign('/login'); return; }
      if (!response.ok) throw new Error(result.error || 'Could not update the kiosk.');
      if (action === 'start') { window.location.assign('/kiosk'); return; }
      setMessage(result.message); setRevoke(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setWorking(false); }
  }
  return <div className="settings-grid kiosk-settings">
    <section className="card settings-card"><div className="card-heading"><div><h2>Employee PINs</h2><p>Give each employee their own six-digit PIN.</p></div><KeyRound size={22} /></div>
      {!employees.length ? <p className="settings-copy">Add employees on the Employees page first.</p> : <form className="kiosk-pin-form" onSubmit={submit}>
        <label>Employee<select required value={employeeId} disabled={busy || working} onChange={e => { setEmployeeId(e.target.value); setPin(''); setConfirm(''); setError(''); setMessage(''); setRemove(false); }}><option value="">Choose an employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.code}{!e.active ? ' (inactive)' : ''}</option>)}</select></label>
        {employee && <p className="kiosk-hint">{employee.kioskPinSet ? 'PIN is set. Saving a new PIN replaces it and unlocks failed attempts.' : 'No PIN set. Set a PIN to enable PIN clock-in.'}</p>}
        <div className="form-row"><label>New PIN<input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={pin} disabled={busy || working} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="Six digits" /></label><label>Confirm PIN<input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={confirm} disabled={busy || working} onChange={e => setConfirm(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="Enter again" /></label></div>
        <div className="kiosk-admin-actions"><button className="button primary" disabled={busy || working || !employeeId}><Check size={17} />Save PIN</button>{employee?.kioskPinSet && <button type="button" className="button danger-outline" disabled={busy || working} onClick={async () => {
          if (!remove) { setRemove(true); return; }
          if (await save({ action: 'remove-employee-pin', employeeId }, false)) { setRemove(false); setPin(''); setConfirm(''); setMessage('PIN removed. An enrolled face can still be used to clock in.'); }
        }}><Trash2 size={16} />{remove ? 'Confirm remove PIN' : 'Remove PIN'}</button>}</div>
      </form>}
      <p className="settings-copy">PINs are stored as salted hashes and cannot be viewed. Reset a PIN if someone forgets it.</p>
    </section>
    <FaceSettings employees={employees} disabled={busy || working} onSaved={onSaved} />
    <section className="card settings-card"><div className="card-heading"><div><h2>Attendance kiosk</h2><p>Make this browser your shared attendance station.</p></div><Monitor size={23} /></div>
      <div className="sample-summary"><span>Active employees ready for the kiosk</span><strong>{ready}</strong></div>
      <p className="settings-copy">Staff choose Clock in or Clock out, select their name, then verify with their face or PIN. The server records the current time in MySQL. The kiosk stays connected for 30 days and remembers this workspace in this browser.</p>
      <div className="info-note compact"><ShieldCheck size={19} /><p>Starting the kiosk signs you out of the administrator screens in this browser. Sign in again to manage staff or return to your dashboard.</p></div>
      <button className="button primary" disabled={busy || working || !ready} onClick={() => station('start')}>{working ? <LoaderCircle size={18} className="spin" /> : <Monitor size={18} />}Start kiosk & sign out</button>
      <p className="settings-copy">Clock out completes an open clock-in for the same workday. Repeat submissions show the saved record. Ask an administrator to correct a missing clock-in.</p>
      <div className="kiosk-admin-actions"><button className="button danger-outline" disabled={busy || working} onClick={() => revoke ? station('revoke') : setRevoke(true)}><Trash2 size={16} />{revoke ? 'Confirm disconnect all kiosks' : 'Disconnect all kiosks'}</button>{revoke && <button className="text-button" onClick={() => setRevoke(false)}>Cancel</button>}</div>
    </section>
    {(error || message) && <div className={error ? 'auth-error' : 'info-note'} role={error ? 'alert' : 'status'}>{error || message}</div>}
  </div>;
}
