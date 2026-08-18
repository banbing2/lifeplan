import type { JourneyPlanFormDraft, SinglePlanFormDraft } from './plan-form';

const JOURNEY_TO_SINGLE_REASON = '仅一个固定阶段时可切换为单次计划';

/** 行程转单次的结果联合；失败时只返回原因，不产生部分转换草稿。 */
export type JourneyToSingleResult =
  | { ok: true; draft: SinglePlanFormDraft }
  | { ok: false; reason: string };

/** 判断行程是否能无损转换为单次计划，可直接用于禁用入口提示。 */
export function getJourneyToSingleConversionReason(draft: JourneyPlanFormDraft): string | null {
  return draft.stages.length === 1 && draft.stages[0].kind === 'fixed'
    ? null
    : JOURNEY_TO_SINGLE_REASON;
}

/** 将单次计划的隐式阶段显式化，保留阶段和费用身份及顺序。 */
export function convertSingleToJourney(draft: SinglePlanFormDraft): JourneyPlanFormDraft {
  const { implicitStageId, implicitStageName, implicitStageNotes, time, isAllDay, expenses, ...base } = draft;
  return {
    ...base,
    structureKind: 'journey',
    stages: [{
      id: implicitStageId,
      kind: 'fixed',
      name: implicitStageName ?? draft.title,
      notes: implicitStageNotes,
      startTime: isAllDay ? '' : time,
      expenses: expenses.map((expense) => ({ ...expense })),
    }],
  };
}

/** 仅把唯一固定阶段折叠为单次计划，拒绝可能丢数据的其他行程结构。 */
export function convertJourneyToSingle(draft: JourneyPlanFormDraft): JourneyToSingleResult {
  const reason = getJourneyToSingleConversionReason(draft);
  if (reason) return { ok: false, reason };

  const stage = draft.stages[0];
  if (stage.kind !== 'fixed') return { ok: false, reason: JOURNEY_TO_SINGLE_REASON };
  const { stages: _stages, ...base } = draft;
  return {
    ok: true,
    draft: {
      ...base,
      structureKind: 'single',
      implicitStageId: stage.id,
      implicitStageName: stage.name,
      implicitStageNotes: stage.notes,
      time: stage.startTime || '09:00',
      isAllDay: stage.startTime === '',
      expenses: stage.expenses.map((expense) => ({ ...expense })),
    },
  };
}
