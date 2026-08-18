import { createElement } from 'react';
// 测试复用已安装的 React DOM 服务端运行时，避免给生产项目增加 DOM 类型依赖。
// @ts-expect-error 当前 Expo 项目未安装仅供测试使用的 @types/react-dom。
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { seedPlans } from '../../db/seed-data';
import type { Plan } from '../../domain/models';
import {
  DetailActionBar,
  DetailTopBar,
  getValidDetailTab,
  PlanDetailContent,
  PlanHero,
  PlanInfoPanel,
} from './plan-detail';
import { PlanExpenseBreakdown } from './plan-expense-breakdown';
import { getVisiblePlanCount, PlanListItem } from './plan-list';

vi.mock('react-native', async () => {
  const React = await import('react');
  /** 为 SSR 测试创建保留可访问角色的最小原生组件替身。 */
  const primitive = (tag: string) => {
    function Primitive({ accessibilityRole, children }: { accessibilityRole?: string; children?: React.ReactNode }) {
      return React.createElement(tag, accessibilityRole ? { role: accessibilityRole } : null, children);
    }
    return Primitive;
  };
  return {
    Pressable: primitive('button'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: primitive('span'),
    View: primitive('div'),
  };
});

vi.mock('lucide-react-native', () => {
  const Icon = () => null;
  return {
    ArrowLeft: Icon, CalendarCheck2: Icon, CheckCircle2: Icon, ChevronDown: Icon,
    ChevronRight: Icon, Circle: Icon, Coffee: Icon, Ellipsis: Icon, Film: Icon,
    Gift: Icon, Image: Icon, MapPin: Icon, Mountain: Icon, Plus: Icon,
    ShoppingBag: Icon, Sparkles: Icon, UtensilsCrossed: Icon,
  };
});

vi.mock('../../theme/use-themed-styles', async () => {
  const { DEFAULT_APP_SETTINGS } = await import('../../domain/app-settings');
  const { createThemeTokens } = await import('../../theme/create-theme');
  const theme = createThemeTokens(DEFAULT_APP_SETTINGS, 'light');
  return { useThemedStyles: <T,>(factory: (value: typeof theme) => T) => ({ styles: factory(theme), theme }) };
});

vi.mock('./journey-timeline', async () => {
  const React = await import('react');
  return { JourneyTimeline: () => React.createElement('div', null, '行程内容') };
});

const singlePlan: Plan = {
  id: 'single-plan', structureKind: 'single', title: '理发', notes: '提前到店',
  dateKey: '2026-08-22', time: '14:30', isAllDay: false, status: 'pending',
  completedAt: null, isFeatured: true, accent: 'green', icon: 'star',
  stages: [{
    id: 'single-plan-implicit-stage', planId: 'single-plan', kind: 'fixed',
    name: '内部隐式阶段', notes: '', startTime: null, sortOrder: 0,
    expenses: [{
      id: 'haircut', stageId: 'single-plan-implicit-stage', name: '理发费',
      category: 'other', amountCents: 4500, sortOrder: 0,
    }],
  }],
};

const journeyPlan: Plan = {
  id: 'journey-plan', structureKind: 'journey', title: '周末出行', notes: '',
  dateKey: '2026-08-23', time: '23:59', isAllDay: true, status: 'pending',
  completedAt: null, isFeatured: true, accent: 'blue', icon: 'tent',
  stages: [
    {
      id: 'outbound', planId: 'journey-plan', kind: 'fixed', name: '去程', notes: '',
      startTime: '08:30', sortOrder: 0,
      expenses: [{
        id: 'bus', stageId: 'outbound', name: '公交', category: 'transport',
        amountCents: 1500, sortOrder: 0,
      }],
    },
    {
      id: 'activity', planId: 'journey-plan', kind: 'choice', name: '游玩', notes: '',
      startTime: null, selectedVariantId: 'museum', sortOrder: 1,
      variants: [{
        id: 'museum', stageId: 'activity', name: '博物馆', notes: '', sortOrder: 0,
        expenses: [{
          id: 'ticket', variantId: 'museum', name: '门票', category: 'ticket',
          amountCents: 2000, sortOrder: 0,
        }],
      }],
    },
    {
      id: 'lunch', planId: 'journey-plan', kind: 'choice', name: '午餐', notes: '',
      startTime: null, selectedVariantId: null, sortOrder: 2,
      variants: [{
        id: 'restaurant', stageId: 'lunch', name: '餐厅', notes: '', sortOrder: 0,
        expenses: [{
          id: 'meal', variantId: 'restaurant', name: '午餐', category: 'food',
          amountCents: 6800, sortOrder: 0,
        }],
      }],
    },
  ],
};

const emptyJourneyPlan: Plan = {
  ...journeyPlan,
  id: 'empty-journey',
  title: '待规划行程',
  stages: [],
};

const zeroExpenseSinglePlan: Plan = {
  ...singlePlan,
  id: 'zero-single',
  title: '散步',
  stages: [{
    id: 'zero-single-implicit-stage',
    planId: 'zero-single',
    kind: 'fixed',
    name: '内部隐式阶段',
    notes: '',
    startTime: null,
    sortOrder: 0,
    expenses: [],
  }],
};

describe('plan list presentation', () => {
  it('counts every rendered monthly plan including an empty journey draft', () => {
    expect(getVisiblePlanCount([...seedPlans, emptyJourneyPlan])).toBe(seedPlans.length + 1);
  });

  it('shows a single plan time and its direct expense total without a journey summary', () => {
    const markup = renderToStaticMarkup(createElement(PlanListItem, {
      plan: singlePlan, onPress: vi.fn(),
    }));

    expect(markup).toContain('14:30');
    expect(markup).toContain('¥45');
    expect(markup).not.toContain('已选');
    expect(markup).not.toContain('阶段待选择');
  });

  it('shows the first journey stage time, confirmed amount, and pending choice count', () => {
    const markup = renderToStaticMarkup(createElement(PlanListItem, {
      plan: journeyPlan, onPress: vi.fn(),
    }));

    expect(markup).toContain('08:30 开始');
    expect(markup).toContain('博物馆');
    expect(markup).toContain('还有 1 个阶段待选择');
    expect(markup).toContain('¥35');
    expect(markup).not.toContain('23:59');
  });
});

describe('plan detail presentation', () => {
  it('does not render unavailable more-action buttons or placeholder copy', () => {
    const topBar = renderToStaticMarkup(createElement(DetailTopBar, {
      onBack: vi.fn(),
    }));
    const actionBar = renderToStaticMarkup(createElement(DetailActionBar, {
      completed: false, onEdit: vi.fn(), onToggleCompleted: vi.fn(),
    }));
    const markup = `${topBar}${actionBar}`;

    expect(markup).not.toContain('更多');
    expect(markup).not.toContain('下一阶段实现');
    expect(markup).toContain('编辑计划');
    expect(markup).toContain('标记完成');
  });

  it('uses the journey stage time in both hero and information panel', () => {
    const hero = renderToStaticMarkup(createElement(PlanHero, { plan: journeyPlan }));
    const info = renderToStaticMarkup(createElement(PlanInfoPanel, { plan: journeyPlan }));

    expect(hero).toContain('8月23日（周日） 08:30 开始');
    expect(info).toContain('08:30 开始');
    expect(hero).not.toContain('23:59');
    expect(info).not.toContain('23:59');
  });

  it('shows structure-aware status and understandable theme details for single and journey plans', () => {
    const singleInfo = renderToStaticMarkup(createElement(PlanInfoPanel, { plan: singlePlan }));
    const journeyInfo = renderToStaticMarkup(createElement(PlanInfoPanel, { plan: journeyPlan }));

    expect(singleInfo).toContain('状态');
    expect(singleInfo).toContain('待执行');
    expect(singleInfo).toContain('主题');
    expect(singleInfo).toContain('绿色 · 星标图标');
    expect(journeyInfo).toContain('待选择');
    expect(journeyInfo).toContain('蓝色 · 露营图标');
  });

  it('hides the implicit stage while preserving single expenses and their input order', () => {
    const markup = renderToStaticMarkup(createElement(PlanExpenseBreakdown, { plan: singlePlan }));

    expect(markup).toContain('理发费');
    expect(markup).toContain('其他');
    expect(markup).toContain('¥45.00');
    expect(markup).not.toContain('内部隐式阶段');
    expect(markup).not.toContain('固定阶段');
  });

  it('distinguishes an empty journey draft from a complete zero-expense single plan', () => {
    const emptyJourney = renderToStaticMarkup(createElement(PlanExpenseBreakdown, { plan: emptyJourneyPlan }));
    const incompleteJourney = renderToStaticMarkup(createElement(PlanExpenseBreakdown, { plan: journeyPlan }));
    const zeroSingle = renderToStaticMarkup(createElement(PlanExpenseBreakdown, { plan: zeroExpenseSinglePlan }));

    expect(emptyJourney).toContain('预算待完善');
    expect(emptyJourney).toContain('>—<');
    expect(emptyJourney).not.toContain('最终预算');
    expect(emptyJourney).not.toContain('¥0.00');
    expect(incompleteJourney).toContain('已确定金额');
    expect(incompleteJourney).toContain('还有 1 个阶段待选择');
    expect(incompleteJourney).toContain('¥35.00');
    expect(incompleteJourney).not.toContain('预算待完善');
    expect(zeroSingle).toContain('最终预算');
    expect(zeroSingle).toContain('¥0.00');
    expect(zeroSingle).not.toContain('预算待完善');
  });

  it('renders single expenses and information directly without journey tabs', () => {
    const markup = renderToStaticMarkup(createElement(PlanDetailContent, {
      plan: singlePlan,
      tab: 'journey',
      onTabChange: vi.fn(),
      onSelectVariant: vi.fn(),
    }));

    expect(markup).toContain('费用明细');
    expect(markup).toContain('计划信息');
    expect(markup).toContain('理发费');
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain('>行程<');
  });

  it('keeps the three-tab journey detail and corrects invalid single tab state', () => {
    const markup = renderToStaticMarkup(createElement(PlanDetailContent, {
      plan: journeyPlan,
      tab: 'expenses',
      onTabChange: vi.fn(),
      onSelectVariant: vi.fn(),
    }));

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('>行程<');
    expect(markup).toContain('>费用<');
    expect(markup).toContain('>计划信息<');
    expect(getValidDetailTab('single', 'journey')).toBe('expenses');
    expect(getValidDetailTab('journey', 'info')).toBe('info');
  });
});
