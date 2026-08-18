import { describe, expect, it } from 'vitest';

import { DEFAULT_APP_SETTINGS } from '../domain/app-settings';
import { createThemeTokens, resolveColorMode } from './create-theme';

describe('resolveColorMode', () => {
  it('跟随系统并在系统模式缺失时回退浅色', () => {
    expect(resolveColorMode('system', 'dark')).toBe('dark');
    expect(resolveColorMode('system', null)).toBe('light');
    expect(resolveColorMode('light', 'dark')).toBe('light');
  });
});

describe('createThemeTokens', () => {
  it('生成默认绿色浅色主题', () => {
    const theme = createThemeTokens(DEFAULT_APP_SETTINGS, 'light');

    expect(theme.mode).toBe('light');
    expect(theme.colors.primary).toBe('#169B50');
    expect(theme.colors.screen).toBe('#FFFFFF');
    expect(theme.fontSize(20)).toBe(20);
    expect(theme.fontWeight('body')).toBe('400');
    expect(theme.fontWeight('strong')).toBe('700');
  });

  it('为深色珊瑚配色生成可读的语义颜色', () => {
    const theme = createThemeTokens({
      colorMode: 'dark',
      colorScheme: 'coral',
      fontSize: 'standard',
      fontWeight: 'standard',
    }, 'light');

    expect(theme.mode).toBe('dark');
    expect(theme.colors.primary).toBe('#FF7A70');
    expect(theme.colors.screen).toBe('#121614');
    expect(theme.colors.text).toBe('#F4F7F5');
    expect(theme.colors.onPrimary).toBe('#1A0C0A');
  });

  it('统一缩放字号并提高基础字重', () => {
    const theme = createThemeTokens({
      colorMode: 'system',
      colorScheme: 'blue',
      fontSize: 'large',
      fontWeight: 'bold',
    }, 'light');

    expect(theme.fontSize(20)).toBe(23);
    expect(theme.fontWeight('body')).toBe('600');
    expect(theme.fontWeight('medium')).toBe('700');
    expect(theme.fontWeight('strong')).toBe('800');
  });
});
