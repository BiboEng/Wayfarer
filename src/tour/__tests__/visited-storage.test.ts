import AsyncStorage from '@react-native-async-storage/async-storage';

import { asyncStorageVisitedStore } from '../visited-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

const mockStore = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockStore.getItem.mockReset();
  mockStore.setItem.mockReset();
});

describe('asyncStorageVisitedStore', () => {
  it('loads the stored day', async () => {
    mockStore.getItem.mockResolvedValue('{"date":"2026-06-10","ids":["a"]}');
    await expect(asyncStorageVisitedStore.load()).resolves.toEqual({ date: '2026-06-10', ids: ['a'] });
  });

  it('loads null when nothing is stored or the data is corrupt', async () => {
    mockStore.getItem.mockResolvedValueOnce(null);
    await expect(asyncStorageVisitedStore.load()).resolves.toBeNull();
    mockStore.getItem.mockResolvedValueOnce('{oops');
    await expect(asyncStorageVisitedStore.load()).resolves.toBeNull();
  });

  it('never rejects when storage fails', async () => {
    mockStore.getItem.mockRejectedValue(new Error('disk'));
    await expect(asyncStorageVisitedStore.load()).resolves.toBeNull();
  });

  it('saves the day as JSON', () => {
    mockStore.setItem.mockResolvedValue(undefined);
    asyncStorageVisitedStore.save({ date: '2026-06-10', ids: ['a', 'b'] });
    expect(mockStore.setItem).toHaveBeenCalledWith(expect.any(String), '{"date":"2026-06-10","ids":["a","b"]}');
  });

  it('ignores a failing save (no unhandled rejection)', async () => {
    mockStore.setItem.mockRejectedValue(new Error('full'));
    expect(() => asyncStorageVisitedStore.save({ date: '2026-06-10', ids: [] })).not.toThrow();
    await flush();
  });
});
