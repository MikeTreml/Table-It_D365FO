import { del as idbDel, entries as idbEntries, get as idbGet, set as idbSet } from 'idb-keyval';
import type { StorageSchema } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

type StorageKey = keyof StorageSchema;
type StorageChanges = Partial<StorageSchema>;
type StorageChangeCallback = (changes: StorageChanges) => void;

const STORAGE_SYNC_CHANNEL = 'table-it-storage-sync';
const STORAGE_KEYS = [
  'profiles',
  'activeProfileId',
  'settings',
  'favorites',
  'entityCountCache',
  'metadataCache',
] as const satisfies readonly StorageKey[];

interface StorageSyncMessage {
  sourceId: string;
  changes: StorageChanges;
}

function createSourceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isStorageKey(key: IDBValidKey): key is StorageKey {
  return typeof key === 'string' && (STORAGE_KEYS as readonly string[]).includes(key);
}

function isStorageSyncMessage(value: unknown): value is StorageSyncMessage {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { sourceId?: unknown }).sourceId === 'string' &&
    !!(value as { changes?: unknown }).changes &&
    typeof (value as { changes?: unknown }).changes === 'object'
  );
}

export class StorageService {
  private readonly sourceId = createSourceId();
  private readonly listeners = new Set<StorageChangeCallback>();
  private readonly channel: BroadcastChannel | null =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(STORAGE_SYNC_CHANNEL);

  constructor() {
    this.channel?.addEventListener('message', this.handleBroadcastMessage);
  }

  async get<K extends StorageKey>(key: K): Promise<StorageSchema[K] | undefined> {
    return (await idbGet(key)) as StorageSchema[K] | undefined;
  }

  async set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
    await idbSet(key, value);
    this.emitChange({ [key]: value } as StorageChanges);
  }

  async getAll(): Promise<Partial<StorageSchema>> {
    const result: Partial<StorageSchema> = {};
    const storedEntries = await idbEntries();

    for (const [key, value] of storedEntries) {
      if (isStorageKey(key)) {
        (result as Record<string, unknown>)[key] = value;
      }
    }

    return result;
  }

  async remove(key: StorageKey): Promise<void> {
    await idbDel(key);
    this.emitChange({ [key]: undefined } as StorageChanges);
  }

  onChange(callback: StorageChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  close(): void {
    this.channel?.removeEventListener('message', this.handleBroadcastMessage);
    this.channel?.close();
    this.listeners.clear();
  }

  private emitChange(changes: StorageChanges): void {
    this.notifyListeners(changes);
    this.channel?.postMessage({ sourceId: this.sourceId, changes });
  }

  private notifyListeners(changes: StorageChanges): void {
    for (const listener of Array.from(this.listeners)) {
      listener(changes);
    }
  }

  private readonly handleBroadcastMessage = (event: MessageEvent<unknown>): void => {
    if (!isStorageSyncMessage(event.data) || event.data.sourceId === this.sourceId) {
      return;
    }
    this.notifyListeners(event.data.changes);
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
