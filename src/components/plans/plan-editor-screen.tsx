import { ArrowLeft, AlertTriangle } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppFrame } from '@/components/layout/app-frame';
import {
  createEmptyPlanDraft,
  planFromDraft,
  planToDraft,
  validatePlanDraft,
  type PlanFormDraft,
  type PlanValidationErrors,
} from '@/domain/plan-form';
import type { Plan } from '@/domain/models';
import { createPlanRepository } from '@/repositories/plan-repository';
import { radii, shadow, spacing } from '@/theme/tokens';
import { PlanEditor } from './plan-editor';

type PlanEditorScreenProps = {
  mode: 'create' | 'edit';
  planId?: string;
  initialDateKey?: string;
};

/**
 * 新建与编辑共用的页面控制器，负责加载、校验、事务保存和脏表单离开保护。
 */
export function PlanEditorScreen({ mode, planId, initialDateKey }: PlanEditorScreenProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const repository = useMemo(() => createPlanRepository(db), [db]);
  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);
  const initialDate = initialDateKey && initialDateKey >= todayKey ? initialDateKey : todayKey;
  const newDraft = useMemo(
    () => createEmptyPlanDraft({ id: createLocalId('plan'), dateKey: initialDate }),
    [initialDate],
  );
  const [draft, setDraft] = useState<PlanFormDraft>(newDraft);
  const [existingPlan, setExistingPlan] = useState<Plan | null>(null);
  const [initialSignature, setInitialSignature] = useState(mode === 'create' ? signature(newDraft) : '');
  const [errors, setErrors] = useState<PlanValidationErrors>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardAction, setDiscardAction] = useState<null | (() => void)>(null);
  const allowLeave = useRef(false);
  const dirty = !loading && signature(draft) !== initialSignature;

  /** 编辑模式下加载计划，并同时建立脏表单比较基线。 */
  const loadPlan = useCallback(async () => {
    if (mode !== 'edit' || !planId) return;
    try {
      setLoadError(null);
      const plan = await repository.getPlan(planId);
      if (!plan) throw new Error('计划不存在');
      const nextDraft = planToDraft(plan);
      setExistingPlan(plan);
      setDraft(nextDraft);
      setInitialSignature(signature(nextDraft));
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : '计划加载失败');
    } finally {
      setLoading(false);
    }
  }, [mode, planId, repository]);

  useEffect(() => {
    // Repository 加载是外部异步同步流程，页面挂载时只触发一次受控状态更新链。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPlan();
  }, [loadPlan]);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!dirty || allowLeave.current) return;
        event.preventDefault();
        setDiscardAction(() => () => {
          allowLeave.current = true;
          navigation.dispatch(event.data.action);
        });
      }),
    [dirty, navigation],
  );

  /** 离开页面前检查是否存在未保存修改。 */
  const requestLeave = () => {
    if (!dirty) {
      router.back();
      return;
    }
    setDiscardAction(() => () => {
      allowLeave.current = true;
      router.back();
    });
  };

  /** 校验表单后，通过 Repository 创建或更新完整计划聚合。 */
  const save = async () => {
    const validationErrors = validatePlanDraft(draft, {
      mode,
      todayKey,
      originalDateKey: existingPlan?.dateKey,
    });
    setErrors(validationErrors);
    setSaveError(null);
    if (Object.keys(validationErrors).length) {
      setSaveError('请检查标红的必填项');
      return;
    }

    setSaving(true);
    try {
      const plan = planFromDraft(draft, existingPlan ?? undefined);
      if (mode === 'create') {
        await repository.createPlan(plan);
        allowLeave.current = true;
        setInitialSignature(signature(draft));
        router.replace({ pathname: '/plan/[id]', params: { id: plan.id } });
      } else {
        await repository.updatePlan(plan);
        allowLeave.current = true;
        setInitialSignature(signature(draft));
        router.back();
      }
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppFrame>
      <View style={styles.screen}>
        <EditorTopBar mode={mode} onBack={requestLeave} />
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable onPress={() => void loadPlan()} style={styles.retryButton}>
              <Text style={styles.retryText}>重试</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {saveError ? (
              <View style={styles.saveErrorBanner}>
                <AlertTriangle size={17} color={theme.colors.danger} />
                <Text style={styles.saveErrorText}>{saveError}</Text>
              </View>
            ) : null}
            <PlanEditor
              draft={draft}
              errors={errors}
              minimumDateKey={existingPlan?.dateKey && existingPlan.dateKey < todayKey ? existingPlan.dateKey : todayKey}
              onCancel={requestLeave}
              onChange={(nextDraft) => {
                setDraft(nextDraft);
                setErrors({});
                setSaveError(null);
              }}
              onSave={() => void save()}
              saving={saving}
            />
          </>
        )}
        <DiscardChangesModal
          onContinue={() => setDiscardAction(null)}
          onDiscard={() => {
            const action = discardAction;
            setDiscardAction(null);
            action?.();
          }}
          visible={discardAction !== null}
        />
      </View>
    </AppFrame>
  );
}

/** 根据页面模式展示新建或编辑标题。 */
function EditorTopBar({ mode, onBack }: { mode: 'create' | 'edit'; onBack: () => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityLabel="返回" onPress={onBack} style={styles.iconButton}>
        <ArrowLeft size={24} color={theme.colors.text} />
      </Pressable>
      <Text style={styles.pageTitle}>{mode === 'create' ? '新建计划' : '编辑计划'}</Text>
      <View style={styles.iconButton} />
    </View>
  );
}

/** 脏表单离开确认弹层，继续编辑不会丢失当前草稿。 */
function DiscardChangesModal({
  visible,
  onContinue,
  onDiscard,
}: {
  visible: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <Modal animationType="fade" onRequestClose={onContinue} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.discardModal}>
          <Text style={styles.modalTitle}>放弃未保存的修改？</Text>
          <Text style={styles.modalText}>当前填写的内容尚未保存。</Text>
          <View style={styles.modalActions}>
            <Pressable accessibilityLabel="继续编辑" onPress={onContinue} style={styles.modalSecondary}>
              <Text style={styles.modalSecondaryText}>继续编辑</Text>
            </Pressable>
            <Pressable accessibilityLabel="放弃修改" onPress={onDiscard} style={styles.modalDanger}>
              <Text style={styles.modalDangerText}>放弃修改</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** 为尚未持久化的计划生成本地 ID。 */
function createLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 使用本地时区生成 YYYY-MM-DD，避免 UTC 转换导致日期偏移。 */
function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 生成草稿快照，用于判断是否存在未保存修改。 */
function signature(draft: PlanFormDraft) {
  return JSON.stringify(draft);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.screen },
  topBar: { height: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: theme.colors.text },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  errorText: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: theme.colors.danger },
  retryButton: { minWidth: 92, minHeight: 44, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: theme.colors.primary },
  retryText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  saveErrorBanner: { minHeight: 42, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FFF0F0' },
  saveErrorText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.danger },
  modalBackdrop: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,26,23,0.42)' },
  discardModal: { width: '100%', maxWidth: 350, padding: spacing.xl, borderRadius: radii.lg, backgroundColor: theme.colors.surface, ...shadow },
  modalTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: theme.colors.text },
  modalText: { marginTop: spacing.sm, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  modalActions: { marginTop: spacing.xl, flexDirection: 'row', gap: spacing.sm },
  modalSecondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md },
  modalSecondaryText: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  modalDanger: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: theme.colors.danger },
  modalDangerText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  });
}
