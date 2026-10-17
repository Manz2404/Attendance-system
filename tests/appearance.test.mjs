import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { appearanceThemes, appearanceAccents, normalizeAppearance, resolveAppearance, colorContrast, appearanceBootstrap } from '../lib/appearance.ts';

test('appearance defaults preserve an existing mode and recover from damaged preferences', () => {
  assert.equal(normalizeAppearance(undefined, 'dark').mode, 'dark');
  assert.equal(normalizeAppearance(undefined, 'light').mode, 'light');
  assert.equal(normalizeAppearance().mode, 'system');
  for (const value of [null, [], 12, 'dark', { version: 99, mode: 'dark' }]) assert.equal(normalizeAppearance(value).theme, 'hadir');
  const settings = normalizeAppearance({ mode: 'injected', theme: '__proto__', accent: 'red;display:none', colors: { dark: { background: '#000000', foreground: '#000000' } } });
  assert.equal(settings.mode, 'system'); assert.equal(settings.theme, 'hadir'); assert.equal(settings.accent, '#247a5b'); assert.equal(settings.colors.dark, null);
});

test('system appearance follows device mode while explicit modes stay fixed', () => {
  const system = normalizeAppearance({ mode: 'system', theme: 'midnight', accent: '#2563EB' });
  assert.equal(resolveAppearance(system, true).mode, 'dark'); assert.equal(resolveAppearance(system, false).mode, 'light');
  assert.equal(resolveAppearance({ ...system, mode: 'light' }, true).mode, 'light');
  assert.equal(resolveAppearance({ ...system, mode: 'dark' }, false).mode, 'dark');
  assert.equal(normalizeAppearance(system).accent, '#2563eb');
});

test('every theme and accent keeps text, buttons, and selected navigation readable in both modes', () => {
  for (const theme of appearanceThemes) for (const mode of ['light', 'dark']) for (const accent of appearanceAccents) {
    const appearance = resolveAppearance({ theme: theme.id, mode, accent: accent.color });
    const tokens = appearance.variables, label = `${theme.id}/${mode}/${accent.id}`;
    assert.ok(colorContrast(appearance.foreground, appearance.background) >= 4.5, label);
    assert.ok(colorContrast(appearance.foreground, appearance.card) >= 4.5, label);
    assert.ok(colorContrast(tokens['--muted'], appearance.card) >= 4.5, label);
    assert.ok(colorContrast(tokens['--appearance-action-ink'], accent.color) >= 4.5, label);
    assert.ok(colorContrast(tokens['--green'], tokens['--soft-green']) >= 4.5, label);
    assert.ok(Object.entries(tokens).every(([name, value]) => name === 'color-scheme' || /^#[0-9a-f]{6}$/.test(value)), label);
  }
});

test('custom background and foreground are independent by mode and unsafe pairs are discarded', () => {
  const settings = normalizeAppearance({ mode: 'dark', colors: { dark: { background: '#000000', foreground: '#EDEDED' }, light: { background: '#FFFDF8', foreground: '#322818' } } });
  assert.equal(resolveAppearance(settings).background, '#000000'); assert.equal(resolveAppearance(settings).foreground, '#ededed');
  assert.equal(resolveAppearance({ ...settings, mode: 'light' }).background, '#fffdf8');
  assert.deepEqual(normalizeAppearance(JSON.parse(JSON.stringify(settings))), settings);
  for (const pair of [{ background: '#ffffff', foreground: '#eeeeee' }, { background: '#000', foreground: '#fff' }, { background: 'url(evil)', foreground: '#ffffff' }]) {
    assert.equal(normalizeAppearance({ colors: { dark: pair } }).colors.dark, null);
  }
  for (const accent of ['#ffffff', '#000000', '#ffff00']) {
    const resolved = resolveAppearance({ ...settings, accent });
    assert.ok(colorContrast(resolved.variables['--appearance-action-ink'], accent) >= 4.5);
    assert.ok(colorContrast(resolved.variables['--green'], resolved.card) >= 4.5);
  }
});

test('first-paint bootstrap works with saved colors, legacy mode, corrupt JSON and blocked storage', () => {
  function boot({ saved = null, legacy = null, dark = false, blocked = false } = {}) {
    const values = {}, root = { dataset: {}, style: { setProperty: (key, value) => { values[key] = value; } } };
    const window = { matchMedia: () => ({ matches: dark }), localStorage: { getItem: key => { if (blocked) throw new Error('Storage disabled'); return key === 'hadir-theme' ? legacy : saved; } } };
    runInNewContext(appearanceBootstrap, { window, document: { documentElement: root } }, { timeout: 1000 });
    return { root, values };
  }
  const saved = JSON.stringify(normalizeAppearance({ mode: 'dark', theme: 'midnight', accent: '#e11d48', colors: { dark: { background: '#000000', foreground: '#ededed' } } }));
  const custom = boot({ saved });
  assert.equal(custom.root.dataset.theme, 'dark'); assert.equal(custom.root.dataset.appearance, 'midnight'); assert.equal(custom.values['--surface'], '#000000'); assert.equal(custom.values['--appearance-accent'], '#e11d48');
  assert.equal(boot({ legacy: 'dark' }).root.dataset.theme, 'dark');
  assert.equal(boot({ saved: '{bad json', legacy: 'dark' }).root.dataset.theme, 'dark');
  assert.equal(boot({ dark: true, blocked: true }).root.dataset.theme, 'dark');
  assert.equal(boot().root.dataset.theme, 'light');
});
