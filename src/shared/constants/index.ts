export const D365FO_VERSION = '10.0';  // Table data extracted from D365FO 10.0

import type { ColorTheme } from '../types';

// ─── Color Presets ────────────────────────────────────────────────────────────

export interface ColorPresetMeta {
  id: string;
  name: string;
  theme: ColorTheme;
}

export const COLOR_PRESETS: ColorPresetMeta[] = [
  {
    id: 'forest',
    name: 'Forest',
    theme: {
      presetId: 'forest',
      light:  { primaryAction: '#606c38', highlight: '#dda15e', pageBg: '#fefae0', toolbar: '#283618', bodyText: '#181510' },
      dark:   { pageBg: '#181510', panelBg: '#2c2920', toolbar: '#283618', bodyText: '#f7f2d0' },
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    theme: {
      presetId: 'ocean',
      light:  { primaryAction: '#0e7490', highlight: '#d97706', pageBg: '#f0f9ff', toolbar: '#0c4a6e', bodyText: '#0c1a25' },
      dark:   { pageBg: '#0c1a25', panelBg: '#0f2640', toolbar: '#0c4a6e', bodyText: '#e0f2fe' },
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    theme: {
      presetId: 'slate',
      light:  { primaryAction: '#475569', highlight: '#0ea5e9', pageBg: '#f8fafc', toolbar: '#1e293b', bodyText: '#0f172a' },
      dark:   { pageBg: '#0f172a', panelBg: '#1e293b', toolbar: '#1e293b', bodyText: '#e2e8f0' },
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    theme: {
      presetId: 'rose',
      light:  { primaryAction: '#9f1239', highlight: '#ea580c', pageBg: '#fff1f2', toolbar: '#4c0519', bodyText: '#1a0008' },
      dark:   { pageBg: '#1a0008', panelBg: '#2d0012', toolbar: '#4c0519', bodyText: '#ffe4e6' },
    },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    theme: {
      presetId: 'dusk',
      light:  { primaryAction: '#4338ca', highlight: '#ca8a04', pageBg: '#eef2ff', toolbar: '#1e1b4b', bodyText: '#0d0b1f' },
      dark:   { pageBg: '#0d0b1f', panelBg: '#1e1b4b', toolbar: '#1e1b4b', bodyText: '#e0e7ff' },
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    theme: {
      presetId: 'midnight',
      light:  { primaryAction: '#1e3a5f', highlight: '#bc6c25', pageBg: '#f0f4f8', toolbar: '#0d1f33', bodyText: '#0a1220' },
      dark:   { pageBg: '#0a1220', panelBg: '#0d1f33', toolbar: '#0d1f33', bodyText: '#dde8f5' },
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    theme: {
      presetId: 'ember',
      light:  { primaryAction: '#c2410c', highlight: '#a16207', pageBg: '#fff7ed', toolbar: '#7c2d12', bodyText: '#1c0f05' },
      dark:   { pageBg: '#1c0f05', panelBg: '#301a0b', toolbar: '#7c2d12', bodyText: '#fed7aa' },
    },
  },
  {
    id: 'tundra',
    name: 'Tundra',
    theme: {
      presetId: 'tundra',
      light:  { primaryAction: '#4b6b8a', highlight: '#2d9cdb', pageBg: '#f3f6f9', toolbar: '#2c3e50', bodyText: '#1a252f' },
      dark:   { pageBg: '#1a252f', panelBg: '#2c3e50', toolbar: '#2c3e50', bodyText: '#d6e4f0' },
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    theme: {
      presetId: 'sage',
      light:  { primaryAction: '#557355', highlight: '#d4a843', pageBg: '#f5f7f2', toolbar: '#2d4a2d', bodyText: '#1a2e1a' },
      dark:   { pageBg: '#1a2e1a', panelBg: '#2d4a2d', toolbar: '#2d4a2d', bodyText: '#d4e5d4' },
    },
  },
  {
    id: 'plum',
    name: 'Plum',
    theme: {
      presetId: 'plum',
      light:  { primaryAction: '#7e3f8e', highlight: '#c77dba', pageBg: '#faf5fc', toolbar: '#4a1259', bodyText: '#1e0826' },
      dark:   { pageBg: '#1e0826', panelBg: '#321445', toolbar: '#4a1259', bodyText: '#ead8f0' },
    },
  },
  {
    id: 'copper',
    name: 'Copper',
    theme: {
      presetId: 'copper',
      light:  { primaryAction: '#8b5e3c', highlight: '#d4883e', pageBg: '#faf6f1', toolbar: '#5c3520', bodyText: '#2a1a0e' },
      dark:   { pageBg: '#2a1a0e', panelBg: '#3d2816', toolbar: '#5c3520', bodyText: '#e8d5c4' },
    },
  },
  {
    id: 'storm',
    name: 'Storm',
    theme: {
      presetId: 'storm',
      light:  { primaryAction: '#3b5998', highlight: '#e0943a', pageBg: '#f0f2f5', toolbar: '#1c2b4a', bodyText: '#0e1726' },
      dark:   { pageBg: '#0e1726', panelBg: '#1c2b4a', toolbar: '#1c2b4a', bodyText: '#d0d8e8' },
    },
  },
];

export const DEFAULT_COLOR_THEME: ColorTheme = COLOR_PRESETS[0].theme;

export const DEFAULT_SETTINGS = {
  theme: 'auto' as const,
  highContrastBw: false,
  colorTheme: DEFAULT_COLOR_THEME,
  colorPresets: {},
};

export const LANGUAGES = [
  { id: 'ar', label: 'Arabic' },
  { id: 'cs', label: 'Czech' },
  { id: 'da', label: 'Danish' },
  { id: 'de', label: 'German' },
  { id: 'en-us', label: 'English (US)' },
  { id: 'es', label: 'Spanish' },
  { id: 'et', label: 'Estonian' },
  { id: 'fi', label: 'Finnish' },
  { id: 'fr', label: 'French' },
  { id: 'hu', label: 'Hungarian' },
  { id: 'is', label: 'Icelandic' },
  { id: 'it', label: 'Italian' },
  { id: 'ja', label: 'Japanese' },
  { id: 'lt', label: 'Lithuanian' },
  { id: 'lv', label: 'Latvian' },
  { id: 'nb', label: 'Norwegian' },
  { id: 'nl', label: 'Dutch' },
  { id: 'pl', label: 'Polish' },
  { id: 'pt-br', label: 'Portuguese (Brazil)' },
  { id: 'pt-pt', label: 'Portuguese (Portugal)' },
  { id: 'ru', label: 'Russian' },
  { id: 'sv', label: 'Swedish' },
  { id: 'th', label: 'Thai' },
  { id: 'tr', label: 'Turkish' },
  { id: 'zh-hans', label: 'Chinese (Simplified)' },
];

export const PROFILE_COLORS = [
  '#0078d4', '#107c10', '#d13438', '#8764b8',
  '#038387', '#ca5010', '#00b7c3', '#737373',
];
