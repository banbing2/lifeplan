import { useFocusEffect, useRouter } from 'expo-router';
import type { AppTheme } from '@/theme/create-theme';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppFrame } from '@/components/layout/app-frame';
import {
  AppHeader,
  BudgetSummary,
  HomeCalendarPicker,
  MonthNavigator,
  ScheduleDateStrip,
  ViewSegmentedControl,
  type HomeViewMode,
} from '@/components/plans/home-controls';
import { EmptyScheduleState, FloatingAddButton, getVisiblePlanCount, PlanListItem } from '@/components/plans/plan-list';
import { calculateMonthlySummary, calculatePlanBudget } from '@/domain/budget';
import type { Plan } from '@/domain/models';
import { getPlanDisplayTime, sortPlansByDisplayTime } from '@/domain/plan-time';
import {
  getLocalDateKey,
  getMonthKey,
  getScheduleDateLabel,
  shiftDateKey,
  shiftMonthKey,
} from '@/domain/schedule';
import { createPlanRepository } from '@/repositories/plan-repository';
import { radii, shadow, spacing } from '@/theme/tokens';

/** 首页控制器：管理月计划/日程视图、数据刷新和新建入口。 */
export default function HomeScreen() {
  const { styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const db = useSQLiteContext();
  const repository = useMemo(() => createPlanRepository(db), [db]);
  const [initialDateKey] = useState(() => getLocalDateKey(new Date()));
  const [viewMode, setViewMode] = useState<HomeViewMode>('month');
  const [monthKey, setMonthKey] = useState(() => getMonthKey(initialDateKey));
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [monthPlans, setMonthPlans] = useState<Plan[]>([]);
  const [schedulePlans, setSchedulePlans] = useState<Plan[]>([]);
  const [markedDateKeys, setMarkedDateKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const refreshIdRef = useRef(0);

  const [monthYear, monthNumber] = monthKey.split('-').map(Number);

  /** 同步刷新当前月份首页计划与当前选中日期的日程。 */
  const refresh = useCallback(async () => {
    const refreshId = ++refreshIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const [featured, scheduled, markedDates] = await Promise.all([
        repository.getFeaturedPlans(monthKey),
        repository.getPlansForDate(selectedDateKey),
        repository.getPlanDateKeysForMonth(monthKey),
      ]);
      if (refreshId !== refreshIdRef.current) return;
      setMonthPlans(featured);
      setSchedulePlans(scheduled);
      setMarkedDateKeys(markedDates);
    } catch (reason) {
      if (refreshId !== refreshIdRef.current) return;
      setError(reason instanceof Error ? reason.message : '计划加载失败');
    } finally {
      if (refreshId === refreshIdRef.current) setLoading(false);
    }
  }, [monthKey, repository, selectedDateKey]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const summary = calculateMonthlySummary(
    monthPlans.map((plan) => ({
      status: plan.status,
      finalTotalCents: calculatePlanBudget(plan).finalTotalCents,
    })),
  );
  const scheduleGroups = useMemo(() => {
    const sorted = sortPlansByDisplayTime(schedulePlans);
    // 分组与列表共用同一份结构感知结果，防止计数和排序采用不同时间来源。
    const timed: Plan[] = [];
    const allDay: Plan[] = [];
    for (const plan of sorted) {
      (getPlanDisplayTime(plan).group === 'timed' ? timed : allDay).push(plan);
    }
    return { timed, allDay, sorted };
  }, [schedulePlans]);

  /** 按月偏移导航；加载状态由 refresh 统一管理，避免无状态变化时卡死。 */
  const shiftMonth = (offset: number) => {
    setMonthKey((current) => shiftMonthKey(current, offset));
  };

  /** 切换日程日期并同步月历；重复选择当前日期只关闭选择器。 */
  const selectScheduleDate = (dateKey: string) => {
    setPickerOpen(false);
    if (dateKey === selectedDateKey) return;
    setSelectedDateKey(dateKey);
    setMonthKey(getMonthKey(dateKey));
  };

  /** 日程顶部箭头按天移动，而月计划顶部箭头按月移动。 */
  const shiftScheduleDate = (offset: number) => {
    const nextDateKey = shiftDateKey(selectedDateKey, offset);
    selectScheduleDate(nextDateKey);
  };

  /** 切换首页视图时保持顶部结构稳定，并收起当前下拉选择器。 */
  const changeViewMode = (mode: HomeViewMode) => {
    setPickerOpen(false);
    setViewMode(mode);
    setMonthKey(mode === 'schedule' ? getMonthKey(selectedDateKey) : monthKey);
  };

  /** 打开新建页；从日程进入时预填当前日期。 */
  const openNewPlan = (dateKey?: string) => {
    router.push({ pathname: '/plan/new', params: dateKey ? { date: dateKey } : {} });
  };

  return (
    <AppFrame>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <AppHeader onSettings={() => router.push('/settings')} />
          <MonthNavigator
            label={viewMode === 'month' ? `${monthYear}年${monthNumber}月` : getScheduleDateLabel(selectedDateKey)}
            onPrevious={() => viewMode === 'month' ? shiftMonth(-1) : shiftScheduleDate(-1)}
            onNext={() => viewMode === 'month' ? shiftMonth(1) : shiftScheduleDate(1)}
            onOpenPicker={() => setPickerOpen((open) => !open)}
            previousLabel={viewMode === 'month' ? '上一个月' : '前一天'}
            nextLabel={viewMode === 'month' ? '下一个月' : '后一天'}
            pickerLabel={viewMode === 'month' ? '选择年份和月份' : '选择日期'}
          />
          <ViewSegmentedControl value={viewMode} onChange={changeViewMode} />
          {pickerOpen ? (
            <HomeCalendarPicker
              mode={viewMode === 'month' ? 'month' : 'date'}
              visibleMonthKey={monthKey}
              selectedDateKey={selectedDateKey}
              markedDateKeys={markedDateKeys}
              onVisibleMonthChange={setMonthKey}
              onSelect={(value) => {
                if (viewMode === 'month') {
                  setMonthKey(value);
                  setPickerOpen(false);
                } else {
                  selectScheduleDate(value);
                }
              }}
            />
          ) : null}
          {viewMode === 'month' ? (
            <>
              <BudgetSummary summary={summary} />
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>{monthNumber}月计划 · 共{getVisiblePlanCount(monthPlans)}个</Text>
              </View>
              {loading ? (
                <LoadingBlock />
              ) : error ? (
                <ErrorBlock message={error} onRetry={refresh} />
              ) : monthPlans.length ? (
                <View style={styles.listCard}>
                  {monthPlans.map((plan) => (
                    <PlanListItem
                      key={plan.id}
                      plan={plan}
                      onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
                    />
                  ))}
                </View>
              ) : (
                <EmptyScheduleState onAdd={() => openNewPlan()} />
              )}
            </>
          ) : (
            <>
              <ScheduleDateStrip
                markedDateKeys={markedDateKeys}
                selectedDateKey={selectedDateKey}
                onChange={selectScheduleDate}
              />
              <View style={styles.scheduleHeading}>
                <Text style={styles.sectionTitle}>
                  当天计划 · {scheduleGroups.timed.length}个
                </Text>
                <Text style={styles.scheduleMeta}>全天/未定 {scheduleGroups.allDay.length}个</Text>
              </View>
              {loading ? (
                <LoadingBlock />
              ) : error ? (
                <ErrorBlock message={error} onRetry={refresh} />
              ) : (
                <>
                  {scheduleGroups.sorted.length ? (
                    <View style={styles.listCard}>
                      {scheduleGroups.sorted.map((plan) => (
                        <PlanListItem
                          key={plan.id}
                          plan={plan}
                          variant="schedule"
                          onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
                        />
                      ))}
                    </View>
                  ) : null}
                  <EmptyScheduleState onAdd={() => openNewPlan(selectedDateKey)} />
                </>
              )}
            </>
          )}
        </ScrollView>
        <FloatingAddButton onPress={() => openNewPlan(viewMode === 'schedule' ? selectedDateKey : undefined)} />
      </View>
    </AppFrame>
  );
}

/** 首页列表加载占位。 */
function LoadingBlock() {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.stateBlock}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

/** 首页加载失败状态与重试入口。 */
function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.stateBlock}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>重试</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.screen },
  scrollContent: { minHeight: '100%', paddingBottom: 128 },
  sectionHeading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  scheduleHeading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: theme.colors.text },
  scheduleMeta: { fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  listCard: {
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radii.lg,
    backgroundColor: theme.colors.surface,
    ...shadow,
  },
  stateBlock: { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  errorText: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: theme.colors.danger },
  retryButton: {
    minWidth: 92,
    minHeight: 44,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: theme.colors.primary,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  });
}
