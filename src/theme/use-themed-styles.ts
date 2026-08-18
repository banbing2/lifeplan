import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useAppTheme } from './appearance-provider';
import type { AppTheme } from './create-theme';
import { applyThemeTypography } from './themed-style';

/** 创建会随全局颜色、字号和字重重新计算的组件样式。 */
export function useThemedStyles<T extends Record<string, unknown>>(factory: (theme: AppTheme) => T) {
  const theme = useAppTheme();
  const styles = useMemo(() => {
    const source = factory(theme);
    return Object.fromEntries(Object.entries(source).map(([name, style]) => {
      const flattened = StyleSheet.flatten(style) as Record<string, unknown> | undefined;
      return [name, flattened ? applyThemeTypography(flattened, theme) : style];
    })) as T;
  }, [factory, theme]);
  return { styles, theme };
}
