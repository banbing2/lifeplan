import { Children, createElement, type ReactElement, type ReactNode } from 'react';
// 测试只调用已安装的 React DOM 服务端运行时，项目无需为生产代码增加 DOM 类型依赖。
// @ts-expect-error 当前 Expo 项目未安装仅供测试使用的 @types/react-dom。
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { JourneyPlanFormDraft, SinglePlanFormDraft } from '../../domain/plan-form';
import { changePlanStructure } from './plan-editor';
import { ChoiceStageEditor } from './choice-stage-editor';
// 平台文件需要分别渲染，Expo 的解析器会把无后缀导入也映射到 Web 实现。
// eslint-disable-next-line import/no-duplicates
import { DateTimeField } from './date-time-field';
// eslint-disable-next-line import/no-duplicates
import { DateTimeField as WebDateTimeField } from './date-time-field.web';
import { createJourneyStageDraft } from './journey-plan-editor';
import { JourneyStageEditor } from './journey-stage-editor';

const renderedPressables = vi.hoisted(() => ({
  props: [] as { accessibilityLabel?: string; onPress?: () => void }[],
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  /** 为 SSR 测试创建带名称的最小原生组件替身。 */
  const primitive = (tag: string) => {
    function Primitive({ children }: { children?: React.ReactNode }) {
      return React.createElement(tag, null, children);
    }
    return Primitive;
  };
  return {
    ActivityIndicator: primitive('span'),
    Alert: { alert: vi.fn() },
    Modal: ({ children, visible }: { children?: React.ReactNode; visible: boolean }) => visible ? React.createElement('div', null, children) : null,
    Platform: { OS: 'web' },
    Pressable: ({ accessibilityLabel, accessibilityState, children, disabled, onPress }: { accessibilityLabel?: string; accessibilityState?: { expanded?: boolean }; children?: React.ReactNode; disabled?: boolean; onPress?: () => void }) => {
      renderedPressables.props.push({ accessibilityLabel, onPress });
      return React.createElement('button', { 'aria-label': accessibilityLabel, 'aria-expanded': accessibilityState?.expanded, disabled }, children);
    },
    ScrollView: primitive('div'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Switch: primitive('input'),
    Text: primitive('span'),
    TextInput: primitive('input'),
    View: primitive('div'),
    useWindowDimensions: () => ({ width: 375, height: 812 }),
  };
});

vi.mock('lucide-react-native', () => {
  const Icon = () => null;
  return {
    ArrowDown: Icon, ArrowUp: Icon, CalendarDays: Icon, Check: Icon,
    CheckCircle2: Icon, ChevronDown: Icon, Circle: Icon, Clock3: Icon,
    Coffee: Icon, Ellipsis: Icon, Film: Icon, Gift: Icon, Image: Icon,
    MoreHorizontal: Icon, Plus: Icon, Repeat2: Icon, ShoppingBag: Icon,
    Star: Icon, Sun: Icon, Tent: Icon, Trash2: Icon, Utensils: Icon, X: Icon,
  };
});

vi.mock('../../theme/use-themed-styles', async () => {
  const { DEFAULT_APP_SETTINGS } = await import('../../domain/app-settings');
  const { createThemeTokens } = await import('../../theme/create-theme');
  const theme = createThemeTokens(DEFAULT_APP_SETTINGS, 'light');
  return { useThemedStyles: <T,>(factory: (value: typeof theme) => T) => ({ styles: factory(theme), theme }) };
});

vi.mock('@react-native-community/datetimepicker', () => ({
  default: 'DateTimePicker',
}));

const singleDraft: SinglePlanFormDraft = {
  id: 'plan-1',
  structureKind: 'single',
  implicitStageId: 'stage-1',
  implicitStageName: null,
  implicitStageNotes: '',
  title: '理发',
  notes: '',
  dateKey: '2026-08-22',
  time: '14:30',
  isAllDay: false,
  accent: 'green',
  icon: 'star',
  expenses: [{ id: 'expense-1', name: '理发', category: 'other', amountYuan: '45' }],
};

describe('plan editor structure actions', () => {
  it('moves the single time and expenses into its fixed journey stage', () => {
    const changed = changePlanStructure(singleDraft, 'journey');

    expect(changed).toMatchObject({
      structureKind: 'journey',
      stages: [{ id: 'stage-1', startTime: '14:30', expenses: singleDraft.expenses }],
    });
  });

  it('keeps an ineligible journey unchanged when switching to single', () => {
    const journey: JourneyPlanFormDraft = {
      id: 'plan-2', structureKind: 'journey', title: '周末出行', notes: '',
      dateKey: '2026-08-23', accent: 'blue', icon: 'tent', stages: [],
    };

    expect(changePlanStructure(journey, 'single')).toBe(journey);
  });
});

describe('journey editor stage creation', () => {
  it('creates a fixed stage with one immediately editable expense', () => {
    expect(createJourneyStageDraft('fixed', {
      stageId: 'stage-fixed', variantId: 'unused', expenseId: 'expense-fixed',
    })).toMatchObject({
      id: 'stage-fixed', kind: 'fixed', expenses: [{ id: 'expense-fixed', name: '', amountYuan: '' }],
    });
  });

  it('creates a choice stage with its first variant and expense', () => {
    expect(createJourneyStageDraft('choice', {
      stageId: 'stage-choice', variantId: 'variant-1', expenseId: 'expense-choice',
    })).toMatchObject({
      id: 'stage-choice', kind: 'choice', selectedVariantId: null,
      variants: [{ id: 'variant-1', expenses: [{ id: 'expense-choice', name: '', amountYuan: '' }] }],
    });
  });
});

describe('plan editor accessibility contracts', () => {
  it('renders real web date and time inputs with browser constraints', () => {
    const dateMarkup = renderToStaticMarkup(createElement(WebDateTimeField, {
      disabled: true,
      label: '计划日期',
      minimumDateKey: '2026-08-18',
      mode: 'date',
      onChange: vi.fn(),
      value: '2026-08-22',
    }));
    const timeMarkup = renderToStaticMarkup(createElement(WebDateTimeField, {
      label: '开始时间', mode: 'time', onChange: vi.fn(), value: '08:30',
    }));

    expect(dateMarkup).toContain('type="date"');
    expect(dateMarkup).toContain('min="2026-08-18"');
    expect(dateMarkup).toContain('disabled=""');
    expect(timeMarkup).toContain('type="time"');
  });

  it('forwards the real web input currentTarget value', () => {
    const onChange = vi.fn();
    const root = WebDateTimeField({
      label: '计划日期', mode: 'date', onChange, value: '2026-08-22',
    }) as ReactElement<{ children?: ReactNode }>;
    const controls = Children.toArray(root.props.children)[1] as ReactElement<{ children?: ReactNode }>;
    const input = Children.toArray(controls.props.children)[0] as ReactElement<{
      onChange: (event: { currentTarget: { value: string } }) => void;
    }>;

    input.props.onChange({ currentTarget: { value: '2026-08-23' } });
    expect(onChange).toHaveBeenCalledWith('2026-08-23');
  });

  it('exposes optional-time clear controls on native and web fields', () => {
    renderedPressables.props.length = 0;
    const nativeOnChange = vi.fn();
    const props = { clearable: true, label: '开始时间', mode: 'time' as const, value: '08:30', onChange: nativeOnChange };

    expect(renderToStaticMarkup(createElement(DateTimeField, props))).toContain('aria-label="清除开始时间"');
    renderedPressables.props.find((item) => item.accessibilityLabel === '清除开始时间')?.onPress?.();
    expect(nativeOnChange).toHaveBeenCalledWith('');

    renderedPressables.props.length = 0;
    const webOnChange = vi.fn();
    expect(renderToStaticMarkup(createElement(WebDateTimeField, { ...props, onChange: webOnChange }))).toContain('aria-label="清除开始时间"');
    renderedPressables.props.find((item) => item.accessibilityLabel === '清除开始时间')?.onPress?.();
    expect(webOnChange).toHaveBeenCalledWith('');
  });

  it('reports the collapsed state of stage and variant more controls', () => {
    const fixed = createJourneyStageDraft('fixed', { stageId: 'fixed', variantId: 'unused', expenseId: 'expense' });
    const choice = createJourneyStageDraft('choice', { stageId: 'choice', variantId: 'variant', expenseId: 'choice-expense' });
    if (choice.kind !== 'choice') throw new Error('expected choice stage');

    const stageMarkup = renderToStaticMarkup(createElement(JourneyStageEditor, {
      stage: fixed, index: 0, count: 1, errors: {}, onChange: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(),
    }));
    const variantMarkup = renderToStaticMarkup(createElement(ChoiceStageEditor, {
      stage: choice, stageIndex: 0, errors: {}, onChange: vi.fn(),
    }));

    expect(stageMarkup).toContain('aria-label="阶段更多操作" aria-expanded="false"');
    expect(variantMarkup).toContain('aria-label="方案更多操作" aria-expanded="false"');
  });
});
