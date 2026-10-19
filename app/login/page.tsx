import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { databaseFailure } from '@/lib/database-error.mjs';
import AuthShell from '../auth-shell';
import LoginForm from './login-form';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function LoginPage() {
  let user, error = '';
  try { user = await getCurrentUser(); } catch (e) { error = databaseFailure(e).error; }
  if (user) redirect('/');
  return <AuthShell title="Welcome back." intro="Sign in to your attendance workspace."><LoginForm initialError={error} /><p className="auth-help">Need a login? <a className="auth-link" href="/register">Create an account</a></p></AuthShell>;
}
