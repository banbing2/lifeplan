import { describe, expect, it } from 'vitest';

import type { JourneyPlanFormDraft, SinglePlanFormDraft } from './plan-form';
import { convertJourneyToSingle, convertSingleToJourney, getJourneyToSingleConversionReason } from './plan-structure';

const single: SinglePlanFormDraft = {
  id: 'plan-1', structureKind: 'single', implicitStageId: 'implicit-1', title: '看展', notes: '带证件',
  implicitStageName: null, implicitStageNotes: '',
  dateKey: '2026-08-18', time: '14:30', isAllDay: false, accent: 'orange', icon: 'image',
  expenses: [
    { id: 'ticket', name: '门票', category: 'ticket', amountYuan: '88.00' },
    { id: 'metro', name: '地铁', category: 'transport', amountYuan: '6.00' },
  ],
};

function journeyWithStages(stages: JourneyPlanFormDraft['stages']): JourneyPlanFormDraft {
  return {
    id: 'plan-1', structureKind: 'journey', title: '看展', notes: '带证件', dateKey: '2026-08-18',
    accent: 'orange', icon: 'image', stages,
  };
}

describe('single to journey conversion', () => {
  it('keeps the implicit stage and expense identity, order, and amounts', () => {
    const converted = convertSingleToJourney(single);

    expect(converted).toMatchObject({
      structureKind: 'journey', title: '看展',
      stages: [{
        id: 'implicit-1', kind: 'fixed', name: '看展', notes: '', startTime: '14:30',
        expenses: [{ id: 'ticket', amountYuan: '88.00' }, { id: 'metro', amountYuan: '6.00' }],
      }],
    });
    expect(converted.stages[0].kind === 'fixed' && converted.stages[0].expenses).toEqual(single.expenses);
  });

  it('uses an empty stage time for an all-day plan and preserves an empty title', () => {
    expect(convertSingleToJourney({ ...single, title: '', isAllDay: true }).stages[0])
      .toMatchObject({ name: '', startTime: '' });
  });
});

describe('journey to single conversion', () => {
  it('converts exactly one fixed stage while preserving its ID and expenses', () => {
    const expenses = single.expenses;
    const journey = journeyWithStages([{
      id: 'fixed-1', kind: 'fixed', name: '展览', notes: '阶段备注', startTime: '16:45', expenses,
    }]);

    expect(getJourneyToSingleConversionReason(journey)).toBeNull();
    expect(convertJourneyToSingle(journey)).toEqual({
      ok: true,
      draft: {
        id: 'plan-1', structureKind: 'single', implicitStageId: 'fixed-1', title: '看展', notes: '带证件',
        implicitStageName: '展览', implicitStageNotes: '阶段备注',
        dateKey: '2026-08-18', time: '16:45', isAllDay: false, accent: 'orange', icon: 'image', expenses,
      },
    });
  });

  it('uses all-day mode when the fixed stage has no time', () => {
    const journey = journeyWithStages([{
      id: 'fixed-1', kind: 'fixed', name: '展览', notes: '', startTime: '', expenses: [],
    }]);
    expect(convertJourneyToSingle(journey)).toMatchObject({
      ok: true,
      draft: { implicitStageId: 'fixed-1', time: '09:00', isAllDay: true, expenses: [] },
    });
  });

  it('preserves the original fixed-stage name and notes across a journey-single-journey round trip', () => {
    const original = journeyWithStages([{
      id: 'fixed-1', kind: 'fixed', name: '展馆内活动', notes: '从东门进入', startTime: '16:45',
      expenses: single.expenses,
    }]);
    const singleResult = convertJourneyToSingle(original);

    expect(singleResult).toMatchObject({
      ok: true,
      draft: { implicitStageName: '展馆内活动', implicitStageNotes: '从东门进入' },
    });
    if (!singleResult.ok) throw new Error('expected an eligible conversion');
    expect(convertSingleToJourney(singleResult.draft).stages[0]).toEqual(original.stages[0]);
  });

  it.each([
    ['zero stages', journeyWithStages([])],
    ['multiple stages', journeyWithStages([
      { id: 'one', kind: 'fixed', name: '一', notes: '', startTime: '', expenses: [] },
      { id: 'two', kind: 'fixed', name: '二', notes: '', startTime: '', expenses: [] },
    ])],
    ['a choice stage', journeyWithStages([{
      id: 'choice', kind: 'choice', name: '选项', notes: '', startTime: '', selectedVariantId: null, variants: [],
    }])],
  ])('rejects %s with a reason and does not mutate the draft', (_, journey) => {
    const snapshot = structuredClone(journey);
    const reason = getJourneyToSingleConversionReason(journey);
    const result = convertJourneyToSingle(journey);

    expect(reason).toBe('仅一个固定阶段时可切换为单次计划');
    expect(result).toEqual({ ok: false, reason });
    expect(journey).toEqual(snapshot);
  });
});
