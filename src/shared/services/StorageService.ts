import type { StorageSchema } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

type StorageKey = keyof StorageSchema;

class StorageService {
  async get<K extends StorageKey>(key: K): Promise<StorageSchema[K] | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] as StorageSchema[K] | undefined);
      });
    });
  }

  async set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  async getAll(): Promise<Partial<StorageSchema>> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(result as Partial<StorageSchema>);
      });
    });
  }

  async remove(key: StorageKey): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  }

  onChange(callback: (changes: Partial<StorageSchema>) => void): () => void {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>
    ) => {
      const mapped: Partial<StorageSchema> = {};
      for (const key of Object.keys(changes)) {
        (mapped as Record<string, unknown>)[key] = changes[key].newValue;
      }
      callback(mapped);
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }

  async getSettings(): Promise<StorageSchema['settings']> {
    const settings = await this.get('settings');
    return settings ?? DEFAULT_SETTINGS;
  }

  async getProfiles(): Promise<StorageSchema['profiles']> {
    return (await this.get('profiles')) ?? [];
  }

  async getActiveProfileId(): Promise<string | null> {
    return (await this.get('activeProfileId')) ?? null;
  }

  async getFavorites(): Promise<string[]> {
    return (await this.get('favorites')) ?? [];
  }

  async getEntityCountCache(): Promise<StorageSchema['entityCountCache']> {
    return (await this.get('entityCountCache')) ?? {};
  }

  async getMetadataCache(): Promise<StorageSchema['metadataCache']> {
    return (await this.get('metadataCache')) ?? {};
  }
}

export const storageService = new StorageService();
