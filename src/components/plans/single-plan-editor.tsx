import { Plus } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { parseYuanToCents, type PlanFormExpense, type PlanValidationErrors, type SinglePlanFormDraft } from '../../domain/plan-form';
import { formatMoney } from '../../domain/budget';
import { spacing } from '../../theme/tokens';
import { ExpenseEditor } from './expense-editor';

type Props = {
  draft: SinglePlanFormDraft;
  errors: PlanValidationErrors;
  onChange: (draft: SinglePlanFormDraft) => void;
};

/** 单次计划直接编辑费用，不向用户暴露内部隐式阶段。 */
export function SinglePlanEditor({ draft, errors, onChange }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  const total = draft.expenses.reduce((sum, expense) => sum + (parseYuanToCents(expense.amountYuan) ?? 0), 0);
  const addExpense = () => onChange({ ...draft, expenses: [...draft.expenses, createBlankExpense()] });

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>费用明细</Text>
          <Text style={styles.total}>合计 {formatMoney(total, true)}</Text>
        </View>
        <Pressable accessibilityLabel="添加费用" onPress={addExpense} style={styles.add}>
          <Plus size={16} color={theme.colors.primaryDark} />
          <Text style={styles.addText}>添加费用</Text>
        </Pressable>
      </View>
      {draft.expenses.map((expense, index) => (
        <ExpenseEditor
          key={expense.id}
          errorPrefix={`expenses.${index}`}
          errors={errors}
          expense={expense}
          onChange={(nextExpense) => onChange({
            ...draft,
            expenses: draft.expenses.map((item, itemIndex) => itemIndex === index ? nextExpense : item),
          })}
          onRemove={() => onChange({
            ...draft,
            expenses: draft.expenses.filter((_, itemIndex) => itemIndex !== index),
          })}
        />
      ))}
      {!draft.expenses.length ? <Text style={styles.empty}>暂无费用，计划预算为 ¥0.00</Text> : null}
    </View>
  );
}

/** 为用户主动新增的费用生成只在草稿期使用的 ID。 */
function createBlankExpense(): PlanFormExpense {
  return { id: createId('expense'), name: '', category: 'other', amountYuan: '' };
}

/** 本地实体 ID 仅需在当前草稿中保持唯一。 */
function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  section: { marginTop: spacing.lg, gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: theme.colors.text },
  total: { marginTop: 1, fontSize: 10, color: theme.colors.textSecondary },
  add: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addText: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryDark },
  empty: { paddingVertical: spacing.lg, textAlign: 'center', fontSize: 12, color: theme.colors.textMuted },
  });
}
