import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../domain/app-settings';
import { createSettingsRepository } from './settings-repository';

describe('settings repository', () => {
  it('maps the single SQLite row to app settings', async () => {
    const db = mockDatabase({
      color_mode: 'dark',
      color_scheme: 'coral',
      font_size: 'large',
      font_weight: 'bold',
    });

    await expect(createSettingsRepository(db).getSettings()).resolves.toEqual({
      colorMode: 'dark',
      colorScheme: 'coral',
      fontSize: 'large',
      fontWeight: 'bold',
    });
  });

  it('returns defaults for a missing or invalid row', async () => {
    await expect(createSettingsRepository(mockDatabase(null)).getSettings()).resolves.toEqual(DEFAULT_APP_SETTINGS);
    await expect(createSettingsRepository(mockDatabase({ color_mode: 'broken' })).getSettings())
      .resolves.toEqual(DEFAULT_APP_SETTINGS);
  });

  it('updates the unique row with parameterized values', async () => {
    const calls: unknown[][] = [];
    const db = mockDatabase(null, calls);

    await createSettingsRepository(db).saveSettings({
      colorMode: 'light',
      colorScheme: 'blue',
      fontSize: 'small',
      fontWeight: 'standard',
    });

    expect(String(calls[0][0])).toContain('UPDATE app_settings');
    expect(calls[0].slice(1, 5)).toEqual(['light', 'blue', 'small', 'standard']);
  });
});

function mockDatabase(row: Record<string, unknown> | null, calls: unknown[][] = []) {
  return {
    getFirstAsync: async <T,>() => row as T | null,
    runAsync: async (...args: unknown[]) => {
      calls.push(args);
      return { changes: 1 };
    },
  };
}
