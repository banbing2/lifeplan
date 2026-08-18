import { describe, expect, it } from 'vitest';

import type { AppSettings } from '../domain/app-settings';
import { DEFAULT_APP_SETTINGS } from '../domain/app-settings';
import { AppearanceSettingsController } from './appearance-controller';

const darkSettings: AppSettings = { ...DEFAULT_APP_SETTINGS, colorMode: 'dark' };

describe('AppearanceSettingsController', () => {
  it('applies a setting immediately and keeps it after persistence succeeds', async () => {
    const saved: AppSettings[] = [];
    const controller = new AppearanceSettingsController(DEFAULT_APP_SETTINGS, async (settings) => {
      saved.push(settings);
    });

    const pending = controller.update({ colorMode: 'dark' });

    expect(controller.getSnapshot().settings).toEqual(darkSettings);
    await pending;
    expect(saved).toEqual([darkSettings]);
    expect(controller.getSnapshot().error).toBeNull();
  });

  it('rolls the latest failed change back to the last persisted settings', async () => {
    const controller = new AppearanceSettingsController(DEFAULT_APP_SETTINGS, async () => {
      throw new Error('disk full');
    });

    await controller.update({ colorMode: 'dark' });

    expect(controller.getSnapshot().settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(controller.getSnapshot().error).toBe('设置保存失败，请重试');
  });

  it('serializes rapid writes and does not let an older failure replace a newer choice', async () => {
    const calls: string[] = [];
    let attempt = 0;
    const controller = new AppearanceSettingsController(DEFAULT_APP_SETTINGS, async (settings) => {
      calls.push(settings.colorMode);
      if (attempt++ === 0) throw new Error('first failed');
    });

    const first = controller.update({ colorMode: 'dark' });
    const second = controller.update({ colorMode: 'light' });
    await Promise.all([first, second]);

    expect(calls).toEqual(['dark', 'light']);
    expect(controller.getSnapshot().settings.colorMode).toBe('light');
    expect(controller.getSnapshot().error).toBeNull();
  });
});
