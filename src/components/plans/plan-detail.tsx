import { ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Plan, PlanAccent, PlanIcon } from '../../domain/models';
import { getPlanDisplayStatus } from '../../domain/plan-display';
import { getPlanDisplayTime } from '../../domain/plan-time';
import { getPlanDateLabel, getPlanDateTimeLabel } from '../../domain/schedule';
import { accentColors, radii, shadow, spacing } from '../../theme/tokens';
import { JourneyTimeline } from './journey-timeline';
import { PlanExpenseBreakdown } from './plan-expense-breakdown';

/** 详情页三个互斥内容标签。 */
export type DetailTab = 'journey' | 'expenses' | 'info';

const accentLabels: Record<PlanAccent, string> = {
  green: '绿色', orange: '橙色', blue: '蓝色', purple: '紫色', red: '红色', teal: '青色',
};

const iconLabels: Record<PlanIcon, string> = {
  image: '图片图标', utensils: '餐饮图标', 'shopping-bag': '购物图标', tent: '露营图标',
  film: '电影图标', gift: '礼物图标', star: '星标图标', coffee: '咖啡图标',
};

/** 将结构感知状态转换为详情页统一中文文案。 */
function getPlanStatusLabel(plan: Plan) {
  const status = getPlanDisplayStatus(plan);
  return status === 'draft' ? '草稿'
    : status === 'unselected' ? '待选择'
      : status === 'completed' ? '已完成'
        : '待执行';
}

/** 详情页顶部导航栏。 */
export function DetailTopBar({ onBack }: { onBack: () => void }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return <View style={styles.topBar}><Pressable accessibilityLabel="返回" onPress={onBack} style={styles.iconButton}><ArrowLeft size={25} color={theme.colors.text} /></Pressable><Text style={styles.pageTitle}>计划详情</Text></View>;
}

/** 展示计划主题、日期时间和由阶段完整性推导出的状态。 */
export function PlanHero({ plan }: { plan: Plan }) {
  const { styles } = useThemedStyles(createStyles);
  const accent = accentColors[plan.accent];
  const displayStatus = getPlanDisplayStatus(plan);
  const label = getPlanStatusLabel(plan);
  return <View style={styles.hero}><View style={[styles.heroIcon, { backgroundColor: accent.solid }]}><ImageIcon size={28} color="#FFFFFF" /></View><View style={styles.heroContent}><View style={styles.heroTitleRow}><Text numberOfLines={1} style={styles.heroTitle}>{plan.title}</Text><View style={[styles.status, displayStatus === 'completed' && styles.statusDone]}><Text style={styles.statusText}>{label}</Text></View></View><Text style={styles.meta}>{getPlanDateTimeLabel(plan)}</Text></View>{plan.notes ? <Text style={styles.notes}>{plan.notes}</Text> : null}</View>;
}

/** 在行程、已确定费用和计划信息之间切换。 */
export function DetailTabs({ value, onChange }: { value: DetailTab; onChange: (tab: DetailTab) => void }) {
  const { styles } = useThemedStyles(createStyles);
  const tabs: { id: DetailTab; label: string }[] = [{ id: 'journey', label: '行程' }, { id: 'expenses', label: '费用' }, { id: 'info', label: '计划信息' }];
  return <View accessibilityRole="tablist" style={styles.tabs}>{tabs.map((tab) => { const selected = tab.id === value; return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={tab.id} onPress={() => onChange(tab.id)} style={styles.tab}><Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>{selected ? <View style={styles.indicator} /> : null}</Pressable>; })}</View>;
}

/** 展示不参与阶段预算计算的计划基础信息。 */
export function PlanInfoPanel({ plan }: { plan: Plan }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.info}><InfoRow label="计划名称" value={plan.title} /><InfoRow label="日期" value={getPlanDateLabel(plan.dateKey)} /><InfoRow label="时间" value={getPlanDisplayTime(plan).label} /><InfoRow label="状态" value={getPlanStatusLabel(plan)} /><InfoRow label="主题" value={`${accentLabels[plan.accent]} · ${iconLabels[plan.icon]}`} swatchColor={accentColors[plan.accent].solid} /><InfoRow label="备注" value={plan.notes || '无'} /></View>;
}
/** 计划信息面板的统一键值行。 */
function InfoRow({ label, value, swatchColor }: { label: string; value: string; swatchColor?: string }) { const { styles } = useThemedStyles(createStyles); return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><View style={styles.infoValueGroup}>{swatchColor ? <View accessibilityLabel={`${value}主题色`} style={[styles.themeSwatch, { backgroundColor: swatchColor }]} /> : null}<Text style={styles.infoValue}>{value}</Text></View></View>; }

/** 单次计划不保留行程标签状态，加载后统一落到费用内容。 */
export function getValidDetailTab(structureKind: Plan['structureKind'], current: DetailTab): DetailTab {
  return structureKind === 'single' ? 'expenses' : current;
}

/** 按显式结构分流详情主体，避免单次计划暴露行程和标签概念。 */
export function PlanDetailContent({
  plan,
  tab,
  onTabChange,
  onSelectVariant,
}: {
  plan: Plan;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onSelectVariant: (stageId: string, variantId: string) => void;
}) {
  const { styles } = useThemedStyles(createStyles);
  if (plan.structureKind === 'single') {
    return <View><Text style={styles.sectionTitle}>费用明细</Text><PlanExpenseBreakdown plan={plan} /><Text style={styles.sectionTitle}>计划信息</Text><PlanInfoPanel plan={plan} /></View>;
  }

  return <View><DetailTabs value={tab} onChange={onTabChange} />
    {tab === 'info' ? <PlanInfoPanel plan={plan} /> : null}
    {tab === 'journey' ? <JourneyTimeline plan={plan} onSelect={onSelectVariant} /> : null}
    {tab === 'expenses' ? <PlanExpenseBreakdown plan={plan} /> : null}
  </View>;
}

/** 详情页固定底部操作栏。 */
export function DetailActionBar({ completed, onEdit, onToggleCompleted }: { completed: boolean; onEdit: () => void; onToggleCompleted: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.actionBar}><Pressable onPress={onEdit} style={styles.secondary}><Text style={styles.secondaryText}>编辑计划</Text></Pressable><Pressable onPress={onToggleCompleted} style={styles.primary}><Text style={styles.primaryText}>{completed ? '取消完成' : '标记完成'}</Text></Pressable></View>;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  topBar: { position: 'relative', height: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center' }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 }, pageTitle: { position: 'absolute', left: 56, right: 56, textAlign: 'center', fontSize: 17, fontWeight: '700', color: theme.colors.text },
  hero: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, heroIcon: { width: 64, height: 64, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', ...shadow }, heroContent: { flex: 1, minWidth: 0 }, heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, heroTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: theme.colors.text }, status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.sm, backgroundColor: theme.colors.primaryLight }, statusDone: { backgroundColor: theme.colors.completedLight }, statusText: { fontSize: 11, fontWeight: '600', color: theme.colors.primaryDark }, meta: { marginTop: spacing.sm, fontSize: 13, color: theme.colors.textSecondary }, notes: { width: '100%', marginTop: spacing.sm, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  tabs: { height: 52, flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.divider }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center' }, tabText: { fontSize: 14, color: theme.colors.textSecondary }, tabTextSelected: { fontWeight: '700', color: theme.colors.primaryDark }, indicator: { position: 'absolute', bottom: 0, width: 48, height: 3, borderRadius: 2, backgroundColor: theme.colors.primary },
  info: { margin: spacing.lg, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.lg }, infoRow: { minHeight: 58, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.divider }, infoLabel: { width: 82, fontSize: 12, color: theme.colors.textSecondary }, infoValueGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, infoValue: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.text }, themeSwatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { marginHorizontal: spacing.lg, marginTop: spacing.lg, fontSize: 14, lineHeight: 20, fontWeight: '700', color: theme.colors.text },
  actionBar: { minHeight: 72, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider, backgroundColor: theme.colors.surface }, secondary: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md }, secondaryText: { fontSize: 12, fontWeight: '600', color: theme.colors.text }, primary: { flex: 1.15, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, backgroundColor: theme.colors.primary }, primaryText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  });
}
