import { describe, expect, it } from 'vitest';

import { planFromDraft, type SinglePlanFormDraft } from '../domain/plan-form';
import type { Plan } from '../domain/models';
import { createPlanRepository, hydratePlans, type PlanRow, type StageRow } from './plan-repository';

type SqlRow = Record<string, bigint | number | string | null>;
type SqliteStatement = {
  all(...params: unknown[]): SqlRow[];
  get(...params: unknown[]): SqlRow | undefined;
  run(...params: unknown[]): { changes: number };
};
type SqliteDatabase = {
  exec(source: string): void;
  prepare(source: string): SqliteStatement;
  close(): void;
};

declare const process: {
  getBuiltinModule(name: 'node:sqlite'): {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
  getBuiltinModule(name: 'node:fs'): {
    mkdtempSync(prefix: string): string;
    rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
  };
  getBuiltinModule(name: 'node:os'): { tmpdir(): string };
  getBuiltinModule(name: 'node:path'): { join(...parts: string[]): string };
};

// 测试使用 Node 内建 SQLite 验证真实 WHERE 约束，不用固定 changes 的替身模拟数据库语义。
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
const { mkdtempSync, rmSync } = process.getBuiltinModule('node:fs');
const { tmpdir } = process.getBuiltinModule('node:os');
const { join } = process.getBuiltinModule('node:path');

const journeyPlan: Plan = {
  id: 'new-plan', structureKind: 'journey', title: '周末采购', notes: '购买用品', dateKey: '2026-08-18',
  time: '10:30', isAllDay: true, status: 'pending', completedAt: null, isFeatured: true,
  accent: 'blue', icon: 'shopping-bag',
  stages: [
    {
      id: 'outbound', planId: 'new-plan', kind: 'fixed', name: '去程', notes: '', startTime: '09:30', sortOrder: 0,
      expenses: [{ id: 'metro', stageId: 'outbound', name: '地铁', category: 'transport', amountCents: 1500, sortOrder: 0 }],
    },
    {
      id: 'shopping', planId: 'new-plan', kind: 'choice', name: '采购', notes: '', startTime: '10:30', sortOrder: 1,
      selectedVariantId: 'offline',
      variants: [{
        id: 'offline', stageId: 'shopping', name: '线下购买', notes: '', sortOrder: 0,
        expenses: [{ id: 'goods', variantId: 'offline', name: '商品', category: 'shopping', amountCents: 68850, sortOrder: 0 }],
      }],
    },
  ],
};

const singlePlan: Plan = {
  id: 'single-plan', structureKind: 'single', title: '看展', notes: '带证件', dateKey: '2026-08-19',
  time: '14:30', isAllDay: true, status: 'pending', completedAt: null, isFeatured: false,
  accent: 'green', icon: 'image',
  stages: [{
    id: 'single-stage', planId: 'single-plan', kind: 'fixed', name: '', notes: '', startTime: null, sortOrder: 0,
    expenses: [],
  }],
};

function getJourneyFixedStage() {
  const stage = journeyPlan.stages[0];
  if (stage.kind !== 'fixed') throw new Error('测试夹具首阶段必须为固定阶段');
  return stage;
}

function getJourneyChoiceStage() {
  const stage = journeyPlan.stages[1];
  if (stage.kind !== 'choice') throw new Error('测试夹具第二阶段必须为可选阶段');
  return stage;
}

function getSingleFixedStage() {
  const stage = singlePlan.stages[0];
  if (stage.kind !== 'fixed') throw new Error('测试夹具必须为固定阶段');
  return stage;
}

const planRow = (structureKind: 'single' | 'journey', id = 'new-plan'): PlanRow => ({
  id, structure_kind: structureKind, title: '周末采购', notes: '', date_key: '2026-08-18', time: null, is_all_day: 1,
  status: 'pending', completed_at: null, is_featured: 1, accent: 'blue', icon: 'shopping-bag',
});

const fixedStage = (id: string, planId = 'new-plan'): StageRow => ({
  id, plan_id: planId, kind: 'fixed', name: '去程', notes: '', start_time: null, selected_variant_id: null, sort_order: 0,
});

describe('hydratePlans', () => {
  it('hydrates explicit single and journey structures', () => {
    const rows = [planRow('single', 'single-plan'), planRow('journey')];
    const stages: StageRow[] = [
      fixedStage('single-stage', 'single-plan'),
      fixedStage('fixed'),
      { id: 'choice', plan_id: 'new-plan', kind: 'choice', name: '午餐', notes: '', start_time: '12:00', selected_variant_id: 'a', sort_order: 1 },
    ];
    const plans = hydratePlans(
      rows, stages,
      [{ id: 'a', stage_id: 'choice', name: '套餐A', notes: '', sort_order: 0 }],
      [{ id: 'metro', stage_id: 'fixed', name: '地铁', category: 'transport', amount_cents: 1500, sort_order: 0 }],
      [{ id: 'meal', variant_id: 'a', name: '午餐', category: 'food', amount_cents: 3000, sort_order: 0 }],
    );

    expect(plans[0]).toMatchObject({ structureKind: 'single', stages: [{ kind: 'fixed' }] });
    expect(plans[1]).toMatchObject({
      structureKind: 'journey',
      stages: [
        { kind: 'fixed', expenses: [{ amountCents: 1500 }] },
        { kind: 'choice', selectedVariantId: 'a', variants: [{ expenses: [{ amountCents: 3000 }] }] },
      ],
    });
    expect(hydratePlans([planRow('journey')], [], [], [], [])[0]).toMatchObject({
      structureKind: 'journey', stages: [],
    });
  });

  it.each([
    ['没有阶段', []],
    ['包含多个阶段', [fixedStage('one'), fixedStage('two')]],
    ['包含可选阶段', [{ ...fixedStage('choice'), kind: 'choice' as const }]],
  ])('rejects a persisted single plan that %s', (_label, stages) => {
    expect(() => hydratePlans([planRow('single')], stages, [], [], [])).toThrow(/单项计划.*固定阶段/);
  });

  it('rejects a variant attached to a fixed stage instead of silently dropping it', () => {
    expect(() => hydratePlans(
      [planRow('journey')], [fixedStage('fixed')],
      [{ id: 'invalid-variant', stage_id: 'fixed', name: '', notes: '', sort_order: 0 }],
      [], [],
    )).toThrow(/方案 invalid-variant.*可选阶段/);
  });

  it('rejects a stage expense attached to a choice stage instead of silently dropping it', () => {
    const choice: StageRow = {
      id: 'choice', plan_id: 'new-plan', kind: 'choice', name: '', notes: '', start_time: null,
      selected_variant_id: null, sort_order: 0,
    };
    expect(() => hydratePlans(
      [planRow('journey')], [choice], [],
      [{ id: 'invalid-expense', stage_id: 'choice', name: '', category: 'other', amount_cents: 1, sort_order: 0 }],
      [],
    )).toThrow(/阶段费用 invalid-expense.*固定阶段/);
  });

  it('hydrates larger grouped stage sets once and preserves sort order without duplicates', () => {
    const stages = Array.from({ length: 24 }, (_, index) => fixedStage(`stage-${index}`)).map((stage, index) => ({
      ...stage, sort_order: 23 - index,
    }));
    const expenses = stages.map((stage, index) => ({
      id: `expense-${index}`, stage_id: stage.id, name: '', category: 'other' as const,
      amount_cents: index, sort_order: 0,
    }));

    const plan = hydratePlans([planRow('journey')], stages, [], expenses, [])[0];

    expect(plan.stages).toHaveLength(24);
    expect(new Set(plan.stages.map((stage) => stage.id)).size).toBe(24);
    expect(plan.stages.map((stage) => stage.sortOrder)).toEqual(Array.from({ length: 24 }, (_, index) => index));
  });
});

describe('createPlanRepository', () => {
  it.each([
    ['没有阶段', []],
    ['包含多个阶段', [singlePlan.stages[0], { ...singlePlan.stages[0], id: 'extra-stage' }]],
    ['包含可选阶段', [{
      id: 'choice', planId: 'single-plan', kind: 'choice' as const, name: '', notes: '', startTime: null,
      sortOrder: 0, selectedVariantId: null, variants: [],
    }]],
  ])('rejects an invalid single that %s before create or update starts a transaction', async (_label, stages) => {
    for (const method of ['createPlan', 'updatePlan'] as const) {
      const calls: unknown[][] = [];
      let transactions = 0;
      const repository = createPlanRepository(mockDb(calls, () => { transactions += 1; }));

      await expect(repository[method]({ ...singlePlan, stages })).rejects.toThrow(/单项计划.*固定阶段/);
      expect(transactions).toBe(0);
      expect(calls).toHaveLength(0);
    }
  });

  it.each([
    ['阶段跨计划', () => ({ ...journeyPlan, stages: [{ ...journeyPlan.stages[0], planId: 'other-plan' }] })],
    ['固定费用跨阶段', () => ({
      ...journeyPlan,
      stages: [{
        ...getJourneyFixedStage(),
        expenses: [{ ...getJourneyFixedStage().expenses[0], stageId: 'other-stage' }],
      }],
    })],
    ['方案跨阶段', () => ({
      ...journeyPlan,
      stages: [{
        ...getJourneyChoiceStage(),
        variants: [{ ...getJourneyChoiceStage().variants[0], stageId: 'other-stage' }],
      }],
    })],
    ['方案费用跨方案', () => ({
      ...journeyPlan,
      stages: [{
        ...getJourneyChoiceStage(),
        variants: [{
          ...getJourneyChoiceStage().variants[0],
          expenses: [{ ...getJourneyChoiceStage().variants[0].expenses[0], variantId: 'other-variant' }],
        }],
      }],
    })],
    ['选择不存在的方案', () => ({
      ...journeyPlan,
      stages: [{ ...getJourneyChoiceStage(), selectedVariantId: 'missing', variants: [] }],
    })],
  ])('rejects invalid aggregate ownership (%s) before any transaction or write', async (_label, makePlan) => {
    const calls: unknown[][] = [];
    let transactions = 0;
    const repository = createPlanRepository(mockDb(calls, () => { transactions += 1; }));

    await expect(repository.createPlan(makePlan() as Plan)).rejects.toThrow(/归属|选中方案/);
    expect(transactions).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['阶段跨计划', () => ({ ...journeyPlan, stages: [{ ...getJourneyFixedStage(), planId: 'other-plan' }] })],
    ['固定费用跨阶段', () => ({
      ...journeyPlan,
      stages: [{
        ...getJourneyFixedStage(),
        expenses: [{ ...getJourneyFixedStage().expenses[0], stageId: 'other-stage' }],
      }],
    })],
    ['方案跨阶段', () => ({
      ...journeyPlan,
      stages: [{
        ...getJourneyChoiceStage(),
        variants: [{ ...getJourneyChoiceStage().variants[0], stageId: 'other-stage' }],
      }],
    })],
    ['方案费用跨方案', () => ({
      ...journeyPlan,
      stages: [{
        ...getJourneyChoiceStage(),
        variants: [{
          ...getJourneyChoiceStage().variants[0],
          expenses: [{ ...getJourneyChoiceStage().variants[0].expenses[0], variantId: 'other-variant' }],
        }],
      }],
    })],
  ])('rejects invalid ownership during update (%s) before a transaction or write', async (_label, makePlan) => {
    const calls: unknown[][] = [];
    let transactions = 0;
    const repository = createPlanRepository(mockDb(calls, () => { transactions += 1; }));

    await expect(repository.updatePlan(makePlan() as Plan)).rejects.toThrow(/归属/);
    expect(transactions).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('creates a zero-expense single aggregate in one transaction and preserves its own time fields', async () => {
    const calls: unknown[][] = [];
    let transactions = 0;
    const repository = createPlanRepository(mockDb(calls, () => { transactions += 1; }));

    await expect(repository.createPlan(singlePlan)).resolves.toBe('single-plan');

    expect(transactions).toBe(1);
    expect(calls).toHaveLength(2);
    expect(String(calls[0][0])).toContain('structure_kind');
    expect(calls[0].slice(1, 8)).toEqual(['single-plan', 'single', '看展', '带证件', '2026-08-19', '14:30', 1]);
    expect(String(calls[1][0])).toContain('INSERT INTO journey_stages');
  });

  it('lists a newly created single plan in its featured month using real SQLite', async () => {
    const db = new TransactionalTestDatabase();
    initializeProductionSchema(db.sqlite);
    const repository = createPlanRepository(db);
    const draft: SinglePlanFormDraft = {
      id: 'featured-new-single', structureKind: 'single', implicitStageId: 'featured-new-single-stage',
      implicitStageName: null, implicitStageNotes: '', title: '新建理发计划', notes: '',
      dateKey: '2026-08-22', time: '14:30', isAllDay: false,
      accent: 'green', icon: 'star', expenses: [],
    };

    await repository.createPlan(planFromDraft(draft));
    const featured = await repository.getFeaturedPlans('2026-08');

    expect(featured.map((plan) => plan.id)).toEqual(['featured-new-single']);
  });

  it('runs an aggregate write exclusively and sends every SQL statement through the transaction database', async () => {
    const rootCalls: unknown[][] = [];
    const transactionCalls: unknown[][] = [];
    let exclusiveTransactions = 0;
    let regularTransactions = 0;
    const transactionDb = sqlRecordingDb(transactionCalls);
    const db = {
      ...sqlRecordingDb(rootCalls),
      withTransactionAsync: async (task: () => Promise<void>) => { regularTransactions += 1; await task(); },
      withExclusiveTransactionAsync: async (task: (txn: typeof transactionDb) => Promise<void>) => {
        exclusiveTransactions += 1;
        await task(transactionDb);
      },
    };

    await createPlanRepository(db).createPlan(singlePlan);

    expect(exclusiveTransactions).toBe(1);
    expect(regularTransactions).toBe(0);
    expect(rootCalls).toHaveLength(0);
    expect(transactionCalls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining('INSERT INTO plans'),
      expect.stringContaining('INSERT INTO journey_stages'),
    ]);
  });

  it('runs multi-query reads through the exclusive transaction database when available', async () => {
    const rootCalls: unknown[][] = [];
    const transactionCalls: unknown[][] = [];
    let exclusiveTransactions = 0;
    let regularTransactions = 0;
    const transactionDb = sqlRecordingDb(transactionCalls);
    const db = {
      ...sqlRecordingDb(rootCalls),
      withTransactionAsync: async (task: () => Promise<void>) => { regularTransactions += 1; await task(); },
      withExclusiveTransactionAsync: async (task: (txn: typeof transactionDb) => Promise<void>) => {
        exclusiveTransactions += 1;
        await task(transactionDb);
      },
    };

    await createPlanRepository(db).getPlansForDate('2026-08-18');

    expect(exclusiveTransactions).toBe(1);
    expect(regularTransactions).toBe(0);
    expect(rootCalls).toHaveLength(0);
    expect(String(transactionCalls[0][0])).toContain('SELECT id, structure_kind');
  });

  it('uses the serialized regular transaction when exclusive capability is disabled for web', async () => {
    const rootCalls: unknown[][] = [];
    let exclusiveTransactions = 0;
    let regularTransactions = 0;
    const db = {
      ...sqlRecordingDb(rootCalls),
      withTransactionAsync: async (task: () => Promise<void>) => { regularTransactions += 1; await task(); },
      withExclusiveTransactionAsync: async () => { exclusiveTransactions += 1; throw new Error('web 不支持 exclusive'); },
    };

    await createPlanRepository(db, { exclusiveTransactions: false }).getPlansForDate('2026-08-18');

    expect(exclusiveTransactions).toBe(0);
    expect(regularTransactions).toBe(1);
    expect(String(rootCalls[0][0])).toContain('SELECT id, structure_kind');
  });

  it('serializes regular transaction fallback across repository instances sharing one database', async () => {
    const firstWriteStarted = deferred<void>();
    const releaseFirstWrite = deferred<void>();
    let activeTransactions = 0;
    let maximumActiveTransactions = 0;
    let transactionStarts = 0;
    const db = {
      ...sqlRecordingDb([]),
      runAsync: async (source: string, ...params: unknown[]) => {
        if (source.includes('INSERT INTO plans') && params[0] === 'queue-first') {
          firstWriteStarted.resolve();
          await releaseFirstWrite.promise;
        }
        return { changes: 1 };
      },
      withTransactionAsync: async (task: () => Promise<void>) => {
        transactionStarts += 1;
        activeTransactions += 1;
        maximumActiveTransactions = Math.max(maximumActiveTransactions, activeTransactions);
        try { await task(); } finally { activeTransactions -= 1; }
      },
    };
    const firstRepository = createPlanRepository(db);
    const secondRepository = createPlanRepository(db);

    const first = firstRepository.createPlan(makeSinglePlan('queue-first'));
    await firstWriteStarted.promise;
    const second = secondRepository.createPlan(makeSinglePlan('queue-second'));
    await Promise.resolve();
    await Promise.resolve();
    const startsBeforeRelease = transactionStarts;
    releaseFirstWrite.resolve();
    await Promise.all([first, second]);

    expect(startsBeforeRelease).toBe(1);
    expect(maximumActiveTransactions).toBe(1);
    expect(transactionStarts).toBe(2);
  });

  it('does not allow another repository write to enter while an exclusive transaction is active', async () => {
    const transactionStarted = deferred<void>();
    const releaseTransaction = deferred<void>();
    const events: string[] = [];
    const transactionDb = {
      ...sqlRecordingDb([]),
      runAsync: async (source: string) => {
        if (source.includes('INSERT INTO plans')) {
          events.push('transaction-write');
          transactionStarted.resolve();
          await releaseTransaction.promise;
        }
        return { changes: 1 };
      },
    };
    const db = {
      ...sqlRecordingDb([]),
      runAsync: async (source: string) => {
        if (source.includes('UPDATE journey_stages')) events.push('outside-write');
        if (source.includes('INSERT INTO plans')) {
          events.push('transaction-write');
          transactionStarted.resolve();
          await releaseTransaction.promise;
        }
        return { changes: 0 };
      },
      withTransactionAsync: async (task: () => Promise<void>) => { await task(); },
      withExclusiveTransactionAsync: async (task: (txn: typeof transactionDb) => Promise<void>) => {
        events.push('exclusive-begin');
        await task(transactionDb);
        events.push('exclusive-end');
      },
    };
    const firstRepository = createPlanRepository(db);
    const secondRepository = createPlanRepository(db);

    const aggregateWrite = firstRepository.createPlan(singlePlan);
    await transactionStarted.promise;
    const outsideWrite = secondRepository.selectStageVariant('new-plan', 'shopping', 'offline');
    await Promise.resolve();
    await Promise.resolve();
    const eventsWhileBlocked = [...events];
    releaseTransaction.resolve();
    await aggregateWrite;
    await outsideWrite;

    expect(eventsWhileBlocked).not.toContain('outside-write');
    expect(events).toEqual(['exclusive-begin', 'transaction-write', 'exclusive-end', 'outside-write']);
  });

  it('keeps a multi-query read on the old subtree when an update is requested between queries', async () => {
    const planQueryStarted = deferred<void>();
    const releasePlanQuery = deferred<void>();
    let stage = fixedStage('old-stage');
    let updateWrites = 0;
    const db = {
      getAllAsync: async <T,>(source: string) => {
        if (source.includes('FROM plans')) {
          planQueryStarted.resolve();
          await releasePlanQuery.promise;
          return [planRow('journey')] as T[];
        }
        if (source.includes('FROM journey_stages')) return [stage] as T[];
        return [] as T[];
      },
      getFirstAsync: async <T,>() => null as T | null,
      runAsync: async (source: string, ...params: unknown[]) => {
        updateWrites += 1;
        if (source.includes('INSERT INTO journey_stages')) {
          stage = {
            id: String(params[0]), plan_id: String(params[1]), kind: 'fixed', name: String(params[3]), notes: '',
            start_time: null, selected_variant_id: null, sort_order: Number(params[6]),
          };
        }
        return { changes: 1 };
      },
      withTransactionAsync: async (task: () => Promise<void>) => { await task(); },
    };
    const reader = createPlanRepository(db);
    const writer = createPlanRepository(db);
    const updatedPlan: Plan = {
      ...journeyPlan,
      stages: [{ ...getJourneyFixedStage(), id: 'new-stage', expenses: [] }],
    };

    const read = reader.getPlan('new-plan');
    await planQueryStarted.promise;
    const update = writer.updatePlan(updatedPlan);
    await Promise.resolve();
    await Promise.resolve();
    const writesBeforeReadContinues = updateWrites;
    releasePlanQuery.resolve();
    const oldSnapshot = await read;
    await update;

    expect(writesBeforeReadContinues).toBe(0);
    expect(oldSnapshot?.stages.map((item) => item.id)).toEqual(['old-stage']);
  });

  it('rolls back the real plan and stage rows when a later variant insert fails', async () => {
    const db = createProductionDatabaseWithFailingVariantInsert();

    await expect(createPlanRepository(db).createPlan(journeyPlan)).rejects.toThrow(/variant insert failed/);

    expect(db.value<number>('SELECT COUNT(*) AS count FROM plans', 'count')).toBe(0);
    expect(db.value<number>('SELECT COUNT(*) AS count FROM journey_stages', 'count')).toBe(0);
    expect(db.value<number>('SELECT COUNT(*) AS count FROM stage_expenses', 'count')).toBe(0);
    expect(db.exclusiveTransactions).toBe(1);
  });

  it('replaces the full subtree when the exclusive connection has foreign keys disabled', async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'plan-repository-'));
    const databasePath = join(tempDirectory, 'repository.sqlite');
    let db: TwoConnectionTestDatabase | undefined;
    try {
      db = createTwoConnectionProductionDatabase(databasePath);
      const repository = createPlanRepository(db);
      expect(db.value<number>('PRAGMA foreign_keys', 'foreign_keys')).toBe(1);
      await repository.createPlan(journeyPlan);

      await expect(repository.updatePlan(journeyPlan)).resolves.toBe(true);

      expect(db.exclusiveForeignKeyModes.every((mode) => mode === 0)).toBe(true);
      expect(db.value<number>('SELECT COUNT(*) AS count FROM plans', 'count')).toBe(1);
      expect(db.value<number>('SELECT COUNT(*) AS count FROM journey_stages', 'count')).toBe(2);
      expect(db.value<number>('SELECT COUNT(*) AS count FROM stage_expenses', 'count')).toBe(1);
      expect(db.value<number>('SELECT COUNT(*) AS count FROM stage_variants', 'count')).toBe(1);
      expect(db.value<number>('SELECT COUNT(*) AS count FROM variant_expenses', 'count')).toBe(1);
      await expect(repository.getPlan('new-plan')).resolves.toMatchObject({
        stages: [
          { id: 'outbound', expenses: [{ id: 'metro' }] },
          { id: 'shopping', variants: [{ id: 'offline', expenses: [{ id: 'goods' }] }] },
        ],
      });
    } finally {
      db?.close();
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('writes valid single expenses under its implicit fixed stage', async () => {
    const calls: unknown[][] = [];
    const plan: Plan = {
      ...singlePlan,
      stages: [{
        ...getSingleFixedStage(),
        expenses: [{
          id: 'ticket', stageId: 'single-stage', name: '门票', category: 'ticket', amountCents: 8800, sortOrder: 0,
        }],
      }],
    };

    await createPlanRepository(mockDb(calls)).createPlan(plan);

    const expenseInsert = calls.find((call) => String(call[0]).includes('INSERT INTO stage_expenses'));
    expect(expenseInsert?.slice(1, 7)).toEqual(['ticket', 'single-stage', '门票', 'ticket', 8800, 0]);
  });

  it('updates structure_kind and replaces a zero-expense single subtree in one transaction', async () => {
    const calls: unknown[][] = [];
    let transactions = 0;
    const repository = createPlanRepository(mockDb(calls, () => { transactions += 1; }));

    await expect(repository.updatePlan(singlePlan)).resolves.toBe(true);

    expect(transactions).toBe(1);
    expect(String(calls[0][0])).toContain('structure_kind = ?');
    expect(calls[0].slice(1, 7)).toEqual(['single', '看展', '带证件', '2026-08-19', '14:30', 1]);
    const deleteCalls = calls.filter((call) => String(call[0]).includes('DELETE FROM'));
    expect(deleteCalls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining('DELETE FROM variant_expenses'),
      expect.stringContaining('DELETE FROM stage_expenses'),
      expect.stringContaining('DELETE FROM stage_variants'),
      expect.stringContaining('DELETE FROM journey_stages'),
    ]);
    expect(deleteCalls.every((call) => String(call[0]).includes('plan_id'))).toBe(true);
    expect(calls.filter((call) => String(call[0]).includes('INSERT INTO journey_stages'))).toHaveLength(1);
    expect(calls.every((call) => !String(call[0]).includes('INSERT INTO stage_expenses'))).toBe(true);
  });

  it('updates a single with valid expenses by replacing its fixed subtree in one transaction', async () => {
    const calls: unknown[][] = [];
    let transactions = 0;
    const plan: Plan = {
      ...singlePlan,
      stages: [{
        ...getSingleFixedStage(),
        expenses: [{
          id: 'ticket', stageId: 'single-stage', name: '门票', category: 'ticket', amountCents: 8800, sortOrder: 0,
        }],
      }],
    };
    const repository = createPlanRepository(mockDb(calls, () => { transactions += 1; }));

    await expect(repository.updatePlan(plan)).resolves.toBe(true);

    expect(transactions).toBe(1);
    expect(calls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining('UPDATE plans'),
      expect.stringContaining('DELETE FROM variant_expenses'),
      expect.stringContaining('DELETE FROM stage_expenses'),
      expect.stringContaining('DELETE FROM stage_variants'),
      expect.stringContaining('DELETE FROM journey_stages'),
      expect.stringContaining('INSERT INTO journey_stages'),
      expect.stringContaining('INSERT INTO stage_expenses'),
    ]);
    expect(calls[6].slice(1, 7)).toEqual(['ticket', 'single-stage', '门票', 'ticket', 8800, 0]);
  });

  it.each(['createPlan', 'updatePlan'] as const)('normalizes journey plan main time fields during %s', async (method) => {
    const calls: unknown[][] = [];
    const repository = createPlanRepository(mockDb(calls));

    await repository[method](journeyPlan);

    const mainWrite = calls[0];
    const params = mainWrite.slice(1);
    expect(String(mainWrite[0])).toContain('structure_kind');
    expect(params).toContain('journey');
    expect(params).not.toContain('10:30');
    expect(params).toContain(null);
    expect(params).toContain(0);
    expect(calls.find((call) => String(call[0]).includes('INSERT INTO journey_stages'))?.slice(1)).toContain('09:30');
  });

  it('selects only a journey variant belonging to the requested plan and stage', async () => {
    const calls: unknown[][] = [];
    const repository = createPlanRepository(mockDb(calls));

    await expect(repository.selectStageVariant('new-plan', 'shopping', 'offline')).resolves.toBe(true);

    expect(calls[0].slice(1)).toEqual(['offline', 'shopping', 'new-plan', 'offline']);
    expect(String(calls[0][0])).toContain("structure_kind = 'journey'");
    expect(String(calls[0][0])).toContain('stage_id = journey_stages.id');
  });

  it('clears a selection only for a choice stage on a journey plan', async () => {
    const calls: unknown[][] = [];
    const repository = createPlanRepository(mockDb(calls));

    await expect(repository.selectStageVariant('new-plan', 'shopping', null)).resolves.toBe(true);

    expect(calls[0].slice(1)).toEqual(['shopping', 'new-plan']);
    expect(String(calls[0][0])).toContain("structure_kind = 'journey'");
    expect(String(calls[0][0])).toContain("kind = 'choice'");
  });

  it.each([
    ['single plan', 'single-plan', 'single-choice', 'single-new'],
    ['fixed stage', 'journey-fixed', 'fixed-stage', 'fixed-new'],
    ['cross-stage variant', 'journey-cross', 'cross-target', 'cross-new'],
  ])('returns false without changing the selection for a %s', async (_label, planId, stageId, variantId) => {
    const db = createSelectionDatabase();
    const repository = createPlanRepository(db);

    await expect(repository.selectStageVariant(planId, stageId, variantId)).resolves.toBe(false);

    expect(db.value<string>('SELECT selected_variant_id FROM journey_stages WHERE id = ?', 'selected_variant_id', stageId))
      .toBe('kept');
  });

  it('treats an empty variant ID as a selection attempt rather than clearing the stage', async () => {
    const db = createSelectionDatabase();
    const repository = createPlanRepository(db);

    await expect(repository.selectStageVariant('journey-cross', 'cross-target', '')).resolves.toBe(false);

    expect(db.value<string>('SELECT selected_variant_id FROM journey_stages WHERE id = ?', 'selected_variant_id', 'cross-target'))
      .toBe('kept');
  });

  it('includes structure_kind in plan reads and does not order by the non-authoritative journey time', async () => {
    const calls: unknown[][] = [];
    const repository = createPlanRepository(mockDb(calls));

    await repository.getPlansForDate('2026-08-18');

    expect(String(calls[0][0])).toContain('structure_kind');
    expect(String(calls[0][0])).toContain('ORDER BY date_key, id');
    expect(String(calls[0][0])).not.toMatch(/ORDER BY[^;]*\\btime\\b/);
  });

  it('returns distinct non-archived plan dates for calendar markers', async () => {
    const calls: unknown[][] = [];
    const db = mockDb(calls);
    db.getAllAsync = async <T,>(...args: unknown[]) => {
      calls.push(args);
      return [{ date_key: '2026-08-18' }, { date_key: '2026-08-20' }] as T[];
    };

    await expect(createPlanRepository(db).getPlanDateKeysForMonth('2026-08'))
      .resolves.toEqual(['2026-08-18', '2026-08-20']);

    expect(String(calls[0][0])).toContain('SELECT DISTINCT date_key');
    expect(String(calls[0][0])).toContain("status != 'archived'");
    expect(calls[0][1]).toBe('2026-08-%');
  });

  it('reads the stage subtree before rejecting a persisted invalid single', async () => {
    const calls: unknown[][] = [];
    let queryIndex = 0;
    const db = {
      getAllAsync: async <T,>(...args: unknown[]) => {
        calls.push(args);
        return (queryIndex++ === 0 ? [planRow('single')] : []) as T[];
      },
      getFirstAsync: async <T,>() => null as T | null,
      runAsync: async () => ({ changes: 1 }),
      withTransactionAsync: async (task: () => Promise<void>) => { await task(); },
    };

    await expect(createPlanRepository(db).getPlan('new-plan')).rejects.toThrow(/单项计划.*固定阶段/);
    expect(calls).toHaveLength(2);
    expect(String(calls[1][0])).toContain('FROM journey_stages');
  });

  it('propagates a child failure so the transaction can roll back', async () => {
    let rolledBack = false;
    const db = {
      getAllAsync: async <T,>() => [] as T[], getFirstAsync: async <T,>() => null as T | null,
      runAsync: async (source: string) => {
        if (source.includes('INSERT INTO stage_variants')) throw new Error('variant insert failed');
        return { changes: 1 };
      },
      withTransactionAsync: async (task: () => Promise<void>) => {
        try { await task(); } catch (error) { rolledBack = true; throw error; }
      },
    };
    await expect(createPlanRepository(db).createPlan(journeyPlan)).rejects.toThrow('variant insert failed');
    expect(rolledBack).toBe(true);
  });

  it('atomically toggles completion twice across repository instances so the updates cancel out', async () => {
    const db = createSelectionDatabase();
    db.sqlite.prepare(
      "INSERT INTO plans (id, structure_kind, status, completed_at, updated_at) VALUES ('toggle-plan', 'single', 'pending', NULL, 0)",
    ).run();
    const firstRepository = createPlanRepository(db);
    const secondRepository = createPlanRepository(db);

    const results = await Promise.all([
      firstRepository.toggleCompleted('toggle-plan'),
      secondRepository.toggleCompleted('toggle-plan'),
    ]);

    expect(results).toEqual(['completed', 'pending']);
    expect(db.row('SELECT status, completed_at FROM plans WHERE id = ?', 'toggle-plan')).toEqual({
      status: 'pending', completed_at: null,
    });
    const toggleStatements = db.getFirstSources.filter((source) => source.includes('UPDATE plans'));
    expect(toggleStatements).toHaveLength(2);
    expect(toggleStatements.every((source) => source.includes('CASE') && source.includes('RETURNING status'))).toBe(true);
    expect(toggleStatements.every((source) => source.includes("structure_kind IN ('single', 'journey')"))).toBe(true);
    expect(db.runSources.every((source) => !source.includes('UPDATE plans'))).toBe(true);
  });
});

function mockDb(calls: unknown[][], onTransaction: (() => void) | undefined = () => {}, changes = 1) {
  return {
    getAllAsync: async <T,>(...args: unknown[]) => { calls.push(args); return [] as T[]; },
    getFirstAsync: async <T,>() => null as T | null,
    runAsync: async (...args: unknown[]) => { calls.push(args); return { changes }; },
    withTransactionAsync: async (task: () => Promise<void>) => { onTransaction?.(); await task(); },
  };
}

function sqlRecordingDb(calls: unknown[][]) {
  return {
    getAllAsync: async <T,>(...args: unknown[]) => { calls.push(args); return [] as T[]; },
    getFirstAsync: async <T,>(...args: unknown[]) => { calls.push(args); return null as T | null; },
    runAsync: async (...args: unknown[]) => { calls.push(args); return { changes: 1 }; },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function makeSinglePlan(id: string): Plan {
  return {
    ...singlePlan,
    id,
    stages: [{ ...getSingleFixedStage(), id: `${id}-stage`, planId: id, expenses: [] }],
  };
}

class SelectionDatabase {
  readonly sqlite = new DatabaseSync(':memory:');
  readonly getFirstSources: string[] = [];
  readonly runSources: string[] = [];

  async getAllAsync<T>(source: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).all(...params) as T[];
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]) {
    this.getFirstSources.push(source);
    return (this.sqlite.prepare(source).get(...params) ?? null) as T | null;
  }

  async runAsync(source: string, ...params: unknown[]) {
    this.runSources.push(source);
    return this.sqlite.prepare(source).run(...params);
  }

  row(source: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).get(...params);
  }

  value<T>(source: string, key: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).get(...params)?.[key] as T;
  }
}

class TransactionalTestDatabase {
  readonly sqlite = new DatabaseSync(':memory:');
  exclusiveTransactions = 0;

  async getAllAsync<T>(source: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).all(...params) as T[];
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]) {
    return (this.sqlite.prepare(source).get(...params) ?? null) as T | null;
  }

  async runAsync(source: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).run(...params);
  }

  async withTransactionAsync(task: () => Promise<void>) {
    await this.transaction(task);
  }

  async withExclusiveTransactionAsync(task: (txn: TransactionalTestDatabase) => Promise<void>) {
    this.exclusiveTransactions += 1;
    await this.transaction(() => task(this));
  }

  value<T>(source: string, key: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).get(...params)?.[key] as T;
  }

  private async transaction(task: () => Promise<void>) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      await task();
      this.sqlite.exec('COMMIT');
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

function createProductionDatabaseWithFailingVariantInsert() {
  const db = new TransactionalTestDatabase();
  db.sqlite.exec('PRAGMA foreign_keys = ON');
  initializeProductionSchema(db.sqlite);
  db.sqlite.exec(`
    CREATE TRIGGER fail_variant BEFORE INSERT ON stage_variants
    BEGIN SELECT RAISE(ABORT, 'variant insert failed'); END;
  `);
  return db;
}

class SqliteExecutor {
  constructor(readonly sqlite: SqliteDatabase) {}

  async getAllAsync<T>(source: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).all(...params) as T[];
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]) {
    return (this.sqlite.prepare(source).get(...params) ?? null) as T | null;
  }

  async runAsync(source: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).run(...params);
  }
}

class TwoConnectionTestDatabase extends SqliteExecutor {
  readonly exclusiveForeignKeyModes: number[] = [];

  constructor(private readonly databasePath: string) {
    super(new DatabaseSync(databasePath));
    this.sqlite.exec('PRAGMA foreign_keys = ON');
  }

  async withExclusiveTransactionAsync(task: (txn: SqliteExecutor) => Promise<void>) {
    const connection = new DatabaseSync(this.databasePath);
    connection.exec('PRAGMA foreign_keys = OFF');
    const foreignKeys = connection.prepare('PRAGMA foreign_keys').get()?.foreign_keys;
    this.exclusiveForeignKeyModes.push(Number(foreignKeys));
    connection.exec('BEGIN IMMEDIATE');
    try {
      await task(new SqliteExecutor(connection));
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    } finally {
      connection.close();
    }
  }

  value<T>(source: string, key: string, ...params: unknown[]) {
    return this.sqlite.prepare(source).get(...params)?.[key] as T;
  }

  close() {
    this.sqlite.close();
  }
}

function createTwoConnectionProductionDatabase(databasePath: string) {
  const db = new TwoConnectionTestDatabase(databasePath);
  initializeProductionSchema(db.sqlite);
  return db;
}

function initializeProductionSchema(sqlite: SqliteDatabase) {
  sqlite.exec(`
    CREATE TABLE plans (
      id TEXT PRIMARY KEY, structure_kind TEXT NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL,
      date_key TEXT NOT NULL, time TEXT, is_all_day INTEGER NOT NULL, status TEXT NOT NULL,
      completed_at INTEGER, selected_option_id TEXT, is_featured INTEGER NOT NULL, accent TEXT NOT NULL,
      icon TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE journey_stages (
      id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, name TEXT NOT NULL, notes TEXT NOT NULL, start_time TEXT,
      selected_variant_id TEXT, sort_order INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE stage_expenses (
      id TEXT PRIMARY KEY, stage_id TEXT NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL,
      sort_order INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE stage_variants (
      id TEXT PRIMARY KEY, stage_id TEXT NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL, notes TEXT NOT NULL, sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE variant_expenses (
      id TEXT PRIMARY KEY, variant_id TEXT NOT NULL REFERENCES stage_variants(id) ON DELETE CASCADE,
      name TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL,
      sort_order INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
  `);
}

function createSelectionDatabase() {
  const db = new SelectionDatabase();
  db.sqlite.exec(`
    CREATE TABLE plans (
      id TEXT PRIMARY KEY, structure_kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      completed_at INTEGER, updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE journey_stages (
      id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, kind TEXT NOT NULL,
      selected_variant_id TEXT, updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE stage_variants (id TEXT PRIMARY KEY, stage_id TEXT NOT NULL);

    INSERT INTO plans (id, structure_kind) VALUES ('single-plan', 'single');
    INSERT INTO journey_stages VALUES ('single-choice', 'single-plan', 'choice', 'kept', 0);
    INSERT INTO stage_variants VALUES ('single-new', 'single-choice');

    INSERT INTO plans (id, structure_kind) VALUES ('journey-fixed', 'journey');
    INSERT INTO journey_stages VALUES ('fixed-stage', 'journey-fixed', 'fixed', 'kept', 0);
    INSERT INTO stage_variants VALUES ('fixed-new', 'fixed-stage');

    INSERT INTO plans (id, structure_kind) VALUES ('journey-cross', 'journey');
    INSERT INTO journey_stages VALUES ('cross-target', 'journey-cross', 'choice', 'kept', 0);
    INSERT INTO journey_stages VALUES ('cross-owner', 'journey-cross', 'choice', NULL, 0);
    INSERT INTO stage_variants VALUES ('cross-new', 'cross-owner');
  `);
  return db;
}
