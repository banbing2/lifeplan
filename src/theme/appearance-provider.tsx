import { useSQLiteContext } from 'expo-sqlite';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

import { DEFAULT_APP_SETTINGS, type AppSettings } from '../domain/app-settings';
import { createSettingsRepository } from '../repositories/settings-repository';
import { AppearanceSettingsController } from './appearance-controller';
import { createThemeTokens, type AppTheme, type ResolvedColorMode } from './create-theme';

type AppearanceContextValue = {
  settings: AppSettings;
  theme: AppTheme;
  error: string | null;
  updateSettings(change: Partial<AppSettings>): Promise<void>;
  clearError(): void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/** 根级外观容器：从 SQLite 加载设置并向全部页面提供动态语义令牌。 */
export function AppearanceProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const repository = useMemo(() => createSettingsRepository(db), [db]);
  const controller = useMemo(
    () => new AppearanceSettingsController(DEFAULT_APP_SETTINGS, repository.saveSettings),
    [repository],
  );
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const systemScheme = useColorScheme();
  const resolvedSystemScheme: ResolvedColorMode | null = systemScheme === 'dark' || systemScheme === 'light'
    ? systemScheme
    : null;
  const theme = useMemo(
    () => createThemeTokens(snapshot.settings, resolvedSystemScheme),
    [resolvedSystemScheme, snapshot.settings],
  );

  useEffect(() => {
    let active = true;
    void repository.getSettings().then((settings) => {
      if (active) controller.replaceFromStorage(settings);
    }).catch(() => {
      // 默认设置已经可用，读取失败不阻断 App 启动。
    });
    return () => { active = false; };
  }, [controller, repository]);

  const value = useMemo<AppearanceContextValue>(() => ({
    settings: snapshot.settings,
    theme,
    error: snapshot.error,
    updateSettings: (change) => controller.update(change),
    clearError: () => controller.clearError(),
  }), [controller, snapshot, theme]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** 获取全局设置、当前主题和更新动作，必须在 AppearanceProvider 内调用。 */
export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance 必须在 AppearanceProvider 内使用');
  return value;
}

/** 页面只需要样式时使用的精简 Hook。 */
export function useAppTheme() {
  return useAppearance().theme;
}
