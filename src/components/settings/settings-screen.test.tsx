import { createElement } from 'react';
// @ts-expect-error 项目不为服务端测试额外安装 @types/react-dom。
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppearanceProvider } from '../../theme/appearance-provider';
import { SettingsScreen } from './settings-screen';

const testState = vi.hoisted(() => ({
  presses: [] as { label?: string; onPress?: () => void | Promise<void> }[],
  sqlCalls: [] as unknown[][],
}));

vi.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({
    databasePath: '/data/life.db',
    serializeAsync: async () => new Uint8Array(1024),
    getFirstAsync: async () => null,
    runAsync: async (...args: unknown[]) => {
      testState.sqlCalls.push(args);
      return { changes: 1 };
    },
  }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  const primitive = (tag: string) => function Primitive({ children }: { children?: React.ReactNode }) {
    return React.createElement(tag, null, children);
  };
  return {
    AppState: { addEventListener: () => ({ remove: () => {} }) },
    Pressable: ({ accessibilityLabel, children, onPress }: { accessibilityLabel?: string; children?: React.ReactNode; onPress?: () => void | Promise<void> }) => {
      testState.presses.push({ label: accessibilityLabel, onPress });
      return React.createElement('button', { 'aria-label': accessibilityLabel }, children);
    },
    ScrollView: primitive('div'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: primitive('span'),
    View: primitive('div'),
    useColorScheme: () => 'light',
  };
});

vi.mock('lucide-react-native', () => ({ ArrowLeft: () => null, Check: () => null, Database: () => null }));
vi.mock('../../services/sqlite-storage-runtime', () => ({
  getSqliteStorageUsage: async () => ({ status: 'available', bytes: 1024 }),
}));
vi.mock('../layout/app-frame', async () => {
  const React = await import('react');
  return { AppFrame: ({ children }: { children?: React.ReactNode }) => React.createElement('main', null, children) };
});

describe('SettingsScreen', () => {
  beforeEach(() => {
    testState.presses.length = 0;
    testState.sqlCalls.length = 0;
  });

  it('renders only the confirmed global appearance and storage groups', () => {
    const html = renderToStaticMarkup(createElement(
      AppearanceProvider,
      null,
      createElement(SettingsScreen, { onBack: () => {} }),
    ));

    for (const text of ['设置', '外观', '跟随系统', '浅色', '深色', '绿色', '蓝色', '珊瑚红', '黑白中性', '文字', '小', '标准', '大', '加粗', '存储', 'SQLite 总占用']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('备份');
    expect(html).not.toContain('默认新建');
  });

  it('persists a selected global mode through the appearance provider', async () => {
    renderToStaticMarkup(createElement(
      AppearanceProvider,
      null,
      createElement(SettingsScreen, { onBack: () => {} }),
    ));

    await testState.presses.find((press) => press.label === '深色')?.onPress?.();

    expect(String(testState.sqlCalls[0][0])).toContain('UPDATE app_settings');
    expect(testState.sqlCalls[0][1]).toBe('dark');
  });
});
