import { Plus } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import type { JourneyPlanFormDraft, PlanFormExpense, PlanFormStage, PlanValidationErrors } from '../../domain/plan-form';
import { radii, spacing } from '../../theme/tokens';
import { JourneyStageEditor } from './journey-stage-editor';

type Props = {
  draft: JourneyPlanFormDraft;
  errors: PlanValidationErrors;
  onChange: (draft: JourneyPlanFormDraft) => void;
};

type StageIds = { stageId: string; variantId: string; expenseId: string };

/** 行程计划仅编辑阶段时间和阶段费用，不渲染计划级时间。 */
export function JourneyPlanEditor({ draft, errors, onChange }: Props) {
  const { styles } = useThemedStyles(createStyles);
  const [pendingFocusExpenseId, setPendingFocusExpenseId] = useState<string | null>(null);

  /** 新阶段自带可填写费用，并把焦点交给该费用名称输入框。 */
  const addStage = (kind: 'fixed' | 'choice') => {
    const ids = {
      stageId: createId('stage'),
      variantId: createId('variant'),
      expenseId: createId('expense'),
    };
    onChange({ ...draft, stages: [...draft.stages, createJourneyStageDraft(kind, ids)] });
    setPendingFocusExpenseId(ids.expenseId);
  };

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>行程与费用</Text>
          <Text style={styles.hint}>{draft.stages.length ? `共 ${draft.stages.length} 个阶段` : '无阶段时将保存为草稿'}</Text>
        </View>
        <View style={styles.actions}>
          <AddStageButton label="固定阶段" onPress={() => addStage('fixed')} />
          <AddStageButton label="可选阶段" onPress={() => addStage('choice')} />
        </View>
      </View>
      {draft.stages.map((stage, index) => (
        <JourneyStageEditor
          key={stage.id}
          count={draft.stages.length}
          errors={errors}
          focusExpenseId={pendingFocusExpenseId}
          index={index}
          onChange={(nextStage) => onChange({
            ...draft,
            stages: draft.stages.map((item, itemIndex) => itemIndex === index ? nextStage : item),
          })}
          onFocusHandled={() => setPendingFocusExpenseId(null)}
          onRemove={() => onChange({ ...draft, stages: draft.stages.filter((_, itemIndex) => itemIndex !== index) })}
          onMove={(offset) => onChange({ ...draft, stages: moveStage(draft.stages, index, offset) })}
          stage={stage}
        />
      ))}
      {!draft.stages.length ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>将保存为草稿</Text>
          <Text style={styles.hint}>添加阶段后即可记录每一段的时间与费用。</Text>
        </View>
      ) : null}
    </View>
  );
}

/** 创建带首条空费用的阶段，保证新增后无需二次点击即可录入。 */
export function createJourneyStageDraft(kind: 'fixed' | 'choice', ids: StageIds): PlanFormStage {
  const expense: PlanFormExpense = { id: ids.expenseId, name: '', category: 'other', amountYuan: '' };
  const base = { id: ids.stageId, name: '', notes: '', startTime: '' };
  if (kind === 'fixed') return { ...base, kind, expenses: [expense] };
  return {
    ...base,
    kind,
    selectedVariantId: null,
    variants: [{ id: ids.variantId, name: '', notes: '', expenses: [expense] }],
  };
}

/** 移动阶段时保持数组和阶段对象的其他字段不变。 */
function moveStage(stages: PlanFormStage[], index: number, offset: number) {
  const destination = index + offset;
  if (destination < 0 || destination >= stages.length) return stages;
  const next = [...stages];
  const [stage] = next.splice(index, 1);
  next.splice(destination, 0, stage);
  return next;
}

/** 阶段新增按钮保持紧凑，同时提供完整可访问名称。 */
function AddStageButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <Pressable accessibilityLabel={`添加${label}`} onPress={onPress} style={styles.add}>
      <Plus size={14} color={theme.colors.primaryDark} />
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}

/** 本地实体 ID 仅需在当前草稿中保持唯一。 */
function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  section: { marginTop: spacing.lg },
  heading: { marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: theme.colors.text },
  hint: { marginTop: 2, fontSize: 10, lineHeight: 15, color: theme.colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.xs },
  add: { minHeight: 38, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: theme.colors.primary, borderRadius: radii.md },
  addText: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark },
  notice: { padding: spacing.lg, borderRadius: radii.md, backgroundColor: theme.colors.warningLight },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.warning },
  });
}
