import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import LoginForm from './login-form';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/');
  return <main className="auth-page"><div className="auth-card"><div className="auth-brand">hadir<span>.</span></div><div className="eyebrow">YOUR TEAM. EVERY WORKDAY.</div><h1>Welcome back.</h1><p className="auth-intro">Sign in to your attendance workspace.</p><LoginForm /><p className="auth-help">First time here? Create your administrator account using <strong>setup-windows.cmd</strong> in the project folder.</p></div><p className="auth-footer">Attendance, made clear.</p></main>;
}
