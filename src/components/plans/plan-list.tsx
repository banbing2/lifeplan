import {
  CalendarCheck2,
  ChevronRight,
  Coffee,
  Film,
  Gift,
  Image as ImageIcon,
  Mountain,
  Plus,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

import { calculatePlanBudget, formatMoney } from '../../domain/budget';
import type { Plan, PlanIcon } from '../../domain/models';
import { getPlanDisplayStatus } from '../../domain/plan-display';
import { getPlanDisplayTime } from '../../domain/plan-time';
import { getPlanDateLabel } from '../../domain/schedule';
import { accentColors, radii, shadow, spacing } from '../../theme/tokens';

type PlanListItemProps = {
  plan: Plan;
  variant?: 'month' | 'schedule';
  onPress: () => void;
};

/** 月计划标题必须统计实际渲染项，不能用预算完整性过滤后的汇总数量。 */
export function getVisiblePlanCount(plans: readonly Plan[]) {
  return plans.length;
}

/** 首页计划行，同时适配月计划日期列与日程时间列。 */
export function PlanListItem({ plan, variant = 'month', onPress }: PlanListItemProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  const accent = accentColors[plan.accent];
  const budget = calculatePlanBudget(plan);
  const displayTime = getPlanDisplayTime(plan);
  const selectedNames = plan.structureKind === 'journey' ? plan.stages.flatMap((stage) => {
    if (stage.kind !== 'choice') return [];
    const selected = stage.variants.find((variant) => variant.id === stage.selectedVariantId);
    return selected ? [selected.name] : [];
  }) : [];
  const selectedSummary = selectedNames.length > 2 || selectedNames.join(' · ').length > 18
    ? `已选 ${selectedNames.length} 个阶段`
    : selectedNames.join(' · ');
  // 单次计划没有方案概念；仅行程展示当前选择摘要或待选择数量。
  const summaryText = plan.structureKind === 'journey'
    ? budget.unselectedStageCount
      ? `${selectedSummary ? `${selectedSummary} · ` : ''}还有 ${budget.unselectedStageCount} 个阶段待选择`
      : selectedSummary
    : '';
  const amountCents = budget.finalTotalCents
    ?? (plan.structureKind === 'journey' && plan.stages.length ? budget.confirmedTotalCents : null);
  const displayStatus = getPlanDisplayStatus(plan);
  const status = displayStatus === 'draft'
    ? { label: '草稿', background: theme.colors.warningLight, text: theme.colors.warning }
    : displayStatus === 'unselected'
      ? { label: '待选择', background: theme.colors.warningLight, text: theme.colors.warning }
    : displayStatus === 'completed'
      ? { label: '已完成', background: theme.colors.completedLight, text: theme.colors.completed }
      : { label: '待执行', background: theme.colors.primaryLight, text: theme.colors.primaryDark };

  return (
    <Pressable
      accessibilityLabel={`查看${plan.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {variant === 'month' ? (
        <View style={styles.dateCell}>
          <Text style={styles.dateText}>{plan.dateKey.slice(5).replace('-', '/')}</Text>
          <Text style={styles.dateWeekday}>{getPlanDateLabel(plan.dateKey, false).match(/（(.+)）/)?.[1]}</Text>
        </View>
      ) : (
        <View style={styles.timeCell}>
          <Text numberOfLines={2} style={styles.scheduleTime}>{displayTime.label}</Text>
          {displayTime.group === 'allDay' ? <View style={styles.timeDot} /> : null}
        </View>
      )}

      <View style={styles.verticalDivider} />

      <View style={[styles.iconBadge, { backgroundColor: accent.solid }]}>
        <PlanGlyph icon={plan.icon} />
      </View>

      <View style={styles.mainContent}>
        <Text numberOfLines={1} style={styles.planTitle}>
          {plan.title}
        </Text>
        {variant === 'month' ? (
          <Text style={styles.planTime}>{displayTime.label}</Text>
        ) : null}
        {summaryText ? (
          <View style={[styles.optionTag, { backgroundColor: accent.soft }]}>
            <Text numberOfLines={1} style={[styles.optionTagText, { color: accent.text }]}>
              {summaryText}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.valueArea}>
        <View style={[styles.statusPill, { backgroundColor: status.background }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
        <Text style={styles.amount}>{amountCents === null ? '—' : formatMoney(amountCents)}</Text>
      </View>

      <ChevronRight size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

/** 将持久化图标标识映射为 Lucide 图标组件。 */
function PlanGlyph({ icon }: { icon: PlanIcon }) {
  const props = { size: 20, color: '#FFFFFF', strokeWidth: 2.1 } as const;
  switch (icon) {
    case 'utensils':
      return <UtensilsCrossed {...props} />;
    case 'shopping-bag':
      return <ShoppingBag {...props} />;
    case 'tent':
      return <Mountain {...props} />;
    case 'film':
      return <Film {...props} />;
    case 'gift':
      return <Gift {...props} />;
    case 'star':
      return <Sparkles {...props} />;
    case 'coffee':
      return <Coffee {...props} />;
    default:
      return <ImageIcon {...props} />;
  }
}

/** 没有日程时展示新增入口。 */
export function EmptyScheduleState({ onAdd }: { onAdd: () => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.emptyState}>
      <View style={styles.illustrationHalo}>
        <View style={styles.illustrationCard}>
          <CalendarCheck2 size={44} color={theme.colors.primary} strokeWidth={1.8} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>当天没有更多计划</Text>
      <Pressable onPress={onAdd} style={styles.outlineButton}>
        <Plus size={19} color={theme.colors.primaryDark} />
        <Text style={styles.outlineButtonText}>新增当天计划</Text>
      </Pressable>
    </View>
  );
}

/** 固定在手机画布右下角的全局新建按钮，不随列表滚动。 */
export function FloatingAddButton({ onPress }: { onPress: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel="新增计划"
      onPress={onPress}
      style={styles.floatingButton}
    >
      <Plus size={34} color="#FFFFFF" strokeWidth={2} />
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  row: {
    minHeight: 78,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    backgroundColor: theme.colors.surface,
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  dateCell: {
    width: 48,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  timeCell: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dateText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dateWeekday: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textSecondary,
  },
  scheduleTime: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: theme.colors.primaryDark,
  },
  timeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  verticalDivider: {
    width: 1,
    height: 46,
    backgroundColor: theme.colors.divider,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  planTitle: {
    maxWidth: '100%',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    color: theme.colors.text,
  },
  planTime: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.textSecondary,
  },
  optionTag: {
    maxWidth: '100%',
    marginTop: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  optionTagText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  valueArea: {
    width: 68,
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  amount: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  emptyState: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  illustrationHalo: {
    width: 128,
    height: 86,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9F6EE',
  },
  illustrationCard: {
    width: 76,
    height: 70,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CFE9D9',
    backgroundColor: '#FFFFFF',
    ...shadow,
  },
  emptyTitle: {
    marginTop: spacing.xl,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  outlineButton: {
    minHeight: 44,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: radii.pill,
    backgroundColor: theme.colors.surface,
  },
  outlineButtonText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
  floatingButton: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...shadow,
    zIndex: 10,
  },
  });
}
