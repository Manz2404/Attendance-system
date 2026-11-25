import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import AppearanceSettings from '../appearance-settings';
import WorkspaceFrame from '../workspace-frame';
import { getDb } from '@/db';
import { workspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
export const dynamic='force-dynamic';
export default async function SettingsPage() {
 const user=await getCurrentUser(); if(!user) redirect('/login');
 const access=await workspaceAccess(user); if(!access) redirect('/');
 if(access.role==='admin') redirect('/#settings');
 const [workspace]=await getDb().select({name:workspaces.name}).from(workspaces).where(eq(workspaces.ownerId,access.ownerId));
 return <WorkspaceFrame displayName={user.fullName} workspaceName={workspace?.name||'My workspace'} role={access.role} activePage="settings"><div className="page-header"><div><h1>My settings</h1><p>Personalize your workspace. Your confirmed preferences follow your account across devices.</p></div></div><AppearanceSettings /></WorkspaceFrame>;
}
