import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../../theme/create-theme';
import { useThemedStyles } from '../../theme/use-themed-styles';

import type { PlanStructureKind } from '../../domain/models';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  value: PlanStructureKind;
  singleDisabledReason: string | null;
  onChange: (value: PlanStructureKind) => void;
};

/** 在单次和行程录入路径之间切换，并明确展示无损转换限制。 */
export function PlanStructureControl({ value, singleDisabledReason, onChange }: Props) {
  const { styles } = useThemedStyles(createStyles);
  const singleDisabled = value === 'journey' && Boolean(singleDisabledReason);
  return (
    <View>
      <View accessibilityRole="tablist" style={styles.control}>
        <StructureOption
          active={value === 'single'}
          disabled={singleDisabled}
          label="单次计划"
          onPress={() => onChange('single')}
        />
        <StructureOption
          active={value === 'journey'}
          disabled={false}
          label="行程计划"
          onPress={() => onChange('journey')}
        />
      </View>
      {singleDisabledReason && value === 'journey' ? (
        <Text style={styles.reason}>{singleDisabledReason}</Text>
      ) : null}
    </View>
  );
}

/** 单个分段选项使用 tab 语义，便于键盘和读屏用户识别当前结构。 */
function StructureOption({ active, disabled, label, onPress }: {
  active: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, active && styles.optionActive, disabled && styles.optionDisabled]}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  control: { height: 42, padding: 3, flexDirection: 'row', borderRadius: radii.md, backgroundColor: theme.colors.surfaceMuted },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  optionActive: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  optionDisabled: { opacity: 0.42 },
  optionText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  optionTextActive: { color: theme.colors.primaryDark },
  reason: { marginTop: spacing.xs, fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary },
  });
}
