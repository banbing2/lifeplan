import { createElement } from 'react';
// @ts-expect-error 项目不为服务端测试额外安装 @types/react-dom。
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AppearanceProvider, useAppearance } from './appearance-provider';

vi.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({
    getFirstAsync: async () => null,
    runAsync: async () => ({ changes: 1 }),
  }),
}));

vi.mock('react-native', () => ({ useColorScheme: () => 'dark' }));

function ThemeProbe() {
  const appearance = useAppearance();
  return createElement('span', null, [
    appearance.theme.mode,
    appearance.theme.colors.primary,
    appearance.settings.colorMode,
    typeof appearance.updateSettings,
  ].join('|'));
}

describe('AppearanceProvider', () => {
  it('provides a system-resolved theme and update API to every child', () => {
    const html = renderToStaticMarkup(
      createElement(AppearanceProvider, null, createElement(ThemeProbe)),
    );

    expect(html).toContain('dark|#55D58A|system|function');
  });
});
