import { create } from 'zustand';
import type { AppSettings, ColorTheme, Theme } from '../types';
import { storageService } from '../services/StorageService';
import { DEFAULT_SETTINGS } from '../constants';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setHighContrastBw: (enabled: boolean) => Promise<void>;
  setColorTheme: (colorTheme: ColorTheme) => Promise<void>;
  setColorPresetTheme: (presetId: string, colorTheme: ColorTheme) => Promise<void>;
  resetColorPresetTheme: (presetId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await storageService.getSettings();
    set({ settings, loaded: true });
  },

  setTheme: async (theme) => {
    const settings = { ...get().settings, theme };
    set({ settings });
    await storageService.set('settings', settings);
  },

  setHighContrastBw: async (enabled) => {
    const settings = { ...get().settings, highContrastBw: enabled };
    set({ settings });
    await storageService.set('settings', settings);
  },

  setColorTheme: async (colorTheme) => {
    const settings = { ...get().settings, colorTheme };
    set({ settings });
    await storageService.set('settings', settings);
  },

  setColorPresetTheme: async (presetId, colorTheme) => {
    const current = get().settings;
    const settings = {
      ...current,
      colorPresets: {
        ...(current.colorPresets ?? {}),
        [presetId]: { ...colorTheme, presetId },
      },
    };
    set({ settings });
    await storageService.set('settings', settings);
  },

  resetColorPresetTheme: async (presetId) => {
    const current = get().settings;
    const { [presetId]: _removed, ...colorPresets } = current.colorPresets ?? {};
    const settings = { ...current, colorPresets };
    set({ settings });
    await storageService.set('settings', settings);
  },
}));
