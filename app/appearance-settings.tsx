'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { appearanceThemes, appearanceAccents, colorContrast, isColor, normalizeAppearance, resolveAppearance, type AppearanceMode } from '@/lib/appearance';
import { useAppearance } from './appearance-provider';

const modes = [{ id: 'system', label: 'System', icon: Monitor }, { id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }] as const;

export default function AppearanceSettings() {
  const { settings, appearance, ready, canSave, update } = useAppearance();
  const [background, setBackground] = useState(appearance.background), [foreground, setForeground] = useState(appearance.foreground);
  const accentPicker = useRef<HTMLInputElement>(null);
  useEffect(() => { setBackground(appearance.background); setForeground(appearance.foreground); }, [appearance.background, appearance.foreground, appearance.mode]);
  const chosenAccent = appearanceAccents.find(item => item.color === settings.accent)?.id ?? 'custom';
  const validColors = isColor(background) && isColor(foreground), contrast = colorContrast(background, foreground);
  const colorsChanged = background.toLowerCase() !== appearance.background || foreground.toLowerCase() !== appearance.foreground;
  const previewColors = validColors ? { background, color: foreground } : { background: appearance.background, color: appearance.foreground };
  function setMode(mode: AppearanceMode) { update({ ...settings, mode }); }
  function applyColors() {
    if (!validColors || contrast < 4.5) return;
    update({ ...settings, colors: { ...settings.colors, [appearance.mode]: { background, foreground } } });
  }
  function resetColors() {
    const next = { ...settings, colors: { ...settings.colors, [appearance.mode]: null } };
    const reset = resolveAppearance(next, appearance.mode === 'dark');
    setBackground(reset.background); setForeground(reset.foreground); update(next);
  }
  return <section className="card appearance-settings" aria-labelledby="appearance-title">
    <header className="appearance-heading"><div><span className="appearance-eyebrow"><Palette size={15} />MAKE IT YOURS</span><h2 id="appearance-title">Appearance</h2><p>Choose the look that feels right for your workday.</p></div><button type="button" className="button secondary small-button" disabled={!ready} onClick={() => update(normalizeAppearance())}><RotateCcw size={14} />Reset appearance</button></header>
    <h3 className="appearance-section-title">Visual style</h3>
    <div className="appearance-mode-row"><div className="appearance-row-label"><strong>Mode</strong><p>Follow your device or choose a look.</p></div><div className="appearance-modes" role="group" aria-label="Color mode">{modes.map(({ id, label, icon: Icon }) => <button type="button" key={id} disabled={!ready} className={`appearance-mode ${settings.mode === id ? 'is-selected' : ''}`} aria-pressed={settings.mode === id} onClick={() => setMode(id)}><span className={`appearance-miniature miniature-${id}`} aria-hidden="true"><span className="miniature-sidebar"><i /><i /><i /></span><span className="miniature-content"><i /><i /><span /><i /></span>{settings.mode === id && <span className="appearance-mode-check"><Check size={10} /></span>}</span><span className="appearance-mode-label"><Icon size={13} />{label}</span></button>)}</div></div>
    <div className="appearance-controls">
      <div className="appearance-row"><label className="appearance-row-label" htmlFor="appearance-theme"><strong>Theme</strong><span>A coordinated background and palette.</span></label><select id="appearance-theme" disabled={!ready} value={settings.theme} onChange={event => { const theme = appearanceThemes.find(item => item.id === event.target.value); if (theme) update({ ...settings, theme: theme.id, accent: theme.accent, colors: { light: null, dark: null } }); }}>{appearanceThemes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select></div>
      <div className="appearance-row"><label className="appearance-row-label" htmlFor="appearance-accent"><strong>Accent</strong><span>Buttons, links, and selected items.</span></label><div className="appearance-color-choice"><select id="appearance-accent" disabled={!ready} value={chosenAccent} onChange={event => { if (event.target.value === 'custom') { accentPicker.current?.click(); return; } const accent = appearanceAccents.find(item => item.id === event.target.value); if (accent) update({ ...settings, accent: accent.color }); }}>{appearanceAccents.map(accent => <option key={accent.id} value={accent.id}>{accent.name}</option>)}<option value="custom">Custom color</option></select><label className="appearance-accent-picker" title="Choose a custom accent color"><input ref={accentPicker} type="color" aria-label="Custom accent color" disabled={!ready} value={settings.accent} onChange={event => update({ ...settings, accent: event.target.value })} /><span className="sr-only">Custom accent color</span></label></div></div>
      <div className="appearance-row"><label className="appearance-row-label" htmlFor="appearance-background"><strong>Background</strong><span>{appearance.mode === 'dark' ? 'Dark' : 'Light'} mode background.</span></label><div className="appearance-color-field"><input type="color" aria-label="Pick background color" disabled={!ready} value={isColor(background) ? background : appearance.background} onChange={event => setBackground(event.target.value)} /><input id="appearance-background" aria-describedby="appearance-color-help" spellCheck={false} autoComplete="off" maxLength={7} value={background} disabled={!ready} onChange={event => setBackground(event.target.value)} /></div></div>
      <div className="appearance-row"><label className="appearance-row-label" htmlFor="appearance-foreground"><strong>Foreground</strong><span>Headings and text.</span></label><div className="appearance-color-field"><input type="color" aria-label="Pick foreground color" disabled={!ready} value={isColor(foreground) ? foreground : appearance.foreground} onChange={event => setForeground(event.target.value)} /><input id="appearance-foreground" aria-describedby="appearance-color-help" spellCheck={false} autoComplete="off" maxLength={7} value={foreground} disabled={!ready} onChange={event => setForeground(event.target.value)} /></div></div>
    </div>
    <div className="appearance-color-actions"><p id="appearance-color-help" role="status">{colorsChanged ? !validColors ? 'Enter colors as six-digit hex values, for example #202E2A.' : contrast < 4.5 ? 'Choose colors with at least 4.5:1 contrast so text stays readable.' : 'Preview ready. Apply these colors to your current mode.' : `Text contrast ${contrast.toFixed(1)}:1 · Custom colors are saved separately for light and dark mode.`}</p><div><button type="button" className="text-button" disabled={!ready || (!colorsChanged && !settings.colors[appearance.mode])} onClick={resetColors}>Reset colors</button><button type="button" className="button primary small-button" disabled={!ready || !colorsChanged || !validColors || contrast < 4.5} onClick={applyColors}><Check size={14} />Apply colors</button></div></div>
    <div className="appearance-live-preview" style={previewColors}><div><span className="appearance-preview-label">PREVIEW</span><strong>A clearer start to your day.</strong><p>Your team. Every workday.</p></div><span className="appearance-preview-action" style={{ background: settings.accent, color: appearance.variables['--appearance-action-ink'] }}><Check size={15} />Clock in</span></div>
    <p className={`appearance-save-note ${canSave ? '' : 'save-unavailable'}`} role="status">{canSave ? 'Saved in this browser. Applies to the dashboard, sign-in, and kiosk screens.' : 'Your browser cannot save these settings. Changes last for this visit.'}</p>
  </section>;
}
