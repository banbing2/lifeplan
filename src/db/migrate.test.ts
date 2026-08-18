import { describe, expect, it } from 'vitest';

import { migrateDatabase } from './migrate';

type SqlRow = Record<string, bigint | number | string | null>;
type SqliteStatement = {
  all(...params: unknown[]): SqlRow[];
  get(...params: unknown[]): SqlRow | undefined;
  run(...params: unknown[]): unknown;
};
type SqliteDatabase = {
  exec(source: string): void;
  prepare(source: string): SqliteStatement;
};

declare const process: {
  getBuiltinModule(name: 'node:sqlite'): {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
};

// 测试使用 Node 24 内建 SQLite 执行真实 SQL，不把 Node 类型加入应用编译环境。
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

describe('migrateDatabase', () => {
  it('upgrades v3 to v4 without repeating the plans table alteration', async () => {
    const db = createV3Database();

    await migrateDatabase(db);

    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(4);
    expect(db.events.some((source) => source.includes('ADD COLUMN structure_kind'))).toBe(false);
    expect(db.row('SELECT color_mode, color_scheme, font_size, font_weight FROM app_settings WHERE id = 1')).toEqual({
      color_mode: 'system',
      color_scheme: 'green',
      font_size: 'standard',
      font_weight: 'standard',
    });
  });

  it('upgrades a v2 database in one transaction and publishes version 4 last', async () => {
    const db = createV2Database();

    await migrateDatabase(db);

    expect(db.transactions).toBe(1);
    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(4);
    expect(db.events.at(-1)).toContain('PRAGMA user_version = 4');
    expect(db.columns('plans')).toContain('structure_kind');
    expect(db.execSources.join('\n').replace(/\s+/g, ' ')).toContain(
      "structure_kind TEXT NOT NULL DEFAULT 'single' CHECK (structure_kind IN ('single', 'journey'))",
    );
  });

  it('enforces the structure_kind check constraint in SQLite', async () => {
    const db = createV2Database();
    await migrateDatabase(db);

    expect(() => db.sqlite.exec(
      "UPDATE plans SET structure_kind = 'invalid' WHERE id = 'single-plan'",
    )).toThrow(/CHECK constraint failed/);
  });

  it('marks staged plans as journey, copies only missing first-stage time, and clears plan time', async () => {
    const db = createV2Database();

    await migrateDatabase(db);

    expect(db.row("SELECT structure_kind, time, is_all_day FROM plans WHERE id = 'journey-copy'")).toEqual({
      structure_kind: 'journey', time: null, is_all_day: 0,
    });
    expect(db.value<string>("SELECT start_time FROM journey_stages WHERE id = 'copy-first'", 'start_time')).toBe('08:30');
    expect(db.value<string>("SELECT start_time FROM journey_stages WHERE id = 'copy-second'", 'start_time')).toBe('14:00');

    expect(db.row("SELECT structure_kind, time, is_all_day FROM plans WHERE id = 'journey-keep'")).toEqual({
      structure_kind: 'journey', time: null, is_all_day: 0,
    });
    expect(db.value<string>("SELECT start_time FROM journey_stages WHERE id = 'keep-first'", 'start_time')).toBe('09:00');
  });

  it('marks an unstaged plan as single and creates one deterministic empty fixed stage', async () => {
    const db = createV2Database();

    await migrateDatabase(db);

    expect(db.row("SELECT structure_kind, time, is_all_day FROM plans WHERE id = 'single-plan'")).toEqual({
      structure_kind: 'single', time: '10:30', is_all_day: 1,
    });
    expect(db.row("SELECT id, kind, start_time FROM journey_stages WHERE plan_id = 'single-plan'")).toEqual({
      id: 'single-stage-single-plan', kind: 'fixed', start_time: null,
    });
    expect(db.value<number>("SELECT COUNT(*) AS count FROM stage_expenses WHERE stage_id = 'single-stage-single-plan'", 'count')).toBe(0);

    await migrateDatabase(db);
    expect(db.transactions).toBe(1);
    expect(db.value<number>("SELECT COUNT(*) AS count FROM journey_stages WHERE plan_id = 'single-plan'", 'count')).toBe(1);
  });

  it('preserves the journey stage tree, expense amounts, and ownership', async () => {
    const db = createV2Database();
    const before = migrationPayload(db);

    await migrateDatabase(db);

    expect(migrationPayload(db)).toEqual(before);
  });

  it.each([
    ['结构', `
      CREATE TRIGGER break_structure AFTER UPDATE OF structure_kind ON plans
      WHEN NEW.id = 'journey-copy'
      BEGIN UPDATE plans SET structure_kind = 'single' WHERE id = NEW.id; END;
    `, '结构校验失败'],
    ['阶段数量', `
      CREATE TRIGGER break_stage_count AFTER INSERT ON journey_stages
      WHEN NEW.plan_id = 'single-plan'
      BEGIN DELETE FROM journey_stages WHERE id = 'copy-second'; END;
    `, '阶段数量校验失败'],
    ['费用金额', `
      CREATE TRIGGER break_expense_amount AFTER UPDATE OF structure_kind ON plans
      WHEN NEW.id = 'journey-copy'
      BEGIN UPDATE stage_expenses SET amount_cents = amount_cents + 1 WHERE id = 'fixed-expense'; END;
    `, '费用金额校验失败'],
    ['外键归属', `
      CREATE TRIGGER break_expense_owner AFTER UPDATE OF structure_kind ON plans
      WHEN NEW.id = 'journey-copy'
      BEGIN UPDATE stage_expenses SET stage_id = 'copy-second' WHERE id = 'fixed-expense'; END;
    `, '费用外键归属校验失败'],
  ])('rolls back and does not publish v3 when %s validation fails', async (_name, sabotageSql, message) => {
    const db = createV2Database();
    db.sqlite.exec(sabotageSql);

    await expect(migrateDatabase(db)).rejects.toThrow(message);

    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(2);
    expect(db.columns('plans')).not.toContain('structure_kind');
    expect(db.execSources.some((source) => source.includes('PRAGMA user_version = 4'))).toBe(false);
  });

  it('can retry successfully after a validation failure is repaired', async () => {
    const db = createV2Database();
    db.sqlite.exec(`
      CREATE TRIGGER break_structure AFTER UPDATE OF structure_kind ON plans
      WHEN NEW.id = 'journey-copy'
      BEGIN UPDATE plans SET structure_kind = 'single' WHERE id = NEW.id; END;
    `);

    await expect(migrateDatabase(db)).rejects.toThrow('结构校验失败');
    db.sqlite.exec('DROP TRIGGER break_structure');
    await migrateDatabase(db);

    expect(db.transactions).toBe(2);
    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(4);
    expect(db.value<string>(
      "SELECT structure_kind FROM plans WHERE id = 'journey-copy'",
      'structure_kind',
    )).toBe('journey');
  });

  it('rejects a selected variant owned by another stage even when foreign keys are valid', async () => {
    const db = createV2Database();
    db.sqlite.exec(`
      INSERT INTO journey_stages (
        id, plan_id, kind, name, notes, start_time, selected_variant_id,
        sort_order, created_at, updated_at
      ) VALUES ('copy-third', 'journey-copy', 'choice', '第三段', '', NULL, NULL, 2, 1, 1);
      INSERT INTO stage_variants (
        id, stage_id, name, notes, sort_order, created_at, updated_at
      ) VALUES ('variant-b', 'copy-third', '方案 B', '', 0, 1, 1);
      UPDATE journey_stages SET selected_variant_id = 'variant-b' WHERE id = 'copy-second';
    `);
    expect(db.value<number>('SELECT COUNT(*) AS count FROM pragma_foreign_key_check', 'count')).toBe(0);

    await expect(migrateDatabase(db)).rejects.toThrow('阶段选择归属校验失败');

    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(2);
    expect(db.columns('plans')).not.toContain('structure_kind');
  });

  it('rejects deletion of a snapshotted plan and rolls the deletion back', async () => {
    const db = createV2Database();
    db.sqlite.exec(`
      CREATE TRIGGER delete_snapshotted_plan AFTER UPDATE OF structure_kind ON plans
      WHEN NEW.id = 'single-plan'
      BEGIN DELETE FROM plans WHERE id = NEW.id; END;
    `);

    await expect(migrateDatabase(db)).rejects.toThrow('计划结构校验失败');

    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(2);
    expect(db.value<number>(
      "SELECT COUNT(*) AS count FROM plans WHERE id = 'single-plan'",
      'count',
    )).toBe(1);
  });

  it('rejects pre-existing broken foreign-key ownership without publishing v3', async () => {
    const db = createV2Database();
    db.sqlite.exec(`
      PRAGMA foreign_keys = OFF;
      INSERT INTO stage_expenses (
        id, stage_id, name, category, amount_cents, sort_order, created_at, updated_at
      ) VALUES ('orphan-expense', 'missing-stage', '损坏费用', 'other', 100, 0, 1, 1);
    `);

    await expect(migrateDatabase(db)).rejects.toThrow('费用外键归属校验失败');
    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(2);
  });

  it('upgrades v1 legacy options through v2 before classifying the resulting journey', async () => {
    const db = createV1Database();

    await migrateDatabase(db);

    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(4);
    expect(db.value<string>("SELECT structure_kind FROM plans WHERE id = 'legacy-plan'", 'structure_kind')).toBe('journey');
    expect(db.row("SELECT kind, start_time, selected_variant_id FROM journey_stages WHERE plan_id = 'legacy-plan'")).toEqual({
      kind: 'choice', start_time: '07:45', selected_variant_id: 'legacy-option',
    });
    expect(db.value<number>("SELECT amount_cents FROM variant_expenses WHERE id = 'legacy-expense'", 'amount_cents')).toBe(1234);
    expect(db.row("SELECT id, plan_id, name FROM plan_options WHERE id = 'legacy-option'")).toEqual({
      id: 'legacy-option', plan_id: 'legacy-plan', name: '旧方案',
    });
    expect(db.row("SELECT id, option_id, amount_cents FROM expense_items WHERE id = 'legacy-expense'")).toEqual({
      id: 'legacy-expense', option_id: 'legacy-option', amount_cents: 1234,
    });
  });

  it('rolls back every v1-v4 schema change when empty-database seeding fails', async () => {
    const db = new TestDatabase();
    db.failRunContaining = 'INSERT INTO plans';

    await expect(migrateDatabase(db)).rejects.toThrow('测试注入写入失败');

    expect(db.transactions).toBe(1);
    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(0);
    expect(db.value<number>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'",
      'count',
    )).toBe(0);
  });

  it('initializes an empty database as v4 and adds structure_kind before inserting seeds', async () => {
    const db = new TestDatabase();

    await migrateDatabase(db);

    const addColumnIndex = db.events.findIndex((source) => source.includes('ADD COLUMN structure_kind'));
    const seedInsertIndex = db.events.findIndex((source) => source.includes('INSERT INTO plans'));
    expect(addColumnIndex).toBeGreaterThanOrEqual(0);
    expect(seedInsertIndex).toBeGreaterThan(addColumnIndex);
    expect(db.value<number>('PRAGMA user_version', 'user_version')).toBe(4);
    expect(db.value<number>("SELECT COUNT(*) AS count FROM plans WHERE structure_kind = 'journey' AND time IS NULL AND is_all_day = 0", 'count')).toBe(9);
    expect(db.value<string>("SELECT start_time FROM journey_stages WHERE plan_id = 'weekend-trip'", 'start_time')).toBe('08:30');
  });
});

class TestDatabase {
  readonly sqlite = new DatabaseSync(':memory:');
  readonly execSources: string[] = [];
  readonly runSources: string[] = [];
  readonly events: string[] = [];
  transactions = 0;
  failRunContaining: string | null = null;

  async execAsync(source: string) {
    this.execSources.push(source);
    this.events.push(source);
    this.sqlite.exec(source);
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]) {
    return (this.sqlite.prepare(source).get(...params) ?? null) as T | null;
  }

  async runAsync(source: string, ...params: unknown[]) {
    this.runSources.push(source);
    this.events.push(source);
    if (this.failRunContaining && source.includes(this.failRunContaining)) {
      throw new Error('测试注入写入失败');
    }
    return this.sqlite.prepare(source).run(...params);
  }

  async withTransactionAsync(task: () => Promise<void>) {
    this.transactions += 1;
    this.sqlite.exec('BEGIN');
    try {
      await task();
      this.sqlite.exec('COMMIT');
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  row(source: string) {
    return this.sqlite.prepare(source).get() as SqlRow | undefined;
  }

  value<T>(source: string, key: string) {
    return this.row(source)?.[key] as T;
  }

  columns(table: string) {
    return (this.sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name);
  }
}

function createV1Database() {
  const db = new TestDatabase();
  db.sqlite.exec(`${version1Schema()}
    INSERT INTO plans (
      id, title, notes, date_key, time, is_all_day, status, completed_at,
      selected_option_id, is_featured, accent, icon, created_at, updated_at
    ) VALUES ('legacy-plan', '旧计划', '', '2026-08-18', '07:45', 0, 'pending', NULL,
      'legacy-option', 1, 'green', 'image', 1, 1);
    INSERT INTO plan_options (id, plan_id, name, notes, sort_order, created_at, updated_at)
    VALUES ('legacy-option', 'legacy-plan', '旧方案', '', 0, 1, 1);
    INSERT INTO expense_items (
      id, option_id, name, category, amount_cents, sort_order, created_at, updated_at
    ) VALUES ('legacy-expense', 'legacy-option', '旧费用', 'other', 1234, 0, 1, 1);
    PRAGMA user_version = 1;
  `);
  return db;
}

function createV2Database() {
  const db = new TestDatabase();
  db.sqlite.exec(`${version1Schema()}${version2Schema()}
    INSERT INTO plans (
      id, title, notes, date_key, time, is_all_day, status, completed_at,
      selected_option_id, is_featured, accent, icon, created_at, updated_at
    ) VALUES
      ('journey-copy', '复制时间', '', '2026-08-18', '08:30', 1, 'pending', NULL, NULL, 1, 'green', 'image', 1, 1),
      ('journey-keep', '保留时间', '', '2026-08-18', '07:30', 1, 'pending', NULL, NULL, 1, 'blue', 'star', 1, 1),
      ('single-plan', '单次计划', '', '2026-08-18', '10:30', 1, 'pending', NULL, NULL, 1, 'orange', 'coffee', 1, 1);
    INSERT INTO journey_stages (
      id, plan_id, kind, name, notes, start_time, selected_variant_id, sort_order, created_at, updated_at
    ) VALUES
      ('copy-first', 'journey-copy', 'fixed', '第一段', '', NULL, NULL, 0, 1, 1),
      ('copy-second', 'journey-copy', 'choice', '第二段', '', '14:00', NULL, 1, 1, 1),
      ('keep-first', 'journey-keep', 'fixed', '已有时间', '', '09:00', NULL, 0, 1, 1);
    INSERT INTO stage_expenses (
      id, stage_id, name, category, amount_cents, sort_order, created_at, updated_at
    ) VALUES ('fixed-expense', 'copy-first', '车票', 'transport', 2500, 0, 1, 1);
    INSERT INTO stage_variants (id, stage_id, name, notes, sort_order, created_at, updated_at)
    VALUES ('variant-a', 'copy-second', '方案 A', '', 0, 1, 1);
    INSERT INTO variant_expenses (
      id, variant_id, name, category, amount_cents, sort_order, created_at, updated_at
    ) VALUES ('variant-expense', 'variant-a', '午餐', 'food', 3600, 0, 1, 1);
    UPDATE journey_stages SET selected_variant_id = 'variant-a' WHERE id = 'copy-second';
    PRAGMA user_version = 2;
  `);
  return db;
}

function createV3Database() {
  const db = createV2Database();
  db.sqlite.exec(`
    ALTER TABLE plans ADD COLUMN structure_kind TEXT NOT NULL DEFAULT 'single'
      CHECK (structure_kind IN ('single', 'journey'));
    PRAGMA user_version = 3;
  `);
  return db;
}

function migrationPayload(db: TestDatabase) {
  return {
    stages: db.sqlite.prepare("SELECT id, plan_id, kind, selected_variant_id, sort_order FROM journey_stages WHERE plan_id != 'single-plan' ORDER BY id").all(),
    variants: db.sqlite.prepare('SELECT id, stage_id, sort_order FROM stage_variants ORDER BY id').all(),
    stageExpenses: db.sqlite.prepare('SELECT id, stage_id, amount_cents, sort_order FROM stage_expenses ORDER BY id').all(),
    variantExpenses: db.sqlite.prepare('SELECT id, variant_id, amount_cents, sort_order FROM variant_expenses ORDER BY id').all(),
  };
}

function version1Schema() {
  return `
    PRAGMA foreign_keys = ON;
    CREATE TABLE plans (
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', date_key TEXT NOT NULL,
      time TEXT, is_all_day INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'archived')), completed_at INTEGER,
      selected_option_id TEXT, is_featured INTEGER NOT NULL DEFAULT 1, accent TEXT NOT NULL, icon TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE plan_options (
      id TEXT PRIMARY KEY NOT NULL, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE expense_items (
      id TEXT PRIMARY KEY NOT NULL, option_id TEXT NOT NULL REFERENCES plan_options(id) ON DELETE CASCADE,
      name TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
  `;
}

function version2Schema() {
  return `
    CREATE TABLE journey_stages (
      id TEXT PRIMARY KEY NOT NULL, plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('fixed', 'choice')), name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      start_time TEXT, selected_variant_id TEXT REFERENCES stage_variants(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      CHECK (kind = 'choice' OR selected_variant_id IS NULL)
    );
    CREATE TABLE stage_variants (
      id TEXT PRIMARY KEY NOT NULL, stage_id TEXT NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE stage_expenses (
      id TEXT PRIMARY KEY NOT NULL, stage_id TEXT NOT NULL REFERENCES journey_stages(id) ON DELETE CASCADE,
      name TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE variant_expenses (
      id TEXT PRIMARY KEY NOT NULL, variant_id TEXT NOT NULL REFERENCES stage_variants(id) ON DELETE CASCADE,
      name TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
  `;
}
