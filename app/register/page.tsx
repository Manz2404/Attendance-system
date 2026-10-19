import { getCurrentUser } from '@/lib/auth';
import { accountCreationEnabled } from '@/lib/account-creation.mjs';
import { databaseFailure } from '@/lib/database-error.mjs';
import AuthShell from '../auth-shell';
import AccountForm from './account-form';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function RegisterPage() {
  let user;
  try { user = await getCurrentUser(); }
  catch (error) {
    return <AuthShell title="Create an account" intro="Add a login for an attendance workspace."><div className="auth-error" role="alert">{databaseFailure(error).error}</div><p className="auth-help"><a className="auth-link" href="/register">Try again</a> · <a className="auth-link" href="/login">Back to sign in</a></p></AuthShell>;
  }
  return <AuthShell title={user ? 'Add a user' : 'Create an account'} intro="Each login has its own attendance workspace." wide><AccountForm administratorName={user?.fullName} enabled={!!user || accountCreationEnabled()} /></AuthShell>;
}
