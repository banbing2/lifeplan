import type { PlanFormChoiceStage, PlanFormFixedStage, PlanFormStage } from './plan-form';

/** 创建指定类型的空阶段草稿。 */
export function createEmptyStage(kind: 'fixed' | 'choice', id: string): PlanFormStage {
  const base = { id, name: '', notes: '', startTime: '' };
  if (kind === 'fixed') return { ...base, kind, expenses: [] };
  return { ...base, kind, selectedVariantId: null, variants: [] };
}

/** 按偏移量移动阶段；越界时原样返回，避免 UI 产生非法排序。 */
export function moveStage(stages: PlanFormStage[], index: number, offset: number) {
  const destination = index + offset;
  if (index < 0 || index >= stages.length || destination < 0 || destination >= stages.length) return stages;
  const next = [...stages];
  const [stage] = next.splice(index, 1);
  next.splice(destination, 0, stage);
  return next;
}

/** 删除方案；若删除的是当前方案，同时清空选择状态。 */
export function removeVariant(stage: PlanFormChoiceStage, index: number): PlanFormChoiceStage {
  const removed = stage.variants[index];
  if (!removed) return stage;
  return {
    ...stage,
    selectedVariantId: stage.selectedVariantId === removed.id ? null : stage.selectedVariantId,
    variants: stage.variants.filter((_, variantIndex) => variantIndex !== index),
  };
}

/** 将固定阶段转为可选阶段，并把原费用放入自动选中的“默认方案”。 */
export function convertFixedStageToChoice(stage: PlanFormFixedStage, variantId: string): PlanFormChoiceStage {
  return {
    id: stage.id,
    kind: 'choice',
    name: stage.name,
    notes: stage.notes,
    startTime: stage.startTime,
    selectedVariantId: variantId,
    variants: [{ id: variantId, name: '默认方案', notes: '', expenses: stage.expenses }],
  };
}

/** 将可选阶段转为固定阶段，只保留用户指定方案的费用。 */
export function convertChoiceStageToFixed(stage: PlanFormChoiceStage, retainedVariantId: string): PlanFormFixedStage {
  return {
    id: stage.id,
    kind: 'fixed',
    name: stage.name,
    notes: stage.notes,
    startTime: stage.startTime,
    expenses: stage.variants.find((variant) => variant.id === retainedVariantId)?.expenses ?? [],
  };
}

/** 不可变地替换一个阶段，确保其他阶段引用保持不变。 */
export function updateStage(stages: PlanFormStage[], index: number, nextStage: PlanFormStage) {
  return stages.map((stage, stageIndex) => (stageIndex === index ? nextStage : stage));
}
