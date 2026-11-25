'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { personalFields, jobFields } from '@/lib/staff-profile';
import ProfilePhotoField from '../profile-photo-field';

type Profile = {
  employee: { id: string; name: string; code: string; department: string; startDate: string; endDate: string | null; active: boolean } | null;
  personal: Record<string, string>;
  job: Record<string, string>;
  photo: string | null;
  schedule: string;
};

function Facts({ values }: { values: Record<string, string> }) {
  return <dl className="profile-grid profile-facts">
    {Object.entries(values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

export default function ProfileEditor() {
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    async function load() {
      try {
        const response = await fetch('/api/profile', { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load your profile.');
        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load your profile.');
      }
    }
    void load();
    return () => controller.abort();
  }, [version]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const details = Object.fromEntries(Object.keys(personalFields).map(key => [key, form.get(key) || '']));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'personal', details, photo: form.get('profilePhoto') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your profile.');
      setMessage('Changes saved.');
      setVersion(value => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="profile-page">
    <div className="page-header"><div>
      <div className="eyebrow">PEOPLE & WORK</div>
      <h1>My profile</h1>
      <p>Keep your personal details up to date and view your job information.</p>
    </div></div>
    {error && <p className="error-banner" role="alert">{error} <button className="text-button" onClick={() => setVersion(value => value + 1)}>Reload profile</button></p>}
    {message && <p className="info-note" role="status">{message}</p>}
    {!data && !error && <p role="status">Loading profile…</p>}
    {data && !data.employee && <section className="card profile-card">No linked employee found. Ask Admin to link your account to an employee record.</section>}
    {data?.employee && <>
      <section className="card profile-card">
        <h2>Personal details</h2>
        <p>Your official employee name is managed by Admin. Your personal contact number is separate from the work WhatsApp number maintained in Employees.</p>
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <ProfilePhotoField key={version} initialPhoto={data.photo} disabled={busy} onBusy={setPhotoBusy} />
            <div className="profile-grid">
              {Object.entries(personalFields).map(([key, label]) => <label key={key}>{label}
                <input name={key} type={key === 'email' ? 'email' : /phone/i.test(key) ? 'tel' : 'text'} maxLength={key === 'address' ? 500 : 120} defaultValue={data.personal[key] || ''} />
              </label>)}
            </div>
            <div className="profile-footer"><button className="button primary" disabled={busy || photoBusy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
          </fieldset>
        </form>
      </section>
      <section className="card profile-card">
        <h2>Job information</h2>
        <p>Managed by Admin. Contact Admin if these details need correcting.</p>
        <Facts values={{
          'Employee name': data.employee.name, 'Employee code': data.employee.code,
          Department: data.employee.department, 'Start date': data.employee.startDate,
          'End date': data.employee.endDate || '—', Schedule: data.schedule,
          Status: data.employee.active ? 'Active' : 'Inactive',
        }} />
        <Facts values={Object.fromEntries(Object.entries(jobFields).map(([key, label]) => [label, data.job[key] || 'Not set']))} />
      </section>
    </>}
  </div>;
}
