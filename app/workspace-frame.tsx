'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Settings, UserRound, Activity, BarChart3, CalendarDays, CheckCheck, ChevronRight, Clock3, Fingerprint, LayoutDashboard, LogOut, Menu, Monitor, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import ThemeToggle from './theme-toggle';
const items = [
 {id:'overview',label:'Overview',icon:LayoutDashboard},
 {id:'attendance',label:'Attendance',icon:CalendarDays},
 {id:'employees',label:'Employees',icon:Users},
 {id:'schedules',label:'Schedules',icon:Clock3},
 {id:'reports',label:'Reports',icon:BarChart3},
 {id:'devices',label:'Devices',icon:Fingerprint},
 {id:'kiosk',label:'Kiosk',icon:Monitor},
];
const initials=(name:string)=>name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
export default function WorkspaceFrame({children,displayName,workspaceName,role,activePage='leave'}:{children:ReactNode;displayName:string;workspaceName:string;role:'admin'|'hr'|'staff';activePage?:'attendance'|'leave'|'profile'|'settings'}) {
 const pageTitle=activePage==='profile'?(role==='admin'?'Staff job information':'My profile'):activePage==='settings'?'My settings':activePage==='attendance'?'My attendance':role==='staff'?'My leave':'Leave';
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);document.getElementById('navigation-toggle')?.focus();}};
  const media=window.matchMedia('(min-width:801px)'); const resize=()=>{if(media.matches)setOpen(false);};
  window.addEventListener('keydown',close);media.addEventListener('change',resize);
  return ()=>{window.removeEventListener('keydown',close);media.removeEventListener('change',resize);};
 },[open]);
 return <div className="app-shell">
  {open&&<button className="mobile-backdrop" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <aside id="workspace-navigation" aria-label="Workspace navigation" className={`sidebar ${open?'open':''}`}>
   <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={()=>{setOpen(false);document.getElementById('navigation-toggle')?.focus();}}><X size={22}/></button>
   <a href={role==='staff'?'/portal':'/#overview'} className="brand"><span className="brand-mark"><CheckCheck size={27} strokeWidth={2.5}/></span><span>hadir<span className="brand-dot">.</span><small>ATTENDANCE WORKSPACE</small></span></a>
   <a className="workspace-select" href={role==='admin'?'/#settings':role==='staff'?'/portal':'/#overview'}><span className="workspace-initial">{initials(workspaceName)}</span><span><strong>{workspaceName}</strong><small>{role==='admin'?'Admin':role==='hr'?'HR':'Staff'} workspace</small></span><ChevronRight size={16}/></a>
   <div className="nav-caption">{role==='staff'?'MY WORKSPACE':'WORKSPACE'}</div>
   <nav aria-label="Main navigation">
    {role==='staff'?<a className={`nav-item ${activePage==='attendance'?'selected':''}`} aria-current={activePage==='attendance'?'page':undefined} href="/portal"><Clock3 size={20}/><span>My attendance</span></a>:items.filter(item=>role==='admin'||!['devices','kiosk'].includes(item.id)).map(item=><a key={item.id} className="nav-item" href={'/#'+item.id}><item.icon size={20}/><span>{item.label}</span></a>)}
    <a className={`nav-item ${activePage==='leave'?'selected':''}`} href="/leave" aria-current={activePage==='leave'?'page':undefined}><CalendarDays size={20}/><span>{role==='staff'?'My leave':'Leave'}</span></a>
    {role==='admin'&&<><a className="nav-item" href="/access"><ShieldCheck size={20}/><span>User access</span></a><a className="nav-item" href="/audit"><Activity size={20}/><span>Audit log</span></a></>}
    {role !== 'admin' && <><a className={`nav-item ${activePage==='profile'?'selected':''}`} href="/profile" aria-current={activePage==='profile'?'page':undefined}><UserRound size={20}/><span>{role==='admin'?'Staff job info':'My profile & job'}</span></a>
    <a className={`nav-item ${activePage==='settings'?'selected':''}`} href="/settings" aria-current={activePage==='settings'?'page':undefined}><Settings size={20}/><span>My settings</span></a></>}
   </nav>
  </aside>
  <div className="main-shell">
   <header className="topbar">
    <div className="topbar-wave" aria-hidden="true"><svg viewBox="0 0 480 36" preserveAspectRatio="none" focusable="false"><path className="topbar-wave-back" d="M0 20C40 4 80 4 120 20S200 36 240 20S320 4 360 20S440 36 480 20V36H0Z"/><path className="topbar-wave-front" d="M0 22C40 34 80 34 120 22S200 10 240 22S320 34 360 22S440 10 480 22V36H0Z"/></svg></div>
    <div className="breadcrumb"><button id="navigation-toggle" className="icon-button menu-toggle" aria-controls="workspace-navigation" aria-expanded={open} aria-label="Open navigation" onClick={()=>setOpen(true)}><Menu size={22}/></button><span>{role==='staff'?'Staff portal':'Workspace'}</span><ChevronRight size={14}/><strong>{pageTitle}</strong></div>
    <div className="topbar-right"><ThemeToggle/><span className="timezone-label"><Clock3 size={15}/> Malaysia time <span className="gmt">GMT+8</span></span><button className="icon-button" aria-label={'Refresh '+pageTitle.toLowerCase()} onClick={()=>window.location.reload()}><RefreshCw size={18}/></button><span className="topbar-divider"/><span className="avatar small mint" title={displayName}>{initials(displayName)}</span><a className="button small-button logout-button" href="/logout" target="_top" aria-label="Log out"><LogOut size={17}/><span>Log out</span></a></div>
   </header>
   <main className="main-content">{children}</main>
  </div>
 </div>;
}
