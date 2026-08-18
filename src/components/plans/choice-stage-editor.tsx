import { CheckCircle2, ChevronDown, Circle, Ellipsis, Plus, Trash2 } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/budget';
import { parseYuanToCents, type PlanFormChoiceStage, type PlanFormVariant, type PlanValidationErrors } from '../../domain/plan-form';
import { removeVariant } from '../../domain/stage-form-actions';
import { radii, spacing } from '../../theme/tokens';
import { ExpenseEditor, FormInput } from './expense-editor';

/** 编辑可选阶段的互斥方案，并确保新增方案立即可录入费用。 */
export function ChoiceStageEditor({ stage, stageIndex, errors, focusExpenseId, onFocusHandled, onChange }: {
  stage: PlanFormChoiceStage;
  stageIndex: number;
  errors: PlanValidationErrors;
  focusExpenseId?: string | null;
  onFocusHandled?: () => void;
  onChange: (stage: PlanFormChoiceStage) => void;
}) {
  const { styles, theme } = useThemedStyles(createStyles);
  const [localFocusExpenseId, setLocalFocusExpenseId] = useState<string | null>(null);
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);

  /** 新方案始终包含一条空费用，减少一次额外点击。 */
  const addVariant = () => {
    const expenseId = createId('expense');
    const variant = { id: createId('variant'), name: '', notes: '', expenses: [{ id: expenseId, name: '', category: 'other' as const, amountYuan: '' }] };
    onChange({ ...stage, variants: [...stage.variants, variant] });
    setLocalFocusExpenseId(expenseId);
  };
  /** 不可变地替换指定方案。 */
  const updateVariant = (index: number, variant: PlanFormVariant) => onChange({ ...stage, variants: stage.variants.map((item, itemIndex) => itemIndex === index ? variant : item) });

  return <View style={styles.body}>
    <View style={styles.heading}><View><Text style={styles.title}>阶段方案</Text><Text style={styles.hint}>{stage.selectedVariantId ? '已选择执行方案' : '请选择方案以确定预算'}</Text></View>
      <Pressable accessibilityLabel="添加方案" onPress={addVariant} style={styles.add}><Plus size={16} color={theme.colors.primaryDark} /><Text style={styles.addText}>添加方案</Text></Pressable>
    </View>
    {errors[`stages.${stageIndex}.selectedVariantId`] ? <Text style={styles.error}>{errors[`stages.${stageIndex}.selectedVariantId`]}</Text> : null}
    {stage.variants.map((variant, variantIndex) => {
      const selected = stage.selectedVariantId === variant.id;
      const total = variant.expenses.reduce((sum, expense) => sum + (parseYuanToCents(expense.amountYuan) ?? 0), 0);
      const prefix = `stages.${stageIndex}.variants.${variantIndex}`;
      const moreOpen = expandedVariantId === variant.id;
      return <View key={variant.id} style={[styles.variant, selected && styles.variantSelected]}>
        <View style={styles.variantHeader}>
          <Pressable accessibilityLabel={`选择${variant.name || `方案${variantIndex + 1}`}`} onPress={() => onChange({ ...stage, selectedVariantId: selected ? null : variant.id })} style={styles.radio}>{selected ? <CheckCircle2 size={21} color={theme.colors.primary} /> : <Circle size={21} color={theme.colors.textMuted} />}</Pressable>
          <FormInput compact error={errors[`${prefix}.name`]} label="方案名称" maxLength={30} onChangeText={(name) => updateVariant(variantIndex, { ...variant, name })} placeholder={`方案 ${variantIndex + 1}`} value={variant.name} />
          <Text style={styles.total}>{formatMoney(total, true)}</Text>
          <Pressable accessibilityLabel="方案更多操作" accessibilityState={{ expanded: moreOpen }} onPress={() => setExpandedVariantId(moreOpen ? null : variant.id)} style={styles.iconButton}>{moreOpen ? <ChevronDown size={18} color={theme.colors.textSecondary} /> : <Ellipsis size={18} color={theme.colors.textSecondary} />}</Pressable>
        </View>
        <View style={styles.variantBody}>
          {variant.expenses.map((expense, expenseIndex) => <ExpenseEditor key={expense.id} expense={expense} errorPrefix={`${prefix}.expenses.${expenseIndex}`} errors={errors} focusOnMount={expense.id === (localFocusExpenseId ?? focusExpenseId)} onChange={(next) => updateVariant(variantIndex, { ...variant, expenses: variant.expenses.map((item, itemIndex) => itemIndex === expenseIndex ? next : item) })} onFocusHandled={() => { setLocalFocusExpenseId(null); onFocusHandled?.(); }} onRemove={() => updateVariant(variantIndex, { ...variant, expenses: variant.expenses.filter((_, itemIndex) => itemIndex !== expenseIndex) })} />)}
          <Pressable accessibilityLabel="添加方案费用" onPress={() => { const expense = { id: createId('expense'), name: '', category: 'other' as const, amountYuan: '' }; updateVariant(variantIndex, { ...variant, expenses: [...variant.expenses, expense] }); setLocalFocusExpenseId(expense.id); }} style={styles.add}><Plus size={15} color={theme.colors.primaryDark} /><Text style={styles.addText}>添加费用</Text></Pressable>
          {moreOpen ? <View style={styles.more}><FormInput error={errors[`${prefix}.notes`]} label="方案备注" maxLength={200} multiline onChangeText={(notes) => updateVariant(variantIndex, { ...variant, notes })} placeholder="方案特点（选填）" value={variant.notes} /><Pressable accessibilityLabel="删除方案" onPress={() => confirmRemoveVariant(selected, () => onChange(removeVariant(stage, variantIndex)))} style={styles.delete}><Trash2 size={17} color={theme.colors.danger} /><Text style={styles.deleteText}>删除方案</Text></Pressable></View> : null}
        </View>
      </View>;
    })}
    {!stage.variants.length ? <Text style={styles.empty}>暂无方案，保存后该阶段将保持待选择</Text> : null}
  </View>;
}

/** 为新增方案或费用生成本地 ID。 */
function createId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
/** 删除已选方案时明确提示预算会恢复为待选择状态。 */
function confirmRemoveVariant(selected: boolean, onConfirm: () => void) {
  const message = selected ? '这是当前选择，删除后该阶段会恢复为待选择。是否继续？' : '方案内的费用也会删除，是否继续？';
  if (Platform.OS === 'web') { if (globalThis.confirm(`删除方案\n\n${message}`)) onConfirm(); return; }
  Alert.alert('删除方案', message, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: onConfirm }]);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  body: { gap: spacing.sm }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 12, fontWeight: '700', color: theme.colors.text }, hint: { marginTop: 2, fontSize: 10, color: theme.colors.textSecondary }, add: { minHeight: 36, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3 }, addText: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryDark },
  variant: { overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface }, variantSelected: { borderColor: theme.colors.primary }, variantHeader: { minHeight: 62, paddingHorizontal: spacing.xs, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs }, radio: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' }, total: { width: 58, height: 42, textAlignVertical: 'center', fontSize: 10, color: theme.colors.primaryDark }, iconButton: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' }, variantBody: { padding: spacing.sm, paddingTop: spacing.xs },
  more: { marginTop: spacing.sm, gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider }, delete: { minHeight: 38, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, deleteText: { fontSize: 12, color: theme.colors.danger }, empty: { paddingVertical: spacing.lg, textAlign: 'center', fontSize: 11, color: theme.colors.textMuted }, error: { fontSize: 11, color: theme.colors.danger },
  });
}
