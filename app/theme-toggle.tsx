'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark');
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'hadir-theme') return;
      document.documentElement.dataset.theme = event.newValue === 'dark' || event.newValue === 'light'
        ? event.newValue : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      sync();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try { localStorage.setItem('hadir-theme', next ? 'dark' : 'light'); } catch { /* Theme still works when storage is disabled. */ }
  }
  return <button type="button" className="theme-toggle" onClick={toggle}
    aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark}
    title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
    {dark ? <Sun size={17} /> : <Moon size={17} />}<span className="theme-toggle-label">{dark ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}
