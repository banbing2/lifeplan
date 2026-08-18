import type {
  ExpenseCategory,
  JourneyStage,
  Plan,
  PlanAccent,
  PlanIcon,
  PlanStatus,
  PlanStructureKind,
  StageVariant,
} from '../domain/models';

declare const process: { env: { EXPO_OS?: string } };

/** plans 表查询行。 */
export type PlanRow = {
  id: string; structure_kind: PlanStructureKind; title: string; notes: string; date_key: string;
  time: string | null; is_all_day: number;
  status: PlanStatus; completed_at: number | null; is_featured: number; accent: PlanAccent; icon: PlanIcon;
};
/** journey_stages 表查询行。 */
export type StageRow = {
  id: string; plan_id: string; kind: 'fixed' | 'choice'; name: string; notes: string; start_time: string | null;
  selected_variant_id: string | null; sort_order: number;
};
/** stage_variants 表查询行。 */
export type VariantRow = { id: string; stage_id: string; name: string; notes: string; sort_order: number };
/** stage_expenses 表查询行。 */
export type StageExpenseRow = {
  id: string; stage_id: string; name: string; category: ExpenseCategory; amount_cents: number; sort_order: number;
};
/** variant_expenses 表查询行。 */
export type VariantExpenseRow = {
  id: string; variant_id: string; name: string; category: ExpenseCategory; amount_cents: number; sort_order: number;
};

/**
 * 校验计划聚合的结构与所有权不变量。
 * 写入前调用可确保无效聚合不会开启事务，读取后调用可暴露数据库中的结构损坏。
 */
function validatePlanAggregate(plan: Plan) {
  if (plan.structureKind === 'single'
    && (plan.stages.length !== 1 || plan.stages[0]?.kind !== 'fixed')) {
    throw new Error(`单项计划 ${plan.id} 必须恰好包含一个固定阶段`);
  }

  for (const stage of plan.stages) {
    if (stage.planId !== plan.id) throw new Error(`阶段 ${stage.id} 的计划归属无效`);
    if (stage.kind === 'fixed') {
      for (const expense of stage.expenses) {
        if (expense.stageId !== stage.id) throw new Error(`固定费用 ${expense.id} 的阶段归属无效`);
      }
      continue;
    }

    for (const variant of stage.variants) {
      if (variant.stageId !== stage.id) throw new Error(`方案 ${variant.id} 的阶段归属无效`);
      for (const expense of variant.expenses) {
        if (expense.variantId !== variant.id) throw new Error(`方案费用 ${expense.id} 的方案归属无效`);
      }
    }
    if (stage.selectedVariantId !== null
      && !stage.variants.some((variant) => variant.id === stage.selectedVariantId)) {
      throw new Error(`阶段 ${stage.id} 的选中方案归属无效`);
    }
  }
}

/**
 * 将分表查询结果水合为完整计划聚合。
 * 使用独立结果集而不是四表大联接，避免多方案、多费用产生笛卡尔积和重复实体。
 */
export function hydratePlans(
  planRows: PlanRow[],
  stageRows: StageRow[],
  variantRows: VariantRow[],
  stageExpenseRows: StageExpenseRow[],
  variantExpenseRows: VariantExpenseRow[],
): Plan[] {
  const planIds = new Set(planRows.map((row) => row.id));
  const stageRowsById = new Map(stageRows.map((row) => [row.id, row]));
  const variantRowsById = new Map(variantRows.map((row) => [row.id, row]));
  const stageExpensesByStageId = new Map<string, StageExpenseRow[]>();
  const variantExpensesByVariantId = new Map<string, VariantExpenseRow[]>();
  const variantRowsByStageId = new Map<string, VariantRow[]>();
  const stagesByPlanId = new Map<string, JourneyStage[]>();

  // 分组前先验证原始查询行，避免错误类型的子项在水合过滤时被静默丢弃。
  for (const row of stageRows) {
    if (!planIds.has(row.plan_id)) throw new Error(`阶段 ${row.id} 的计划归属无效`);
  }
  for (const row of variantRows) {
    const stage = stageRowsById.get(row.stage_id);
    if (!stage) throw new Error(`方案 ${row.id} 的阶段归属无效`);
    if (stage.kind !== 'choice') throw new Error(`方案 ${row.id} 只能属于可选阶段`);
    const group = variantRowsByStageId.get(row.stage_id) ?? [];
    group.push(row);
    variantRowsByStageId.set(row.stage_id, group);
  }
  for (const row of stageExpenseRows) {
    const stage = stageRowsById.get(row.stage_id);
    if (!stage) throw new Error(`阶段费用 ${row.id} 的阶段归属无效`);
    if (stage.kind !== 'fixed') throw new Error(`阶段费用 ${row.id} 只能属于固定阶段`);
    const group = stageExpensesByStageId.get(row.stage_id) ?? [];
    group.push(row);
    stageExpensesByStageId.set(row.stage_id, group);
  }
  for (const row of variantExpenseRows) {
    if (!variantRowsById.has(row.variant_id)) throw new Error(`方案费用 ${row.id} 的方案归属无效`);
    const group = variantExpensesByVariantId.get(row.variant_id) ?? [];
    group.push(row);
    variantExpensesByVariantId.set(row.variant_id, group);
  }

  const variants = new Map<string, StageVariant>();
  for (const row of variantRows) {
    variants.set(row.id, {
      id: row.id, stageId: row.stage_id, name: row.name, notes: row.notes, sortOrder: row.sort_order,
      expenses: [...(variantExpensesByVariantId.get(row.id) ?? [])]
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((expense) => ({
          id: expense.id, variantId: row.id, name: expense.name, category: expense.category,
          amountCents: expense.amount_cents, sortOrder: expense.sort_order,
        })),
    });
  }

  for (const row of stageRows) {
    const base = {
      id: row.id, planId: row.plan_id, name: row.name, notes: row.notes,
      startTime: row.start_time, sortOrder: row.sort_order,
    };
    let stage: JourneyStage;
    if (row.kind === 'fixed') {
      stage = {
        ...base,
        kind: 'fixed',
        expenses: [...(stageExpensesByStageId.get(row.id) ?? [])]
          .sort((left, right) => left.sort_order - right.sort_order)
          .map((expense) => ({
            id: expense.id, stageId: row.id, name: expense.name, category: expense.category,
            amountCents: expense.amount_cents, sortOrder: expense.sort_order,
          })),
      };
    } else {
      stage = {
        ...base,
        kind: 'choice',
        selectedVariantId: row.selected_variant_id,
        variants: (variantRowsByStageId.get(row.id) ?? [])
          .map((variant) => variants.get(variant.id)!)
          .sort((left, right) => left.sortOrder - right.sortOrder),
      };
    }
    const group = stagesByPlanId.get(row.plan_id) ?? [];
    group.push(stage);
    stagesByPlanId.set(row.plan_id, group);
  }

  const plans = planRows.map((row) => ({
    id: row.id, structureKind: row.structure_kind, title: row.title, notes: row.notes,
    dateKey: row.date_key, time: row.time,
    isAllDay: row.is_all_day === 1, status: row.status, completedAt: row.completed_at,
    isFeatured: row.is_featured === 1, accent: row.accent, icon: row.icon,
    stages: [...(stagesByPlanId.get(row.id) ?? [])]
      .sort((left, right) => left.sortOrder - right.sortOrder),
  }));
  for (const plan of plans) validatePlanAggregate(plan);
  return plans;
}

/** Repository 依赖的最小 SQLite 接口，便于单元测试使用替身。 */
type QueryDatabase = {
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  runAsync(source: string, ...params: unknown[]): Promise<{ changes: number }>;
  withTransactionAsync?(task: () => Promise<void>): Promise<void>;
  withExclusiveTransactionAsync?(task: (txn: QueryDatabase) => Promise<void>): Promise<void>;
};

/** Repository 运行时能力；web 可显式关闭不受支持的 exclusive transaction。 */
export type PlanRepositoryCapabilities = { exclusiveTransactions?: boolean };

// Expo regular transaction 不是独占连接；按根 db 排队可阻止不同 Repository 实例互相穿插 SQL。
const databaseQueues = new WeakMap<object, Promise<void>>();

async function serializeDatabase<T>(db: QueryDatabase, task: () => Promise<T>): Promise<T> {
  const previous = databaseQueues.get(db) ?? Promise.resolve();
  const result = previous.then(task);
  const tail = result.then(() => undefined, () => undefined);
  databaseQueues.set(db, tail);
  return result.finally(() => {
    if (databaseQueues.get(db) === tail) databaseQueues.delete(db);
  });
}

/** 先查计划主表，再按实际 ID 分层读取阶段、方案和两类费用。 */
async function queryPlans(db: QueryDatabase, whereClause: string, ...params: unknown[]) {
  const plans = await db.getAllAsync<PlanRow>(
    `SELECT id, structure_kind, title, notes, date_key, time, is_all_day, status, completed_at, is_featured, accent, icon
     FROM plans WHERE ${whereClause}
     ORDER BY date_key, id`,
    ...params,
  );
  if (!plans.length) return [];
  const placeholders = plans.map(() => '?').join(', ');
  const planIds = plans.map((plan) => plan.id);
  const stages = await db.getAllAsync<StageRow>(
    `SELECT id, plan_id, kind, name, notes, start_time, selected_variant_id, sort_order
     FROM journey_stages WHERE plan_id IN (${placeholders}) ORDER BY plan_id, sort_order`,
    ...planIds,
  );
  if (!stages.length) return hydratePlans(plans, [], [], [], []);
  const stagePlaceholders = stages.map(() => '?').join(', ');
  const stageIds = stages.map((stage) => stage.id);
  const [variants, stageExpenses] = await Promise.all([
    db.getAllAsync<VariantRow>(
      `SELECT id, stage_id, name, notes, sort_order FROM stage_variants
       WHERE stage_id IN (${stagePlaceholders}) ORDER BY stage_id, sort_order`,
      ...stageIds,
    ),
    db.getAllAsync<StageExpenseRow>(
      `SELECT id, stage_id, name, category, amount_cents, sort_order FROM stage_expenses
       WHERE stage_id IN (${stagePlaceholders}) ORDER BY stage_id, sort_order`,
      ...stageIds,
    ),
  ]);
  let variantExpenses: VariantExpenseRow[] = [];
  if (variants.length) {
    const variantPlaceholders = variants.map(() => '?').join(', ');
    variantExpenses = await db.getAllAsync<VariantExpenseRow>(
      `SELECT id, variant_id, name, category, amount_cents, sort_order FROM variant_expenses
       WHERE variant_id IN (${variantPlaceholders}) ORDER BY variant_id, sort_order`,
      ...variants.map((variant) => variant.id),
    );
  }
  return hydratePlans(plans, stages, variants, stageExpenses, variantExpenses);
}

/**
 * 在一致事务中执行任务：native 优先使用专用 txn，web/能力关闭时使用已串行化的 regular transaction。
 */
async function runTransaction<T>(
  db: QueryDatabase,
  exclusiveTransactions: boolean,
  task: (transactionDb: QueryDatabase) => Promise<T>,
): Promise<T> {
  let outcome: { value: T } | undefined;
  if (exclusiveTransactions && db.withExclusiveTransactionAsync) {
    await db.withExclusiveTransactionAsync(async (transactionDb) => {
      outcome = { value: await task(transactionDb) };
    });
    return outcome!.value;
  }
  if (!db.withTransactionAsync) throw new Error('当前数据库不支持事务写入');
  await db.withTransactionAsync(async () => {
    outcome = { value: await task(db) };
  });
  return outcome!.value;
}

/** 按外键顺序插入阶段子树；可选阶段最后回填当前选择。 */
async function insertPlanChildren(db: QueryDatabase, plan: Plan, now: number) {
  for (const stage of plan.stages) {
    await db.runAsync(
      `INSERT INTO journey_stages (
        id, plan_id, kind, name, notes, start_time, selected_variant_id, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      stage.id, plan.id, stage.kind, stage.name, stage.notes, stage.startTime, stage.sortOrder, now, now,
    );
    if (stage.kind === 'fixed') {
      for (const expense of stage.expenses) {
        await db.runAsync(
          `INSERT INTO stage_expenses (
            id, stage_id, name, category, amount_cents, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          expense.id, stage.id, expense.name, expense.category, expense.amountCents, expense.sortOrder, now, now,
        );
      }
      continue;
    }
    for (const variant of stage.variants) {
      await db.runAsync(
        `INSERT INTO stage_variants (id, stage_id, name, notes, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        variant.id, stage.id, variant.name, variant.notes, variant.sortOrder, now, now,
      );
      for (const expense of variant.expenses) {
        await db.runAsync(
          `INSERT INTO variant_expenses (
            id, variant_id, name, category, amount_cents, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          expense.id, variant.id, expense.name, expense.category, expense.amountCents, expense.sortOrder, now, now,
        );
      }
    }
    // SQL 同时验证计划、阶段和方案归属，阻止跨阶段方案 ID 被误写。
    if (stage.selectedVariantId) {
      const result = await db.runAsync(
        `UPDATE journey_stages SET selected_variant_id = ?, updated_at = ?
         WHERE id = ? AND plan_id = ? AND kind = 'choice'
           AND EXISTS (SELECT 1 FROM stage_variants WHERE id = ? AND stage_id = journey_stages.id)`,
        stage.selectedVariantId, now, stage.id, plan.id, stage.selectedVariantId,
      );
      if (result.changes !== 1) throw new Error('阶段方案归属校验失败');
    }
  }
}

/**
 * 按外键依赖顺序显式删除一个计划的完整子树。
 * exclusive transaction 使用新连接且可能关闭 foreign_keys，不能依赖 ON DELETE CASCADE。
 */
async function deletePlanChildren(db: QueryDatabase, planId: string) {
  await db.runAsync(
    `DELETE FROM variant_expenses
     WHERE variant_id IN (
       SELECT variant.id FROM stage_variants variant
       JOIN journey_stages stage ON stage.id = variant.stage_id
       WHERE stage.plan_id = ?
     )`,
    planId,
  );
  await db.runAsync(
    `DELETE FROM stage_expenses
     WHERE stage_id IN (SELECT id FROM journey_stages WHERE plan_id = ?)`,
    planId,
  );
  await db.runAsync(
    `DELETE FROM stage_variants
     WHERE stage_id IN (SELECT id FROM journey_stages WHERE plan_id = ?)`,
    planId,
  );
  await db.runAsync('DELETE FROM journey_stages WHERE plan_id = ?', planId);
}

/** 创建计划数据仓储，页面只能通过该接口读写 SQLite。 */
export function createPlanRepository(db: QueryDatabase, capabilities: PlanRepositoryCapabilities = {}) {
  const exclusiveTransactions = capabilities.exclusiveTransactions ?? process.env.EXPO_OS !== 'web';
  const readPlans = (whereClause: string, ...params: unknown[]) => serializeDatabase(
    db,
    () => runTransaction(db, exclusiveTransactions, (transactionDb) => queryPlans(transactionDb, whereClause, ...params)),
  );

  return {
    /** 查询指定月份需要在首页展示的非归档计划。 */
    getFeaturedPlans(monthKey: string) {
      return readPlans(`is_featured = 1 AND status != 'archived' AND date_key LIKE ?`, `${monthKey}-%`);
    },
    /** 查询指定日期的全部非归档日程。 */
    getPlansForDate(dateKey: string) {
      return readPlans(`status != 'archived' AND date_key = ?`, dateKey);
    },
    /** 按 ID 读取一个完整计划聚合，不存在时返回 null。 */
    async getPlan(planId: string) {
      const plans = await readPlans('id = ?', planId);
      return plans[0] ?? null;
    },
    /** 在一个事务中创建计划主记录及完整阶段子树。 */
    async createPlan(plan: Plan) {
      validatePlanAggregate(plan);
      return serializeDatabase(db, async () => {
        const now = Date.now();
        const time = plan.structureKind === 'journey' ? null : plan.time;
        const isAllDay = plan.structureKind === 'journey' ? 0 : plan.isAllDay ? 1 : 0;
        await runTransaction(db, exclusiveTransactions, async (transactionDb) => {
          await transactionDb.runAsync(
            `INSERT INTO plans (
              id, structure_kind, title, notes, date_key, time, is_all_day, status, completed_at,
              selected_option_id, is_featured, accent, icon, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
            plan.id, plan.structureKind, plan.title, plan.notes, plan.dateKey, time, isAllDay,
            plan.status, plan.completedAt, plan.isFeatured ? 1 : 0, plan.accent, plan.icon, now, now,
          );
          await insertPlanChildren(transactionDb, plan, now);
        });
        return plan.id;
      });
    },
    /** 更新可编辑主字段，并在同一事务中整体替换阶段子树。 */
    async updatePlan(plan: Plan) {
      validatePlanAggregate(plan);
      return serializeDatabase(db, async () => {
        const now = Date.now();
        const time = plan.structureKind === 'journey' ? null : plan.time;
        const isAllDay = plan.structureKind === 'journey' ? 0 : plan.isAllDay ? 1 : 0;
        await runTransaction(db, exclusiveTransactions, async (transactionDb) => {
          const result = await transactionDb.runAsync(
            `UPDATE plans SET structure_kind = ?, title = ?, notes = ?, date_key = ?, time = ?, is_all_day = ?,
               accent = ?, icon = ?, updated_at = ? WHERE id = ?`,
            plan.structureKind, plan.title, plan.notes, plan.dateKey, time, isAllDay,
            plan.accent, plan.icon, now, plan.id,
          );
          if (result.changes !== 1) throw new Error('计划不存在或更新失败');
          await deletePlanChildren(transactionDb, plan.id);
          await insertPlanChildren(transactionDb, plan, now);
        });
        return true;
      });
    },
    /** 只切换一个可选阶段的方案，并校验方案属于该计划的该阶段。 */
    async selectStageVariant(planId: string, stageId: string, variantId: string | null) {
      // SQL 同时验证计划结构、阶段类型及方案归属，任何一项不符都保持 changes = 0。
      return serializeDatabase(db, async () => {
        const result = variantId !== null
          ? await db.runAsync(
          `UPDATE journey_stages SET selected_variant_id = ?, updated_at = unixepoch() * 1000
           WHERE id = ? AND plan_id = ? AND kind = 'choice'
             AND EXISTS (SELECT 1 FROM plans
                         WHERE id = journey_stages.plan_id AND structure_kind = 'journey')
             AND EXISTS (SELECT 1 FROM stage_variants WHERE id = ? AND stage_id = journey_stages.id)`,
          variantId, stageId, planId, variantId,
        )
          : await db.runAsync(
          `UPDATE journey_stages SET selected_variant_id = NULL, updated_at = unixepoch() * 1000
           WHERE id = ? AND plan_id = ? AND kind = 'choice'
             AND EXISTS (SELECT 1 FROM plans
                         WHERE id = journey_stages.plan_id AND structure_kind = 'journey')`,
          stageId, planId,
        );
        return result.changes === 1;
      });
    },
    /** 在待执行与已完成之间切换，同时维护完成时间。 */
    async toggleCompleted(planId: string) {
      return serializeDatabase(db, async () => {
        // 单条 UPDATE 基于旧 status 同时计算两个字段，避免并发 SELECT/UPDATE 丢失切换。
        const updated = await db.getFirstAsync<{ status: PlanStatus }>(
          `UPDATE plans
           SET status = CASE WHEN status = 'completed' THEN 'pending' ELSE 'completed' END,
               completed_at = CASE WHEN status = 'completed' THEN NULL ELSE ? END,
               updated_at = unixepoch() * 1000
           WHERE id = ? AND structure_kind IN ('single', 'journey')
           RETURNING status`,
          Date.now(), planId,
        );
        if (!updated) throw new Error('计划不存在、结构无效或状态更新失败');
        return updated.status;
      });
    },
  };
}
