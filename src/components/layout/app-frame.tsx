import { BatteryFull, Signal, Wifi } from 'lucide-react-native';
import type { AppTheme } from '@/theme/create-theme';
import { useThemedStyles } from '@/theme/use-themed-styles';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii } from '@/theme/tokens';
import { getAppFrameSafeAreaEdges } from './safe-area';

/**
 * 跨平台应用外框：移动端铺满屏幕，Web 端限制为居中的手机宽度画布。
 */
export function AppFrame({ children }: PropsWithChildren) {
  const { styles, theme } = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 520;

  return (
    <View style={styles.viewport}>
      <View
        style={[
          styles.frame,
          isDesktopWeb && {
            width: 430,
            height: Math.max(720, height - 16),
            borderRadius: radii.phone,
            ...theme.shadow,
          },
        ]}
      >
        {Platform.OS === 'web' ? <WebStatusBar /> : null}
        <SafeAreaView edges={getAppFrameSafeAreaEdges(Platform.OS)} style={styles.safeArea}>
          {children}
        </SafeAreaView>
      </View>
    </View>
  );
}

/** Web 手机画布顶部的轻量状态栏模拟。 */
function WebStatusBar() {
  const { styles, theme } = useThemedStyles(createStyles);
  return (
    <View style={styles.statusBar}>
      <Text style={styles.time}>9:41</Text>
      <View style={styles.statusIcons}>
        <Signal size={17} strokeWidth={2.7} color={theme.colors.text} />
        <Wifi size={17} strokeWidth={2.7} color={theme.colors.text} />
        <BatteryFull size={21} strokeWidth={2.3} color={theme.colors.text} />
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.appBackground,
  },
  frame: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: theme.colors.screen,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.screen,
  },
  statusBar: {
    height: 48,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.screen,
  },
  time: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  });
}
