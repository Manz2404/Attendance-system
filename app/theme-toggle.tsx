'use client';

import { Moon, Sun } from 'lucide-react';
import { useAppearance } from './appearance-provider';

export default function ThemeToggle() {
  const { settings, appearance, ready, update } = useAppearance();
  const dark = appearance.mode === 'dark';
  function toggle() {
    update({ ...settings, mode: dark ? 'light' : 'dark' });
  }
  return <button type="button" className="theme-toggle" onClick={toggle} disabled={!ready}
    aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark}
    title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
    {dark ? <Sun size={17} /> : <Moon size={17} />}<span className="theme-toggle-label">{dark ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}
