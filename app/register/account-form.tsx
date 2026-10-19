'use client';
import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function AccountForm({ administratorName, enabled }: { administratorName?: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [created, setCreated] = useState('');
  const signedIn = administratorName !== undefined;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget, data = new FormData(form);
    if (data.get('password') !== data.get('confirmPassword')) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data.entries())) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to create the account.');
      form.reset(); setCreated(result.username);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to reach the server. Please try again.'); }
    finally { setBusy(false); }
  }
  if (created) return <div className="account-success" role="status"><CheckCircle2 size={34} /><h2>Account created</h2><p><strong>{created}</strong> can now sign in with the new password.</p><p>The new account starts with an empty workspace. Existing employees and attendance stay with their original account.</p>{signedIn ? <><a className="button primary" href="/#settings">Back to settings<ArrowRight size={17} /></a><button type="button" className="text-button" onClick={() => setCreated('')}>Add another user</button></> : <a className="button primary" href="/login">Go to sign in<ArrowRight size={17} /></a>}</div>;
  return <>
    <div className="account-notice"><ShieldCheck size={18} /><p>{signedIn ? <>Signed in as <strong>{administratorName}</strong>. Confirm your current password to add a user.</> : enabled ? 'Enter the account creation code provided by your administrator.' : 'An administrator needs to enable account creation or sign in to add a user.'}</p></div>
    <form className="auth-form" onSubmit={submit}>
      <fieldset className="account-fields" disabled={busy || !enabled}>
        <label>Display name<input name="name" autoComplete="name" required maxLength={120} autoFocus /></label>
        <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={80} aria-describedby="username-help" /><small id="username-help">3–80 letters, numbers, dots, underscores, @ or hyphens.</small></label>
        <div className="account-passwords"><label>New password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} aria-describedby="password-help" /></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={256} /></label></div>
        <p className="account-hint" id="password-help">Use at least 12 characters for the new password.</p>
        <div className="account-authorization">{signedIn ? <label>Your current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} /></label> : <label>Account creation code<input name="creationKey" type="password" autoComplete="off" required minLength={32} maxLength={256} spellCheck={false} /></label>}</div>
      </fieldset>
      {error && <div className="auth-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
      <button className="button primary" disabled={busy || !enabled}>{busy ? 'Creating account…' : signedIn ? 'Add user' : 'Create account'}<ArrowRight size={17} /></button>
    </form>
    <p className="auth-help">This creates a separate administrator workspace. To manage your current team, use your existing account.</p>
    <a className="account-back auth-link" href={signedIn ? '/#settings' : '/login'}><ArrowLeft size={15} />{signedIn ? 'Back to settings' : 'Back to sign in'}</a>
  </>;
}
