'use client';
import { useEffect, useState } from 'react';
import { dateMY, dateLabel, timeMY } from '@/lib/attendance';
type Entry = { id: string; actorName: string; actorId: string; action: string; target: string; details: string; createdAt: string };
export default function AuditViewer() {
 const [entries, setEntries] = useState<Entry[]>([]), [cursor, setCursor] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
 async function load(next?: string) {
  setBusy(true); setError('');
  try {
   const response = await fetch('/api/audit' + (next ? '?cursor=' + encodeURIComponent(next) : ''), { cache: 'no-store' });
   if (response.status === 401) { window.location.assign('/login'); return; }
   const data = await response.json();
   if (!response.ok) throw new Error(data.error || 'Could not load audit log.');
   setEntries(previous => next ? [...previous, ...data.entries] : data.entries); setCursor(data.nextCursor);
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not load audit log.'); }
  finally { setBusy(false); }
 }
 useEffect(() => { load(); }, []);
 return <main className="member-page"><header className="member-header"><a href="/" className="button secondary">← Dashboard</a><button className="button secondary" disabled={busy} onClick={() => load()}>Refresh</button></header><div className="page-header"><div><div className="eyebrow">ADMINISTRATOR</div><h1>Audit log</h1><p>Successful staff, schedule, attendance, device and user-access changes. All times in Malaysia time.</p></div></div><p className="info-note">Logging starts after this update. Earlier changes and sign-in attempts are not included. Logs cannot be edited or deleted through this application.</p>{error && <p className="error-banner" role="alert">{error}</p>}<section className="card"><div className="table-scroll"><table><thead><tr><th>Time (MYT)</th><th>Changed by</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{entries.map(e => <tr key={e.id}><td>{dateLabel(dateMY(e.createdAt))}<br />{timeMY(e.createdAt)}</td><td>{e.actorName}<br /><small>{e.actorId}</small></td><td>{e.action.replaceAll('-', ' ')}</td><td style={{ overflowWrap: 'anywhere' }}>{e.target || 'Workspace'}</td><td>{e.details}</td></tr>)}</tbody></table>{!entries.length && <div className="empty-state">{busy ? 'Loading…' : 'No changes recorded yet.'}</div>}</div></section>{cursor && <button className="button secondary" disabled={busy} onClick={() => load(cursor)}>{busy ? 'Loading…' : 'Load older entries'}</button>}</main>;
}
