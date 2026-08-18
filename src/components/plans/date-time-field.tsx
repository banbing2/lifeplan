import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { CalendarDays, Check, Clock3, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../../theme/tokens';
import type { DateTimeFieldProps } from './date-time-field.types';

/** 原生端日期/时间字段，点击后使用系统 DateTimePicker。 */
export function DateTimeField({
  label,
  mode,
  value,
  minimumDateKey,
  disabled = false,
  clearable = false,
  compact = false,
  emptyLabel = '请选择',
  hideLabel = false,
  error,
  onChange,
}: DateTimeFieldProps) {
  const { styles, theme } = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const pickerValue = parsePickerValue(value, mode);
  const minimumDate = minimumDateKey ? parsePickerValue(minimumDateKey, 'date') : undefined;

  /** 接收系统选择结果；Android 在一次选择后自动关闭弹层。 */
  const handleChange = (event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type !== 'set' || !next) return;
    onChange(mode === 'date' ? formatDateKey(next) : formatTime(next));
  };

  return (
    <View style={styles.fieldGroup}>
      {!hideLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel={label}
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={[styles.field, compact && styles.compactField, disabled && styles.disabledField, error && styles.errorBorder]}
        >
          {mode === 'date' ? <CalendarDays size={18} color={theme.colors.textSecondary} /> : <Clock3 size={18} color={theme.colors.textSecondary} />}
          <Text style={[styles.value, disabled && styles.disabledText]}>{value || emptyLabel}</Text>
        </Pressable>
        {clearable && mode === 'time' && value ? (
          <Pressable accessibilityLabel={`清除${label}`} onPress={() => { setOpen(false); onChange(''); }} style={styles.clearButton}>
            <X size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {open ? (
        <View style={styles.pickerArea}>
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={mode === 'date' ? minimumDate : undefined}
            mode={mode}
            onChange={handleChange}
            value={pickerValue}
          />
          {Platform.OS === 'ios' ? (
            <Pressable accessibilityLabel="完成选择" onPress={() => setOpen(false)} style={styles.doneButton}>
              <Check size={17} color="#FFFFFF" />
              <Text style={styles.doneText}>完成</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** 将表单字符串转换为系统选择器需要的 Date 对象。 */
function parsePickerValue(value: string, mode: 'date' | 'time') {
  const now = new Date();
  if (mode === 'date') {
    const [year, month, day] = value.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day, 12) : now;
  }
  const [hour, minute] = value.split(':').map(Number);
  if (Number.isInteger(hour) && Number.isInteger(minute)) now.setHours(hour, minute, 0, 0);
  return now;
}

/** 将系统选择结果格式化为本地 YYYY-MM-DD。 */
function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 将系统选择结果格式化为 24 小时 HH:mm。 */
function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  fieldGroup: { flex: 1, minWidth: 0 },
  label: { marginBottom: 7, fontSize: 12, lineHeight: 17, fontWeight: '600', color: theme.colors.textSecondary },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  field: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: radii.md,
    backgroundColor: theme.colors.surface,
  },
  disabledField: { backgroundColor: theme.colors.surfaceMuted },
  compactField: { minHeight: 42, paddingHorizontal: spacing.sm },
  clearButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface },
  value: { flex: 1, fontSize: 14, color: theme.colors.text },
  disabledText: { color: theme.colors.textMuted },
  errorBorder: { borderColor: theme.colors.danger },
  errorText: { marginTop: 5, fontSize: 11, lineHeight: 15, color: theme.colors.danger },
  pickerArea: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.md, backgroundColor: theme.colors.surfaceMuted },
  doneButton: {
    minHeight: 40,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radii.md,
    backgroundColor: theme.colors.primary,
  },
  doneText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  });
}
