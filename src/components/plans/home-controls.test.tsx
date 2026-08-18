import { createElement, type ComponentType } from 'react';
// @ts-expect-error 项目不为服务端测试额外安装 @types/react-dom。
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppHeader, BudgetSummary, HomeCalendarPicker, ScheduleDateStrip } from './home-controls';

const presses = vi.hoisted(() => [] as { label?: string; onPress?: () => void }[]);
const scrollViews = vi.hoisted(() => [] as { horizontal?: boolean }[]);

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
    ScrollView: ({ children, horizontal }: { children?: React.ReactNode; horizontal?: boolean }) => {
      scrollViews.push({ horizontal });
      return React.createElement('div', { 'data-horizontal': horizontal }, children);
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
  beforeEach(() => {
    presses.splice(0);
    scrollViews.splice(0);
  });

  it('opens global settings from the settings icon', () => {
    const onSettings = vi.fn();
    const TestableHeader = AppHeader as ComponentType<{ onSettings: () => void }>;
    const markup = renderToStaticMarkup(createElement(TestableHeader, { onSettings }));

    presses.find((press) => press.label === '设置')?.onPress?.();

    expect(markup).toContain('生活预算');
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('keeps the monthly budget amount on one line at large text sizes', () => {
    const html = renderToStaticMarkup(createElement(BudgetSummary, {
      summary: { totalBudgetCents: 241600, planCount: 5, pendingCount: 3, completedCount: 2, completionPercent: 40 },
    }));

    expect(html).toContain('data-lines="1">¥2,416.00');
  });

  it('ignores the already-selected schedule date and selects another full date key', () => {
    const onChange = vi.fn();
    renderToStaticMarkup(createElement(ScheduleDateStrip, {
      selectedDateKey: '2026-08-18',
      markedDateKeys: ['2026-08-19'],
      onChange,
    }));

    expect(scrollViews).toEqual([{ horizontal: true }]);
    expect(presses.filter((press) => press.label?.startsWith('8月'))).toHaveLength(31);
    expect(presses.some((press) => press.label === '8月19日 周三，有计划')).toBe(true);

    presses.find((press) => press.label === '8月18日 周二')?.onPress?.();

    expect(onChange).not.toHaveBeenCalled();

    presses.find((press) => press.label === '8月19日 周三，有计划')?.onPress?.();

    expect(onChange).toHaveBeenCalledWith('2026-08-19');
  });

  it('renders a full month calendar and exposes plan markers', () => {
    renderToStaticMarkup(createElement(HomeCalendarPicker, {
      mode: 'date',
      visibleMonthKey: '2026-08',
      selectedDateKey: '2026-08-18',
      markedDateKeys: ['2026-08-19'],
      onVisibleMonthChange: vi.fn(),
      onSelect: vi.fn(),
    }));

    expect(presses.some((press) => press.label === '2026年8月19日，有计划')).toBe(true);
    expect(presses.some((press) => press.label === '2026年8月18日，已选择')).toBe(true);
    expect(presses.filter((press) => press.label?.match(/^2026年(?:7|8|9)月\d+日/))).toHaveLength(42);
  });

  it('renders all twelve months and switches years in month mode', () => {
    const onVisibleMonthChange = vi.fn();
    const onSelect = vi.fn();
    renderToStaticMarkup(createElement(HomeCalendarPicker, {
      mode: 'month',
      visibleMonthKey: '2026-08',
      markedDateKeys: [],
      onVisibleMonthChange,
      onSelect,
    }));

    presses.find((press) => press.label === '上一年')?.onPress?.();
    presses.find((press) => press.label === '选择2026年12月')?.onPress?.();

    expect(onVisibleMonthChange).toHaveBeenCalledWith('2025-08');
    expect(onSelect).toHaveBeenCalledWith('2026-12');
  });
});
