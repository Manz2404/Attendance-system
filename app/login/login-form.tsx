'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
export default function LoginForm() {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
      window.location.assign('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign in.'); setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}><label>Username<input name="username" autoComplete="username" autoCapitalize="none" required minLength={3} maxLength={80} autoFocus /></label><label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>{error && <div className="auth-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}<button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button></form>;
}
