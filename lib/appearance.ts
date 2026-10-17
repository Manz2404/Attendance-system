export type AppearanceMode = 'system' | 'light' | 'dark';
export type ColorMode = 'light' | 'dark';
export type ColorPair = { background: string; foreground: string };
export type AppearanceSettings = {
  version: 1;
  mode: AppearanceMode;
  theme: 'hadir' | 'midnight' | 'sand';
  accent: string;
  colors: Record<ColorMode, ColorPair | null>;
};

// Keep this factory self-contained: the same policy runs before the first paint.
export function createAppearanceTools() {
  const themes = [
    { id: 'hadir', name: 'Hadir', accent: '#247a5b', light: { background: '#f7f9f7', foreground: '#202e2a', card: '#ffffff' }, dark: { background: '#111b17', foreground: '#e6eee9', card: '#1b2723' } },
    { id: 'midnight', name: 'Midnight', accent: '#8b5cf6', light: { background: '#f7f7fb', foreground: '#262330', card: '#ffffff' }, dark: { background: '#101014', foreground: '#ededf2', card: '#19191f' } },
    { id: 'sand', name: 'Sand', accent: '#b7791f', light: { background: '#faf7f1', foreground: '#3d3327', card: '#fffdfa' }, dark: { background: '#211c17', foreground: '#f0e7db', card: '#2d251d' } },
  ] as const;
  const accents = [
    { id: 'green', name: 'Green', color: '#247a5b' }, { id: 'purple', name: 'Purple', color: '#8b5cf6' },
    { id: 'blue', name: 'Blue', color: '#2563eb' }, { id: 'teal', name: 'Teal', color: '#0d9488' },
    { id: 'orange', name: 'Orange', color: '#ea580c' }, { id: 'rose', name: 'Rose', color: '#e11d48' },
    { id: 'amber', name: 'Amber', color: '#b7791f' }, { id: 'slate', name: 'Slate', color: '#64748b' },
  ] as const;
  const paletteKeys: string[] = ["185840", "1e3b2b", "202e2a", "244830", "247a5b", "254232", "3d6247", "3e5637", "438662", "476451", "48594d", "536b5b", "54675a", "568973", "57a47c", "5a7261", "5b7164", "5c6a5f", "5d7864", "5e7565", "609771", "617a5a", "648854", "64a889", "68875d", "6a8c6b", "6b9875", "6c8c75", "6d815b", "70866f", "718576", "718675", "719c80", "7290b0", "73916d", "79857e", "79a184", "79aa93", "7a897f", "7a9270", "7d8983", "7d9879", "7d9a6a", "7f996a", "808e83", "80baa1", "819486", "819966", "829f6e", "84936e", "84958a", "85a38c", "87a088", "87a485", "889e84", "88a483", "89a18d", "8a968e", "8a9b8e", "8a9e83", "8a9e8c", "8b9b90", "8b9c90", "8c9a8e", "8c9a90", "8c9c91", "8d9a82", "8d9a84", "8d9c91", "8e9c92", "8eaa86", "8eac75", "90a491", "90a78a", "91a08c", "91a097", "91a18b", "92a384", "93a098", "93a188", "93a38b", "93a48c", "94a28f", "94a997", "94bc9e", "9582b8", "95a58c", "95c08b", "96a497", "97a29b", "98a29d", "99a68f", "99a69b", "99aa8a", "99ca9d", "9aa59d", "9aa69b", "9aa69d", "9aa89d", "9aaaa0", "9aaba0", "9aaca0", "9ba89e", "9bb191", "9bb194", "9bbea4", "9da88b", "9eaf95", "9fa99d", "a0aca3", "a1aaa4", "a1af98", "a1af9b", "a1afa4", "a2b091", "a2b193", "a3b198", "a3b294", "a4afa7", "a5b1a7", "a64441", "a6b2a8", "a6b399", "a7c7a2", "a7cbb1", "a8c9a8", "a9b5a1", "ac8065", "ada06d", "afbc9c", "b09876", "b0bba7", "b36662", "b4bdb4", "b75954", "b78a49", "b7c5bb", "ba975b", "bb786b", "bb7c70", "bc965d", "bd7470", "bdc4b9", "c18279", "c18b3e", "c26a68", "c3d8b8", "c48c81", "c78380", "c89b59", "c8daba", "c9a66d", "d2e0d2", "d4ac68", "d5e3d1", "d7eadf", "d8ebd8", "dce7d8", "dce8df", "dce9df", "dfe6e0", "dfe9dc", "dfeddf", "e1c597", "e1efe4", "e2ead8", "e2ebde", "e2ebe0", "e4ebdc", "e4efdf", "e5eddf", "e5edf6", "e6ebe2", "e6ede5", "e7f1e9", "e8ece9", "e8eee8", "e8f1e6", "e8f3ed", "e9ede5", "ead5d3", "eaf0e7", "eaf2eb", "eaf4ec", "eaf5ed", "ece8f6", "edf1e8", "edf3ec", "edf4eb", "edf5ee", "edf5f1", "eef1ef", "eef2e8", "efd6cf", "eff4e8", "f0d9d2", "f0f3ef", "f0f3f0", "f0f6ea", "f1f5ee", "f1f5f1", "f1f6f1", "f2f4f2", "f2f6ee", "f2f6ef", "f3f5ed", "f3f5ee", "f3f5f1", "f3f6ef", "f4f7f2", "f5f8f0", "f5f9ef", "f6e7dc", "f6f5e8", "f6f8f3", "f6f9f4", "f6f9f6", "f7f8f5", "f7f9f7", "f8faf4", "fafbf9", "fafcf9", "fbefee", "fbf4e9", "fbf5ee", "fcf0ed", "fdf5e7", "fdf5e8", "fdfefc"];
  const accentKeys = new Set(['185840', '247a5b', '438662', '64a889', '79aa93', '80baa1', '94bc9e', '9bbea4', 'a7cbb1']);
  const accentSurfaces = new Set(['d7eadf', 'e1efe4', 'e7f1e9', 'e8f3ed']);
  const successKeys = new Set(['568973', '57a47c', '609771', '6b9875', '719c80', 'eaf4ec', 'eaf5ed', 'edf5ee', 'edf5f1']);
  const lineKeys = new Set(['dfe6e0', 'e8ece9', 'e6ebe2', 'e2ebe0']);
  const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const color = (value: unknown, fallback: string) => isColor(value) ? value.toLowerCase() : fallback;
  const rgb = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const mix = (a: string, b: string, amount: number) => {
    const first = rgb(a), second = rgb(b);
    return '#' + first.map((value, i) => Math.round(value + (second[i] - value) * amount).toString(16).padStart(2, '0')).join('');
  };
  function luminance(hex: string) {
    const values = rgb(hex).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; });
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  }
  function contrast(first: string, second: string) {
    if (!isColor(first) || !isColor(second)) return 0;
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  function normalize(value?: unknown, legacy?: string | null): AppearanceSettings {
    const raw = record(value), saved = raw.version === undefined || raw.version === 1 ? raw : {};
    const theme = themes.find(item => item.id === saved.theme) ?? themes[0];
    const mode = saved.mode === 'light' || saved.mode === 'dark' || saved.mode === 'system' ? saved.mode : legacy === 'dark' || legacy === 'light' ? legacy : 'system';
    const pairs = record(saved.colors);
    const pair = (mode: ColorMode): ColorPair | null => {
      const item = record(pairs[mode]);
      return isColor(item.background) && isColor(item.foreground) && contrast(item.background, item.foreground) >= 4.5
        ? { background: item.background.toLowerCase(), foreground: item.foreground.toLowerCase() } : null;
    };
    return { version: 1, mode, theme: theme.id, accent: color(saved.accent, theme.accent), colors: { light: pair('light'), dark: pair('dark') } };
  }
  function resolve(value: unknown, systemDark = false) {
    const settings = normalize(value), mode: ColorMode = settings.mode === 'system' ? systemDark ? 'dark' : 'light' : settings.mode;
    const theme = themes.find(item => item.id === settings.theme) ?? themes[0], base = theme[mode];
    const custom = settings.colors[mode], background = custom?.background ?? base.background, foreground = custom?.foreground ?? base.foreground;
    const raised = custom ? mix(background, foreground, 0.04) : base.card;
    const card = contrast(raised, foreground) >= 4.5 ? raised : background;
    const softSurface = (tint: string, amount: number) => {
      const candidate = mix(card, tint, amount);
      return contrast(candidate, foreground) >= 4.5 ? candidate : card;
    };
    const soft = softSurface(settings.accent, 0.12);
    const readable = (hex: string, backgrounds = [card, background]) => {
      if (backgrounds.every(surface => contrast(hex, surface) >= 4.5)) return hex;
      for (let step = 1; step <= 100; step++) { const candidate = mix(hex, foreground, step / 100); if (backgrounds.every(surface => contrast(candidate, surface) >= 4.5)) return candidate; }
      return foreground;
    };
    const accent = settings.accent, accentText = readable(accent, [card, background, soft]), muted = readable(mix(card, foreground, 0.67), [card, background, softSurface(foreground, 0.035)]);
    const actionInk = contrast(accent, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
    const actionHover = mix(accent, actionInk === '#ffffff' ? '#000000' : '#ffffff', 0.13);
    const variables: Record<string, string> = {
      '--surface': background, '--card': card, '--ink': foreground, '--muted': muted, '--line': mix(card, foreground, 0.16),
      '--green': accentText, '--green-dark': readable(actionHover), '--soft-green': soft,
      '--appearance-accent': accent, '--appearance-action-ink': actionInk, '--appearance-action-hover': actionHover,
      'color-scheme': mode,
    };
    for (const key of paletteKeys) {
      const original = '#' + key, [r, g, b] = rgb(original), maximum = Math.max(r, g, b), minimum = Math.min(r, g, b), difference = maximum - minimum;
      let hue = difference === 0 ? 0 : maximum === r ? ((g - b) / difference) % 6 : maximum === g ? (b - r) / difference + 2 : (r - g) / difference + 4;
      hue = (hue * 60 + 360) % 360;
      const saturation = maximum ? difference / maximum : 0;
      let family: string | null = null;
      if (successKeys.has(key)) family = '#27915c';
      else if (saturation > 0.08 && (hue < 28 || hue > 330)) family = '#c54b4b';
      else if (saturation > 0.08 && hue >= 28 && hue < 65) family = '#b98024';
      else if (saturation > 0.08 && hue >= 190 && hue < 255) family = '#427fc2';
      else if (saturation > 0.08 && hue >= 255 && hue <= 330) family = '#9263c5';
      const token = '--palette-' + key;
      if (accentKeys.has(key)) variables[token] = accentText;
      else if (accentSurfaces.has(key)) variables[token] = soft;
      else if (lineKeys.has(key)) variables[token] = variables['--line'];
      else if (luminance(original) > 0.58) variables[token] = family ? softSurface(family, 0.12) : softSurface(foreground, 0.035);
      else variables[token] = family ? readable(family, [card, background, softSurface(family, 0.12)]) : luminance(original) < 0.055 ? foreground : muted;
    }
    return { mode, theme: theme.id, background, foreground, card, accent, variables };
  }
  return { themes, accents, isColor, contrast, normalize, resolve };
}

export const { themes: appearanceThemes, accents: appearanceAccents, isColor, contrast: colorContrast, normalize: normalizeAppearance, resolve: resolveAppearance } = createAppearanceTools();
export const APPEARANCE_KEY = 'hadir-appearance';

export function applyAppearanceToRoot(root: HTMLElement, appearance: ReturnType<typeof resolveAppearance>) {
  root.dataset.theme = appearance.mode;
  root.dataset.appearance = appearance.theme;
  for (const [name, value] of Object.entries(appearance.variables)) root.style.setProperty(name, value);
}

export const appearanceBootstrap = `(()=>{try{const tools=(${createAppearanceTools.toString()})();const apply=(${applyAppearanceToRoot.toString()});let saved,legacy;try{legacy=window.localStorage.getItem('hadir-theme');try{saved=JSON.parse(window.localStorage.getItem('hadir-appearance')||'null')}catch(e){}}catch(e){}const dark=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-color-scheme: dark)').matches;apply(document.documentElement,tools.resolve(tools.normalize(saved,legacy),dark))}catch(e){document.documentElement.dataset.theme='light'}})();`;
