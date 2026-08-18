import type { Plan } from '../domain/models';
import { seedPlans } from './seed-data';

/** 当前 SQLite 结构版本，只有迁移和校验全部成功后才会更新。 */
const DATABASE_VERSION = 4;

/** 数据库迁移所需的最小 Expo SQLite 接口。 */
type MigrationDatabase = {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

/**
 * 将数据库顺序升级到当前版本。
 * v1 到 v4 按顺序补齐，数据转换、校验和最终版本发布位于同一事务中。
 */
export async function migrateDatabase(db: MigrationDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  await db.withTransactionAsync(async () => {
    // 空库的 v1 基础表也属于 0 -> 3 原子升级，后续失败时必须一并回滚。
    if (currentVersion === 0) await createVersion1Schema(db);
    if (currentVersion < 2) await createVersion2Schema(db);

    const countRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM plans');
    const isFreshDatabase = currentVersion === 0 && (countRow?.count ?? 0) === 0;
    if (!isFreshDatabase && currentVersion < 2) {
      await migrateLegacyData(db);
    }

    if (currentVersion < 3) {
      // 先补显式结构列再写 v3 种子，避免默认 single 暂存行程计划。
      await createVersion3Schema(db);
      await snapshotVersion2Data(db);
      if (isFreshDatabase) await insertSeedPlans(db);
      else await migrateVersion2Data(db);
      await validateVersion3Data(db);
    }
    if (currentVersion < 4) await createVersion4Schema(db);
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}

/** 创建只保存一份全局外观偏好的 v4 设置表。 */
async function createVersion4Schema(db: MigrationDatabase) {
  await db.execAsync(`
    CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      color_mode TEXT NOT NULL CHECK (color_mode IN ('system', 'light', 'dark')),
      color_scheme TEXT NOT NULL CHECK (color_scheme IN ('green', 'blue', 'coral', 'neutral')),
      font_size TEXT NOT NULL CHECK (font_size IN ('small', 'standard', 'large')),
      font_weight TEXT NOT NULL CHECK (font_weight IN ('standard', 'bold')),
      updated_at TEXT NOT NULL
    );
    INSERT INTO app_settings (
      id, color_mode, color_scheme, font_size, font_weight, updated_at
    ) VALUES (1, 'system', 'green', 'standard', 'standard', CURRENT_TIMESTAMP);
  `);
}

/** 创建旧版基础结构，供全新数据库沿用唯一升级路径。旧表暂不删除，便于恢复。 */
async function createVersion1Schema(db: MigrationDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      date_key TEXT NOT NULL,
      time TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'archived')),
      completed_at INTEGER,
      selected_option_id TEXT,
      is_featured INTEGER NOT NULL DEFAULT 1,
      accent TEXT NOT NULL,
      icon TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plan_options (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expense_items (
      id TEXT PRIMARY KEY NOT NULL,
      option_id TEXT NOT NULL REFERENCES plan_options(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_plans_date_key ON plans(date_key);
    CREATE INDEX IF NOT EXISTS idx_options_plan_id ON plan_options(plan_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_option_id ON expense_items(option_id);
  `);
}

/** 创建阶段模型的权威表、外键和查询索引。 */
async function createVersion2Schema(db: MigrationDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS journey_stages (
      id TEXT PRIMARY KEY NOT NULL,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('fixed', 'choice')),
      name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      start_time TEXT,
      selected_variant_id TEXT REFERENCES stage_variants(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (kind = 'choice' OR selected_variant_id IS NULL)
    );
    CREATE TABLE IF NOT EXISTS stage_variants (
      id TEXT PRIMARY KEY NOT NULL,
      stage_id TEXT NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stage_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      stage_id TEXT NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS variant_expenses (
      id TEXT PRIMARY KEY NOT NULL,
      variant_id TEXT NOT NULL REFERENCES stage_variants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stages_plan_id ON journey_stages(plan_id);
    CREATE INDEX IF NOT EXISTS idx_stages_selected_variant_id ON journey_stages(selected_variant_id);
    CREATE INDEX IF NOT EXISTS idx_variants_stage_id ON stage_variants(stage_id);
    CREATE INDEX IF NOT EXISTS idx_stage_expenses_stage_id ON stage_expenses(stage_id);
    CREATE INDEX IF NOT EXISTS idx_variant_expenses_variant_id ON variant_expenses(variant_id);
  `);
}

/** 增加计划结构判别列；user_version 保证 ALTER TABLE 在成功升级路径上只执行一次。 */
async function createVersion3Schema(db: MigrationDatabase) {
  await db.execAsync(`
    ALTER TABLE plans ADD COLUMN structure_kind TEXT NOT NULL DEFAULT 'single'
      CHECK (structure_kind IN ('single', 'journey'));
  `);
}

/** 在任何 v3 数据改写前保存归属、数量和金额基线，供事务提交前逐项核对。 */
async function snapshotVersion2Data(db: MigrationDatabase) {
  await db.execAsync(`
    DROP TABLE IF EXISTS temp.migration_v3_plan_structure;
    DROP TABLE IF EXISTS temp.migration_v3_plan_counts;
    DROP TABLE IF EXISTS temp.migration_v3_stages;
    DROP TABLE IF EXISTS temp.migration_v3_variants;
    DROP TABLE IF EXISTS temp.migration_v3_stage_expenses;
    DROP TABLE IF EXISTS temp.migration_v3_variant_expenses;

    CREATE TEMP TABLE migration_v3_plan_structure AS
      SELECT p.id AS plan_id,
        CASE WHEN EXISTS (SELECT 1 FROM journey_stages s WHERE s.plan_id = p.id)
          THEN 'journey' ELSE 'single' END AS structure_kind
      FROM plans p;

    CREATE TEMP TABLE migration_v3_plan_counts AS
      SELECT p.id AS plan_id,
        (SELECT COUNT(*) FROM journey_stages s WHERE s.plan_id = p.id) AS stage_count,
        (SELECT COUNT(*) FROM stage_variants v
          JOIN journey_stages s ON s.id = v.stage_id WHERE s.plan_id = p.id) AS variant_count,
        (SELECT COUNT(*) FROM stage_expenses e
          JOIN journey_stages s ON s.id = e.stage_id WHERE s.plan_id = p.id) AS stage_expense_count,
        (SELECT COUNT(*) FROM variant_expenses e
          JOIN stage_variants v ON v.id = e.variant_id
          JOIN journey_stages s ON s.id = v.stage_id WHERE s.plan_id = p.id) AS variant_expense_count
      FROM plans p
      WHERE EXISTS (SELECT 1 FROM journey_stages s WHERE s.plan_id = p.id);

    CREATE TEMP TABLE migration_v3_stages AS
      SELECT id, plan_id FROM journey_stages;
    CREATE TEMP TABLE migration_v3_variants AS
      SELECT id, stage_id FROM stage_variants;
    CREATE TEMP TABLE migration_v3_stage_expenses AS
      SELECT id, stage_id, amount_cents FROM stage_expenses;
    CREATE TEMP TABLE migration_v3_variant_expenses AS
      SELECT id, variant_id, amount_cents FROM variant_expenses;
  `);
}

/** 将 v2 计划集合迁移为显式 single 或 journey，并规范化各自的时间权威字段。 */
async function migrateVersion2Data(db: MigrationDatabase) {
  await db.runAsync(`
    UPDATE plans
    SET structure_kind = CASE
      WHEN EXISTS (SELECT 1 FROM journey_stages s WHERE s.plan_id = plans.id) THEN 'journey'
      ELSE 'single'
    END
  `);

  // 只给排序最前且尚无时间的阶段复制旧计划时间，已有阶段时间保持不变。
  await db.runAsync(`
    UPDATE journey_stages
    SET start_time = (SELECT p.time FROM plans p WHERE p.id = journey_stages.plan_id)
    WHERE id = (
      SELECT first_stage.id
      FROM journey_stages first_stage
      WHERE first_stage.plan_id = journey_stages.plan_id
      ORDER BY first_stage.sort_order, first_stage.id
      LIMIT 1
    )
      AND start_time IS NULL
      AND EXISTS (
        SELECT 1 FROM plans p
        WHERE p.id = journey_stages.plan_id
          AND p.structure_kind = 'journey'
          AND p.time IS NOT NULL
      )
  `);

  await db.runAsync(`
    UPDATE plans
    SET time = NULL, is_all_day = 0
    WHERE structure_kind = 'journey'
  `);

  // single 复用确定性 ID，NOT EXISTS 同时保护重试路径不生成重复隐式阶段。
  await db.runAsync(`
    INSERT INTO journey_stages (
      id, plan_id, kind, name, notes, start_time, selected_variant_id,
      sort_order, created_at, updated_at
    )
    SELECT 'single-stage-' || p.id, p.id, 'fixed', p.title, '', NULL, NULL,
      0, p.created_at, p.updated_at
    FROM plans p
    WHERE p.structure_kind = 'single'
      AND NOT EXISTS (SELECT 1 FROM journey_stages s WHERE s.plan_id = p.id)
  `);
}

/** 提交前校验结构、子树数量、金额和外键归属；任一失败都会触发事务回滚。 */
async function validateVersion3Data(db: MigrationDatabase) {
  const structureMismatch = await db.getFirstAsync<{ count: number }>(`
    SELECT
      (SELECT COUNT(*)
        FROM migration_v3_plan_structure old
        LEFT JOIN plans current ON current.id = old.plan_id
        WHERE current.id IS NULL OR current.structure_kind != old.structure_kind)
      + (SELECT COUNT(*)
        FROM plans current
        WHERE current.structure_kind = 'single'
          AND (
            (SELECT COUNT(*) FROM journey_stages s WHERE s.plan_id = current.id) != 1
            OR EXISTS (
              SELECT 1 FROM journey_stages s
              WHERE s.plan_id = current.id AND s.kind != 'fixed'
            )
          )
      ) AS count
  `);
  if ((structureMismatch?.count ?? 0) !== 0) throw new Error('计划结构校验失败');

  const countMismatch = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) AS count
    FROM migration_v3_plan_counts old
    WHERE old.stage_count !=
        (SELECT COUNT(*) FROM journey_stages s WHERE s.plan_id = old.plan_id)
      OR old.variant_count !=
        (SELECT COUNT(*) FROM stage_variants v
          JOIN journey_stages s ON s.id = v.stage_id WHERE s.plan_id = old.plan_id)
      OR old.stage_expense_count !=
        (SELECT COUNT(*) FROM stage_expenses e
          JOIN journey_stages s ON s.id = e.stage_id WHERE s.plan_id = old.plan_id)
      OR old.variant_expense_count !=
        (SELECT COUNT(*) FROM variant_expenses e
          JOIN stage_variants v ON v.id = e.variant_id
          JOIN journey_stages s ON s.id = v.stage_id WHERE s.plan_id = old.plan_id)
  `);
  if ((countMismatch?.count ?? 0) !== 0) throw new Error('行程阶段数量校验失败');

  const amountMismatch = await db.getFirstAsync<{ count: number }>(`
    SELECT
      (SELECT COUNT(*) FROM migration_v3_stage_expenses old
        LEFT JOIN stage_expenses current ON current.id = old.id
        WHERE current.id IS NULL OR current.amount_cents != old.amount_cents)
      + (SELECT COUNT(*) FROM migration_v3_variant_expenses old
        LEFT JOIN variant_expenses current ON current.id = old.id
        WHERE current.id IS NULL OR current.amount_cents != old.amount_cents)
      AS count
  `);
  if ((amountMismatch?.count ?? 0) !== 0) throw new Error('费用金额校验失败');

  // SQLite 外键只能确认方案存在，还需确认被选方案确实属于当前 choice 阶段。
  const selectionMismatch = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) AS count
    FROM journey_stages stage
    WHERE stage.selected_variant_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM stage_variants variant
        WHERE variant.id = stage.selected_variant_id
          AND variant.stage_id = stage.id
      )
  `);
  if ((selectionMismatch?.count ?? 0) !== 0) throw new Error('阶段选择归属校验失败');

  const ownershipMismatch = await db.getFirstAsync<{ count: number }>(`
    SELECT
      (SELECT COUNT(*) FROM migration_v3_stages old
        LEFT JOIN journey_stages current ON current.id = old.id
        WHERE current.id IS NULL OR current.plan_id != old.plan_id)
      + (SELECT COUNT(*) FROM migration_v3_variants old
        LEFT JOIN stage_variants current ON current.id = old.id
        WHERE current.id IS NULL OR current.stage_id != old.stage_id)
      + (SELECT COUNT(*) FROM migration_v3_stage_expenses old
        LEFT JOIN stage_expenses current ON current.id = old.id
        WHERE current.id IS NULL OR current.stage_id != old.stage_id)
      + (SELECT COUNT(*) FROM migration_v3_variant_expenses old
        LEFT JOIN variant_expenses current ON current.id = old.id
        WHERE current.id IS NULL OR current.variant_id != old.variant_id)
      + (SELECT COUNT(*) FROM pragma_foreign_key_check)
      AS count
  `);
  if ((ownershipMismatch?.count ?? 0) !== 0) throw new Error('费用外键归属校验失败');
}

/**
 * 把每个旧计划的全局方案迁移为一个“行程方案”可选阶段。
 * 先以空选择创建阶段，方案写完后再回填 selected_variant_id，避免循环外键顺序问题。
 */
async function migrateLegacyData(db: MigrationDatabase) {
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO journey_stages (
       id, plan_id, kind, name, notes, start_time, selected_variant_id, sort_order, created_at, updated_at
     )
     SELECT 'legacy-stage-' || p.id, p.id, 'choice', '行程方案', '', p.time, NULL, 0, ?, ?
     FROM plans p
     WHERE EXISTS (SELECT 1 FROM plan_options o WHERE o.plan_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM journey_stages s WHERE s.plan_id = p.id)`,
    now,
    now,
  );
  await db.runAsync(
    `INSERT INTO stage_variants (id, stage_id, name, notes, sort_order, created_at, updated_at)
     SELECT o.id, 'legacy-stage-' || o.plan_id, o.name, o.notes, o.sort_order, o.created_at, o.updated_at
     FROM plan_options o
     WHERE NOT EXISTS (SELECT 1 FROM stage_variants v WHERE v.id = o.id)`,
  );
  await db.runAsync(
    `INSERT INTO variant_expenses (id, variant_id, name, category, amount_cents, sort_order, created_at, updated_at)
     SELECT e.id, e.option_id, e.name, e.category, e.amount_cents, e.sort_order, e.created_at, e.updated_at
     FROM expense_items e
     WHERE NOT EXISTS (SELECT 1 FROM variant_expenses ve WHERE ve.id = e.id)`,
  );
  await db.runAsync(
    `UPDATE journey_stages
     SET selected_variant_id = (
       SELECT p.selected_option_id FROM plans p WHERE p.id = journey_stages.plan_id
     ), updated_at = ?
     WHERE id LIKE 'legacy-stage-%'
       AND EXISTS (
         SELECT 1 FROM stage_variants v
         JOIN plans p ON p.selected_option_id = v.id
         WHERE v.stage_id = journey_stages.id AND p.id = journey_stages.plan_id
       )`,
    now,
  );

  // 在提交前逐计划核对方案数、费用数、金额合计和选择映射，防止静默丢数据。
  const mismatch = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) AS count FROM plans p
    WHERE
      (SELECT COUNT(*) FROM plan_options o WHERE o.plan_id = p.id) !=
      (SELECT COUNT(*) FROM stage_variants v JOIN journey_stages s ON s.id = v.stage_id WHERE s.plan_id = p.id)
      OR (SELECT COUNT(*) FROM expense_items e JOIN plan_options o ON o.id = e.option_id WHERE o.plan_id = p.id) !=
         (SELECT COUNT(*) FROM variant_expenses ve JOIN stage_variants v ON v.id = ve.variant_id JOIN journey_stages s ON s.id = v.stage_id WHERE s.plan_id = p.id)
      OR COALESCE((SELECT SUM(e.amount_cents) FROM expense_items e JOIN plan_options o ON o.id = e.option_id WHERE o.plan_id = p.id), 0) !=
         COALESCE((SELECT SUM(ve.amount_cents) FROM variant_expenses ve JOIN stage_variants v ON v.id = ve.variant_id JOIN journey_stages s ON s.id = v.stage_id WHERE s.plan_id = p.id), 0)
      OR (p.selected_option_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM journey_stages s WHERE s.plan_id = p.id AND s.selected_variant_id = p.selected_option_id
      ))
  `);
  if ((mismatch?.count ?? 0) !== 0) throw new Error('旧计划数据迁移校验失败');
}

/** 全新安装直接写入阶段化种子，不再先生成旧方案数据。 */
async function insertSeedPlans(db: MigrationDatabase) {
  const now = Date.now();
  for (const plan of seedPlans) {
    await db.runAsync(
      `INSERT INTO plans (
        id, structure_kind, title, notes, date_key, time, is_all_day, status, completed_at,
        selected_option_id, is_featured, accent, icon, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      plan.id, plan.structureKind, plan.title, plan.notes, plan.dateKey, plan.time, plan.isAllDay ? 1 : 0, plan.status,
      plan.completedAt, plan.isFeatured ? 1 : 0, plan.accent, plan.icon, now, now,
    );
    await insertStageTree(db, plan, now);
  }
}

/** 按外键依赖顺序写入计划的完整阶段子树。 */
async function insertStageTree(db: MigrationDatabase, plan: Plan, now: number) {
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
    // 方案全部存在后再设置选择，并通过 SQL 再次验证方案确实属于当前阶段。
    if (stage.selectedVariantId) {
      await db.runAsync(
        `UPDATE journey_stages SET selected_variant_id = ?, updated_at = ?
         WHERE id = ? AND EXISTS (SELECT 1 FROM stage_variants WHERE id = ? AND stage_id = ?)`,
        stage.selectedVariantId, now, stage.id, stage.selectedVariantId, stage.id,
      );
    }
  }
}
