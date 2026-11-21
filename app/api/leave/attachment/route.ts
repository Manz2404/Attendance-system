import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { leaveRequests, leaveAttachments, leaveSettings } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import { defaultLeavePolicy, mayReview, type LeaveRecord } from '@/lib/leave';
export const dynamic='force-dynamic';
export async function GET(request: Request) {
 const denied=()=>new Response('Document unavailable.',{status:404,headers:{'Cache-Control':'private, no-store'}});
 const user=await getCurrentUser(); if(!user) return denied();
 const access=await workspaceAccess(user); if(!access) return denied();
 const db=getDb(), id=new URL(request.url).searchParams.get('id')||'';
 const [row]=await db.select().from(leaveRequests).where(and(eq(leaveRequests.id,id),eq(leaveRequests.ownerId,access.ownerId))); if(!row) return denied();
 const [settings]=await db.select().from(leaveSettings).where(eq(leaveSettings.ownerId,access.ownerId));
 const policy=settings?JSON.parse(settings.settings):defaultLeavePolicy;
 if(row.employeeId!==access.employeeId&&row.requestedBy!==user.userId&&!mayReview(access.role,user.userId,access.employeeId,{...row,days:JSON.parse(row.days)} as LeaveRecord,policy)) return denied();
 const [file]=await db.select().from(leaveAttachments).where(eq(leaveAttachments.requestId,id)); if(!file) return denied();
 const ext=file.mime==='application/pdf'?'pdf':file.mime==='image/png'?'png':'jpg';
 return new Response(new Uint8Array(Buffer.from(file.data,'base64')),{headers:{'Content-Type':file.mime,'Content-Disposition':`attachment; filename="leave-document.${ext}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
