import { ArrowDown, ArrowUp, ChevronDown, Ellipsis, Repeat2, Trash2 } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlanFormStage, PlanValidationErrors } from '../../domain/plan-form';
import { convertChoiceStageToFixed, convertFixedStageToChoice } from '../../domain/stage-form-actions';
import { radii, spacing } from '../../theme/tokens';
import { ChoiceStageEditor } from './choice-stage-editor';
import { DateTimeField } from './date-time-field';
import { FormInput } from './expense-editor';
import { FixedStageEditor } from './fixed-stage-editor';

/** 编辑阶段的名称、可选时间和费用，把低频操作收进“更多”。 */
export function JourneyStageEditor({ stage, index, count, errors, focusExpenseId, onFocusHandled, onChange, onMove, onRemove }: {
  stage: PlanFormStage; index: number; count: number; errors: PlanValidationErrors;
  focusExpenseId?: string | null; onFocusHandled?: () => void;
  onChange: (stage: PlanFormStage) => void; onMove: (offset: number) => void; onRemove: () => void;
}) {
  const { styles, theme } = useThemedStyles(createStyles);
  const [moreOpen, setMoreOpen] = useState(false);
  const prefix = `stages.${index}`;

  /** 固定转可选无损；可选转固定需提示只保留一个方案。 */
  const convert = () => {
    if (stage.kind === 'fixed') {
      onChange(convertFixedStageToChoice(stage, createId('variant')));
      return;
    }
    const retained = stage.variants.find((variant) => variant.id === stage.selectedVariantId) ?? stage.variants[0];
    if (!retained) { showMessage('无法转换', '请先添加一个方案，再将该方案的费用保留为固定费用。'); return; }
    confirmAction('转为固定阶段', `将只保留“${retained.name || '未命名方案'}”的费用，其他方案会删除。`, () => onChange(convertChoiceStageToFixed(stage, retained.id)));
  };

  return <View style={styles.card}>
    <View style={styles.primaryFields}>
      <FormInput compact error={errors[`${prefix}.name`]} label="阶段名称" maxLength={30} onChangeText={(name) => onChange({ ...stage, name })} placeholder={`阶段 ${index + 1}`} value={stage.name} />
      <View style={styles.timeField}><DateTimeField clearable compact emptyLabel="时间未设置" error={errors[`${prefix}.startTime`]} label="开始时间（选填）" mode="time" onChange={(startTime) => onChange({ ...stage, startTime })} value={stage.startTime} /></View>
      <Pressable accessibilityLabel="阶段更多操作" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen((open) => !open)} style={styles.moreButton}>{moreOpen ? <ChevronDown size={19} color={theme.colors.textSecondary} /> : <Ellipsis size={19} color={theme.colors.textSecondary} />}</Pressable>
    </View>
    <Text style={styles.kind}>{stage.kind === 'fixed' ? '固定阶段' : '可选阶段'}</Text>
    <View style={styles.body}>
      {stage.kind === 'fixed' ? <FixedStageEditor stage={stage} stageIndex={index} errors={errors} focusExpenseId={focusExpenseId} onChange={onChange} onFocusHandled={onFocusHandled} /> : <ChoiceStageEditor stage={stage} stageIndex={index} errors={errors} focusExpenseId={focusExpenseId} onChange={onChange} onFocusHandled={onFocusHandled} />}
      {moreOpen ? <View style={styles.morePanel}>
        <FormInput error={errors[`${prefix}.notes`]} label="阶段备注" maxLength={200} multiline onChangeText={(notes) => onChange({ ...stage, notes })} placeholder="补充说明（选填）" value={stage.notes} />
        <View style={styles.moreActions}>
          <Pressable accessibilityLabel="上移阶段" disabled={index === 0} onPress={() => onMove(-1)} style={[styles.action, index === 0 && styles.disabled]}><ArrowUp size={17} color={theme.colors.textSecondary} /><Text style={styles.actionText}>上移</Text></Pressable>
          <Pressable accessibilityLabel="下移阶段" disabled={index === count - 1} onPress={() => onMove(1)} style={[styles.action, index === count - 1 && styles.disabled]}><ArrowDown size={17} color={theme.colors.textSecondary} /><Text style={styles.actionText}>下移</Text></Pressable>
          <Pressable accessibilityLabel="转换阶段类型" onPress={convert} style={styles.action}><Repeat2 size={17} color={theme.colors.textSecondary} /><Text style={styles.actionText}>转为{stage.kind === 'fixed' ? '可选' : '固定'}</Text></Pressable>
          <Pressable accessibilityLabel="删除阶段" onPress={() => confirmAction('删除阶段', '阶段内的费用和方案也会删除，是否继续？', onRemove)} style={styles.action}><Trash2 size={17} color={theme.colors.danger} /><Text style={styles.deleteText}>删除</Text></Pressable>
        </View>
      </View> : null}
    </View>
  </View>;
}

/** 本地实体 ID 仅需在当前草稿中保持唯一。 */
function createId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
/** Web 和原生端使用各自可执行的提示接口。 */
function showMessage(title: string, message: string) { if (Platform.OS === 'web') { globalThis.alert(`${title}\n\n${message}`); return; } Alert.alert(title, message); }
/** 删除和有损阶段转换都必须经过二次确认。 */
function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') { if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm(); return; }
  Alert.alert(title, message, [{ text: '取消', style: 'cancel' }, { text: '继续', style: 'destructive', onPress: onConfirm }]);
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  card: { marginBottom: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface }, primaryFields: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }, timeField: { width: 126 }, moreButton: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' }, kind: { marginTop: spacing.xs, fontSize: 10, color: theme.colors.textSecondary }, body: { marginTop: spacing.sm },
  morePanel: { marginTop: spacing.md, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider }, moreActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, action: { minHeight: 38, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md }, actionText: { fontSize: 11, color: theme.colors.textSecondary }, deleteText: { fontSize: 11, color: theme.colors.danger }, disabled: { opacity: 0.35 },
  });
}
