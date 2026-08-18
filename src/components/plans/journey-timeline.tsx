import { CheckCircle2, Circle, MapPin } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/domain/budget';
import { calculateJourneyBudget } from '@/domain/journey-budget';
import type { Plan } from '@/domain/models';
import { radii, spacing } from '@/theme/tokens';

/** 按手动顺序展示完整行程，并允许独立切换每个可选阶段的方案。 */
export function JourneyTimeline({ plan, onSelect }: { plan: Plan; onSelect: (stageId: string, variantId: string) => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  const budget = calculateJourneyBudget(plan.stages);
  if (!plan.stages.length) return <Text style={styles.empty}>尚未添加行程阶段</Text>;
  return <View style={styles.container}>
    {[...plan.stages].sort((a, b) => a.sortOrder - b.sortOrder).map((stage, index) => {
      const fixedTotal = stage.kind === 'fixed' ? sum(stage.expenses) : 0;
      const selected = stage.kind === 'choice' ? stage.variants.find((variant) => variant.id === stage.selectedVariantId) : null;
      const selectedTotal = selected ? sum(selected.expenses) : null;
      return <View key={stage.id} style={styles.stageRow}>
        <View style={styles.rail}><View style={styles.dot}><MapPin size={14} color="#FFFFFF" /></View>{index < plan.stages.length - 1 ? <View style={styles.line} /> : null}</View>
        <View style={styles.stageCard}>
          <View style={styles.stageHeader}><View style={styles.stageHeading}><Text style={styles.time}>{stage.startTime || `阶段 ${index + 1}`}</Text><Text style={styles.name}>{stage.name}</Text></View><Text style={styles.total}>{stage.kind === 'fixed' ? formatMoney(fixedTotal, true) : selectedTotal === null ? '待选择' : formatMoney(selectedTotal, true)}</Text></View>
          {stage.notes ? <Text style={styles.notes}>{stage.notes}</Text> : null}
          {stage.kind === 'fixed' ? <View style={styles.items}>{stage.expenses.map((expense) => <View key={expense.id} style={styles.item}><Text style={styles.itemName}>{expense.name}</Text><Text style={styles.itemAmount}>{formatMoney(expense.amountCents, true)}</Text></View>)}{!stage.expenses.length ? <Text style={styles.muted}>无费用</Text> : null}</View> : <View style={styles.variants}>{stage.variants.map((variant) => {
            const active = variant.id === stage.selectedVariantId;
            const total = sum(variant.expenses);
            const difference = selectedTotal === null ? null : total - selectedTotal;
            return <Pressable accessibilityState={{ selected: active }} key={variant.id} onPress={() => onSelect(stage.id, variant.id)} style={[styles.variant, active && styles.variantActive]}>
              {active ? <CheckCircle2 size={20} color={theme.colors.primary} /> : <Circle size={20} color={theme.colors.textMuted} />}
              <View style={styles.variantMain}><Text numberOfLines={1} style={[styles.variantName, active && styles.activeText]}>{variant.name}</Text>{!active && difference ? <Text style={styles.difference}>{difference > 0 ? `多 ${formatMoney(difference)}` : `省 ${formatMoney(-difference)}`}</Text> : null}</View><Text style={styles.itemAmount}>{formatMoney(total, true)}</Text>
            </Pressable>;
          })}{!stage.variants.length ? <Text style={styles.muted}>暂无可选方案</Text> : null}</View>}
        </View>
      </View>;
    })}
    <View style={styles.summary}><View><Text style={styles.summaryLabel}>{budget.unselectedStageCount ? '已确定金额' : '最终预算'}</Text>{budget.unselectedStageCount ? <Text style={styles.warning}>还有 {budget.unselectedStageCount} 个阶段待选择</Text> : <Text style={styles.muted}>固定费用 + 各阶段已选方案</Text>}</View><Text style={styles.summaryAmount}>{formatMoney(budget.confirmedTotalCents, true)}</Text></View>
  </View>;
}

/** 汇总当前阶段或方案的整数分费用。 */
function sum(items: readonly { amountCents: number }[]) { return items.reduce((total, item) => total + item.amountCents, 0); }
function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  container: { padding: spacing.lg }, stageRow: { flexDirection: 'row', gap: spacing.sm }, rail: { width: 28, alignItems: 'center' }, dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary }, line: { flex: 1, width: 2, minHeight: 28, backgroundColor: theme.colors.primaryLight }, stageCard: { flex: 1, minWidth: 0, marginBottom: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface },
  stageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }, stageHeading: { flex: 1, minWidth: 0 }, time: { fontSize: 10, color: theme.colors.primaryDark }, name: { marginTop: 2, fontSize: 15, fontWeight: '700', color: theme.colors.text }, total: { fontSize: 14, fontWeight: '700', color: theme.colors.primaryDark }, notes: { marginTop: spacing.sm, fontSize: 11, color: theme.colors.textSecondary }, items: { marginTop: spacing.md, gap: spacing.sm }, item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, itemName: { fontSize: 12, color: theme.colors.textSecondary }, itemAmount: { fontSize: 12, fontWeight: '600', color: theme.colors.text }, variants: { marginTop: spacing.md, gap: spacing.sm }, variant: { minHeight: 48, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md }, variantActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight }, variantMain: { flex: 1, minWidth: 0 }, variantName: { fontSize: 12, fontWeight: '600', color: theme.colors.text }, activeText: { color: theme.colors.primaryDark }, difference: { marginTop: 2, fontSize: 9, color: theme.colors.textSecondary }, muted: { fontSize: 11, color: theme.colors.textMuted }, empty: { padding: spacing.xxl, textAlign: 'center', color: theme.colors.textSecondary },
  summary: { minHeight: 72, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radii.md, backgroundColor: theme.colors.surfaceMuted }, summaryLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text }, warning: { marginTop: 3, fontSize: 11, color: theme.colors.warning }, summaryAmount: { fontSize: 20, fontWeight: '700', color: theme.colors.primaryDark },
  });
}
