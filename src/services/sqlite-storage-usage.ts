export type SqliteStorageUsage =
  | { status: 'available'; bytes: number }
  | { status: 'unavailable' };

type FileSizeReader = (path: string) => Promise<number | undefined>;
type SerializableDatabase = { serializeAsync(): Promise<Uint8Array> };

/** 使用 1024 进制将数据库字节数格式化为紧凑显示值。 */
export function formatStorageSize(bytes: number) {
  const safeBytes = Math.max(0, Math.round(bytes));
  if (safeBytes < 1024) return `${safeBytes} B`;
  if (safeBytes < 1024 * 1024) return `${(safeBytes / 1024).toFixed(1)} KB`;
  return `${(safeBytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 统计原生 SQLite 主文件及可能存在的 WAL、SHM、journal 附属文件。 */
export async function getNativeDatabaseBytes(databasePath: string, readSize: FileSizeReader) {
  const paths = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`];
  const sizes = await Promise.all(paths.map(async (path) => (await readSize(path)) ?? 0));
  return sizes.reduce((total, size) => total + size, 0);
}

/** Web 只使用当前数据库自身的序列化字节，失败时明确返回不可用。 */
export async function getWebDatabaseBytes(database: SerializableDatabase) {
  try {
    return (await database.serializeAsync()).byteLength;
  } catch {
    return null;
  }
}
