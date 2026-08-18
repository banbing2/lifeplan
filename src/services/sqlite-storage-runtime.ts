import { getInfoAsync } from 'expo-file-system/legacy';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getNativeDatabaseBytes, getWebDatabaseBytes, type SqliteStorageUsage } from './sqlite-storage-usage';

/** 按当前平台读取这个 SQLite 数据库本身占用的字节数。 */
export async function getSqliteStorageUsage(database: SQLiteDatabase): Promise<SqliteStorageUsage> {
  try {
    if (Platform.OS === 'web') {
      const bytes = await getWebDatabaseBytes(database);
      return bytes === null ? { status: 'unavailable' } : { status: 'available', bytes };
    }

    const bytes = await getNativeDatabaseBytes(database.databasePath, async (path) => {
      const info = await getInfoAsync(path);
      return info.exists ? info.size : undefined;
    });
    return { status: 'available', bytes };
  } catch {
    return { status: 'unavailable' };
  }
}
