import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from './app-settings';

describe('normalizeAppSettings', () => {
  it('保留合法的全局外观设置', () => {
    expect(normalizeAppSettings({
      colorMode: 'dark',
      colorScheme: 'coral',
      fontSize: 'large',
      fontWeight: 'bold',
    })).toEqual({
      colorMode: 'dark',
      colorScheme: 'coral',
      fontSize: 'large',
      fontWeight: 'bold',
    });
  });

  it('缺失或非法字段分别回退到默认值', () => {
    expect(normalizeAppSettings({
      colorMode: 'unknown',
      colorScheme: null,
      fontSize: 'huge',
      fontWeight: undefined,
    })).toEqual(DEFAULT_APP_SETTINGS);
  });
});
