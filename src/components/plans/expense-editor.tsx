import { Check, ChevronDown, Trash2 } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { useEffect, useRef, useState, type ComponentProps, type Ref } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import type { PlanFormExpense, PlanValidationErrors } from '../../domain/plan-form';
import type { ExpenseCategory } from '../../domain/models';
import { radii, shadow, spacing } from '../../theme/tokens';

const categories: { value: ExpenseCategory; label: string }[] = [
  { value: 'transport', label: '交通' }, { value: 'ticket', label: '门票' },
  { value: 'food', label: '餐饮' }, { value: 'lodging', label: '住宿' },
  { value: 'activity', label: '活动' }, { value: 'shopping', label: '购物' }, { value: 'other', label: '其他' },
];

type ExpenseEditorProps = {
  expense: PlanFormExpense;
  errorPrefix: string;
  errors: PlanValidationErrors;
  focusOnMount?: boolean;
  onFocusHandled?: () => void;
  onChange: (expense: PlanFormExpense) => void;
  onRemove: () => void;
};

/** 单次、固定阶段和方案共用的紧凑费用行。 */
export function ExpenseEditor({ expense, errorPrefix, errors, focusOnMount = false, onFocusHandled, onChange, onRemove }: ExpenseEditorProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const narrow = width <= 340;
  const selected = categories.find((item) => item.value === expense.category) ?? categories[6];
  const nameError = errors[`${errorPrefix}.name`];
  const amountError = errors[`${errorPrefix}.amountYuan`];

  // 新增阶段或方案后只聚焦一次，避免后续重渲染反复抢夺键盘焦点。
  useEffect(() => {
    if (!focusOnMount) return;
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
      onFocusHandled?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [focusOnMount, onFocusHandled]);

  return <View style={styles.expense}>
    <View style={[styles.row, narrow && styles.rowNarrow]}>
      <View style={[styles.nameField, narrow && styles.nameFieldNarrow]}>
        <Text style={styles.columnLabel}>名称</Text>
        <TextInput accessibilityLabel="费用名称" maxLength={30} onChangeText={(name) => onChange({ ...expense, name })} placeholder="例如：地铁" placeholderTextColor={theme.colors.textMuted} ref={nameInputRef} style={[styles.input, nameError && styles.errorBorder]} value={expense.name} />
      </View>
      <View style={styles.categoryField}>
        <Text style={styles.columnLabel}>分类</Text>
        <Pressable accessibilityLabel="费用分类" onPress={() => setCategoryOpen(true)} style={styles.select}><Text numberOfLines={1} style={styles.value}>{selected.label}</Text><ChevronDown size={14} color={theme.colors.textSecondary} /></Pressable>
      </View>
      <View style={styles.amountField}>
        <Text style={styles.columnLabel}>金额</Text>
        <TextInput accessibilityLabel="金额（元）" keyboardType="decimal-pad" onChangeText={(amountYuan) => onChange({ ...expense, amountYuan })} placeholder="0.00" placeholderTextColor={theme.colors.textMuted} style={[styles.input, amountError && styles.errorBorder]} value={expense.amountYuan} />
      </View>
      <Pressable accessibilityLabel="删除费用" onPress={onRemove} style={styles.iconButton}><Trash2 size={17} color={theme.colors.danger} /></Pressable>
    </View>
    {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
    {amountError ? <Text style={styles.error}>{amountError}</Text> : null}
    <Modal animationType="fade" onRequestClose={() => setCategoryOpen(false)} transparent visible={categoryOpen}>
      <Pressable onPress={() => setCategoryOpen(false)} style={styles.backdrop}><View style={styles.menu}>
        <Text style={styles.menuTitle}>选择费用分类</Text>
        {categories.map((item) => <Pressable key={item.value} onPress={() => { onChange({ ...expense, category: item.value }); setCategoryOpen(false); }} style={styles.menuItem}>
          <Text style={[styles.value, item.value === expense.category && styles.selected]}>{item.label}</Text>
          {item.value === expense.category ? <Check size={18} color={theme.colors.primary} /> : null}
        </Pressable>)}
      </View></Pressable>
    </Modal>
  </View>;
}

/** 统一标签、错误态和多行样式的表单输入组件。 */
export function FormInput({ label, error, multiline = false, inputRef, compact = false, ...props }: ComponentProps<typeof TextInput> & { label: string; error?: string; inputRef?: Ref<TextInput>; compact?: boolean }) {
  const { styles, theme } = useThemedStyles(createStyles);
  return <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput placeholderTextColor={theme.colors.textMuted} ref={inputRef} style={[styles.formInput, compact && styles.formInputCompact, multiline && styles.multiline, error && styles.errorBorder]} textAlignVertical={multiline ? 'top' : 'center'} multiline={multiline} {...props} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  expense: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 }, rowNarrow: { flexWrap: 'wrap' },
  nameField: { flex: 1, minWidth: 72 }, nameFieldNarrow: { flexBasis: '100%' }, categoryField: { width: 76 }, amountField: { width: 82 },
  columnLabel: { marginBottom: 3, fontSize: 10, lineHeight: 14, fontWeight: '600', color: theme.colors.textSecondary },
  input: { height: 40, minWidth: 0, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface, fontSize: 13, color: theme.colors.text },
  select: { height: 40, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface },
  value: { minWidth: 0, fontSize: 13, color: theme.colors.text }, iconButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { flex: 1, minWidth: 0 }, label: { marginBottom: 6, fontSize: 12, lineHeight: 17, fontWeight: '600', color: theme.colors.textSecondary },
  formInput: { minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface, fontSize: 14, color: theme.colors.text },
  formInputCompact: { minHeight: 42, paddingVertical: spacing.sm }, multiline: { minHeight: 76 }, errorBorder: { borderColor: theme.colors.danger }, error: { marginTop: 4, fontSize: 11, lineHeight: 15, color: theme.colors.danger }, selected: { fontWeight: '700', color: theme.colors.primaryDark },
  backdrop: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,26,23,0.42)' },
  menu: { width: '100%', maxWidth: 360, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: theme.colors.surface, ...shadow }, menuTitle: { marginBottom: spacing.sm, fontSize: 16, fontWeight: '700', color: theme.colors.text },
  menuItem: { minHeight: 46, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  });
}
