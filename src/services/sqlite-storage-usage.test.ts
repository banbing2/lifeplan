import { describe, expect, it } from 'vitest';

import { formatStorageSize, getNativeDatabaseBytes, getWebDatabaseBytes } from './sqlite-storage-usage';

describe('formatStorageSize', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatStorageSize(bytes)).toBe(expected);
  });
});

describe('SQLite storage adapters', () => {
  it('sums the main database and existing SQLite sidecar files on native', async () => {
    const sizes: Record<string, number | undefined> = {
      '/data/life.db': 1000,
      '/data/life.db-wal': 240,
      '/data/life.db-shm': 60,
    };

    await expect(getNativeDatabaseBytes('/data/life.db', async (path) => sizes[path]))
      .resolves.toBe(1300);
  });

  it('uses the serialized current database size on web', async () => {
    await expect(getWebDatabaseBytes({ serializeAsync: async () => new Uint8Array(2048) }))
      .resolves.toBe(2048);
  });

  it('returns unavailable when web serialization fails', async () => {
    await expect(getWebDatabaseBytes({ serializeAsync: async () => { throw new Error('unsupported'); } }))
      .resolves.toBeNull();
  });
});
