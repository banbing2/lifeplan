import { StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

import { calculatePlanBudget, formatMoney } from '../../domain/budget';
import type { ExpenseCategory, Plan } from '../../domain/models';
import { radii, spacing } from '../../theme/tokens';

type DisplayExpense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  amountCents: number;
  sortOrder: number;
};

type ExpenseGroup = {
  id: string;
  title: string | null;
  subtitle: string | null;
  expenses: DisplayExpense[];
};

const categoryLabels: Record<ExpenseCategory, string> = {
  transport: '交通', ticket: '门票', food: '餐饮', lodging: '住宿',
  activity: '活动', shopping: '商品', other: '其他',
};

/** 按结构提取实际执行费用；单次计划刻意抹去隐式阶段的展示元数据。 */
export function getPlanExpenseGroups(plan: Plan): ExpenseGroup[] {
  if (plan.structureKind === 'single') {
    const stage = plan.stages[0];
    return stage?.kind === 'fixed'
      ? [{ id: plan.id, title: null, subtitle: null, expenses: [...stage.expenses].sort(bySortOrder) }]
      : [];
  }

  const groups: ExpenseGroup[] = [];
  for (const stage of plan.stages) {
    if (stage.kind === 'fixed') {
      groups.push({
        id: stage.id, title: stage.name, subtitle: '固定阶段',
        expenses: [...stage.expenses].sort(bySortOrder),
      });
      continue;
    }
    const selected = stage.variants.find((variant) => variant.id === stage.selectedVariantId);
    if (selected) {
      groups.push({
        id: stage.id, title: stage.name, subtitle: selected.name,
        expenses: [...selected.expenses].sort(bySortOrder),
      });
    }
  }
  return groups;
}

/** 仅展示固定费用和各阶段当前已选方案，未选方案不会混入执行明细。 */
export function PlanExpenseBreakdown({ plan }: { plan: Plan }) {
  const { styles } = useThemedStyles(createStyles);
  const budget = calculatePlanBudget(plan);
  const groups = getPlanExpenseGroups(plan);
  const expenseCount = groups.reduce((total, group) => total + group.expenses.length, 0);
  const budgetPending = budget.finalTotalCents === null;
  // 未选方案仍有可展示的已确定金额；空行程则尚未形成任何最终预算。
  const summaryLabel = budget.unselectedStageCount
    ? '已确定金额'
    : budgetPending ? '预算待完善' : '最终预算';
  const summaryAmount = budgetPending && !budget.unselectedStageCount
    ? '—'
    : formatMoney(budget.confirmedTotalCents, true);
  return <View style={styles.container}>
    {groups.map((group) => <View key={group.id} style={styles.group}>
      {group.title ? <View style={styles.heading}><View><Text style={styles.title}>{group.title}</Text><Text style={styles.subtitle}>{group.subtitle}</Text></View><Text style={styles.total}>{formatMoney(sum(group.expenses), true)}</Text></View> : null}
      {group.expenses.map((expense) => <View key={expense.id} style={styles.row}><View><Text style={styles.name}>{expense.name}</Text><Text style={styles.category}>{categoryLabels[expense.category]}</Text></View><Text style={styles.amount}>{formatMoney(expense.amountCents, true)}</Text></View>)}
      {!group.expenses.length ? <Text style={styles.empty}>{plan.structureKind === 'single' ? '暂无费用' : '该阶段无费用'}</Text> : null}
    </View>)}
    {!groups.length ? <Text style={styles.empty}>暂无已确定费用</Text> : null}
    <View style={styles.summary}><View><Text style={styles.summaryLabel}>{summaryLabel}</Text>{budget.unselectedStageCount ? <Text style={styles.warning}>还有 {budget.unselectedStageCount} 个阶段待选择</Text> : budgetPending ? <Text style={styles.subtitle}>添加行程阶段后生成预算</Text> : plan.structureKind === 'single' ? <Text style={styles.subtitle}>共 {expenseCount} 项费用</Text> : <Text style={styles.subtitle}>固定阶段 {formatMoney(budget.fixedTotalCents)} + 已选方案 {formatMoney(budget.selectedVariantsTotalCents)}</Text>}</View><Text style={styles.summaryAmount}>{summaryAmount}</Text></View>
  </View>;
}
/** 汇总一个费用分组的整数分金额。 */
function sum(items: readonly { amountCents: number }[]) { return items.reduce((total, item) => total + item.amountCents, 0); }
/** 按录入顺序稳定排列费用。 */
function bySortOrder(left: { sortOrder: number }, right: { sortOrder: number }) { return left.sortOrder - right.sortOrder; }
function createStyles(theme: AppTheme) {
  return StyleSheet.create({ container: { padding: spacing.lg, gap: spacing.md }, group: { paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface }, heading: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.divider }, title: { fontSize: 14, fontWeight: '700', color: theme.colors.text }, subtitle: { marginTop: 2, fontSize: 10, color: theme.colors.textSecondary }, total: { fontSize: 15, fontWeight: '700', color: theme.colors.primaryDark }, row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.divider }, name: { fontSize: 12, color: theme.colors.text }, category: { marginTop: 2, fontSize: 10, color: theme.colors.textMuted }, amount: { fontSize: 12, fontWeight: '600', color: theme.colors.text }, empty: { padding: spacing.xl, textAlign: 'center', fontSize: 12, color: theme.colors.textMuted }, summary: { minHeight: 72, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radii.md, backgroundColor: theme.colors.surfaceMuted }, summaryLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text }, warning: { marginTop: 3, fontSize: 11, color: theme.colors.warning }, summaryAmount: { fontSize: 20, fontWeight: '700', color: theme.colors.primaryDark }   });
}
