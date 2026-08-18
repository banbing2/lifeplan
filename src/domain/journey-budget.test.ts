import { describe, expect, it } from 'vitest';

import type { JourneyStage } from './models';
import { calculateJourneyBudget } from './journey-budget';

const stages: JourneyStage[] = [
  {
    id: 'outbound',
    planId: 'trip',
    kind: 'fixed',
    name: '去程交通',
    notes: '',
    startTime: '08:00',
    sortOrder: 0,
    expenses: [
      { id: 'outbound-expense', stageId: 'outbound', name: '地铁', category: 'transport', amountCents: 1500, sortOrder: 0 },
    ],
  },
  {
    id: 'lunch',
    planId: 'trip',
    kind: 'choice',
    name: '午餐',
    notes: '',
    startTime: '12:00',
    sortOrder: 1,
    selectedVariantId: 'fast-food',
    variants: [
      {
        id: 'fast-food',
        stageId: 'lunch',
        name: '麦当劳',
        notes: '',
        sortOrder: 0,
        expenses: [
          { id: 'burger', variantId: 'fast-food', name: '套餐', category: 'food', amountCents: 3000, sortOrder: 0 },
        ],
      },
      {
        id: 'hotpot',
        stageId: 'lunch',
        name: '火锅',
        notes: '',
        sortOrder: 1,
        expenses: [
          { id: 'hotpot-set', variantId: 'hotpot', name: '套餐', category: 'food', amountCents: 12000, sortOrder: 0 },
        ],
      },
    ],
  },
  {
    id: 'activity',
    planId: 'trip',
    kind: 'choice',
    name: '下午活动',
    notes: '',
    startTime: '14:00',
    sortOrder: 2,
    selectedVariantId: 'movie',
    variants: [
      {
        id: 'movie',
        stageId: 'activity',
        name: '看电影',
        notes: '',
        sortOrder: 0,
        expenses: [
          { id: 'movie-ticket', variantId: 'movie', name: '电影票', category: 'ticket', amountCents: 5500, sortOrder: 0 },
        ],
      },
    ],
  },
  {
    id: 'return',
    planId: 'trip',
    kind: 'fixed',
    name: '返程交通',
    notes: '',
    startTime: '18:30',
    sortOrder: 3,
    expenses: [
      { id: 'return-expense', stageId: 'return', name: '地铁', category: 'transport', amountCents: 1500, sortOrder: 0 },
    ],
  },
];

describe('calculateJourneyBudget', () => {
  it('combines fixed stages with each independently selected stage variant', () => {
    expect(calculateJourneyBudget(stages)).toEqual({
      fixedTotalCents: 3000,
      selectedVariantsTotalCents: 8500,
      confirmedTotalCents: 11500,
      finalTotalCents: 11500,
      unselectedStageCount: 0,
    });
  });

  it('keeps a confirmed subtotal but no final total while a choice stage is unselected', () => {
    const incomplete = stages.map((stage) =>
      stage.id === 'activity' && stage.kind === 'choice' ? { ...stage, selectedVariantId: null } : stage,
    );

    expect(calculateJourneyBudget(incomplete)).toEqual({
      fixedTotalCents: 3000,
      selectedVariantsTotalCents: 3000,
      confirmedTotalCents: 6000,
      finalTotalCents: null,
      unselectedStageCount: 1,
    });
  });

  it('treats a choice stage without variants as unselected', () => {
    const emptyChoice: JourneyStage = {
      id: 'empty', planId: 'trip', kind: 'choice', name: '待安排', notes: '', startTime: null,
      sortOrder: 0, selectedVariantId: null, variants: [],
    };

    expect(calculateJourneyBudget([emptyChoice]).unselectedStageCount).toBe(1);
    expect(calculateJourneyBudget([emptyChoice]).finalTotalCents).toBeNull();
  });

  it('allows a fixed-only journey to have a final total', () => {
    expect(calculateJourneyBudget(stages.filter((stage) => stage.kind === 'fixed')).finalTotalCents).toBe(3000);
  });
});
