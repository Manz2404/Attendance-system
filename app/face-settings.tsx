'use client';
import { useEffect, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import type { Employee } from '@/lib/attendance';
import CameraCapture from './camera-capture';

export default function FaceSettings({ employees, onSaved, disabled }: { employees: Employee[]; onSaved: () => Promise<void>; disabled: boolean }) {
  const [employeeId, setEmployeeId] = useState(''), [consent, setConsent] = useState(false), [open, setOpen] = useState(false), [ready, setReady] = useState<boolean | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [working, setWorking] = useState(false), [remove, setRemove] = useState(false);
  const employee = employees.find(e => e.id === employeeId);
  useEffect(() => { fetch('/api/kiosk/face-enrollment', { cache: 'no-store' }).then(r => r.json()).then(d => setReady(d.ready === true)).catch(() => setReady(false)); }, []);
  async function save(images?: string[]) {
    setWorking(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/kiosk/face-enrollment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: images ? 'enroll' : 'remove', employeeId, consent, images }), signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (response.status === 401) { window.location.assign('/login'); throw new Error('Administrator sign-in is required.'); }
      if (!response.ok) throw new Error(data.error || 'Could not update face enrollment.');
      await onSaved(); setMessage(data.message); setOpen(false); setConsent(false); setRemove(false);
    } finally { setWorking(false); }
  }
  return <section className="card settings-card face-settings"><div className="card-heading"><div><h2>Face enrollment</h2><p>Register each employee using the laptop or USB camera.</p></div><Camera size={22} /></div>
    {ready === false && <div className="auth-error">Face scanning needs setup. Run setup-windows.cmd to install the models and create your private encryption key.</div>}
    <label className="face-employee-label">Employee<select value={employeeId} disabled={disabled || working || open} onChange={e => { setEmployeeId(e.target.value); setConsent(false); setRemove(false); setMessage(''); setError(''); }}><option value="">Choose an employee…</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.code}{e.faceEnrolled ? ' (face enrolled)' : ''}</option>)}</select></label>
    {employee && <><p className="kiosk-hint">{employee.faceEnrolled ? 'A face is enrolled. A new enrollment replaces it.' : 'No face enrolled yet.'}</p>
    <label className="face-consent"><input type="checkbox" checked={consent} disabled={working} onChange={e => setConsent(e.target.checked)} />This employee agrees to face enrollment for attendance.</label>
    {open ? <CameraCapture mode="enroll" disabled={!consent || disabled || working} onCapture={images => save(images)} onClose={() => setOpen(false)} /> : <div className="kiosk-admin-actions"><button className="button secondary" disabled={!consent || !ready || working || disabled} onClick={() => setOpen(true)}><Camera size={17} />{employee.faceEnrolled ? 'Re-enroll face' : 'Enroll face'}</button>{employee.faceEnrolled && <button className="button danger-outline" disabled={working || disabled} onClick={async () => { if (!remove) { setRemove(true); return; } try { await save(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove enrollment.'); } }}><Trash2 size={16} />{remove ? 'Confirm remove face' : 'Remove face'}</button>}</div>}
    </>}
    {(error || message) && <p className={error ? 'auth-error' : 'info-note'} role={error ? 'alert' : 'status'}>{error || message}</p>}
    <p className="settings-copy">Face scans use a basic head-turn check. Use the kiosk with supervision; an ordinary webcam does not provide certified anti-spoofing protection. Keep PIN entry available for staff who prefer it or cannot be matched.</p>
  </section>;
}
