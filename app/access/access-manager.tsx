'use client';
import { useEffect, useState, type FormEvent } from 'react';
import ThemeToggle from '../theme-toggle';
type Member = { userId: string; username: string; name: string; role: 'admin' | 'hr' | 'staff'; active: boolean; employeeId: string | null; isOwner: boolean };
type Data = { currentUserId: string; members: Member[]; employees: { id: string; name: string; code: string; active: boolean }[] };
const blank = { userId: '', username: '', name: '', role: 'staff' as Member['role'], active: true, employeeId: '', password: '' };
export default function AccessManager() {
 const [data, setData] = useState<Data | null>(null), [form, setForm] = useState(blank), [editing, setEditing] = useState(false);
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 async function load() {
  const response = await fetch('/api/members', { cache: 'no-store' });
  if (response.status === 401) { window.location.assign('/login'); return; }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not load users.');
  setData(result);
 }
 useEffect(() => { load().catch(e => setError(e.message)); }, []);
 async function save(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setBusy(true); setError(''); setMessage('');
  try {
   const response = await fetch('/api/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, action: form.userId ? 'update' : 'create' }) });
   const result = await response.json();
   if (!response.ok) throw new Error(result.error || 'Could not save.');
   setForm(blank); setEditing(false); setMessage(result.message); await load();
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
  finally { setBusy(false); }
 }
 return <main className="member-page">
  <header className="member-header"><a className="button secondary" href="/">← Dashboard</a><ThemeToggle /></header>
  <div className="page-header"><div><div className="eyebrow">SHARED WORKSPACE</div><h1>User access</h1><p>Create logins for your existing team. Each person signs in with their own username and password.</p></div><button className="button primary" disabled={!data || busy} onClick={() => { setForm(blank); setEditing(true); setError(''); }}>Add login</button></div>
  <div className="access-role-grid"><section className="card"><h2>Admin</h2><p>All workspace features, devices, kiosk and user access.</p></section><section className="card"><h2>HR</h2><p>Employees, schedules, attendance and reports.</p></section><section className="card"><h2>Staff</h2><p>Read-only access to their own attendance and schedule.</p></section></div>
  {error && <p className="error-banner" role="alert">{error}<button className="text-button" onClick={() => load().then(() => setError('')).catch(e => setError(e.message))}>Retry</button></p>}
  {message && <p role="status" className="info-note">{message}</p>}
  {editing && <section className="card access-form"><h2>{form.userId ? 'Edit access' : 'Create login'}</h2><form onSubmit={save}><fieldset disabled={busy}>
   <label>Full name<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
   <label>Username<input required minLength={3} maxLength={80} autoComplete="off" disabled={!!form.userId} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
   <label>{form.userId ? 'New password (leave blank to keep current)' : 'Password'}<input type="password" autoComplete="new-password" required={!form.userId} minLength={12} maxLength={256} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /><small>At least 12 characters. Share credentials privately with this person.</small></label>
   <label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Member['role'] })}><option value="staff">Staff</option><option value="hr">HR</option><option value="admin">Admin</option></select></label>
   {form.role === 'staff' && <label>Linked employee<select required value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}><option value="">Select employee</option>{data?.employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.code}{!e.active ? ' (inactive)' : ''}</option>)}</select><small>Only this employee’s records will be visible. Inactive employees cannot sign in.</small></label>}
   <label>Status<select value={String(form.active)} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Disabled</option></select></label>
   <div className="member-actions"><button type="submit" className="button primary">{busy ? 'Saving…' : 'Save access'}</button><button type="button" className="button secondary" onClick={() => { setEditing(false); setForm(blank); }}>Cancel</button></div>
  </fieldset></form></section>}
  <section className="card">{!data ? <div className="empty-state">Loading users…</div> : <div className="table-scroll"><table><thead><tr><th>Name / username</th><th>Role</th><th>Employee</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.members.map(member => <tr key={member.userId}><td><strong>{member.name}</strong><br /><small>{member.username}</small></td><td>{member.isOwner ? 'Owner / Admin' : member.role.toUpperCase()}</td><td>{data.employees.find(e => e.id === member.employeeId)?.name ?? '—'}</td><td>{member.active ? 'Active' : 'Disabled'}</td><td>{member.isOwner || member.userId === data.currentUserId ? <span>{member.userId === data.currentUserId ? 'Your account' : 'Workspace owner'}</span> : <button className="button secondary small-button" disabled={busy} onClick={() => { setForm({ ...member, employeeId: member.employeeId ?? '', password: '' }); setEditing(true); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>}</td></tr>)}</tbody></table></div>}</section>
  <p className="info-note">Staff and HR use the same login page. Staff accounts open their own portal automatically. Editing access signs that user out; attendance records are retained.</p>
 </main>;
}
