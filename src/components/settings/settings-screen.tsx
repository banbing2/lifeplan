import { ArrowLeft, Database } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import type { ColorMode, FontSizeLevel, FontWeightLevel } from '../../domain/app-settings';
import { formatStorageSize, type SqliteStorageUsage } from '../../services/sqlite-storage-usage';
import { getSqliteStorageUsage } from '../../services/sqlite-storage-runtime';
import { useAppearance } from '../../theme/appearance-provider';
import type { AppTheme } from '../../theme/create-theme';
import { AppFrame } from '../layout/app-frame';
import { ColorSchemePicker } from './color-scheme-picker';
import { SegmentedSetting } from './segmented-setting';

const modeOptions: readonly { value: ColorMode; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];
const sizeOptions: readonly { value: FontSizeLevel; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'standard', label: '标准' },
  { value: 'large', label: '大' },
];
const weightOptions: readonly { value: FontWeightLevel; label: string }[] = [
  { value: 'standard', label: '标准' },
  { value: 'bold', label: '加粗' },
];

/** 全局颜色、文字和 SQLite 总占用设置页。 */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const database = useSQLiteContext();
  const appearance = useAppearance();
  const styles = useMemo(() => createStyles(appearance.theme), [appearance.theme]);
  const [usage, setUsage] = useState<SqliteStorageUsage | null>(null);

  useEffect(() => {
    let active = true;
    const loadUsage = () => {
      void getSqliteStorageUsage(database).then((result) => {
        if (active) setUsage(result);
      });
    };
    loadUsage();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadUsage();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [database]);

  const usageText = usage === null
    ? '正在读取'
    : usage.status === 'available'
      ? formatStorageSize(usage.bytes)
      : '暂时无法获取';

  return (
    <AppFrame>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="返回" hitSlop={8} onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={appearance.theme.colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>设置</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SettingSection title="外观" styles={styles}>
            <SettingItem label="显示模式" styles={styles}>
              <SegmentedSetting value={appearance.settings.colorMode} options={modeOptions} onChange={(colorMode) => appearance.updateSettings({ colorMode })} />
            </SettingItem>
            <SettingItem label="配色" styles={styles}>
              <ColorSchemePicker value={appearance.settings.colorScheme} onChange={(colorScheme) => appearance.updateSettings({ colorScheme })} />
            </SettingItem>
          </SettingSection>

          <SettingSection title="文字" styles={styles}>
            <SettingItem label="字号" styles={styles}>
              <SegmentedSetting value={appearance.settings.fontSize} options={sizeOptions} onChange={(fontSize) => appearance.updateSettings({ fontSize })} />
            </SettingItem>
            <SettingItem label="字重" styles={styles}>
              <SegmentedSetting value={appearance.settings.fontWeight} options={weightOptions} onChange={(fontWeight) => appearance.updateSettings({ fontWeight })} />
            </SettingItem>
          </SettingSection>

          <SettingSection title="存储" styles={styles}>
            <View style={styles.storageRow}>
              <View style={styles.storageIcon}><Database size={19} color={appearance.theme.colors.primaryDark} /></View>
              <Text style={styles.storageLabel}>SQLite 总占用</Text>
              <Text style={styles.storageValue}>{usageText}</Text>
            </View>
          </SettingSection>

          {appearance.error ? <Text style={styles.error}>{appearance.error}</Text> : null}
        </ScrollView>
      </View>
    </AppFrame>
  );
}

function SettingSection({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.sectionBody}>{children}</View></View>;
}

function SettingItem({ label, children, styles }: { label: string; children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.item}><Text style={styles.itemLabel}>{label}</Text>{children}</View>;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.colors.screen },
    topBar: { position: 'relative', height: 54, paddingHorizontal: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
    backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    pageTitle: { position: 'absolute', left: 56, right: 56, textAlign: 'center', fontSize: theme.fontSize(17), fontWeight: theme.fontWeight('strong'), color: theme.colors.text },
    content: { paddingBottom: 48 },
    section: { marginTop: theme.spacing.xxl },
    sectionTitle: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm, fontSize: theme.fontSize(13), fontWeight: theme.fontWeight('strong'), color: theme.colors.textSecondary },
    sectionBody: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.divider, backgroundColor: theme.colors.surface },
    item: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, gap: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
    itemLabel: { fontSize: theme.fontSize(13), fontWeight: theme.fontWeight('medium'), color: theme.colors.text },
    storageRow: { minHeight: 64, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    storageIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.md, backgroundColor: theme.colors.primaryLight },
    storageLabel: { flex: 1, fontSize: theme.fontSize(13), fontWeight: theme.fontWeight('medium'), color: theme.colors.text },
    storageValue: { minWidth: 92, textAlign: 'right', fontSize: theme.fontSize(12), color: theme.colors.textSecondary },
    error: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg, fontSize: theme.fontSize(12), color: theme.colors.danger },
  });
}
