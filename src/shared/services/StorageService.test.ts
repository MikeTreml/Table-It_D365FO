import { beforeEach, describe, expect, it, vi } from 'vitest';
import { del as idbDel, entries as idbEntries, get as idbGet, set as idbSet } from 'idb-keyval';
import type { StorageSchema } from '../types';

vi.mock('idb-keyval', () => ({
  del: vi.fn(),
  entries: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

type MessageListener = (event: MessageEvent<unknown>) => void;

class FakeBroadcastChannel {
  private static channels = new Map<string, Set<FakeBroadcastChannel>>();
  private listeners = new Set<MessageListener>();
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    const channels = FakeBroadcastChannel.channels.get(name) ?? new Set<FakeBroadcastChannel>();
    channels.add(this);
    FakeBroadcastChannel.channels.set(name, channels);
  }

  static reset() {
    FakeBroadcastChannel.channels.clear();
  }

  postMessage(data: unknown) {
    const channels = FakeBroadcastChannel.channels.get(this.name) ?? new Set<FakeBroadcastChannel>();
    for (const channel of channels) {
      if (channel === this) continue;
      const event = { data } as MessageEvent<unknown>;
      for (const listener of channel.listeners) {
        listener(event);
      }
    }
  }

  addEventListener(type: 'message', listener: MessageListener) {
    if (type === 'message') {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: 'message', listener: MessageListener) {
    if (type === 'message') {
      this.listeners.delete(listener);
    }
  }

  close() {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
    this.listeners.clear();
  }
}

async function loadStorageService() {
  vi.resetModules();
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  return import('./StorageService');
}

describe('StorageService', () => {
  beforeEach(() => {
    FakeBroadcastChannel.reset();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists values in IndexedDB and notifies local subscribers', async () => {
    const { StorageService } = await loadStorageService();
    const service = new StorageService();
    const changes: Array<Partial<StorageSchema>> = [];

    service.onChange((change) => changes.push(change));
    await service.set('favorites', ['CustTable']);

    expect(idbSet).toHaveBeenCalledWith('favorites', ['CustTable']);
    expect(changes).toEqual([{ favorites: ['CustTable'] }]);
  });

  it('broadcasts changes to other service instances', async () => {
    const { StorageService } = await loadStorageService();
    const first = new StorageService();
    const second = new StorageService();
    const changes: Array<Partial<StorageSchema>> = [];

    second.onChange((change) => changes.push(change));
    await first.set('activeProfileId', 'profile-1');

    expect(changes).toEqual([{ activeProfileId: 'profile-1' }]);
  });

  it('reads all keys and removes values through IndexedDB', async () => {
    vi.mocked(idbGet).mockResolvedValueOnce(['VendTable']);
    vi.mocked(idbEntries).mockResolvedValueOnce([
      ['favorites', ['CustTable']],
      ['activeProfileId', 'profile-1'],
    ]);
    const { StorageService } = await loadStorageService();
    const service = new StorageService();

    await expect(service.get('favorites')).resolves.toEqual(['VendTable']);
    await expect(service.getAll()).resolves.toEqual({
      favorites: ['CustTable'],
      activeProfileId: 'profile-1',
    });

    await service.remove('activeProfileId');

    expect(idbDel).toHaveBeenCalledWith('activeProfileId');
  });
});
