import type { ReactNode } from 'react';
import ThemeToggle from './theme-toggle';

export default function AuthShell({ title, intro, children, wide = false }: { title: string; intro: string; children: ReactNode; wide?: boolean }) {
  return <main className="auth-page"><div className="auth-theme"><ThemeToggle /></div><div className={`auth-card${wide ? ' account-card' : ''}`}><div className="auth-brand">hadir<span>.</span></div><div className="eyebrow">YOUR TEAM. EVERY WORKDAY.</div><h1>{title}</h1><p className="auth-intro">{intro}</p>{children}</div><p className="auth-footer">Attendance, made clear.</p></main>;
}
