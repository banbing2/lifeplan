import { ChevronDown, ChevronLeft, ChevronRight, Settings } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { formatMoney, type MonthlySummary } from '../../domain/budget';
import {
  createMonthCalendarDays,
  createScheduleDays,
  getLocalDateKey,
  getScheduleDateScrollOffset,
  shiftMonthKey,
} from '../../domain/schedule';
import { radii, shadow, spacing } from '../../theme/tokens';

/** 首页支持月计划和单日日程两种视图。 */
export type HomeViewMode = 'month' | 'schedule';

/** 首页品牌标题与设置入口。 */
export function AppHeader({ onSettings }: { onSettings: () => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.appTitle}>生活预算</Text>
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
  onOpenPicker: () => void;
  previousLabel: string;
  nextLabel: string;
  pickerLabel: string;
};

/** 月份或日期的上一项、下一项导航。 */
export function MonthNavigator({
  label,
  onPrevious,
  onNext,
  onOpenPicker,
  previousLabel,
  nextLabel,
  pickerLabel,
}: MonthNavigatorProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.monthNavigator}>
      <Pressable accessibilityLabel={previousLabel} hitSlop={8} onPress={onPrevious} style={styles.iconButton}>
        <ChevronLeft size={24} color={theme.colors.text} />
      </Pressable>
      <Pressable accessibilityLabel={pickerLabel} onPress={onOpenPicker} style={styles.monthTitleRow}>
        <Text style={styles.monthTitle}>{label}</Text>
        <ChevronDown size={14} color={theme.colors.text} fill={theme.colors.text} />
      </Pressable>
      <Pressable accessibilityLabel={nextLabel} hitSlop={8} onPress={onNext} style={styles.iconButton}>
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

type ScheduleDateStripProps = {
  selectedDateKey: string;
  markedDateKeys: string[];
  onChange: (dateKey: string) => void;
};

/** 展示日程页可横向滚动的整月日期选择条，并自动定位选中日期。 */
export function ScheduleDateStrip({ selectedDateKey, markedDateKeys, onChange }: ScheduleDateStripProps) {
  const { styles } = useThemedStyles(createStyles);
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const scheduleDays = createScheduleDays(selectedDateKey);
  const markedDates = new Set(markedDateKeys);

  /** 选中日期或可视宽度变化时，把日期平滑滚动到视口中间附近。 */
  useEffect(() => {
    if (viewportWidth === 0) return;
    scrollRef.current?.scrollTo({
      x: getScheduleDateScrollOffset(selectedDateKey, viewportWidth),
      animated: true,
    });
  }, [selectedDateKey, viewportWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.dateStripContent}
      directionalLockEnabled
      horizontal
      onLayout={handleLayout}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={styles.dateStrip}
    >
      {scheduleDays.map((date) => {
        const selected = date.dateKey === selectedDateKey;
        const marked = markedDates.has(date.dateKey);
        const month = Number(date.dateKey.slice(5, 7));
        return (
          <Pressable
            accessibilityLabel={`${month}月${date.day}日 ${date.weekday}${marked ? '，有计划' : ''}`}
            accessibilityState={{ selected }}
            key={date.dateKey}
            onPress={() => {
              if (!selected) onChange(date.dateKey);
            }}
            style={[styles.dateItem, selected && styles.dateItemSelected]}
          >
            <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>{date.day}</Text>
            <Text style={[styles.weekday, selected && styles.dateTextSelected]}>{date.weekday}</Text>
            {marked ? <View style={[styles.planMarker, selected && styles.planMarkerSelected]} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type HomeCalendarPickerProps = {
  mode: 'date' | 'month';
  visibleMonthKey: string;
  selectedDateKey?: string;
  markedDateKeys: string[];
  onVisibleMonthChange: (monthKey: string) => void;
  onSelect: (value: string) => void;
};

const calendarWeekdays = ['一', '二', '三', '四', '五', '六', '日'] as const;

/** 首页下拉选择器：月计划选择年份月份，日程选择完整日期。 */
export function HomeCalendarPicker({
  mode,
  visibleMonthKey,
  selectedDateKey,
  markedDateKeys,
  onVisibleMonthChange,
  onSelect,
}: HomeCalendarPickerProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  const [year, month] = visibleMonthKey.split('-').map(Number);
  const markedDates = new Set(markedDateKeys);
  const todayKey = getLocalDateKey(new Date());

  if (mode === 'month') {
    return (
      <View style={styles.calendarPanel}>
        <View style={styles.calendarHeader}>
          <Pressable accessibilityLabel="上一年" onPress={() => onVisibleMonthChange(shiftMonthKey(visibleMonthKey, -12))} style={styles.calendarArrow}>
            <ChevronLeft size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.calendarTitle}>{year}年</Text>
          <Pressable accessibilityLabel="下一年" onPress={() => onVisibleMonthChange(shiftMonthKey(visibleMonthKey, 12))} style={styles.calendarArrow}>
            <ChevronRight size={20} color={theme.colors.text} />
          </Pressable>
        </View>
        <View style={styles.monthGrid}>
          {Array.from({ length: 12 }, (_, index) => {
            const value = `${year}-${String(index + 1).padStart(2, '0')}`;
            const selected = value === visibleMonthKey;
            return (
              <Pressable
                accessibilityLabel={`选择${year}年${index + 1}月`}
                accessibilityState={{ selected }}
                key={value}
                onPress={() => onSelect(value)}
                style={styles.monthCell}
              >
                <View style={[styles.monthPill, selected && styles.monthPillSelected]}>
                  <Text style={[styles.monthCellText, selected && styles.calendarSelectedText]}>{index + 1}月</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.calendarPanel}>
      <View style={styles.calendarHeader}>
        <Pressable accessibilityLabel="上一个月" onPress={() => onVisibleMonthChange(shiftMonthKey(visibleMonthKey, -1))} style={styles.calendarArrow}>
          <ChevronLeft size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.calendarTitle}>{year}年{month}月</Text>
        <Pressable accessibilityLabel="下一个月" onPress={() => onVisibleMonthChange(shiftMonthKey(visibleMonthKey, 1))} style={styles.calendarArrow}>
          <ChevronRight size={20} color={theme.colors.text} />
        </Pressable>
      </View>
      <View style={styles.weekdayRow}>
        {calendarWeekdays.map((weekday) => <Text key={weekday} style={styles.calendarWeekday}>{weekday}</Text>)}
      </View>
      <View style={styles.calendarGrid}>
        {createMonthCalendarDays(visibleMonthKey).map((date) => {
          const selected = date.dateKey === selectedDateKey;
          const marked = markedDates.has(date.dateKey);
          const today = date.dateKey === todayKey;
          const [dateYear, dateMonth] = date.dateKey.split('-').map(Number);
          const stateLabel = selected ? '，已选择' : marked ? '，有计划' : today ? '，今天' : '';
          return (
            <Pressable
              accessibilityLabel={`${dateYear}年${dateMonth}月${date.day}日${stateLabel}`}
              accessibilityState={{ selected }}
              key={date.dateKey}
              onPress={() => onSelect(date.dateKey)}
              style={styles.calendarDayCell}
            >
              <View style={[styles.calendarDay, today && styles.calendarToday, selected && styles.calendarDaySelected]}>
                <Text style={[
                  styles.calendarDayText,
                  !date.isCurrentMonth && styles.calendarAdjacentText,
                  selected && styles.calendarSelectedText,
                ]}>
                  {date.day}
                </Text>
                {marked ? <View style={[styles.planMarker, selected && styles.planMarkerSelected]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
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
  },
  dateStripContent: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  calendarPanel: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  calendarHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  weekdayRow: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarWeekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.2857%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarToday: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  calendarDaySelected: {
    borderWidth: 0,
    backgroundColor: theme.colors.primary,
  },
  calendarDayText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.text,
  },
  calendarAdjacentText: {
    color: theme.colors.textMuted,
  },
  calendarSelectedText: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
  },
  planMarker: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  planMarkerSelected: {
    backgroundColor: theme.colors.onPrimary,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '25%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPill: {
    width: 64,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPillSelected: {
    backgroundColor: theme.colors.primary,
  },
  monthCellText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.text,
  },
  });
}
