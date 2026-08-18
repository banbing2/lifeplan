/** 行程时间展示所需的最小阶段字段。 */
export type PlanTimeStage = {
  startTime: string | null;
  sortOrder: number;
};

/** 单次计划时间展示所需字段。 */
export type SinglePlanTimeInput = {
  structureKind: 'single';
  isAllDay: boolean;
  time: string | null;
};

/** 行程计划时间展示所需字段。 */
export type JourneyPlanTimeInput = {
  structureKind: 'journey';
  stages: readonly PlanTimeStage[];
};

/** 通过计划结构判别的时间展示输入。 */
export type PlanTimeInput = SinglePlanTimeInput | JourneyPlanTimeInput;

/** 日程分组；定时计划在前，全天或未设置时间的计划在后。 */
export type PlanDisplayTimeGroup = 'timed' | 'allDay';

/** 计划时间的展示文本和稳定排序字段。 */
export type PlanDisplayTime = {
  label: string;
  group: PlanDisplayTimeGroup;
  sortKey: string | null;
};

/** 根据计划结构生成统一的时间展示、分组和排序字段。 */
export function getPlanDisplayTime(plan: PlanTimeInput): PlanDisplayTime {
  if (plan.structureKind === 'single') {
    if (plan.isAllDay) return { label: '全天', group: 'allDay', sortKey: null };
    if (plan.time) return { label: plan.time, group: 'timed', sortKey: plan.time };
    return { label: '时间未设置', group: 'allDay', sortKey: null };
  }

  let firstTimedStage: PlanTimeStage | undefined;
  for (const stage of plan.stages) {
    if (!stage.startTime) continue;
    if (!firstTimedStage || stage.sortOrder < firstTimedStage.sortOrder) {
      firstTimedStage = stage;
    }
  }

  return firstTimedStage?.startTime
    ? { label: `${firstTimedStage.startTime} 开始`, group: 'timed', sortKey: firstTimedStage.startTime }
    : { label: '时间未设置', group: 'allDay', sortKey: null };
}

/**
 * 返回按展示时间稳定排序的新数组，不改变计划或阶段的输入顺序。
 */
export function sortPlansByDisplayTime<T extends PlanTimeInput>(plans: readonly T[]): T[] {
  return plans
    .map((plan, inputOrder) => ({ plan, inputOrder, displayTime: getPlanDisplayTime(plan) }))
    .sort((left, right) => {
      if (left.displayTime.group !== right.displayTime.group) {
        return left.displayTime.group === 'timed' ? -1 : 1;
      }
      if (left.displayTime.sortKey !== right.displayTime.sortKey) {
        return (left.displayTime.sortKey ?? '').localeCompare(right.displayTime.sortKey ?? '');
      }
      return left.inputOrder - right.inputOrder;
    })
    .map(({ plan }) => plan);
}
