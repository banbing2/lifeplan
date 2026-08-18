/** 用户可选择的全局明暗模式。 */
export type ColorMode = 'system' | 'light' | 'dark';

/** 保证文字对比度的预设全局配色。 */
export type ColorScheme = 'green' | 'blue' | 'coral' | 'neutral';

/** 全局文字缩放等级。 */
export type FontSizeLevel = 'small' | 'standard' | 'large';

/** 全局基础字重等级。 */
export type FontWeightLevel = 'standard' | 'bold';

/** 持久化到 SQLite 的唯一全局设置。 */
export type AppSettings = {
  colorMode: ColorMode;
  colorScheme: ColorScheme;
  fontSize: FontSizeLevel;
  fontWeight: FontWeightLevel;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  colorMode: 'system',
  colorScheme: 'green',
  fontSize: 'standard',
  fontWeight: 'standard',
};

const COLOR_MODES = new Set<ColorMode>(['system', 'light', 'dark']);
const COLOR_SCHEMES = new Set<ColorScheme>(['green', 'blue', 'coral', 'neutral']);
const FONT_SIZES = new Set<FontSizeLevel>(['small', 'standard', 'large']);
const FONT_WEIGHTS = new Set<FontWeightLevel>(['standard', 'bold']);

/** 将数据库或其他不可信来源的字段逐项收敛为可用设置。 */
export function normalizeAppSettings(source: Partial<Record<keyof AppSettings, unknown>> | null): AppSettings {
  return {
    colorMode: isMember(COLOR_MODES, source?.colorMode) ? source.colorMode : DEFAULT_APP_SETTINGS.colorMode,
    colorScheme: isMember(COLOR_SCHEMES, source?.colorScheme) ? source.colorScheme : DEFAULT_APP_SETTINGS.colorScheme,
    fontSize: isMember(FONT_SIZES, source?.fontSize) ? source.fontSize : DEFAULT_APP_SETTINGS.fontSize,
    fontWeight: isMember(FONT_WEIGHTS, source?.fontWeight) ? source.fontWeight : DEFAULT_APP_SETTINGS.fontWeight,
  };
}

/** Set.has 不会替 unknown 收窄类型，此处集中完成安全判定。 */
function isMember<T extends string>(values: ReadonlySet<T>, value: unknown): value is T {
  return typeof value === 'string' && values.has(value as T);
}
