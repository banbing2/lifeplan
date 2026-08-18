import type {
  ExpenseCategory,
  JourneyStage,
  Plan,
  PlanAccent,
  PlanIcon,
  StageVariant,
} from './models';

/** 费用表单 DTO，金额保留为输入框字符串。 */
export type PlanFormExpense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  amountYuan: string;
};

/** 可选阶段方案的表单 DTO。 */
export type PlanFormVariant = {
  id: string;
  name: string;
  notes: string;
  expenses: PlanFormExpense[];
};

/** 固定阶段和可选阶段共用的表单字段。 */
type PlanFormStageBase = {
  id: string;
  name: string;
  notes: string;
  startTime: string;
};

/** 固定阶段表单，费用直接挂在阶段下。 */
export type PlanFormFixedStage = PlanFormStageBase & {
  kind: 'fixed';
  expenses: PlanFormExpense[];
};

/** 可选阶段表单，保存多个方案及当前选择。 */
export type PlanFormChoiceStage = PlanFormStageBase & {
  kind: 'choice';
  selectedVariantId: string | null;
  variants: PlanFormVariant[];
};

/** 通过 kind 判别的阶段表单联合类型。 */
export type PlanFormStage = PlanFormFixedStage | PlanFormChoiceStage;

/** 两种计划草稿共用的页面字段。 */
export type PlanFormBase = {
  id: string;
  title: string;
  notes: string;
  dateKey: string;
  accent: PlanAccent;
  icon: PlanIcon;
};

/** 单次计划草稿；隐式阶段 ID 仅用于稳定持久化身份，不在界面展示。 */
export type SinglePlanFormDraft = PlanFormBase & {
  structureKind: 'single';
  implicitStageId: string;
  /** null 仅用于直接新建，表示隐式阶段名称跟随首次保存时的计划标题。 */
  implicitStageName: string | null;
  /** 行程折叠为单次时保留的阶段备注，不在单次编辑器展示。 */
  implicitStageNotes: string;
  time: string;
  isAllDay: boolean;
  expenses: PlanFormExpense[];
};

/** 行程计划草稿，时间只保存在各阶段。 */
export type JourneyPlanFormDraft = PlanFormBase & {
  structureKind: 'journey';
  stages: PlanFormStage[];
};

/** 通过 structureKind 判别的完整计划表单联合类型。 */
export type PlanFormDraft = SinglePlanFormDraft | JourneyPlanFormDraft;

/** 校验模式及日期边界上下文。 */
export type PlanValidationContext = {
  mode: 'create' | 'edit';
  todayKey: string;
  originalDateKey?: string;
};

/** 校验错误以字段路径为键，供嵌套编辑器精准标红。 */
export type PlanValidationErrors = Record<string, string>;

/** 日期、时间和金额输入的格式约束。 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const YUAN_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const MAX_AMOUNT_CENTS = 999_999_999;

/** 创建单次计划界面使用的空费用行。 */
function createBlankSingleExpense(planId: string): PlanFormExpense {
  return { id: `single-expense-${planId}`, name: '', category: 'other', amountYuan: '' };
}

/** 名称和金额都为空才是占位空行，分类不参与判断。 */
export function isBlankExpense(expense: PlanFormExpense) {
  return expense.name.trim() === '' && expense.amountYuan.trim() === '';
}

/** 在校验与持久化边界统一移除界面占位空行。 */
export function filterBlankExpenses(expenses: PlanFormExpense[]) {
  return expenses.filter((expense) => !isBlankExpense(expense));
}

/**
 * 将用户输入的元转换为整数分。
 * 只接受非负金额和最多两位小数，超出数据库安全范围时返回 null。
 */
export function parseYuanToCents(value: string) {
  const normalized = value.trim();
  if (!YUAN_PATTERN.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  return cents <= MAX_AMOUNT_CENTS ? cents : null;
}

/** 创建默认全天的单次计划草稿，并提供一条可直接输入的空费用行。 */
export function createEmptyPlanDraft({ id, dateKey }: { id: string; dateKey: string }): SinglePlanFormDraft {
  return {
    id,
    structureKind: 'single',
    implicitStageId: `single-stage-${id}`,
    implicitStageName: null,
    implicitStageNotes: '',
    title: '',
    notes: '',
    dateKey,
    time: '09:00',
    isAllDay: true,
    accent: 'green',
    icon: 'star',
    expenses: [createBlankSingleExpense(id)],
  };
}

/**
 * 校验完整计划草稿，错误键使用字段路径。
 * 编辑旧计划时允许保留原有过去日期，但不允许改成另一个过去日期。
 */
export function validatePlanDraft(draft: PlanFormDraft, context: PlanValidationContext): PlanValidationErrors {
  const errors: PlanValidationErrors = {};

  if (!draft.title.trim()) errors.title = '请输入计划名称';
  else if (draft.title.trim().length > 50) errors.title = '计划名称不能超过50个字';
  if (draft.notes.length > 500) errors.notes = '备注不能超过500个字';
  if (!DATE_PATTERN.test(draft.dateKey)) errors.dateKey = '请选择有效日期';
  else if (context.mode === 'create' && draft.dateKey < context.todayKey) errors.dateKey = '不能新建过去日期的计划';
  else if (
    context.mode === 'edit'
    && draft.dateKey < context.todayKey
    && draft.dateKey !== context.originalDateKey
  ) errors.dateKey = '不能改为过去日期';

  if (draft.structureKind === 'single') {
    if (!draft.isAllDay && !TIME_PATTERN.test(draft.time)) errors.time = '请选择有效时间';
    validateExpenses(draft.expenses, 'expenses', errors);
    return errors;
  }

  draft.stages.forEach((stage, stageIndex) => {
    const prefix = `stages.${stageIndex}`;
    validateNamedItem(stage, prefix, '阶段', errors);
    if (stage.notes.length > 200) errors[`${prefix}.notes`] = '阶段备注不能超过200个字';
    if (stage.startTime && !TIME_PATTERN.test(stage.startTime)) errors[`${prefix}.startTime`] = '请选择有效时间';

    if (stage.kind === 'fixed') {
      validateExpenses(stage.expenses, `${prefix}.expenses`, errors);
      return;
    }

    if (stage.selectedVariantId && !stage.variants.some((variant) => variant.id === stage.selectedVariantId)) {
      errors[`${prefix}.selectedVariantId`] = '请选择当前阶段内的有效方案';
    }
    stage.variants.forEach((variant, variantIndex) => {
      const variantPrefix = `${prefix}.variants.${variantIndex}`;
      validateNamedItem(variant, variantPrefix, '方案', errors);
      if (variant.notes.length > 200) errors[`${variantPrefix}.notes`] = '方案备注不能超过200个字';
      validateExpenses(variant.expenses, `${variantPrefix}.expenses`, errors);
    });
  });

  return errors;
}

/**
 * 将页面草稿转换为持久化领域对象。
 * 新建计划默认进入首页；编辑时继承完成状态、完成时间和原首页展示标记。
 */
export function planFromDraft(draft: PlanFormDraft, existing?: Plan): Plan {
  const shared = {
    id: draft.id,
    structureKind: draft.structureKind,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    dateKey: draft.dateKey,
    status: existing?.status ?? 'pending' as const,
    completedAt: existing?.completedAt ?? null,
    isFeatured: existing?.isFeatured ?? true,
    accent: draft.accent,
    icon: draft.icon,
  };

  if (draft.structureKind === 'single') {
    return {
      ...shared,
      structureKind: 'single',
      time: draft.isAllDay ? null : draft.time,
      isAllDay: draft.isAllDay,
      stages: [singleStageFromDraft(draft)],
    };
  }

  return {
    ...shared,
    structureKind: 'journey',
    time: null,
    isAllDay: false,
    stages: draft.stages.map((stage, stageIndex) => stageFromDraft(stage, draft.id, stageIndex)),
  };
}

/** 将数据库领域对象按显式结构类型回填为可编辑的字符串草稿。 */
export function planToDraft(plan: Plan): PlanFormDraft {
  const base: PlanFormBase = {
    id: plan.id,
    title: plan.title,
    notes: plan.notes,
    dateKey: plan.dateKey,
    accent: plan.accent,
    icon: plan.icon,
  };

  if (plan.structureKind === 'single') {
    const stage = [...plan.stages]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .find((candidate) => candidate.kind === 'fixed');
    const expenses = stage?.kind === 'fixed' ? expensesToDraft(stage.expenses) : [];
    // 普通单次阶段由计划标题派生；只有独立名称或备注才作为行程往返元数据保留。
    const hasIndependentStageMetadata = Boolean(
      stage && (stage.name !== plan.title || stage.notes !== ''),
    );
    return {
      ...base,
      structureKind: 'single',
      implicitStageId: stage?.id ?? `single-stage-${plan.id}`,
      implicitStageName: hasIndependentStageMetadata ? stage?.name ?? null : null,
      implicitStageNotes: hasIndependentStageMetadata ? stage?.notes ?? '' : '',
      time: plan.time ?? '09:00',
      isAllDay: plan.isAllDay,
      expenses: expenses.length ? expenses : [createBlankSingleExpense(plan.id)],
    };
  }

  return {
    ...base,
    structureKind: 'journey',
    stages: [...plan.stages]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(stageToDraft),
  };
}

/** 校验阶段或方案的通用名称规则。 */
function validateNamedItem(
  item: { name: string },
  prefix: string,
  label: '阶段' | '方案',
  errors: PlanValidationErrors,
) {
  if (!item.name.trim()) errors[`${prefix}.name`] = `请输入${label}名称`;
  else if (item.name.trim().length > 30) errors[`${prefix}.name`] = `${label}名称不能超过30个字`;
}

/** 校验非空费用，并保留原数组索引作为错误路径。 */
function validateExpenses(expenses: PlanFormExpense[], prefix: string, errors: PlanValidationErrors) {
  expenses.forEach((expense, expenseIndex) => {
    if (isBlankExpense(expense)) return;
    const expensePrefix = `${prefix}.${expenseIndex}`;
    if (!expense.name.trim()) errors[`${expensePrefix}.name`] = '请输入费用名称';
    if (parseYuanToCents(expense.amountYuan) === null) {
      errors[`${expensePrefix}.amountYuan`] = '请输入有效金额，最多两位小数';
    }
  });
}

/** 把单次草稿写入一个身份稳定且不承载时间的固定阶段。 */
function singleStageFromDraft(draft: SinglePlanFormDraft): JourneyStage {
  return {
    id: draft.implicitStageId,
    planId: draft.id,
    kind: 'fixed',
    name: (draft.implicitStageName ?? draft.title).trim(),
    notes: draft.implicitStageNotes.trim(),
    startTime: null,
    sortOrder: 0,
    expenses: filterBlankExpenses(draft.expenses).map((expense, expenseIndex) => ({
      ...expenseFromDraft(expense, expenseIndex),
      stageId: draft.implicitStageId,
    })),
  };
}

/** 把固定或可选阶段草稿转换为判别联合类型。 */
function stageFromDraft(stage: PlanFormStage, planId: string, sortOrder: number): JourneyStage {
  const base = {
    id: stage.id,
    planId,
    name: stage.name.trim(),
    notes: stage.notes.trim(),
    startTime: stage.startTime || null,
    sortOrder,
  };
  if (stage.kind === 'fixed') {
    return {
      ...base,
      kind: 'fixed',
      expenses: filterBlankExpenses(stage.expenses).map((expense, expenseIndex) => ({
        ...expenseFromDraft(expense, expenseIndex),
        stageId: stage.id,
      })),
    };
  }
  return {
    ...base,
    kind: 'choice',
    selectedVariantId: stage.selectedVariantId,
    variants: stage.variants.map((variant, variantIndex) => variantFromDraft(variant, stage.id, variantIndex)),
  };
}

/** 把方案草稿及其非空费用转换为领域对象。 */
function variantFromDraft(variant: PlanFormVariant, stageId: string, sortOrder: number): StageVariant {
  return {
    id: variant.id,
    stageId,
    name: variant.name.trim(),
    notes: variant.notes.trim(),
    sortOrder,
    expenses: filterBlankExpenses(variant.expenses).map((expense, expenseIndex) => ({
      ...expenseFromDraft(expense, expenseIndex),
      variantId: variant.id,
    })),
  };
}

/** 把表单金额文本转换成整数分费用字段。 */
function expenseFromDraft(expense: PlanFormExpense, sortOrder: number) {
  return {
    id: expense.id,
    name: expense.name.trim(),
    category: expense.category,
    amountCents: parseYuanToCents(expense.amountYuan) ?? 0,
    sortOrder,
  };
}

/** 将一个持久化阶段转换为阶段草稿。 */
function stageToDraft(stage: JourneyStage): PlanFormStage {
  const base = {
    id: stage.id,
    name: stage.name,
    notes: stage.notes,
    startTime: stage.startTime ?? '',
  };
  if (stage.kind === 'fixed') {
    return { ...base, kind: 'fixed', expenses: expensesToDraft(stage.expenses) };
  }
  return {
    ...base,
    kind: 'choice',
    selectedVariantId: stage.selectedVariantId,
    variants: [...stage.variants]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        notes: variant.notes,
        expenses: expensesToDraft(variant.expenses),
      })),
  };
}

/** 将整数分费用按顺序转换为固定两位小数的输入文本。 */
function expensesToDraft(
  expenses: readonly {
    id: string;
    name: string;
    category: ExpenseCategory;
    amountCents: number;
    sortOrder: number;
  }[],
) {
  return [...expenses]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((expense) => ({
      id: expense.id,
      name: expense.name,
      category: expense.category,
      amountYuan: (expense.amountCents / 100).toFixed(2),
    }));
}
