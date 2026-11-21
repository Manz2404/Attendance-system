import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { employees, schedules, workspaceMembers, users, workspaces, leaveSettings, leaveEntitlements, leaveRequests, leaveAttachments } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { workspaceAccess } from '@/lib/workspace-access';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';
import { writeAudit } from '@/lib/audit';
import { leaveTypes, defaultLeavePolicy, leaveDays, units, balance, overlaps, reserved, mayReview, validDate, type LeavePolicy, type LeaveRecord, type LeaveType } from '@/lib/leave';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'private, no-store'}});
function fail(message: string, status = 400): never { throw new RequestError(message, status); }
function yearValue(value: unknown) { const n=Number(value); if(!Number.isInteger(n)||n<2000||n>2100) fail('Choose a year from 2000 to 2100.'); return n; }
function typeValue(value: unknown) { if(!leaveTypes.includes(value as LeaveType)) fail('Invalid leave type.'); return value as LeaveType; }
function textValue(value: unknown, max: number, required=false) { if(typeof value!=='string'||value.length>max||required&&!value.trim()) fail('Enter valid text (maximum '+max+' characters).'); return value.trim(); }
export async function GET(request: Request) {
 try {
  const user=await getCurrentUser(); if(!user) return json({error:'Please sign in.'},401);
  const access=await workspaceAccess(user); if(!access) return json({error:'Access unavailable.'},403);
  const db=getDb(), owner=access.ownerId, year=yearValue(new URL(request.url).searchParams.get('year')||new Date().getFullYear());
  const [setting]=await db.select().from(leaveSettings).where(eq(leaveSettings.ownerId,owner));
  const policy: LeavePolicy=setting?JSON.parse(setting.settings):defaultLeavePolicy;
  const management=access.role==='admin'||access.role==='hr';
  const allEmployees=await db.select({id:employees.id,name:employees.name,code:employees.code,active:employees.active}).from(employees).where(eq(employees.ownerId,owner));
  const visible=allEmployees.filter(e=>management||e.id===access.employeeId||policy.managers[e.id]===user.userId);
  const ids=new Set(visible.map(e=>e.id));
  const rows=await db.select().from(leaveRequests).where(and(eq(leaveRequests.ownerId,owner),eq(leaveRequests.year,year)));
  const requests=rows.filter(r=>ids.has(r.employeeId)).map(r=>{ const record={...r,type:r.type as LeaveType,days:JSON.parse(r.days)}; return {...record,canReview:mayReview(access.role,user.userId,access.employeeId,record,policy),own:r.employeeId===access.employeeId||r.requestedBy===user.userId}; });
  const quotas=(await db.select().from(leaveEntitlements).where(and(eq(leaveEntitlements.ownerId,owner),eq(leaveEntitlements.year,year)))).filter(q=>ids.has(q.employeeId));
  const attachments=await db.select({id:leaveAttachments.requestId}).from(leaveAttachments).innerJoin(leaveRequests,eq(leaveRequests.id,leaveAttachments.requestId)).where(and(eq(leaveRequests.ownerId,owner),eq(leaveRequests.year,year)));
  const attached=new Set(attachments.map(a=>a.id));
  const members=access.role==='admin'?await db.select({userId:workspaceMembers.userId,name:users.name,employeeId:workspaceMembers.employeeId}).from(workspaceMembers).innerJoin(users,eq(users.id,workspaceMembers.userId)).where(and(eq(workspaceMembers.ownerId,owner),eq(workspaceMembers.active,true))):[];
  return json({role:access.role,employeeId:access.employeeId,currentUserId:user.userId,year,employees:visible,members,policy:access.role==='admin'?policy:{...policy,managers:{}},quotas,requests:requests.map(r=>({...r,attachment:attached.has(r.id)}))});
 } catch(e) { console.error('Leave load failed', e instanceof Error?e.message:'Unknown'); return json({error:e instanceof RequestError?e.message:'Could not load leave. Ensure the leave database migration has completed.'},e instanceof RequestError?e.status:500); }
}
export async function POST(request: Request) {
 try {
  const user=await getCurrentUser(); if(!user) return json({error:'Please sign in.'},401);
  if(!allowedOrigin(request)) return json({error:'Request not allowed.'},403);
  const body=await readJSON(request,2900000);
  await getDb().transaction(async tx=>{
   const access=await workspaceAccess(user,tx); if(!access) fail('Access unavailable.',403);
   const owner=access.ownerId;
   // Serialize leave changes within this workspace, including quota updates and simultaneous submissions.
   const [workspace]=await tx.select().from(workspaces).where(eq(workspaces.ownerId,owner)).for('update');
   if(!workspace) fail('Workspace unavailable.',403);
   const [setting]=await tx.select().from(leaveSettings).where(eq(leaveSettings.ownerId,owner));
   const policy: LeavePolicy=setting?JSON.parse(setting.settings):structuredClone(defaultLeavePolicy);
   const action=String(body.action), now=new Date().toISOString();
   if(action==='policy') {
    if(access.role!=='admin') fail('Only Admin can configure leave.',403);
    const p=body.policy as LeavePolicy;
    if(!p||!Array.isArray(p.calendar)||!Array.isArray(p.attachment)||!Array.isArray(p.holidays)||p.holidays.length>366||p.calendar.some(t=>!leaveTypes.includes(t))||p.attachment.some(t=>!leaveTypes.includes(t))||p.holidays.some(d=>!validDate(d))||!p.managers||typeof p.managers!=='object'||Array.isArray(p.managers)) fail('Invalid leave policy.');
    const staff=await tx.select().from(employees).where(eq(employees.ownerId,owner));
    const members=await tx.select().from(workspaceMembers).where(and(eq(workspaceMembers.ownerId,owner),eq(workspaceMembers.active,true)));
    for(const [employeeId,userId] of Object.entries(p.managers)) if(!staff.some(e=>e.id===employeeId)||!members.some(m=>m.userId===userId&&m.employeeId!==employeeId)) fail('Choose an active manager from this workspace, other than the employee.');
    const settings=JSON.stringify({calendar:[...new Set(p.calendar)],attachment:[...new Set(p.attachment)],holidays:[...new Set(p.holidays)],managers:p.managers});
    await tx.insert(leaveSettings).values({ownerId:owner,settings}).onDuplicateKeyUpdate({set:{settings}});
    await writeAudit(tx,owner,user.userId,'leave-policy','Leave settings','Updated leave counting, document requirements, holidays or managers.'); return;
   }
   if(action==='quota') {
    if(access.role!=='admin') fail('Only Admin can set entitlements.',403);
    const year=yearValue(body.year), type=typeValue(body.type), amount=Number(body.days)*2;
    if(!Number.isInteger(amount)||amount<0||amount>732) fail('Enter 0–366 days in half-day increments.');
    const staff=await tx.select().from(employees).where(and(eq(employees.ownerId,owner),eq(employees.active,true)));
    const selected=body.employeeId==='all'?staff:staff.filter(e=>e.id===body.employeeId); if(!selected.length) fail('Choose an active employee.');
    const records=(await tx.select().from(leaveRequests).where(and(eq(leaveRequests.ownerId,owner),eq(leaveRequests.year,year)))).map(r=>({...r,type:r.type as LeaveType,days:JSON.parse(r.days)}));
    for(const employee of selected) {
     if(balance(records,employee.id,type,year,amount).available<0) fail('Quota cannot be below approved and pending leave for '+employee.name+'.');
     await tx.insert(leaveEntitlements).values({id:`${employee.id}:${year}:${type}`,ownerId:owner,employeeId:employee.id,year,type,units:amount}).onDuplicateKeyUpdate({set:{units:amount}});
    }
    await writeAudit(tx,owner,user.userId,'leave-quota',String(body.employeeId),`${year} ${type}: ${amount/2} days for ${selected.length} employee(s).`); return;
   }
   if(action==='apply') {
    const employeeId=access.role==='staff'?access.employeeId:String(body.employeeId||access.employeeId||'');
    const [employee]=await tx.select().from(employees).where(and(eq(employees.id,employeeId||''),eq(employees.ownerId,owner),eq(employees.active,true)));
    if(!employee) fail('Choose an active employee linked to this workspace.');
    const [schedule]=await tx.select().from(schedules).where(and(eq(schedules.id,employee.scheduleId),eq(schedules.ownerId,owner))); if(!schedule) fail('Employee schedule unavailable.');
    const type=typeValue(body.type), start=String(body.start), end=String(body.end), year=yearValue(start.slice(0,4));
    if(start<employee.startDate||employee.endDate&&end>employee.endDate) fail('Leave must be within employment dates.');
    let days: ReturnType<typeof leaveDays>; try { days=leaveDays(start,end,String(body.part),schedule.weekdays,policy.calendar.includes(type),policy.holidays); } catch(e) { fail((e as Error).message); }
    const records=(await tx.select().from(leaveRequests).where(and(eq(leaveRequests.ownerId,owner),eq(leaveRequests.employeeId,employee.id),eq(leaveRequests.year,year)))).map(r=>({...r,type:r.type as LeaveType,days:JSON.parse(r.days)}));
    if(records.some(r=>reserved(r.status)&&overlaps(days,r.days))) fail('These dates overlap an existing pending or approved request.');
    const [quota]=await tx.select().from(leaveEntitlements).where(eq(leaveEntitlements.id,`${employee.id}:${year}:${type}`));
    if(!quota) fail('Admin must set this employee’s entitlement for this leave type and year first.');
    if(balance(records,employee.id,type,year,quota.units).available<units(days)/2) fail('Insufficient available leave balance.');
    const id=crypto.randomUUID(), reason=textValue(body.reason,1000,true);
    const attachment=body.attachment as {mime:string;data:string}|undefined;
    if(policy.attachment.includes(type)&&!attachment) fail('A supporting document is required for this leave type.');
    if(attachment) {
     if(!['application/pdf','image/png','image/jpeg'].includes(attachment.mime)||typeof attachment.data!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.data)) fail('Upload a PDF, PNG or JPEG document.');
     const b=Buffer.from(attachment.data,'base64');
     if(b.length>2*1024*1024||b.length<8) fail('Attachment must be at most 2 MB.');
     const valid=attachment.mime==='application/pdf'?b.subarray(0,5).toString()==='%PDF-':attachment.mime==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b[0]===255&&b[1]===216&&b[2]===255;
     if(!valid) fail('The file contents do not match its type.');
    }
    await tx.insert(leaveRequests).values({id,ownerId:owner,employeeId:employee.id,year,type,days:JSON.stringify(days),reason,status:'pending',requestedBy:user.userId,reviewNote:'',createdAt:now,updatedAt:now});
    if(attachment) await tx.insert(leaveAttachments).values({requestId:id,...attachment});
    await writeAudit(tx,owner,user.userId,'leave-apply',id,`Submitted ${units(days)/2} day(s); awaiting approval.`); return;
   }
   const [row]=await tx.select().from(leaveRequests).where(and(eq(leaveRequests.id,String(body.id)),eq(leaveRequests.ownerId,owner)));
   if(!row) fail('Request not found.',404);
   const record: LeaveRecord={...row,type:row.type as LeaveType,days:JSON.parse(row.days)};
   let status=row.status, note=row.reviewNote, reviewer=row.reviewedBy;
   if(action==='cancel') {
    if(row.employeeId!==access.employeeId&&row.requestedBy!==user.userId) fail('Only the applicant can request cancellation.',403);
    if(status==='pending') status='cancelled'; else if(status==='approved') status='cancel_requested'; else fail('This request cannot be cancelled in its current state.');
   } else {
    if(!mayReview(access.role,user.userId,access.employeeId,record,policy)) fail('You cannot review this request. Self-approval is not allowed.',403);
    if(action==='approve'&&status==='pending') status='approved';
    else if(action==='reject'&&status==='pending') status='rejected';
    else if(action==='approve-cancel'&&status==='cancel_requested') status='cancelled';
    else if(action==='reject-cancel'&&status==='cancel_requested') status='approved';
    else fail('This request has already changed. Refresh and retry.',409);
    note=textValue(body.note,1000,action==='reject'||action==='reject-cancel'); reviewer=user.userId;
   }
   await tx.update(leaveRequests).set({status,reviewNote:note,reviewedBy:reviewer,updatedAt:now}).where(eq(leaveRequests.id,row.id));
   await writeAudit(tx,owner,user.userId,'leave-'+action,row.id,`Status: ${row.status} → ${status}.`);
  }, { isolationLevel: 'read committed' });
  return json({message:'Leave changes saved.'});
 } catch(e) { if(!(e instanceof RequestError)) console.error('Leave change failed',e); return json({error:e instanceof RequestError?e.message:'Could not save leave. Please retry.'},e instanceof RequestError?e.status:500); }
}
