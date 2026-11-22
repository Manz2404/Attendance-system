import {and,eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {employees,staffProfiles,employeePhotos,schedules} from '@/db/schema';
import {getCurrentUser} from '@/lib/auth';
import {workspaceAccess} from '@/lib/workspace-access';
import {allowedOrigin,readJSON,RequestError} from '@/lib/request';
import {writeAudit} from '@/lib/audit';
import {validateProfile} from '@/lib/staff-profile';
import {normalizeProfilePhoto} from '@/lib/profile-photo.mjs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request) {
 try {
  const user=await getCurrentUser(); if(!user)return json({error:'Please sign in.'},401);
  const access=await workspaceAccess(user); if(!access)return json({error:'Access unavailable.'},403);
  const db=getDb();
  const list=access.role==='admin'?await db.select({id:employees.id,name:employees.name}).from(employees).where(eq(employees.ownerId,access.ownerId)):[];
  const id=access.role==='admin'?new URL(request.url).searchParams.get('employeeId')||list[0]?.id:access.employeeId;
  if(!id)return json({role:access.role,employees:list,employee:null});
  const [employee]=await db.select({id:employees.id,name:employees.name,code:employees.code,department:employees.department,startDate:employees.startDate,endDate:employees.endDate,scheduleId:employees.scheduleId,active:employees.active}).from(employees).where(and(eq(employees.ownerId,access.ownerId),eq(employees.id,id)));
  if(!employee)return json({error:'Employee not found.'},404);
  const [profile]=await db.select().from(staffProfiles).where(and(eq(staffProfiles.employeeId,id),eq(staffProfiles.ownerId,access.ownerId)));
  const [photo]=await db.select().from(employeePhotos).where(and(eq(employeePhotos.employeeId,id),eq(employeePhotos.ownerId,access.ownerId)));
  const [schedule]=await db.select({name:schedules.name}).from(schedules).where(and(eq(schedules.id,employee.scheduleId),eq(schedules.ownerId,access.ownerId)));
  return json({role:access.role,employees:list,employee,personal:profile?JSON.parse(profile.personal):{},job:profile?JSON.parse(profile.job):{},photo:photo?.photo||null,schedule:schedule?.name||'Not assigned'});
 }catch{return json({error:'Could not load profile. Check that database migrations are up to date.'},500);}
}
export async function POST(request:Request) {
 try {
  const user=await getCurrentUser(); if(!user)return json({error:'Please sign in.'},401);
  if(!allowedOrigin(request))return json({error:'Request not allowed.'},403);
  const body=await readJSON(request,80000);
  if(!['personal','job'].includes(String(body.action)))return json({error:'Invalid action.'},400);
  await getDb().transaction(async tx=>{
   const access=await workspaceAccess(user,tx); if(!access)throw new RequestError('Access unavailable.',403);
   const job=body.action==='job';
   if(job&&access.role!=='admin')throw new RequestError('Only Admin can update job information.',403);
   const id=job?String(body.employeeId||''):access.employeeId;
   if(!id)throw new RequestError('Your account must be linked to an employee.',403);
   const [employee]=await tx.select().from(employees).where(and(eq(employees.ownerId,access.ownerId),eq(employees.id,id))).for('update');
   if(!employee)throw new RequestError('Employee not found.',404);
   let details:Record<string,string>,photo:string|null=null;
   try{details=validateProfile(body.details,job);if(!job)photo=normalizeProfilePhoto(body.photo??'');}catch(e){throw new RequestError(e instanceof Error?e.message:'Invalid details.',400);}
   const values={updatedAt:new Date().toISOString(),...(job?{job:JSON.stringify(details)}:{personal:JSON.stringify(details)})};
   await tx.insert(staffProfiles).values({employeeId:id,ownerId:access.ownerId,personal:'{}',job:'{}',...values}).onDuplicateKeyUpdate({set:values});
   if(!job){if(photo)await tx.insert(employeePhotos).values({employeeId:id,ownerId:access.ownerId,photo}).onDuplicateKeyUpdate({set:{photo}});else await tx.delete(employeePhotos).where(and(eq(employeePhotos.employeeId,id),eq(employeePhotos.ownerId,access.ownerId)));}
   await writeAudit(tx,access.ownerId,user.userId,job?'job-update':'profile-update',id,job?'Updated job information.':'Updated personal profile.');
  });
  return json({ok:true});
 }catch(e){return json({error:e instanceof RequestError?e.message:'Could not save details. Please retry.'},e instanceof RequestError?e.status:500);}
}
