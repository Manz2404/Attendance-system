'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { APPEARANCE_KEY, applyAppearanceToRoot, normalizeAppearance, resolveAppearance, type AppearanceSettings } from '@/lib/appearance';

type AppearanceContextValue = {
  settings: AppearanceSettings;
  appearance: ReturnType<typeof resolveAppearance>;
  ready: boolean;
  canSave: boolean;
  update: (settings: AppearanceSettings) => void;
};
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export default function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(() => normalizeAppearance());
  const [systemDark, setSystemDark] = useState(false), [ready, setReady] = useState(false), [canSave, setCanSave] = useState(true);
  const appearance = resolveAppearance(settings, systemDark);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function load() {
      let saved: unknown, legacy: string | null = null;
      try {
        legacy = window.localStorage.getItem('hadir-theme');
        try { saved = JSON.parse(window.localStorage.getItem(APPEARANCE_KEY) || 'null'); } catch { /* Recover from a damaged preference. */ }
        setCanSave(true);
      } catch { setCanSave(false); }
      setSettings(normalizeAppearance(saved, legacy)); setReady(true);
    }
    load(); setSystemDark(media.matches);
    const onMedia = () => setSystemDark(media.matches);
    const onStorage = (event: StorageEvent) => { if (event.key === APPEARANCE_KEY || event.key === 'hadir-theme' || event.key === null) load(); };
    media.addEventListener('change', onMedia); window.addEventListener('storage', onStorage);
    return () => { media.removeEventListener('change', onMedia); window.removeEventListener('storage', onStorage); };
  }, []);
  useEffect(() => { if (ready) applyAppearanceToRoot(document.documentElement, resolveAppearance(settings, systemDark)); }, [settings, systemDark, ready]);
  function update(value: AppearanceSettings) {
    const next = normalizeAppearance(value); setSettings(next);
    try {
      window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
      // Keep the original mode preference readable by older app tabs.
      window.localStorage.setItem('hadir-theme', next.mode); setCanSave(true);
    } catch { setCanSave(false); }
  }
  return <AppearanceContext.Provider value={{ settings, appearance, ready, canSave, update }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('AppearanceProvider is required.');
  return context;
}
