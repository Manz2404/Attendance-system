import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import AttendanceApp from './attendance-app';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Home() {
 const user = await getCurrentUser();
 if (!user) redirect('/login');
 const access = await workspaceAccess(user);
 if (!access) return <main className="auth-page"><h1>Access unavailable</h1><p>Your account is inactive. Contact your administrator.</p><a href="/logout">Sign out</a></main>;
 if (access.role === 'staff') redirect('/portal');
 return <AttendanceApp displayName={user.fullName} signOutPath="/logout" role={access.role} />;
}
