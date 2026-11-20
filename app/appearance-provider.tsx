'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { APPEARANCE_KEY, applyAppearanceToRoot, normalizeAppearance, resolveAppearance, type AppearanceSettings } from '@/lib/appearance';

type AppearanceContextValue = {
  settings: AppearanceSettings;
  appearance: ReturnType<typeof resolveAppearance>;
  ready: boolean;
  canSave: boolean;
  saving: boolean;
  accountSaved: boolean;
  error: string;
  update: (settings: AppearanceSettings) => Promise<void>;
};
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function cache(settings: AppearanceSettings) {
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings)); localStorage.setItem('hadir-theme', settings.mode); } catch { /* Account persistence does not depend on browser storage. */ }
}
export default function AppearanceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<AppearanceSettings>(() => normalizeAppearance());
  const [ready, setReady] = useState(false), [canSave, setCanSave] = useState(false);
  const [saving, setSaving] = useState(false), [accountSaved, setAccountSaved] = useState(false), [error, setError] = useState('');
  const account = useRef(false), pending = useRef(false), generation = useRef(0);
  const appearance = resolveAppearance(settings);
  useEffect(() => {
    const revision = ++generation.current;
    const controller = new AbortController();
    setReady(false); setCanSave(false); setError(''); setAccountSaved(false); account.current = false;
    let local = normalizeAppearance();
    try { local = normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null'), localStorage.getItem('hadir-theme')); } catch { /* Use defaults. */ }
    const fixed = { ...local, mode: resolveAppearance(local, window.matchMedia('(prefers-color-scheme: dark)').matches).mode };
    setSettings(fixed);
    async function load() {
      try {
        const response = await fetch('/api/appearance', { cache: 'no-store', signal: controller.signal });
        if (revision !== generation.current) return;
        if (response.status === 401) {
          if (pathname === '/login' || pathname === '/register' || pathname.startsWith('/kiosk')) { setCanSave(true); return; }
          throw new Error('Please sign in again to load and save your appearance.');
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load appearance. Please reload to retry.');
        account.current = true;
        if (result.settings) {
          const saved = normalizeAppearance(result.settings);
          const next = { ...saved, mode: saved.mode === 'system' ? fixed.mode : saved.mode };
          setSettings(next); cache(next); setAccountSaved(true);
        }
        setCanSave(true);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load appearance.');
      } finally { if (revision === generation.current) setReady(true); }
    }
    void load();
    return () => { controller.abort(); ++generation.current; };
  }, [pathname]);
  useEffect(() => { if (ready) applyAppearanceToRoot(document.documentElement, appearance); }, [settings, ready]);
  async function update(value: AppearanceSettings) {
    if (!ready || !canSave || pending.current) return;
    const revision = generation.current;
    const normalized = normalizeAppearance(value);
    const next = { ...normalized, mode: normalized.mode === 'system' ? appearance.mode : normalized.mode };
    pending.current = true; setSaving(true); setError('');
    try {
      if (account.current) {
        const response = await fetch('/api/appearance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: next }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not save appearance. Please retry.');
      }
      if (revision !== generation.current) return;
      setSettings(next); cache(next); setAccountSaved(account.current);
    } catch (e) {
      if (revision === generation.current) setError(e instanceof Error ? e.message : 'Could not save appearance. Please retry.');
    } finally { pending.current = false; setSaving(false); }
  }
  return <AppearanceContext.Provider value={{ settings, appearance, ready, canSave, saving, accountSaved, error, update }}>{children}</AppearanceContext.Provider>;
}
export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('AppearanceProvider is required.');
  return context;
}
