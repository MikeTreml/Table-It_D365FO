import { create } from 'zustand';
import { storageService } from '../services/StorageService';

interface FavoritesState {
  favorites: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (tableName: string) => Promise<void>;
  isFavorite: (tableName: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set(),
  loaded: false,

  load: async () => {
    const list = await storageService.getFavorites();
    set({ favorites: new Set(list), loaded: true });
  },

  toggle: async (tableName) => {
    const { favorites } = get();
    const updated = new Set(favorites);
    if (updated.has(tableName)) {
      updated.delete(tableName);
    } else {
      updated.add(tableName);
    }
    set({ favorites: updated });
    await storageService.set('favorites', Array.from(updated));
  },

  isFavorite: (tableName) => get().favorites.has(tableName),
}));
