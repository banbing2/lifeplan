import { describe, expect, it } from 'vitest';

import type { PlanFormChoiceStage, PlanFormFixedStage } from './plan-form';
import { convertChoiceStageToFixed, convertFixedStageToChoice, createEmptyStage, moveStage, removeVariant, updateStage } from './stage-form-actions';

const fixed: PlanFormFixedStage = {
  id: 'fixed', kind: 'fixed', name: '去程', notes: '', startTime: '08:00',
  expenses: [{ id: 'metro', name: '地铁', category: 'transport', amountYuan: '15.00' }],
};
const choice: PlanFormChoiceStage = {
  id: 'choice', kind: 'choice', name: '午餐', notes: '', startTime: '12:00', selectedVariantId: 'a',
  variants: [{ id: 'a', name: '套餐A', notes: '', expenses: [] }, { id: 'b', name: '套餐B', notes: '', expenses: [] }],
};

describe('stage form actions', () => {
  it('creates empty fixed and choice stages', () => {
    expect(createEmptyStage('fixed', 'fixed-id')).toMatchObject({ id: 'fixed-id', kind: 'fixed', expenses: [] });
    expect(createEmptyStage('choice', 'choice-id')).toMatchObject({ id: 'choice-id', kind: 'choice', variants: [], selectedVariantId: null });
  });

  it('moves stages without changing their data', () => {
    expect(moveStage([fixed, choice], 1, -1).map((stage) => stage.id)).toEqual(['choice', 'fixed']);
    expect(moveStage([fixed, choice], 0, -1).map((stage) => stage.id)).toEqual(['fixed', 'choice']);
  });

  it('clears selection when removing the selected variant', () => {
    expect(removeVariant(choice, 0)).toMatchObject({ selectedVariantId: null, variants: [{ id: 'b' }] });
  });

  it('preserves expenses in a selected default variant when converting fixed to choice', () => {
    const converted = convertFixedStageToChoice(fixed, 'default');
    expect(converted).toMatchObject({ kind: 'choice', selectedVariantId: 'default' });
    expect(converted.variants[0]).toMatchObject({ id: 'default', name: '默认方案', expenses: fixed.expenses });
  });

  it('keeps only the requested variant expenses when converting choice to fixed', () => {
    const withExpense: PlanFormChoiceStage = { ...choice, variants: [choice.variants[0], { ...choice.variants[1], expenses: fixed.expenses }] };
    expect(convertChoiceStageToFixed(withExpense, 'b')).toMatchObject({ kind: 'fixed', expenses: fixed.expenses });
  });

  it('updates one stage without changing another stage reference', () => {
    const result = updateStage([fixed, choice], 0, { ...fixed, name: '新去程' });
    expect(result[0].name).toBe('新去程');
    expect(result[1]).toBe(choice);
  });
});
