import { create } from 'zustand';
import type { Profile } from '../types';
import { storageService } from '../services/StorageService';
import { COLOR_PRESETS, PROFILE_COLORS } from '../constants';

interface ProfileState {
  profiles: Profile[];
  activeProfileId: string | null;
  loaded: boolean;
  activeProfile: () => Profile | null;
  load: () => Promise<void>;
  add: (data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt' | 'color'> & { color?: string }) => Promise<void>;
  update: (id: string, data: Partial<Profile>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
}

function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  loaded: false,

  activeProfile: () => {
    const { profiles, activeProfileId } = get();
    return profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;
  },

  load: async () => {
    const [profiles, activeProfileId] = await Promise.all([
      storageService.getProfiles(),
      storageService.getActiveProfileId(),
    ]);
    set({ profiles, activeProfileId, loaded: true });
  },

  add: async (data) => {
    const { profiles } = get();
    const presetColor = data.colorPresetId
      ? COLOR_PRESETS.find((preset) => preset.id === data.colorPresetId)?.theme.light.primaryAction
      : undefined;
    const color = data.color ?? presetColor ?? PROFILE_COLORS[profiles.length % PROFILE_COLORS.length];
    const now = Date.now();
    const profile: Profile = {
      ...data,
      id: generateId(),
      color,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...profiles, profile];
    set({ profiles: updated });
    await storageService.set('profiles', updated);

    // Auto-activate first profile
    if (updated.length === 1) {
      set({ activeProfileId: profile.id });
      await storageService.set('activeProfileId', profile.id);
    }
  },

  update: async (id, data) => {
    const updated = get().profiles.map((p) =>
      p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
    );
    set({ profiles: updated });
    await storageService.set('profiles', updated);
  },

  remove: async (id) => {
    const { profiles, activeProfileId } = get();
    const updated = profiles.filter((p) => p.id !== id);
    set({ profiles: updated });
    await storageService.set('profiles', updated);

    if (activeProfileId === id) {
      const newActive = updated[0]?.id ?? null;
      set({ activeProfileId: newActive });
      await storageService.set('activeProfileId', newActive);
    }
  },

  setActive: async (id) => {
    set({ activeProfileId: id });
    await storageService.set('activeProfileId', id);
  },
}));
