import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AttendanceApp from './attendance-app';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <AttendanceApp displayName={user.fullName} signOutPath="/logout" />;
}
