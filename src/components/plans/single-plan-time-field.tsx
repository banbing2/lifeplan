import { Clock3, Sun } from 'lucide-react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../../theme/tokens';
import { DateTimeField } from './date-time-field';

type Props = {
  isAllDay: boolean;
  time: string;
  error?: string;
  onChange: (value: { isAllDay: boolean; time: string }) => void;
};

/** 单次计划的合并时间字段：先选择全天或具体时刻，再按需打开时间选择器。 */
export function SinglePlanTimeField({ isAllDay, time, error, onChange }: Props) {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>时间</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="全天计划"
          accessibilityState={{ selected: isAllDay }}
          onPress={() => onChange({ isAllDay: true, time })}
          style={[styles.mode, isAllDay && styles.modeActive]}
        >
          <Sun size={16} color={isAllDay ? theme.colors.primaryDark : theme.colors.textSecondary} />
          <Text style={[styles.modeText, isAllDay && styles.modeTextActive]}>全天</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="具体时刻"
          accessibilityState={{ selected: !isAllDay }}
          onPress={() => onChange({ isAllDay: false, time: time || '09:00' })}
          style={[styles.mode, !isAllDay && styles.modeActive]}
        >
          <Clock3 size={16} color={!isAllDay ? theme.colors.primaryDark : theme.colors.textSecondary} />
          <Text style={[styles.modeText, !isAllDay && styles.modeTextActive]}>具体时刻</Text>
        </Pressable>
      </View>
      {!isAllDay ? (
        <DateTimeField
          compact
          error={error}
          hideLabel
          label="具体时刻"
          mode="time"
          onChange={(nextTime) => onChange({ isAllDay: false, time: nextTime })}
          value={time}
        />
      ) : error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  fieldGroup: { flex: 1, minWidth: 0 },
  label: { marginBottom: 6, fontSize: 12, lineHeight: 17, fontWeight: '600', color: theme.colors.textSecondary },
  row: { height: 42, padding: 3, flexDirection: 'row', gap: 2, borderWidth: 1, borderColor: theme.colors.border, borderRadius: radii.md, backgroundColor: theme.colors.surfaceMuted },
  mode: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.sm },
  modeActive: { backgroundColor: theme.colors.surface },
  modeText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  modeTextActive: { color: theme.colors.primaryDark },
  error: { marginTop: 5, fontSize: 11, color: theme.colors.danger },
  });
}
