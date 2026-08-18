import { useFocusEffect, useRouter } from 'expo-router';
import type { AppTheme } from '@/theme/create-theme';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppFrame } from '@/components/layout/app-frame';
import {
  AppHeader,
  BudgetSummary,
  MonthNavigator,
  ScheduleDateStrip,
  ViewSegmentedControl,
  type HomeViewMode,
} from '@/components/plans/home-controls';
import { EmptyScheduleState, FloatingAddButton, getVisiblePlanCount, PlanListItem } from '@/components/plans/plan-list';
import { calculateMonthlySummary, calculatePlanBudget } from '@/domain/budget';
import type { Plan } from '@/domain/models';
import { getPlanDisplayTime, sortPlansByDisplayTime } from '@/domain/plan-time';
import { getScheduleDateLabel } from '@/domain/schedule';
import { createPlanRepository } from '@/repositories/plan-repository';
import { radii, shadow, spacing } from '@/theme/tokens';

const initialMonth = new Date(2026, 7, 1);

/** 首页控制器：管理月计划/日程视图、数据刷新和新建入口。 */
export default function HomeScreen() {
  const { styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const db = useSQLiteContext();
  const repository = useMemo(() => createPlanRepository(db), [db]);
  const [viewMode, setViewMode] = useState<HomeViewMode>('month');
  const [month, setMonth] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState(16);
  const [monthPlans, setMonthPlans] = useState<Plan[]>([]);
  const [schedulePlans, setSchedulePlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const selectedDateKey = `2026-08-${String(selectedDay).padStart(2, '0')}`;

  /** 同步刷新当前月份首页计划与当前选中日期的日程。 */
  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [featured, scheduled] = await Promise.all([
        repository.getFeaturedPlans(monthKey),
        repository.getPlansForDate(selectedDateKey),
      ]);
      setMonthPlans(featured);
      setSchedulePlans(scheduled);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '计划加载失败');
    } finally {
      setLoading(false);
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

  /** 按月偏移导航，并在查询完成前显示加载状态。 */
  const shiftMonth = (offset: number) => {
    setLoading(true);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
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
          {viewMode === 'month' ? (
            <>
              <MonthNavigator
                label={`${month.getFullYear()}年${month.getMonth() + 1}月`}
                onPrevious={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
              />
              <ViewSegmentedControl value={viewMode} onChange={setViewMode} />
              <BudgetSummary summary={summary} />
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>{month.getMonth() + 1}月计划 · 共{getVisiblePlanCount(monthPlans)}个</Text>
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
              <MonthNavigator
                label={getScheduleDateLabel(selectedDay)}
                onPrevious={() => setSelectedDay((day) => Math.max(14, day - 1))}
                onNext={() => setSelectedDay((day) => Math.min(20, day + 1))}
              />
              <ScheduleDateStrip
                selectedDay={selectedDay}
                onChange={(day) => {
                  setLoading(true);
                  setSelectedDay(day);
                }}
              />
              <ViewSegmentedControl value={viewMode} onChange={setViewMode} />
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
