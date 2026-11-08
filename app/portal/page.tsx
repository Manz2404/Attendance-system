import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import StaffPortal from './staff-portal';
export const dynamic = 'force-dynamic';
export default async function PortalPage() {
 const user = await getCurrentUser();
 if (!user) redirect('/login');
 const access = await workspaceAccess(user);
 if (access?.role !== 'staff') redirect('/');
 return <StaffPortal />;
}
