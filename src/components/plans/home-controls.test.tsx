import { createElement, type ComponentType } from 'react';
// @ts-expect-error 项目不为服务端测试额外安装 @types/react-dom。
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AppHeader, BudgetSummary } from './home-controls';

const presses = vi.hoisted(() => [] as { label?: string; onPress?: () => void }[]);

vi.mock('react-native', async () => {
  const React = await import('react');
  const primitive = (tag: string) => {
    function Primitive({ children }: { children?: React.ReactNode }) {
      return React.createElement(tag, null, children);
    }
    return Primitive;
  };
  return {
    Pressable: ({ accessibilityLabel, children, onPress }: { accessibilityLabel?: string; children?: React.ReactNode; onPress?: () => void }) => {
      presses.push({ label: accessibilityLabel, onPress });
      return React.createElement('button', null, children);
    },
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: ({ children, numberOfLines }: { children?: React.ReactNode; numberOfLines?: number }) => React.createElement('span', { 'data-lines': numberOfLines }, children),
    View: primitive('div'),
  };
});

vi.mock('lucide-react-native', () => ({
  ChevronDown: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Settings: () => null,
}));

vi.mock('../../theme/use-themed-styles', async () => {
  const { DEFAULT_APP_SETTINGS } = await import('../../domain/app-settings');
  const { createThemeTokens } = await import('../../theme/create-theme');
  const theme = createThemeTokens(DEFAULT_APP_SETTINGS, 'light');
  return { useThemedStyles: <T,>(factory: (value: typeof theme) => T) => ({ styles: factory(theme), theme }) };
});

describe('AppHeader', () => {
  it('opens global settings from the settings icon', () => {
    const onSettings = vi.fn();
    const TestableHeader = AppHeader as ComponentType<{ onSettings: () => void }>;
    renderToStaticMarkup(createElement(TestableHeader, { onSettings }));

    presses.find((press) => press.label === '设置')?.onPress?.();

    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('keeps the monthly budget amount on one line at large text sizes', () => {
    const html = renderToStaticMarkup(createElement(BudgetSummary, {
      summary: { totalBudgetCents: 241600, planCount: 5, pendingCount: 3, completedCount: 2, completionPercent: 40 },
    }));

    expect(html).toContain('data-lines="1">¥2,416.00');
  });
});
