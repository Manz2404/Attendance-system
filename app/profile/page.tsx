import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import ProfileEditor from './profile-editor';
import './profile.css';
import WorkspaceFrame from '../workspace-frame';
import { getDb } from '@/db';
import { workspaces } from '@/db/schema';
import { eq } from 'drizzle-orm';
export const dynamic='force-dynamic';
export default async function ProfilePage() {
 const user=await getCurrentUser(); if(!user) redirect('/login');
 const access=await workspaceAccess(user); if(!access) redirect('/');
 if(access.role==='admin') redirect('/#employees');
 const [workspace]=await getDb().select({name:workspaces.name}).from(workspaces).where(eq(workspaces.ownerId,access.ownerId));
 return <WorkspaceFrame displayName={user.fullName} workspaceName={workspace?.name||'My workspace'} role={access.role} activePage="profile"><ProfileEditor /></WorkspaceFrame>;
}
