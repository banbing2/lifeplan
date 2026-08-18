import { Check, ChevronDown, Coffee, Film, Gift, Image as ImageIcon, MoreHorizontal, ShoppingBag, Star, Tent, Utensils, X } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { calculatePlanBudget, formatMoney } from '../../domain/budget';
import { planFromDraft, type PlanFormDraft, type PlanValidationErrors } from '../../domain/plan-form';
import { convertJourneyToSingle, convertSingleToJourney, getJourneyToSingleConversionReason } from '../../domain/plan-structure';
import type { PlanAccent, PlanIcon, PlanStructureKind } from '../../domain/models';
import { accentColors, radii, spacing } from '../../theme/tokens';
import { DateTimeField } from './date-time-field';
import { FormInput } from './expense-editor';
import { JourneyPlanEditor } from './journey-plan-editor';
import { PlanStructureControl } from './plan-structure-control';
import { SinglePlanEditor } from './single-plan-editor';
import { SinglePlanTimeField } from './single-plan-time-field';

type Props = { draft: PlanFormDraft; errors: PlanValidationErrors; saving: boolean; minimumDateKey: string; onChange: (draft: PlanFormDraft) => void; onCancel: () => void; onSave: () => void };

/** 单页编辑器只编排公共字段、结构分派、更多设置和底部保存栏。 */
export function PlanEditor({ draft, errors, saving, minimumDateKey, onChange, onCancel, onSave }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  const [moreOpen, setMoreOpen] = useState(false);
  const plan = planFromDraft(draft);
  const budget = calculatePlanBudget(plan);
  const singleDisabledReason = draft.structureKind === 'journey' ? getJourneyToSingleConversionReason(draft) : null;

  /** 结构转换只修改内存草稿，保存前不会触碰 SQLite。 */
  const setStructureKind = (structureKind: PlanStructureKind) => {
    const nextDraft = changePlanStructure(draft, structureKind);
    if (nextDraft !== draft) onChange(nextDraft);
  };

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <FormInput compact error={errors.title} label="计划名称" maxLength={50} onChangeText={(title) => onChange({ ...draft, title })} placeholder="例如：理发或周末出行" value={draft.title} />
      <View style={styles.dateTimeRow}>
        <DateTimeField compact error={errors.dateKey} label="日期" minimumDateKey={minimumDateKey} mode="date" onChange={(dateKey) => onChange({ ...draft, dateKey })} value={draft.dateKey} />
        {draft.structureKind === 'single' ? <SinglePlanTimeField error={errors.time} isAllDay={draft.isAllDay} onChange={({ isAllDay, time }) => onChange({ ...draft, isAllDay, time })} time={draft.time} /> : null}
      </View>
      <PlanStructureControl onChange={setStructureKind} singleDisabledReason={singleDisabledReason} value={draft.structureKind} />

      {draft.structureKind === 'single'
        ? <SinglePlanEditor draft={draft} errors={errors} onChange={onChange} />
        : <JourneyPlanEditor draft={draft} errors={errors} onChange={onChange} />}

      <Pressable accessibilityLabel="更多计划设置" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen((open) => !open)} style={styles.moreToggle}>
        <MoreHorizontal size={18} color={theme.colors.textSecondary} />
        <Text style={styles.moreText}>更多</Text>
        <ChevronDown size={17} color={theme.colors.textSecondary} />
      </Pressable>
      {moreOpen ? <PlanMoreSettings draft={draft} errors={errors} onChange={onChange} /> : null}
    </ScrollView>

    <View style={styles.actionBar}>
      <View style={styles.budget}>
        <Text style={styles.budgetLabel}>{budget.unselectedStageCount ? `已确定 · 还有 ${budget.unselectedStageCount} 个阶段待选择` : budget.finalTotalCents === null ? '预算待完善' : '总预算'}</Text>
        <Text style={styles.budgetValue}>{formatMoney(budget.confirmedTotalCents, true)}</Text>
      </View>
      <Pressable accessibilityLabel="取消编辑" disabled={saving} onPress={onCancel} style={styles.cancel}><X size={18} color={theme.colors.text} /></Pressable>
      <Pressable accessibilityLabel="保存计划" disabled={saving} onPress={onSave} style={[styles.save, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Check size={19} color="#FFFFFF" />}<Text style={styles.saveText}>{saving ? '保存中' : '保存'}</Text></Pressable>
    </View>
  </View>;
}

/** 使用领域转换函数切换结构；不满足无损规则时原样返回草稿。 */
export function changePlanStructure(draft: PlanFormDraft, target: PlanStructureKind): PlanFormDraft {
  if (draft.structureKind === target) return draft;
  if (draft.structureKind === 'single') return convertSingleToJourney(draft);
  const result = convertJourneyToSingle(draft);
  return result.ok ? result.draft : draft;
}

/** 折叠展示备注、主题色和图标，避免阻挡主录入路径。 */
function PlanMoreSettings({ draft, errors, onChange }: { draft: PlanFormDraft; errors: PlanValidationErrors; onChange: (draft: PlanFormDraft) => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return <View style={styles.morePanel}>
    <FormInput error={errors.notes} label="备注" maxLength={500} multiline onChangeText={(notes) => onChange({ ...draft, notes })} placeholder="补充计划说明（选填）" value={draft.notes} />
    <View><Text style={styles.settingLabel}>主题色</Text><View style={styles.swatches}>{accentOptions.map((accent) => <Pressable key={accent} accessibilityLabel={`主题色${accent}`} accessibilityState={{ selected: draft.accent === accent }} onPress={() => onChange({ ...draft, accent })} style={[styles.swatchButton, draft.accent === accent && styles.swatchSelected]}><View style={[styles.swatch, { backgroundColor: accentColors[accent].solid }]} /></Pressable>)}</View></View>
    <View><Text style={styles.settingLabel}>图标</Text><View style={styles.icons}>{iconOptions.map(({ value, label, Icon }) => <Pressable key={value} accessibilityLabel={label} accessibilityState={{ selected: draft.icon === value }} onPress={() => onChange({ ...draft, icon: value })} style={[styles.iconChoice, draft.icon === value && styles.iconChoiceSelected]}><Icon size={18} color={draft.icon === value ? theme.colors.primaryDark : theme.colors.textSecondary} /></Pressable>)}</View></View>
  </View>;
}

const accentOptions: PlanAccent[] = ['green', 'orange', 'blue', 'purple', 'red', 'teal'];
const iconOptions: { value: PlanIcon; label: string; Icon: ComponentType<{ size: number; color: string }> }[] = [
  { value: 'image', label: '图片图标', Icon: ImageIcon }, { value: 'utensils', label: '餐饮图标', Icon: Utensils },
  { value: 'shopping-bag', label: '购物图标', Icon: ShoppingBag }, { value: 'tent', label: '露营图标', Icon: Tent },
  { value: 'film', label: '电影图标', Icon: Film }, { value: 'gift', label: '礼物图标', Icon: Gift },
  { value: 'star', label: '星标图标', Icon: Star }, { value: 'coffee', label: '咖啡图标', Icon: Coffee },
];

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.screen }, scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 102 }, dateTimeRow: { marginTop: spacing.sm, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  moreToggle: { minHeight: 44, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: 1, borderTopColor: theme.colors.divider }, moreText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }, morePanel: { gap: spacing.lg, paddingBottom: spacing.lg }, settingLabel: { marginBottom: spacing.sm, fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  swatches: { flexDirection: 'row', gap: spacing.sm }, swatchButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: radii.md }, swatchSelected: { borderColor: theme.colors.primary }, swatch: { width: 24, height: 24, borderRadius: 12 }, icons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, iconChoice: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md }, iconChoiceSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  actionBar: { minHeight: 72, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider, backgroundColor: theme.colors.surface }, budget: { flex: 1, minWidth: 0 }, budgetLabel: { fontSize: 10, color: theme.colors.textSecondary }, budgetValue: { marginTop: 2, fontSize: 16, fontWeight: '700', color: theme.colors.primaryDark }, cancel: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md }, save: { minWidth: 88, height: 44, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radii.md, backgroundColor: theme.colors.primary }, saveText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' }, disabled: { opacity: 0.55 },
  });
}
