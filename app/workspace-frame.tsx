'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Settings, UserRound, Activity, BarChart3, CalendarDays, CheckCheck, ChevronRight, Clock3, Fingerprint, LayoutDashboard, LogOut, Menu, Monitor, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import ThemeToggle from './theme-toggle';

export const workspacePages = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'attendance', label: 'Attendance', icon: CalendarDays },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'schedules', label: 'Schedules', icon: Clock3 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'devices', label: 'Devices', icon: Fingerprint },
  { id: 'kiosk', label: 'Kiosk', icon: Monitor },
] as const;

type Page = typeof workspacePages[number]['id'] | 'leave' | 'profile' | 'settings';
type Props = {
  children: ReactNode;
  displayName: string;
  workspaceName: string;
  role: 'admin' | 'hr' | 'staff';
  activePage?: Page;
  employeeCount?: number;
  signOutPath?: string;
  busy?: boolean;
  onNavigate?: (page: Page) => void;
  onRefresh?: () => void;
};
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(n => n[0] || '').join('').toUpperCase();

export default function WorkspaceFrame({ children, displayName, workspaceName, role, activePage = 'leave', employeeCount, signOutPath = '/logout', busy = false, onNavigate, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const staff = role === 'staff';
  const pageTitle = activePage === 'profile' ? 'My profile'
    : activePage === 'settings' ? (role === 'admin' ? 'Settings' : 'My settings')
    : activePage === 'leave' ? (staff ? 'My leave' : 'Leave')
    : staff ? 'My attendance' : workspacePages.find(p => p.id === activePage)?.label;

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        document.getElementById('navigation-toggle')?.focus();
      }
    };
    const media = window.matchMedia('(min-width:801px)');
    const resize = () => { if (media.matches) setOpen(false); };
    window.addEventListener('keydown', close);
    media.addEventListener('change', resize);
    return () => {
      window.removeEventListener('keydown', close);
      media.removeEventListener('change', resize);
    };
  }, [open]);

  const home = staff ? '/portal' : '/#overview';
  const workspaceLink = role === 'admin' ? '/#settings' : home;
  function navigate(page: Page) {
    setOpen(false);
    onNavigate?.(page);
  }

  return <div className="app-shell">
    {open && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside id="workspace-navigation" aria-label="Workspace navigation" className={`sidebar ${open ? 'open' : ''}`}>
      <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => { setOpen(false); document.getElementById('navigation-toggle')?.focus(); }}><X size={22} /></button>
      <a href={home} className="brand" onClick={onNavigate ? e => { e.preventDefault(); navigate('overview'); } : undefined}>
        <span className="brand-mark"><CheckCheck size={27} strokeWidth={2.5} /></span>
        <span>hadir<span className="brand-dot">.</span><small>ATTENDANCE WORKSPACE</small></span>
      </a>
      <a className="workspace-select" href={workspaceLink} onClick={onNavigate ? e => { e.preventDefault(); navigate(role === 'admin' ? 'settings' : 'overview'); } : undefined}>
        <span className="workspace-initial">{initials(workspaceName)}</span>
        <span><strong>{workspaceName}</strong><small>{role === 'admin' ? 'Admin' : role === 'hr' ? 'HR' : 'Staff'} workspace</small></span><ChevronRight size={16} />
      </a>
      <div className="nav-caption">{staff ? 'MY WORKSPACE' : 'WORKSPACE'}</div>
      <nav aria-label="Main navigation">
        {staff ? <a className={`nav-item ${activePage === 'attendance' ? 'selected' : ''}`} aria-current={activePage === 'attendance' ? 'page' : undefined} href="/portal"><Clock3 size={20} /><span>My attendance</span></a>
          : workspacePages.filter(item => role === 'admin' || !['devices', 'kiosk'].includes(item.id)).map(item => {
            const content = <><item.icon size={20} /><span>{item.label}</span>{item.id === 'employees' && employeeCount !== undefined && <small>{employeeCount}</small>}</>;
            const props = { className: `nav-item ${activePage === item.id ? 'selected' : ''}`, 'aria-current': activePage === item.id ? 'page' as const : undefined };
            return onNavigate
              ? <button key={item.id} {...props} onClick={() => navigate(item.id)}>{content}</button>
              : <a key={item.id} {...props} href={'/#' + item.id}>{content}</a>;
          })}
        <a className={`nav-item ${activePage === 'leave' ? 'selected' : ''}`} href="/leave" aria-current={activePage === 'leave' ? 'page' : undefined}><CalendarDays size={20} /><span>{staff ? 'My leave' : 'Leave'}</span></a>
        {role === 'admin' && <>
          <a className="nav-item" href="/access"><ShieldCheck size={20} /><span>User access</span></a>
          <a className="nav-item" href="/audit"><Activity size={20} /><span>Audit log</span></a>
        </>}
        {role !== 'admin' && <>
          <a className={`nav-item ${activePage === 'profile' ? 'selected' : ''}`} href="/profile" aria-current={activePage === 'profile' ? 'page' : undefined}><UserRound size={20} /><span>My profile & job</span></a>
          <a className={`nav-item ${activePage === 'settings' ? 'selected' : ''}`} href="/settings" aria-current={activePage === 'settings' ? 'page' : undefined}><Settings size={20} /><span>My settings</span></a>
        </>}
      </nav>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-wave" aria-hidden="true"><svg viewBox="0 0 480 36" preserveAspectRatio="none" focusable="false">
          <path className="topbar-wave-back" d="M0 20C40 4 80 4 120 20S200 36 240 20S320 4 360 20S440 36 480 20V36H0Z" />
          <path className="topbar-wave-front" d="M0 22C40 34 80 34 120 22S200 10 240 22S320 34 360 22S440 10 480 22V36H0Z" />
        </svg></div>
        <div className="breadcrumb">
          <button id="navigation-toggle" className="icon-button menu-toggle" aria-controls="workspace-navigation" aria-expanded={open} aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <span>{staff ? 'Staff portal' : 'Workspace'}</span><ChevronRight size={14} /><strong>{pageTitle}</strong>
        </div>
        <div className="topbar-right">
          <ThemeToggle />
          <span className="timezone-label"><Clock3 size={15} /> Malaysia time <span className="gmt">GMT+8</span></span>
          <button className="icon-button" aria-label="Refresh workspace" disabled={busy} onClick={onRefresh || (() => window.location.reload())}><RefreshCw size={18} className={busy ? 'spin' : ''} /></button>
          <span className="topbar-divider" /><span className="avatar small mint" title={displayName}>{initials(displayName)}</span>
          <a className="button small-button logout-button" href={signOutPath} target="_top" aria-label="Log out"><LogOut size={17} /><span>Log out</span></a>
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  </div>;
}
