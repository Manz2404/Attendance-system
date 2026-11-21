import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import LeaveManager from './leave-manager';
export const dynamic='force-dynamic';
export default async function LeavePage() {
 const user=await getCurrentUser(); if(!user) redirect('/login');
 if(!await workspaceAccess(user)) redirect('/');
 return <LeaveManager />;
}
