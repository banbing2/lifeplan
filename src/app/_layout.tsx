import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { migrateDatabase } from '@/db/migrate';
import { AppearanceProvider, useAppTheme } from '@/theme/appearance-provider';

/** 应用根布局：初始化 SQLite、执行迁移并注册 Expo Router 页面。 */
export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SQLiteProvider databaseName="life-plan-budget.db" onInit={migrateDatabase} useSuspense>
        <AppearanceProvider>
          <ThemedRoot />
        </AppearanceProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

/** 将已解析的全局主题同步到根背景、状态栏和所有路由页面。 */
function ThemedRoot() {
  const theme = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.screen }]}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </View>
  );
}

/** SQLite 初始化和迁移期间展示的全屏加载状态。 */
export function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#159447" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F5',
  },
});
