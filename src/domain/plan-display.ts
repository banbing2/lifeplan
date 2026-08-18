import { calculateJourneyBudget } from './journey-budget';
import type { JourneyStage, PlanStatus, PlanStructureKind } from './models';

type PlanDisplaySource = {
  structureKind: PlanStructureKind;
  stages: JourneyStage[];
  status: PlanStatus;
};

/** 页面状态：草稿、待选择、待执行或已完成。 */
export type PlanDisplayStatus = 'draft' | 'unselected' | 'pending' | 'completed';

/** 将持久化状态与阶段完整性合并为页面使用的展示状态。 */
export function getPlanDisplayStatus(plan: PlanDisplaySource): PlanDisplayStatus {
  if (plan.status === 'completed') return 'completed';
  if (plan.structureKind === 'single') return 'pending';
  if (!plan.stages.length) return 'draft';
  if (calculateJourneyBudget(plan.stages).unselectedStageCount) return 'unselected';
  return 'pending';
}
