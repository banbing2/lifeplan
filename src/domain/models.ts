/** 计划持久化状态；阶段完整性产生的“草稿/待选择”不写入此字段。 */
export type PlanStatus = 'pending' | 'completed' | 'archived';
/** 计划编辑与持久化使用的显式结构判别类型。 */
export type PlanStructureKind = 'single' | 'journey';
/** 计划卡片可选主题色标识。 */
export type PlanAccent = 'green' | 'orange' | 'blue' | 'purple' | 'red' | 'teal';
/** 计划卡片可选图标标识。 */
export type PlanIcon = 'image' | 'utensils' | 'shopping-bag' | 'tent' | 'film' | 'gift' | 'star' | 'coffee';
/** 费用分类标识，用于输入选择和分类汇总。 */
export type ExpenseCategory = 'transport' | 'ticket' | 'food' | 'lodging' | 'activity' | 'shopping' | 'other';

/** 旧版全局方案费用，仅用于兼容数据库 v1 数据迁移。 */
export type ExpenseItem = {
  id: string;
  optionId: string;
  name: string;
  category: ExpenseCategory;
  amountCents: number;
  sortOrder: number;
};

/** 固定阶段费用，使用 stageId 明确归属于某个行程阶段。 */
export type StageExpenseItem = {
  id: string;
  stageId: string;
  name: string;
  category: ExpenseCategory;
  amountCents: number;
  sortOrder: number;
};

/** 可选方案费用，使用 variantId 明确归属于某个阶段方案。 */
export type VariantExpenseItem = {
  id: string;
  variantId: string;
  name: string;
  category: ExpenseCategory;
  amountCents: number;
  sortOrder: number;
};

/** 两种阶段共享的基础字段。 */
type JourneyStageBase = {
  id: string;
  planId: string;
  name: string;
  notes: string;
  startTime: string | null;
  sortOrder: number;
};

export type FixedJourneyStage = JourneyStageBase & {
  /** kind 是阶段联合类型的判别标签，fixed 表示费用必定发生。 */
  kind: 'fixed';
  expenses: StageExpenseItem[];
};

/** 可选阶段中的一个互斥执行方案。 */
export type StageVariant = {
  id: string;
  stageId: string;
  name: string;
  notes: string;
  sortOrder: number;
  expenses: VariantExpenseItem[];
};

export type ChoiceJourneyStage = JourneyStageBase & {
  /** choice 表示该阶段包含多个互斥方案，每个阶段独立选择。 */
  kind: 'choice';
  /** 当前执行方案；null 表示该阶段尚未决定，整项计划预算待定。 */
  selectedVariantId: string | null;
  variants: StageVariant[];
};

/** 通过 kind 字段判别的行程阶段联合类型。 */
export type JourneyStage = FixedJourneyStage | ChoiceJourneyStage;

/** 旧版全局方案类型，仅保留给 v1 数据迁移，不再作为权威领域模型。 */
export type PlanOption = {
  id: string;
  planId: string;
  name: string;
  notes: string;
  sortOrder: number;
  expenses: ExpenseItem[];
};

/** 页面和 Repository 之间传递的完整计划聚合根。 */
export type Plan = {
  id: string;
  structureKind: PlanStructureKind;
  title: string;
  notes: string;
  dateKey: string;
  time: string | null;
  isAllDay: boolean;
  status: PlanStatus;
  completedAt: number | null;
  isFeatured: boolean;
  accent: PlanAccent;
  icon: PlanIcon;
  /** 按 sortOrder 排列的任意行程阶段，是计划预算的唯一权威来源。 */
  stages: JourneyStage[];
};
