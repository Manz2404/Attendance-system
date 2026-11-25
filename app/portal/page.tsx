import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import WorkspaceFrame from '../workspace-frame';
import { getDb } from '@/db';
import { workspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import './portal.css';
import StaffPortal from './staff-portal';
export const dynamic = 'force-dynamic';
export default async function PortalPage() {
 const user = await getCurrentUser();
 if (!user) redirect('/login');
 const access = await workspaceAccess(user);
 if (access?.role !== 'staff') redirect('/');
 const [workspace] = await getDb().select({name:workspaces.name}).from(workspaces).where(eq(workspaces.ownerId,access.ownerId));
 return <WorkspaceFrame displayName={user.fullName} workspaceName={workspace?.name||'My workspace'} role="staff" activePage="attendance"><StaffPortal /></WorkspaceFrame>;
}

