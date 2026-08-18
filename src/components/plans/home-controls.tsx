import { ChevronDown, ChevronLeft, ChevronRight, Settings } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney, type MonthlySummary } from '../../domain/budget';
import { scheduleDays } from '../../domain/schedule';
import { radii, shadow, spacing } from '../../theme/tokens';

/** 首页支持月计划和单日日程两种视图。 */
export type HomeViewMode = 'month' | 'schedule';

/** 首页品牌标题与设置入口。 */
export function AppHeader({ onSettings }: { onSettings: () => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.appTitle}>生活计划</Text>
        <Text style={styles.subtitle}>先计划，后行动</Text>
      </View>
      <Pressable accessibilityLabel="设置" hitSlop={8} onPress={onSettings} style={styles.iconButton}>
        <Settings size={25} color={theme.colors.text} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

type MonthNavigatorProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
};

/** 月份或日期的上一项、下一项导航。 */
export function MonthNavigator({ label, onPrevious, onNext }: MonthNavigatorProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.monthNavigator}>
      <Pressable accessibilityLabel="上一个月" hitSlop={8} onPress={onPrevious} style={styles.iconButton}>
        <ChevronLeft size={24} color={theme.colors.text} />
      </Pressable>
      <Pressable accessibilityLabel="选择月份" style={styles.monthTitleRow}>
        <Text style={styles.monthTitle}>{label}</Text>
        <ChevronDown size={14} color={theme.colors.text} fill={theme.colors.text} />
      </Pressable>
      <Pressable accessibilityLabel="下一个月" hitSlop={8} onPress={onNext} style={styles.iconButton}>
        <ChevronRight size={24} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

type SegmentedControlProps = {
  value: HomeViewMode;
  onChange: (value: HomeViewMode) => void;
};

/** 在月计划和日程视图之间切换的分段控件。 */
export function ViewSegmentedControl({ value, onChange }: SegmentedControlProps) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View accessibilityRole="tablist" style={styles.segmented}>
      {(['month', 'schedule'] as const).map((item) => {
        const selected = value === item;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={item}
            onPress={() => onChange(item)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {item === 'month' ? '月计划' : '日程'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 展示只包含最终预算的月度金额、计划数和完成率。 */
export function BudgetSummary({ summary }: { summary: MonthlySummary }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryColumn, styles.summaryBudget]}>
        <Text style={styles.summaryLabel}>本月最终预算</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={styles.summaryAmount}>
          {formatMoney(summary.totalBudgetCents, true)}
        </Text>
        <Text style={styles.summaryHint}>
          较上月 <Text style={styles.summaryIncrease}>+¥316.00</Text>
        </Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryColumn}>
        <Text style={styles.summaryLabel}>计划数量</Text>
        <Text style={styles.summaryValue}>{summary.planCount}个</Text>
        <Text style={styles.summaryHint}>待执行 {summary.pendingCount} 个</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryColumn}>
        <Text style={styles.summaryLabel}>完成进度</Text>
        <Text style={styles.summaryValue}>{summary.completionPercent}%</Text>
        <Text style={styles.summaryHint}>已完成 {summary.completedCount} 个</Text>
      </View>
    </View>
  );
}

/** 展示日程页可横向扫描的一周日期选择条。 */
export function ScheduleDateStrip({ selectedDay, onChange }: { selectedDay: number; onChange: (day: number) => void }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.dateStrip}>
      {scheduleDays.map((date) => {
        const selected = date.day === selectedDay;
        return (
          <Pressable
            accessibilityLabel={`8月${date.day}日 ${date.weekday}`}
            accessibilityState={{ selected }}
            key={date.day}
            onPress={() => onChange(date.day)}
            style={[styles.dateItem, selected && styles.dateItemSelected]}
          >
            <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>{date.day}</Text>
            <Text style={[styles.weekday, selected && styles.dateTextSelected]}>{date.weekday}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appTitle: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavigator: {
    height: 48,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitleRow: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  monthTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  segmented: {
    height: 38,
    marginHorizontal: spacing.lg,
    padding: 2,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radii.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  segmentSelected: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  segmentTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryCard: {
    minHeight: 112,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radii.lg,
    backgroundColor: theme.colors.surface,
    ...shadow,
  },
  summaryColumn: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
    justifyContent: 'space-between',
  },
  summaryBudget: {
    flex: 1.45,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: theme.colors.divider,
  },
  summaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textSecondary,
  },
  summaryAmount: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  summaryValue: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    color: theme.colors.text,
  },
  summaryHint: {
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textMuted,
  },
  summaryIncrease: {
    color: theme.colors.danger,
  },
  dateStrip: {
    height: 76,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateItem: {
    width: 42,
    height: 58,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dateItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  dateNumber: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    color: theme.colors.text,
  },
  weekday: {
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textSecondary,
  },
  dateTextSelected: {
    color: '#FFFFFF',
  },
  });
}
