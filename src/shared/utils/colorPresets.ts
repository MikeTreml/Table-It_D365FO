import { COLOR_PRESETS } from '@shared/constants';
import type { ColorTheme } from '@shared/types';

export function getResetPreset(theme: ColorTheme) {
  return COLOR_PRESETS.find((preset) => preset.id === theme.presetId) ?? COLOR_PRESETS[0];
}

export function getPresetTheme(
  settingsOrPresets: { colorPresets?: Record<string, ColorTheme> } | Record<string, ColorTheme> | undefined,
  presetId: string,
): ColorTheme {
  if (!settingsOrPresets) {
    return COLOR_PRESETS.find((preset) => preset.id === presetId)?.theme ?? COLOR_PRESETS[0].theme;
  }

  const colorPresets = Object.prototype.hasOwnProperty.call(settingsOrPresets, 'colorPresets')
    ? (settingsOrPresets as { colorPresets?: Record<string, ColorTheme> }).colorPresets
    : settingsOrPresets as Record<string, ColorTheme>;

  return colorPresets?.[presetId] ?? COLOR_PRESETS.find((preset) => preset.id === presetId)?.theme ?? COLOR_PRESETS[0].theme;
}
