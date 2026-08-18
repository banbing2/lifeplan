import type { JourneyStage } from './models';

/** 阶段预算计算结果，区分已确定金额与可计入月度汇总的最终金额。 */
export type JourneyBudget = {
  fixedTotalCents: number;
  selectedVariantsTotalCents: number;
  confirmedTotalCents: number;
  finalTotalCents: number | null;
  unselectedStageCount: number;
};

/** 汇总一组以“分”为单位的费用，避免浮点金额误差。 */
function sumExpenses(expenses: readonly { amountCents: number }[]) {
  return expenses.reduce((total, expense) => total + expense.amountCents, 0);
}

/**
 * 根据阶段组合计算计划预算。
 * 存在任意未选可选阶段时，finalTotalCents 返回 null，但仍保留已确定金额。
 */
export function calculateJourneyBudget(stages: readonly JourneyStage[]): JourneyBudget {
  let fixedTotalCents = 0;
  let selectedVariantsTotalCents = 0;
  let unselectedStageCount = 0;

  for (const stage of stages) {
    if (stage.kind === 'fixed') {
      fixedTotalCents += sumExpenses(stage.expenses);
      continue;
    }

    const selected = stage.variants.find((variant) => variant.id === stage.selectedVariantId);
    if (!selected) {
      unselectedStageCount += 1;
      continue;
    }
    selectedVariantsTotalCents += sumExpenses(selected.expenses);
  }

  const confirmedTotalCents = fixedTotalCents + selectedVariantsTotalCents;
  return {
    fixedTotalCents,
    selectedVariantsTotalCents,
    confirmedTotalCents,
    finalTotalCents: unselectedStageCount ? null : confirmedTotalCents,
    unselectedStageCount,
  };
}
