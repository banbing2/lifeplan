import { Check } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ColorScheme } from '../../domain/app-settings';
import { useAppTheme } from '../../theme/appearance-provider';
import type { AppTheme } from '../../theme/create-theme';

const schemes: readonly { value: ColorScheme; label: string; color: string }[] = [
  { value: 'green', label: '绿色', color: '#169B50' },
  { value: 'blue', label: '蓝色', color: '#2878D4' },
  { value: 'coral', label: '珊瑚红', color: '#E9655C' },
  { value: 'neutral', label: '黑白中性', color: '#242A27' },
];

/** 带文字名称的配色色板，避免只依赖颜色传达选择。 */
export function ColorSchemePicker({ value, onChange }: {
  value: ColorScheme;
  onChange(value: ColorScheme): void | Promise<void>;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      {schemes.map((scheme) => {
        const selected = value === scheme.value;
        return (
          <Pressable
            accessibilityLabel={`${scheme.label}配色`}
            accessibilityState={{ selected }}
            key={scheme.value}
            onPress={() => onChange(scheme.value)}
            style={styles.option}
          >
            <View style={[styles.swatchFrame, selected && styles.swatchFrameSelected]}>
              <View style={[styles.swatch, { backgroundColor: scheme.color }]}>
                {selected ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </View>
            <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>{scheme.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
    option: { flex: 1, minWidth: 0, alignItems: 'center', gap: theme.spacing.xs },
    swatchFrame: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 21,
    },
    swatchFrameSelected: { borderColor: theme.colors.primary },
    swatch: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
    label: { fontSize: theme.fontSize(10), color: theme.colors.textSecondary },
    labelSelected: { fontWeight: theme.fontWeight('strong'), color: theme.colors.text },
  });
}
