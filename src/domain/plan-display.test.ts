import { describe, expect, it } from 'vitest';

import { getPlanDisplayStatus } from './plan-display';

describe('plan display status', () => {
  it('keeps a single plan without expenses pending instead of treating zero as a draft', () => {
    expect(getPlanDisplayStatus({ structureKind: 'single', stages: [], status: 'pending' })).toBe('pending');
  });

  it('shows a completed single plan as completed', () => {
    expect(getPlanDisplayStatus({ structureKind: 'single', stages: [], status: 'completed' })).toBe('completed');
  });

  it('shows a journey without stages as a draft', () => {
    expect(getPlanDisplayStatus({ structureKind: 'journey', stages: [], status: 'pending' })).toBe('draft');
  });

  it('prioritizes an explicit completed status over an unselected journey stage', () => {
    const unselectedStage = {
      id: 'stage-a',
      planId: 'plan-a',
      kind: 'choice' as const,
      name: '午餐',
      notes: '',
      startTime: null,
      sortOrder: 0,
      selectedVariantId: null,
      variants: [],
    };

    expect(getPlanDisplayStatus({
      structureKind: 'journey', stages: [unselectedStage], status: 'completed',
    })).toBe('completed');
  });

  it('distinguishes unselected, pending, and completed stage plans', () => {
    const choiceStage = {
      id: 'stage-a',
      planId: 'plan-a',
      kind: 'choice' as const,
      name: '午餐',
      notes: '',
      startTime: null,
      sortOrder: 0,
      variants: [{ id: 'variant-a', stageId: 'stage-a', name: '套餐', notes: '', sortOrder: 0, expenses: [] }],
    };

    expect(getPlanDisplayStatus({ structureKind: 'journey', stages: [{ ...choiceStage, selectedVariantId: null }], status: 'pending' })).toBe('unselected');
    expect(getPlanDisplayStatus({ structureKind: 'journey', stages: [{ ...choiceStage, selectedVariantId: 'variant-a' }], status: 'pending' })).toBe('pending');
    expect(getPlanDisplayStatus({ structureKind: 'journey', stages: [{ ...choiceStage, selectedVariantId: 'variant-a' }], status: 'completed' })).toBe('completed');
  });
});
