import { describe, expect, it } from 'vitest';

import { calculateMonthlySummary } from '../domain/budget';
import { calculateJourneyBudget } from '../domain/journey-budget';

import { seedPlans } from './seed-data';

describe('seedPlans', () => {
  it('matches the monthly design summary', () => {
    const featuredPlans = seedPlans.filter((plan) => plan.isFeatured);
    const summary = calculateMonthlySummary(
      featuredPlans.map((plan) => ({
        status: plan.status,
        finalTotalCents: calculateJourneyBudget(plan.stages).finalTotalCents,
      })),
    );

    expect(summary).toEqual({
      totalBudgetCents: 241600,
      planCount: 5,
      completedCount: 2,
      pendingCount: 3,
      completionPercent: 40,
    });
  });

  it('declares every staged example as a normalized journey plan', () => {
    expect(seedPlans.every((plan) => plan.structureKind === 'journey')).toBe(true);
    expect(seedPlans.every((plan) => plan.time === null && !plan.isAllDay)).toBe(true);
    expect(seedPlans.every((plan) => plan.stages.length > 0)).toBe(true);
  });

  it('keeps the former plan time on the first journey stage', () => {
    expect(seedPlans.find((plan) => plan.id === 'weekend-trip')?.stages[0].startTime).toBe('08:30');
    expect(seedPlans.find((plan) => plan.id === 'friends-dinner')?.stages[0].startTime).toBe('19:00');
    expect(seedPlans.find((plan) => plan.id === 'shopping-plan')?.stages[0].startTime).toBeNull();
  });
});
