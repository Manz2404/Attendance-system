'use client';
import { useEffect, useState } from 'react';
export default function Logout() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/auth/logout', { method: 'POST' }).then(r => { if (!r.ok) throw new Error(); window.location.replace('/login'); }).catch(() => setFailed(true));
  }, []);
  return <main className="auth-page"><div className="auth-card"><h1>{failed ? 'Unable to sign out.' : 'Signing out…'}</h1>{failed && <><p>Please check the database connection and try again.</p><a href="/" className="button secondary">Back to workspace</a></>}</div></main>;
}
