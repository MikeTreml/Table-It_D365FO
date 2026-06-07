import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useProfileStore } from '../stores/profileStore';
import type { ColorTheme, Profile } from '../types';
import { COLOR_PRESETS, DEFAULT_COLOR_THEME } from '../constants';
import { storageService } from '../services/StorageService';

// ─── Light/dark class toggle ──────────────────────────────────────────────────

function applyTheme(theme: 'light' | 'dark' | 'auto') {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (theme === 'dark' || (theme === 'auto' && prefersDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ─── Color math helpers ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  switch (max) {
    case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: hue = ((b - r) / d + 2) / 6; break;
    case b: hue = ((r - g) / d + 4) / 6; break;
  }
  return [hue * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  return rgbToHsl(...hexToRgb(hex));
}

/** Relative luminance for contrast ratio calculation (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Scale derivation ─────────────────────────────────────────────────────────

/**
 * Derives a 10-step color scale from a single base hex.
 * The base is treated as the "600" stop.
 * Lightness steps are tuned so the scale reads naturally across all sizes.
 */
function deriveScale(base: string): Record<string, string> {
  const [h, s] = hexToHsl(base);
  // [stop, saturationMultiplier, lightness]
  const stops: [number, number, number][] = [
    [50,  0.20, 97],
    [100, 0.30, 93],
    [200, 0.45, 84],
    [300, 0.60, 72],
    [400, 0.78, 60],
    [500, 0.90, 50],
    [600, 1.00, -1],  // -1 = use base directly
    [700, 1.00, 37],
    [800, 1.05, 27],
    [900, 1.10, 18],
  ];
  const result: Record<string, string> = {};
  for (const [stop, sm, l] of stops) {
    result[String(stop)] = l === -1 ? base : hslToHex(h, Math.min(s * sm, 100), l);
  }
  return result;
}

/**
 * Derives the neutral surface scale from the page background color.
 * The bg is treated as surface-50; darker stops are derived toward black,
 * lighter stops toward white.
 */
function deriveSurfaceScale(bg: string, darkBg: string): Record<string, string> {
  const [h, s, l] = hexToHsl(bg);
  const [dh, ds] = hexToHsl(darkBg);
  // Surface neutrals: keep a hint of the bg hue/saturation at low amounts
  const ws = Math.min(s * 0.5, 15); // warm saturation, capped
  return {
    '0':   '#ffffff',
    '50':  bg,
    '100': hslToHex(h, ws * 0.9, Math.min(l - 4,  96)),
    '200': hslToHex(h, ws * 0.8, Math.min(l - 10, 88)),
    '300': hslToHex(h, ws * 0.6, 75),
    '400': hslToHex(h, ws * 0.4, 60),
    '500': hslToHex(h, ws * 0.3, 47),
    '600': hslToHex(h, ws * 0.2, 36),
    '700': hslToHex(h, ws * 0.2, 26),
    '800': hslToHex(dh, Math.min(ds * 0.6, 20), 17),
    '850': hslToHex(dh, Math.min(ds * 0.5, 18), 12),
    '900': darkBg,
    '950': hslToHex(dh, Math.min(ds * 0.4, 15), 5),
  };
}

// ─── CSS variable builder ─────────────────────────────────────────────────────

function buildCss(ct: ColorTheme): string {
  const brand   = deriveScale(ct.light.primaryAction);
  const accent  = deriveScale(ct.light.highlight);
  const surface = deriveSurfaceScale(ct.light.pageBg, ct.dark.pageBg);

  // Override brand-900 with the explicit toolbar color
  brand['900'] = ct.light.toolbar;

  const vars = (scale: Record<string, string>, prefix: string) =>
    Object.entries(scale).map(([k, v]) => `  --color-${prefix}-${k}: ${v};`).join('\n');

  // Dark toolbar may differ from light; surface-900 is set from dark.pageBg
  surface['800'] = ct.dark.panelBg;
  surface['900'] = ct.dark.pageBg;

  return `
:root {
${vars(brand,   'brand')}
${vars(accent,  'accent')}
${vars(surface, 'surface')}
  --color-surface-0: #ffffff;
  --color-body-text: ${ct.light.bodyText};
}
.dark {
  --color-brand-900: ${ct.dark.toolbar};
  --color-body-text: ${ct.dark.bodyText};
}
`.trim();
}

// ─── Inject / remove style tag ────────────────────────────────────────────────

const STYLE_ID = 'd365-color-theme';

function injectColorTheme(ct: ColorTheme) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildCss(ct);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppTheme(profileOverride?: Profile | null) {
  const theme      = useSettingsStore((s) => s.settings.theme);
  const highContrastBw = useSettingsStore((s) => s.settings.highContrastBw ?? false);
  const colorTheme = useSettingsStore((s) => s.settings.colorTheme);
  const colorPresets = useSettingsStore((s) => s.settings.colorPresets);
  const loaded     = useSettingsStore((s) => s.loaded);
  const activeProfile = useProfileStore((s) => s.activeProfile());
  const effectiveProfile = profileOverride ?? activeProfile;
  const effectiveTheme = effectiveProfile?.themeMode ?? theme;
  const effectiveColorTheme = effectiveProfile?.colorPresetId
    ? colorPresets?.[effectiveProfile.colorPresetId] ?? COLOR_PRESETS.find((preset) => preset.id === effectiveProfile.colorPresetId)?.theme
    : colorTheme;

  useEffect(() => {
    if (!loaded) return;
    applyTheme(effectiveTheme);
  }, [effectiveTheme, loaded]);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.classList.toggle('a11y-bw', highContrastBw);
  }, [highContrastBw, loaded]);

  useEffect(() => {
    if (effectiveTheme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [effectiveTheme]);

  useEffect(() => {
    if (!loaded) return;
    injectColorTheme(effectiveColorTheme ?? DEFAULT_COLOR_THEME);
  }, [effectiveColorTheme, loaded]);

  useEffect(() => storageService.onChange((changes) => {
    if (changes.settings) {
      useSettingsStore.setState({ settings: changes.settings, loaded: true });
    }
    if (changes.profiles) {
      useProfileStore.setState({ profiles: changes.profiles, loaded: true });
    }
    if ('activeProfileId' in changes) {
      useProfileStore.setState({ activeProfileId: changes.activeProfileId ?? null, loaded: true });
    }
  }), []);
}
