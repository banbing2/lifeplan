import { describe, expect, it } from 'vitest';

import type { Plan } from './models';
import { getPlanDisplayTime, sortPlansByDisplayTime } from './plan-time';

const persistedSingle: Plan = {
  id: 'persisted-single',
  structureKind: 'single',
  title: '看展',
  notes: '',
  dateKey: '2026-08-18',
  time: '14:30',
  isAllDay: false,
  status: 'pending',
  completedAt: null,
  isFeatured: false,
  accent: 'orange',
  icon: 'image',
  stages: [],
};

function displayPersistedPlan(plan: Plan) {
  return {
    displayTime: getPlanDisplayTime(plan),
    sorted: sortPlansByDisplayTime([plan]),
  };
}

describe('getPlanDisplayTime', () => {
  it('describes an all-day single plan', () => {
    expect(getPlanDisplayTime({ structureKind: 'single', isAllDay: true, time: null })).toEqual({
      label: '全天',
      group: 'allDay',
      sortKey: null,
    });
  });

  it('describes a timed single plan', () => {
    expect(getPlanDisplayTime({ structureKind: 'single', isAllDay: false, time: '14:30' })).toEqual({
      label: '14:30',
      group: 'timed',
      sortKey: '14:30',
    });
  });

  it('accepts a complete persisted plan without a presentation adapter', () => {
    const result = displayPersistedPlan(persistedSingle);
    expect(result.displayTime.label).toBe('14:30');
    expect(result.sorted).toEqual([persistedSingle]);
  });

  it('uses the first timed journey stage by sort order without relying on array order', () => {
    const stages = [
      { startTime: '15:30', sortOrder: 2 },
      { startTime: null, sortOrder: 0 },
      { startTime: '09:15', sortOrder: 1 },
    ];

    expect(getPlanDisplayTime({ structureKind: 'journey', stages })).toEqual({
      label: '09:15 开始',
      group: 'timed',
      sortKey: '09:15',
    });
    expect(stages.map((stage) => stage.sortOrder)).toEqual([2, 0, 1]);
  });

  it('places a journey with no stage time in the all-day group', () => {
    expect(getPlanDisplayTime({
      structureKind: 'journey',
      stages: [{ startTime: null, sortOrder: 1 }, { startTime: '', sortOrder: 0 }],
    })).toEqual({
      label: '时间未设置',
      group: 'allDay',
      sortKey: null,
    });
  });
});

describe('sortPlansByDisplayTime', () => {
  it('sorts timed plans first and preserves input order for equal times and all-day plans', () => {
    const plans = [
      { id: 'all-day-a', structureKind: 'single' as const, isAllDay: true, time: null },
      { id: 'nine-a', structureKind: 'single' as const, isAllDay: false, time: '09:00' },
      { id: 'eight', structureKind: 'journey' as const, stages: [{ startTime: '08:00', sortOrder: 0 }] },
      { id: 'nine-b', structureKind: 'journey' as const, stages: [{ startTime: '09:00', sortOrder: 0 }] },
      { id: 'unset', structureKind: 'journey' as const, stages: [{ startTime: null, sortOrder: 0 }] },
      { id: 'all-day-b', structureKind: 'single' as const, isAllDay: true, time: null },
    ];

    expect(sortPlansByDisplayTime(plans).map((plan) => plan.id)).toEqual([
      'eight', 'nine-a', 'nine-b', 'all-day-a', 'unset', 'all-day-b',
    ]);
    expect(plans.map((plan) => plan.id)).toEqual([
      'all-day-a', 'nine-a', 'eight', 'nine-b', 'unset', 'all-day-b',
    ]);
  });
});
