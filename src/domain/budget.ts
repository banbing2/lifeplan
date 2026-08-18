import { calculateJourneyBudget } from './journey-budget';
import type { JourneyBudget } from './journey-budget';
import type { ExpenseCategory, JourneyStage, PlanStructureKind } from './models';

/** 月度汇总所需的最小计划字段。 */
export type PlanSummaryInput = {
  status: 'pending' | 'completed' | 'archived';
  finalTotalCents: number | null;
};

/** 结构感知预算计算所需的最小计划聚合字段。 */
export type PlanBudgetInput = {
  structureKind: PlanStructureKind;
  stages: readonly JourneyStage[];
};

/** 费用分类表格的领域标识和中文标签。 */
export type ExpenseCategoryRow = {
  category: ExpenseCategory;
  label: string;
};

const expenseCategoryDefinitions: readonly ExpenseCategoryRow[] = [
  { category: 'transport', label: '交通' },
  { category: 'ticket', label: '门票' },
  { category: 'food', label: '餐饮' },
  { category: 'lodging', label: '住宿' },
  { category: 'activity', label: '活动' },
  { category: 'shopping', label: '商品' },
  { category: 'other', label: '其他' },
];

/** 根据实际费用内容返回需要展示的分类，隐藏没有使用的分类。 */
export function getExpenseCategoryRows(
  groups: readonly { expenses: readonly { category: ExpenseCategory; [key: string]: unknown }[] }[],
): ExpenseCategoryRow[] {
  const usedCategories = new Set(groups.flatMap((group) => group.expenses.map((expense) => expense.category)));
  return expenseCategoryDefinitions.filter((row) => usedCategories.has(row.category));
}

/** 首页月度预算与完成进度统计结果。 */
export type MonthlySummary = {
  totalBudgetCents: number;
  planCount: number;
  completedCount: number;
  pendingCount: number;
  completionPercent: number;
};

/** 汇总单个方案费用；保留此方法供旧版显示逻辑和兼容测试使用。 */
export function calculateOptionTotal(items: readonly { amountCents: number }[]): number {
  return items.reduce((total, item) => total + item.amountCents, 0);
}

/**
 * 计算完整计划的预算；空行程仍是草稿，单次计划的零费用则是确定金额。
 */
export function calculatePlanBudget(plan: PlanBudgetInput): JourneyBudget {
  const budget = calculateJourneyBudget(plan.stages);
  return plan.structureKind === 'journey' && !plan.stages.length
    ? { ...budget, finalTotalCents: null }
    : budget;
}

/**
 * 计算月度汇总，仅纳入未归档且预算已确定的计划，确定的零金额仍计数。
 */
export function calculateMonthlySummary(plans: readonly PlanSummaryInput[]): MonthlySummary {
  const activePlans = plans.filter(
    (plan): plan is PlanSummaryInput & { finalTotalCents: number } =>
      plan.status !== 'archived' && plan.finalTotalCents !== null,
  );
  const completedCount = activePlans.filter((plan) => plan.status === 'completed').length;

  return {
    totalBudgetCents: activePlans.reduce(
      (total, plan) => total + plan.finalTotalCents,
      0,
    ),
    planCount: activePlans.length,
    completedCount,
    pendingCount: activePlans.length - completedCount,
    completionPercent: activePlans.length
      ? Math.round((completedCount / activePlans.length) * 100)
      : 0,
  };
}

/** 将整数分格式化为人民币文本，可选择是否保留两位小数。 */
export function formatMoney(amountCents: number, showDecimals = false): string {
  return `¥${(amountCents / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })}`;
}
