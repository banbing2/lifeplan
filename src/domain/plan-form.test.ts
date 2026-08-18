import { describe, expect, it } from 'vitest';

import type { Plan } from './models';
import {
  createEmptyPlanDraft,
  parseYuanToCents,
  planFromDraft,
  planToDraft,
  validatePlanDraft,
  type JourneyPlanFormDraft,
  type SinglePlanFormDraft,
} from './plan-form';
import { convertJourneyToSingle, convertSingleToJourney } from './plan-structure';

const journeyDraft: JourneyPlanFormDraft = {
  id: 'plan-journey', structureKind: 'journey', title: '周末采购', notes: '购买工作用品',
  dateKey: '2026-08-18', accent: 'blue', icon: 'shopping-bag',
  stages: [
    {
      id: 'outbound', kind: 'fixed', name: '去程', notes: '', startTime: '09:30',
      expenses: [{ id: 'metro', name: '地铁', category: 'transport', amountYuan: '15.00' }],
    },
    {
      id: 'shopping', kind: 'choice', name: '采购方式', notes: '比较渠道', startTime: '10:30',
      selectedVariantId: 'offline',
      variants: [{
        id: 'offline', name: '线下购买', notes: '当天取货',
        expenses: [{ id: 'goods', name: '商品', category: 'shopping', amountYuan: '688.50' }],
      }],
    },
  ],
};

const singleDraft: SinglePlanFormDraft = {
  id: 'plan-single', structureKind: 'single', implicitStageId: 'single-stage-plan-single',
  implicitStageName: null, implicitStageNotes: '',
  title: '看电影', notes: '晚场', dateKey: '2026-08-18', time: '19:30', isAllDay: false,
  accent: 'purple', icon: 'film',
  expenses: [{ id: 'ticket', name: '电影票', category: 'ticket', amountYuan: '68.00' }],
};

describe('parseYuanToCents', () => {
  it('converts valid yuan text including zero to integer cents', () => {
    expect(parseYuanToCents('688.50')).toBe(68850);
    expect(parseYuanToCents('0')).toBe(0);
    expect(parseYuanToCents('0.00')).toBe(0);
  });

  it('rejects invalid precision, negative values, and excessive amounts', () => {
    expect(parseYuanToCents('12.345')).toBeNull();
    expect(parseYuanToCents('-1')).toBeNull();
    expect(parseYuanToCents('10000000')).toBeNull();
  });
});

describe('new single plan draft', () => {
  it('defaults to all day with a deterministic implicit stage and one blank expense row', () => {
    expect(createEmptyPlanDraft({ id: 'draft-1', dateKey: '2026-08-17' })).toEqual({
      id: 'draft-1', structureKind: 'single', implicitStageId: 'single-stage-draft-1',
      implicitStageName: null, implicitStageNotes: '',
      title: '', notes: '', dateKey: '2026-08-17', time: '09:00', isAllDay: true,
      accent: 'green', icon: 'star',
      expenses: [{ id: 'single-expense-draft-1', name: '', category: 'other', amountYuan: '' }],
    });
  });

  it('persists one fixed implicit stage while ignoring the default blank expense', () => {
    const draft = createEmptyPlanDraft({ id: 'draft-1', dateKey: '2026-08-17' });
    draft.title = '稍后规划';

    expect(validatePlanDraft(draft, { mode: 'create', todayKey: '2026-08-17' })).toEqual({});
    expect(planFromDraft(draft)).toMatchObject({
      structureKind: 'single', time: null, isAllDay: true,
      stages: [{
        id: 'single-stage-draft-1', planId: 'draft-1', kind: 'fixed', name: '稍后规划',
        notes: '', startTime: null, sortOrder: 0, expenses: [],
      }],
    });
  });
});

describe('plan form validation', () => {
  it('ignores fully blank expenses regardless of their category', () => {
    const draft: SinglePlanFormDraft = {
      ...singleDraft,
      expenses: [{ id: 'blank', name: '  ', category: 'shopping', amountYuan: '  ' }],
    };

    expect(validatePlanDraft(draft, { mode: 'create', todayKey: '2026-08-17' })).toEqual({});
    const stage = planFromDraft(draft).stages[0];
    expect(stage.kind === 'fixed' && stage.expenses).toEqual([]);
  });

  it('validates whichever field is missing from a partially filled expense', () => {
    const draft: SinglePlanFormDraft = {
      ...singleDraft,
      expenses: [
        { id: 'name-only', name: '停车', category: 'transport', amountYuan: '' },
        { id: 'amount-only', name: '', category: 'other', amountYuan: '0' },
      ],
    };

    expect(validatePlanDraft(draft, { mode: 'create', todayKey: '2026-08-17' })).toMatchObject({
      'expenses.0.amountYuan': '请输入有效金额，最多两位小数',
      'expenses.1.name': '请输入费用名称',
    });
  });

  it('accepts zero and preserves it during persistence', () => {
    const draft: SinglePlanFormDraft = {
      ...singleDraft,
      expenses: [
        { id: 'zero', name: '免费票', category: 'ticket', amountYuan: '0' },
        { id: 'zero-decimal', name: '优惠', category: 'other', amountYuan: '0.00' },
      ],
    };

    expect(validatePlanDraft(draft, { mode: 'create', todayKey: '2026-08-17' })).toEqual({});
    const stage = planFromDraft(draft).stages[0];
    expect(stage.kind === 'fixed' && stage.expenses.map((expense) => expense.amountCents)).toEqual([0, 0]);
  });

  it('rejects a past date when creating a plan', () => {
    expect(validatePlanDraft({ ...journeyDraft, dateKey: '2026-08-16' }, { mode: 'create', todayKey: '2026-08-17' }).dateKey)
      .toBe('不能新建过去日期的计划');
  });

  it('allows an existing past date to remain unchanged during edit', () => {
    expect(validatePlanDraft(
      { ...journeyDraft, dateKey: '2026-08-16' },
      { mode: 'edit', todayKey: '2026-08-17', originalDateKey: '2026-08-16' },
    )).toEqual({});
    expect(validatePlanDraft(
      { ...journeyDraft, dateKey: '2026-08-15' },
      { mode: 'edit', todayKey: '2026-08-17', originalDateKey: '2026-08-16' },
    ).dateKey).toBe('不能改为过去日期');
  });

  it('validates journey stage, variant, time, and nested expense fields', () => {
    const fixedStage = journeyDraft.stages[0];
    const choiceStage = journeyDraft.stages[1];
    if (fixedStage.kind !== 'fixed' || choiceStage.kind !== 'choice') throw new Error('invalid fixture');
    const invalid: JourneyPlanFormDraft = {
      ...journeyDraft,
      stages: [
        { ...fixedStage, name: '', startTime: '25:00' },
        {
          ...choiceStage, selectedVariantId: 'missing',
          variants: [{
            ...choiceStage.variants[0], name: '',
            expenses: [{ ...choiceStage.variants[0].expenses[0], name: '', amountYuan: '12.345' }],
          }],
        },
      ],
    };

    expect(validatePlanDraft(invalid, { mode: 'create', todayKey: '2026-08-17' })).toMatchObject({
      'stages.0.name': '请输入阶段名称',
      'stages.0.startTime': '请选择有效时间',
      'stages.1.selectedVariantId': '请选择当前阶段内的有效方案',
      'stages.1.variants.0.name': '请输入方案名称',
      'stages.1.variants.0.expenses.0.name': '请输入费用名称',
      'stages.1.variants.0.expenses.0.amountYuan': '请输入有效金额，最多两位小数',
    });
  });

  it('allows an incomplete choice stage and a zero-expense single plan', () => {
    const journey: JourneyPlanFormDraft = {
      ...journeyDraft,
      stages: [{ id: 'later', kind: 'choice', name: '稍后决定', notes: '', startTime: '', selectedVariantId: null, variants: [] }],
    };
    const single: SinglePlanFormDraft = { ...singleDraft, expenses: [] };

    expect(validatePlanDraft(journey, { mode: 'create', todayKey: '2026-08-17' })).toEqual({});
    expect(validatePlanDraft(single, { mode: 'create', todayKey: '2026-08-17' })).toEqual({});
    expect(planFromDraft(single).stages[0]).toMatchObject({ kind: 'fixed', expenses: [] });
  });
});

describe('plan form conversion', () => {
  it('features new plans by default while preserving an existing hidden plan', () => {
    expect(planFromDraft(singleDraft).isFeatured).toBe(true);
    expect(planFromDraft(journeyDraft).isFeatured).toBe(true);

    const existing = { ...planFromDraft(singleDraft), isFeatured: false };
    expect(planFromDraft(singleDraft, existing).isFeatured).toBe(false);
  });

  it('normalizes a journey aggregate to plan-level null time and false all-day', () => {
    const plan = planFromDraft(journeyDraft);
    expect(plan).toMatchObject({ structureKind: 'journey', time: null, isAllDay: false });
    expect(plan.status).toBe('pending');
    expect(plan.stages[0]).toMatchObject({ kind: 'fixed', planId: 'plan-journey', sortOrder: 0 });
    expect(plan.stages[0].kind === 'fixed' && plan.stages[0].expenses[0]).toMatchObject({ stageId: 'outbound', amountCents: 1500, sortOrder: 0 });
    expect(plan.stages[1]).toMatchObject({ kind: 'choice', selectedVariantId: 'offline', sortOrder: 1 });
    expect(plan.stages[1].kind === 'choice' && plan.stages[1].variants[0].expenses[0]).toMatchObject({ variantId: 'offline', amountCents: 68850, sortOrder: 0 });
  });

  it('round-trips a single plan without losing state or expenses', () => {
    const existing: Plan = { ...planFromDraft(singleDraft), status: 'completed', completedAt: 123456, isFeatured: true };
    const hydrated = planToDraft(existing);
    expect(hydrated).toMatchObject({
      structureKind: 'single', implicitStageId: 'single-stage-plan-single',
      isAllDay: false, time: '19:30', expenses: [{ id: 'ticket', amountYuan: '68.00' }],
    });
    expect(planFromDraft(hydrated, existing)).toEqual(existing);
  });

  it('persists hidden implicit-stage metadata at the single-plan save boundary', () => {
    const withRetainedStageMetadata: SinglePlanFormDraft = {
      ...singleDraft,
      implicitStageName: '原行程阶段名',
      implicitStageNotes: '原行程阶段备注',
    };
    const saved = planFromDraft(withRetainedStageMetadata);

    expect(saved.stages[0]).toMatchObject({ name: '原行程阶段名', notes: '原行程阶段备注' });
    expect(planToDraft(saved)).toMatchObject({
      structureKind: 'single',
      implicitStageName: '原行程阶段名',
      implicitStageNotes: '原行程阶段备注',
    });
  });

  it('derives a normal single stage from the current title after save, reload, and rename', () => {
    const saved = planFromDraft({ ...singleDraft, implicitStageName: null, implicitStageNotes: '' });
    const reloaded = planToDraft(saved);
    if (reloaded.structureKind !== 'single') throw new Error('expected single draft');

    expect(reloaded.implicitStageName).toBeNull();
    const journey = convertSingleToJourney({ ...reloaded, title: '改名后的电影计划' });
    expect(journey.stages[0]).toMatchObject({ name: '改名后的电影计划', notes: '' });
  });

  it('preserves independent journey stage metadata across single save and reload', () => {
    const journey: JourneyPlanFormDraft = {
      ...journeyDraft,
      title: '周末安排',
      stages: [{
        id: 'independent-stage', kind: 'fixed', name: '只保留这个阶段名', notes: '独立阶段备注',
        startTime: '10:00', expenses: [],
      }],
    };
    const converted = convertJourneyToSingle(journey);
    if (!converted.ok) throw new Error('expected eligible journey');
    const reloaded = planToDraft(planFromDraft(converted.draft));
    if (reloaded.structureKind !== 'single') throw new Error('expected single draft');

    expect(convertSingleToJourney(reloaded).stages[0]).toMatchObject({
      id: 'independent-stage', name: '只保留这个阶段名', notes: '独立阶段备注', startTime: '10:00',
    });
  });

  it('adds one UI blank row when hydrating a zero-expense single plan', () => {
    const hydrated = planToDraft(planFromDraft({ ...singleDraft, expenses: [] }));

    expect(hydrated.structureKind).toBe('single');
    expect(hydrated.structureKind === 'single' && hydrated.expenses).toEqual([
      { id: 'single-expense-plan-single', name: '', category: 'other', amountYuan: '' },
    ]);
  });

  it('round-trips a journey plan without losing selections or state', () => {
    const existing: Plan = { ...planFromDraft(journeyDraft), status: 'completed', completedAt: 123456, isFeatured: true };
    const hydrated = planToDraft(existing);
    expect(hydrated.structureKind).toBe('journey');
    expect(hydrated.structureKind === 'journey' && hydrated.stages[1]).toMatchObject({ kind: 'choice', selectedVariantId: 'offline' });
    expect(planFromDraft(hydrated, existing)).toEqual(existing);
  });

  it('hydrates solely from persisted structureKind instead of inferring from stage count', () => {
    const noStages: Plan = { ...planFromDraft(journeyDraft), stages: [] };
    expect(planToDraft(noStages)).toMatchObject({ structureKind: 'journey', stages: [] });
  });
});
