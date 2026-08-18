import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { AppTheme } from '@/theme/create-theme';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppFrame } from '@/components/layout/app-frame';
import {
  DetailActionBar,
  getValidDetailTab,
  PlanDetailContent,
  DetailTopBar,
  PlanHero,
  type DetailTab,
} from '@/components/plans/plan-detail';
import type { Plan } from '@/domain/models';
import { goBackOrHome, handleCompletionToggleSuccess } from '@/navigation/go-back';
import { createPlanRepository } from '@/repositories/plan-repository';
import { spacing } from '@/theme/tokens';

/** 计划详情路由，负责聚合加载、阶段方案切换和完成状态更新。 */
export default function PlanDetailScreen() {
  const { styles, theme } = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const repository = useMemo(() => createPlanRepository(db), [db]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<DetailTab>('journey');
  const [error, setError] = useState<string | null>(null);

  /** 从 Repository 重新加载完整计划聚合。 */
  const loadPlan = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const loadedPlan = await repository.getPlan(id);
      setPlan(loadedPlan);
      // 路由复用或编辑改变结构时，清除单次计划无法使用的行程标签。
      if (loadedPlan) setTab((current) => getValidDetailTab(loadedPlan.structureKind, current));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '计划加载失败');
    }
  }, [id, repository]);

  useFocusEffect(
    useCallback(() => {
      void loadPlan();
    }, [loadPlan]),
  );

  /** 切换单个阶段方案；其他阶段的选择不会被改写。 */
  const selectVariant = async (stageId: string, variantId: string) => {
    if (!plan) return;
    const stage = plan.stages.find((item) => item.id === stageId);
    if (stage?.kind !== 'choice' || variantId === stage.selectedVariantId) return;
    try {
      const updated = await repository.selectStageVariant(plan.id, stageId, variantId);
      if (!updated) throw new Error('方案切换失败');
      await loadPlan();
    } catch (reason) {
      Alert.alert('操作失败', reason instanceof Error ? reason.message : '请稍后重试');
    }
  };

  /** 标记完成后返回来源列表；取消完成后刷新当前详情。 */
  const toggleCompleted = async () => {
    if (!plan) return;
    try {
      const wasCompleted = plan.status === 'completed';
      await repository.toggleCompleted(plan.id);
      await handleCompletionToggleSuccess({ wasCompleted, router, reloadPlan: loadPlan });
    } catch (reason) {
      Alert.alert('操作失败', reason instanceof Error ? reason.message : '请稍后重试');
    }
  };

  return (
    <AppFrame>
      <View style={styles.screen}>
        <DetailTopBar onBack={() => goBackOrHome(router)} />
        {error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : !plan ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <PlanHero plan={plan} />
              <PlanDetailContent
                plan={plan}
                tab={tab}
                onTabChange={setTab}
                onSelectVariant={(stageId, variantId) => void selectVariant(stageId, variantId)}
              />
            </ScrollView>
            <DetailActionBar
              completed={plan.status === 'completed'}
              onEdit={() => router.push({ pathname: '/plan/[id]/edit', params: { id: plan.id } })}
              onToggleCompleted={() => void toggleCompleted()}
            />
          </>
        )}
      </View>
    </AppFrame>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.screen },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.lg },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  errorText: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: theme.colors.danger },
  });
}
