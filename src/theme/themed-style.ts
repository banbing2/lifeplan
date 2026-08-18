import type { AppTheme, ThemeFontRole } from './create-theme';

/** 为一条 React Native 样式应用全局字号和相对字重设置。 */
export function applyThemeTypography<T extends Record<string, unknown>>(style: T, theme: AppTheme): T {
  const next: Record<string, unknown> = { ...style };
  if (typeof next.fontSize === 'number') next.fontSize = theme.fontSize(next.fontSize);
  if (typeof next.lineHeight === 'number') next.lineHeight = theme.fontSize(next.lineHeight);
  if (typeof next.fontWeight === 'string') next.fontWeight = theme.fontWeight(getWeightRole(next.fontWeight));
  return next as T;
}

/** 把组件原有相对字重层级映射到用户选择后的三级语义字重。 */
function getWeightRole(weight: string): ThemeFontRole {
  const numeric = Number.parseInt(weight, 10);
  if (Number.isFinite(numeric) && numeric >= 700) return 'strong';
  if (Number.isFinite(numeric) && numeric >= 500) return 'medium';
  return 'body';
}
