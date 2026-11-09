import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import AuditViewer from './viewer';
export const dynamic = 'force-dynamic';
export default async function AuditPage() {
 const user = await getCurrentUser();
 if (!user) redirect('/login');
 if ((await workspaceAccess(user))?.role !== 'admin') redirect('/');
 return <AuditViewer />;
}
