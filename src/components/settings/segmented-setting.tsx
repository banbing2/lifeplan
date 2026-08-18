import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../../theme/appearance-provider';
import type { AppTheme } from '../../theme/create-theme';

type Option<T extends string> = { value: T; label: string };

/** 设置页共用的单选分段控件。 */
export function SegmentedSetting<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly Option<T>[];
  onChange(value: T): void | Promise<void>;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View accessibilityRole="tablist" style={styles.control}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    control: {
      minHeight: 42,
      padding: 3,
      flexDirection: 'row',
      gap: 3,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    option: {
      flex: 1,
      minWidth: 0,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.sm,
    },
    optionSelected: { backgroundColor: theme.colors.primary },
    label: {
      fontSize: theme.fontSize(12),
      fontWeight: theme.fontWeight('medium'),
      color: theme.colors.textSecondary,
    },
    labelSelected: { color: theme.colors.onPrimary, fontWeight: theme.fontWeight('strong') },
  });
}
