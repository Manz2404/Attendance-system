'use client';

import { Moon, Sun } from 'lucide-react';
import { useAppearance } from './appearance-provider';

export default function ThemeToggle() {
  const { settings, appearance, ready, canSave, saving, error, update } = useAppearance();
  const dark = appearance.mode === 'dark';
  function toggle() {
    update({ ...settings, mode: dark ? 'light' : 'dark' });
  }
  return <button type="button" className="theme-toggle" onClick={toggle} disabled={!ready || !canSave || saving}
    aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark}
    title={error || (dark ? 'Switch to light mode' : 'Switch to dark mode')}>
    {dark ? <Sun size={17} /> : <Moon size={17} />}<span className="theme-toggle-label">{dark ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}

