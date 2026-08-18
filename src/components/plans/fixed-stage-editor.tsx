import { Plus } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/budget';
import { parseYuanToCents, type PlanFormFixedStage, type PlanValidationErrors } from '../../domain/plan-form';
import { spacing } from '../../theme/tokens';
import { ExpenseEditor } from './expense-editor';

/** 编辑固定阶段费用，并在新增后把焦点交给费用名称。 */
export function FixedStageEditor({ stage, stageIndex, errors, focusExpenseId, onFocusHandled, onChange }: {
  stage: PlanFormFixedStage;
  stageIndex: number;
  errors: PlanValidationErrors;
  focusExpenseId?: string | null;
  onFocusHandled?: () => void;
  onChange: (stage: PlanFormFixedStage) => void;
}) {
  const { styles, theme } = useThemedStyles(createStyles);
  const [localFocusExpenseId, setLocalFocusExpenseId] = useState<string | null>(null);
  const total = stage.expenses.reduce((sum, expense) => sum + (parseYuanToCents(expense.amountYuan) ?? 0), 0);

  /** 新增一条空费用并记录待聚焦 ID。 */
  const addExpense = () => {
    const expense = { id: createId('expense'), name: '', category: 'other' as const, amountYuan: '' };
    onChange({ ...stage, expenses: [...stage.expenses, expense] });
    setLocalFocusExpenseId(expense.id);
  };

  return <View style={styles.body}>
    <View style={styles.heading}>
      <Text style={styles.title}>固定费用 · {formatMoney(total, true)}</Text>
      <Pressable accessibilityLabel="添加费用" onPress={addExpense} style={styles.add}><Plus size={16} color={theme.colors.primaryDark} /><Text style={styles.addText}>添加费用</Text></Pressable>
    </View>
    {stage.expenses.map((expense, index) => <ExpenseEditor
      key={expense.id}
      errorPrefix={`stages.${stageIndex}.expenses.${index}`}
      errors={errors}
      expense={expense}
      focusOnMount={expense.id === (localFocusExpenseId ?? focusExpenseId)}
      onChange={(next) => onChange({ ...stage, expenses: stage.expenses.map((item, itemIndex) => itemIndex === index ? next : item) })}
      onFocusHandled={() => { setLocalFocusExpenseId(null); onFocusHandled?.(); }}
      onRemove={() => onChange({ ...stage, expenses: stage.expenses.filter((_, itemIndex) => itemIndex !== index) })}
    />)}
    {!stage.expenses.length ? <Text style={styles.empty}>暂无固定费用</Text> : null}
  </View>;
}

/** 为新增费用生成草稿期本地 ID。 */
function createId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  body: { gap: spacing.xs }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  add: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 3 }, addText: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryDark }, empty: { paddingVertical: spacing.lg, textAlign: 'center', fontSize: 12, color: theme.colors.textMuted },
  });
}
