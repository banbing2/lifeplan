import type { CSSProperties } from 'react';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../../theme/tokens';
import type { DateTimeFieldProps } from './date-time-field.types';

/** Web 端日期/时间字段，复用浏览器原生 date/time 输入能力。 */
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
  const webInputStyles = createWebInputStyles(theme);
  return (
    <View style={styles.fieldGroup}>
      {!hideLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.controls}>
        {/* Web 必须渲染真实 HTML input，浏览器才会应用日期类型和最小日期约束。 */}
        <input
          aria-invalid={Boolean(error)}
          aria-label={label}
          disabled={disabled}
          min={mode === 'date' ? minimumDateKey : undefined}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            ...webInputStyles.field,
            ...(compact ? webInputStyles.compactField : {}),
            ...(disabled ? webInputStyles.disabledField : {}),
            ...(error ? webInputStyles.errorBorder : {}),
          }}
          type={mode}
          value={value}
        />
        {clearable && mode === 'time' && value ? (
          <Pressable accessibilityLabel={`清除${label}`} onPress={() => onChange('')} style={styles.clearButton}>
            <X size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {!value && emptyLabel !== '请选择' ? <Text style={styles.emptyHint}>{emptyLabel}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  fieldGroup: { flex: 1, minWidth: 0 },
  label: { marginBottom: 7, fontSize: 12, lineHeight: 17, fontWeight: '600', color: theme.colors.textSecondary },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  clearButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surface },
  emptyHint: { marginTop: 4, fontSize: 10, color: theme.colors.textMuted },
  errorText: { marginTop: 5, fontSize: 11, lineHeight: 15, color: theme.colors.danger },
  });
}

/** HTML input 使用独立样式对象，避免 React Native 样式数组被 DOM 忽略。 */
function createWebInputStyles(theme: AppTheme): Record<'field' | 'disabledField' | 'compactField' | 'errorBorder', CSSProperties> {
  return {
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    boxSizing: 'border-box',
    padding: `0 ${spacing.md}px`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: radii.md,
    backgroundColor: theme.colors.surface,
    fontFamily: 'inherit',
    fontSize: 14,
    letterSpacing: 0,
    color: theme.colors.text,
  },
  disabledField: { backgroundColor: theme.colors.surfaceMuted, color: theme.colors.textMuted },
  compactField: { minHeight: 42, padding: `0 ${spacing.sm}px` },
  errorBorder: { borderColor: theme.colors.danger },
  };
}
