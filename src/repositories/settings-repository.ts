import { DEFAULT_APP_SETTINGS, normalizeAppSettings, type AppSettings } from '../domain/app-settings';

type SettingsDatabase = {
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
};

type SettingsRow = {
  color_mode?: unknown;
  color_scheme?: unknown;
  font_size?: unknown;
  font_weight?: unknown;
};

/** 创建只负责唯一全局设置记录的 SQLite Repository。 */
export function createSettingsRepository(db: SettingsDatabase) {
  return {
    async getSettings(): Promise<AppSettings> {
      const row = await db.getFirstAsync<SettingsRow>(`
        SELECT color_mode, color_scheme, font_size, font_weight
        FROM app_settings
        WHERE id = 1
      `);
      if (!row) return DEFAULT_APP_SETTINGS;
      return normalizeAppSettings({
        colorMode: row.color_mode,
        colorScheme: row.color_scheme,
        fontSize: row.font_size,
        fontWeight: row.font_weight,
      });
    },

    async saveSettings(settings: AppSettings): Promise<void> {
      await db.runAsync(
        `UPDATE app_settings
         SET color_mode = ?, color_scheme = ?, font_size = ?, font_weight = ?, updated_at = ?
         WHERE id = 1`,
        settings.colorMode,
        settings.colorScheme,
        settings.fontSize,
        settings.fontWeight,
        new Date().toISOString(),
      );
    },
  };
}
