import { describe, expect, it } from 'vitest';

import {
  calculateMonthlySummary,
  calculateOptionTotal,
  calculatePlanBudget,
  formatMoney,
  getExpenseCategoryRows,
} from './budget';

const fixedStage = (amountCents: number) => ({
  id: 'fixed',
  planId: 'plan',
  kind: 'fixed' as const,
  name: '固定安排',
  notes: '',
  startTime: null,
  sortOrder: 0,
  expenses: amountCents
    ? [{ id: 'expense', stageId: 'fixed', name: '费用', category: 'other' as const, amountCents, sortOrder: 0 }]
    : [],
});

const unselectedStage = {
  id: 'choice',
  planId: 'plan',
  kind: 'choice' as const,
  name: '待选择',
  notes: '',
  startTime: null,
  sortOrder: 0,
  selectedVariantId: null,
  variants: [],
};

describe('calculateOptionTotal', () => {
  it('adds expense amounts stored in cents', () => {
    expect(calculateOptionTotal([{ amountCents: 12600 }, { amountCents: 12000 }, { amountCents: 14000 }, { amountCents: 3000 }])).toBe(41600);
  });
});

describe('getExpenseCategoryRows', () => {
  it('shows the actual category used by a shopping-only option', () => {
    const rows = getExpenseCategoryRows([
      {
        expenses: [
          {
            id: 'shopping-expense',
            optionId: 'brand-a-option',
            name: '商品',
            category: 'shopping',
            amountCents: 68800,
            sortOrder: 0,
          },
        ],
      },
    ]);

    expect(rows).toEqual([{ category: 'shopping', label: '商品' }]);
    expect(calculateOptionTotal([{ amountCents: 68800 }])).toBe(68800);
  });
});

describe('calculateMonthlySummary', () => {
  it('excludes archived plans and plans without a complete stage budget', () => {
    const summary = calculateMonthlySummary([
      { status: 'pending', finalTotalCents: 41600 },
      { status: 'pending', finalTotalCents: 35800 },
      { status: 'pending', finalTotalCents: null },
      { status: 'completed', finalTotalCents: 86200 },
      { status: 'completed', finalTotalCents: 15800 },
      { status: 'pending', finalTotalCents: 62200 },
      { status: 'archived', finalTotalCents: 99900 },
    ]);

    expect(summary).toEqual({
      totalBudgetCents: 241600,
      planCount: 5,
      completedCount: 2,
      pendingCount: 3,
      completionPercent: 40,
    });
  });

  it('counts a zero-budget single plan but excludes draft and unselected journeys', () => {
    const zeroSingle = calculatePlanBudget({ structureKind: 'single', stages: [fixedStage(0)] });
    const pricedSingle = calculatePlanBudget({ structureKind: 'single', stages: [fixedStage(6800)] });
    const draftJourney = calculatePlanBudget({ structureKind: 'journey', stages: [] });
    const incompleteJourney = calculatePlanBudget({ structureKind: 'journey', stages: [unselectedStage] });

    expect(calculateMonthlySummary([
      { status: 'pending', finalTotalCents: zeroSingle.finalTotalCents },
      { status: 'completed', finalTotalCents: pricedSingle.finalTotalCents },
      { status: 'pending', finalTotalCents: draftJourney.finalTotalCents },
      { status: 'pending', finalTotalCents: incompleteJourney.finalTotalCents },
    ])).toEqual({
      totalBudgetCents: 6800,
      planCount: 2,
      completedCount: 1,
      pendingCount: 1,
      completionPercent: 50,
    });
  });
});

describe('calculatePlanBudget', () => {
  it('returns a final zero budget for a single plan without expenses', () => {
    expect(calculatePlanBudget({ structureKind: 'single', stages: [fixedStage(0)] }).finalTotalCents).toBe(0);
  });

  it('returns the fixed expense total for a priced single plan', () => {
    expect(calculatePlanBudget({ structureKind: 'single', stages: [fixedStage(6800)] }).finalTotalCents).toBe(6800);
  });

  it('keeps journey drafts and unselected choices out of final budget totals', () => {
    expect(calculatePlanBudget({ structureKind: 'journey', stages: [] }).finalTotalCents).toBeNull();
    expect(calculatePlanBudget({ structureKind: 'journey', stages: [unselectedStage] }).finalTotalCents).toBeNull();
  });

  it('returns a complete journey budget after every choice is selected', () => {
    const selectedStage = {
      ...unselectedStage,
      selectedVariantId: 'selected',
      variants: [{
        id: 'selected', stageId: 'choice', name: '已选择', notes: '', sortOrder: 0,
        expenses: [{ id: 'meal', variantId: 'selected', name: '餐费', category: 'food' as const, amountCents: 3200, sortOrder: 0 }],
      }],
    };

    expect(calculatePlanBudget({ structureKind: 'journey', stages: [fixedStage(1000), selectedStage] }).finalTotalCents).toBe(4200);
  });
});

describe('formatMoney', () => {
  it('formats cents as Chinese yuan with optional decimals', () => {
    expect(formatMoney(41600)).toBe('¥416');
    expect(formatMoney(241600, true)).toBe('¥2,416.00');
  });
});
