import type { AppSettings, ColorMode, ColorScheme } from '../domain/app-settings';
import { accentColors, radii, shadow, spacing } from './tokens';

export type ResolvedColorMode = Exclude<ColorMode, 'system'>;
export type ThemeFontRole = 'body' | 'medium' | 'strong';
export type ThemeFontWeight = '400' | '500' | '600' | '700' | '800';

const lightBase = {
  appBackground: '#EEF2F0',
  screen: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9F8',
  text: '#151A17',
  textSecondary: '#66706A',
  textMuted: '#909893',
  border: '#E5EAE7',
  divider: '#EDF0EE',
  danger: '#D94348',
  warning: '#C96B12',
  warningLight: '#FFF1DF',
  completed: '#68706C',
  completedLight: '#F0F2F1',
} as const;

const darkBase = {
  appBackground: '#090C0B',
  screen: '#121614',
  surface: '#181D1A',
  surfaceMuted: '#202622',
  text: '#F4F7F5',
  textSecondary: '#B2BBB6',
  textMuted: '#858F89',
  border: '#303833',
  divider: '#262D29',
  danger: '#FF8589',
  warning: '#FFB768',
  warningLight: '#3A2A18',
  completed: '#A2AAA6',
  completedLight: '#282E2B',
} as const;

const schemeColors: Record<ResolvedColorMode, Record<ColorScheme, {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  onPrimary: string;
}>> = {
  light: {
    green: { primary: '#169B50', primaryDark: '#087C38', primaryLight: '#E8F7EE', onPrimary: '#FFFFFF' },
    blue: { primary: '#2878D4', primaryDark: '#185EAE', primaryLight: '#E8F2FF', onPrimary: '#FFFFFF' },
    coral: { primary: '#E9655C', primaryDark: '#C94B43', primaryLight: '#FFF0EE', onPrimary: '#FFFFFF' },
    neutral: { primary: '#242A27', primaryDark: '#111512', primaryLight: '#ECEFED', onPrimary: '#FFFFFF' },
  },
  dark: {
    green: { primary: '#55D58A', primaryDark: '#79E5A5', primaryLight: '#193929', onPrimary: '#07150D' },
    blue: { primary: '#72B3FF', primaryDark: '#9AC8FF', primaryLight: '#182F49', onPrimary: '#07121E' },
    coral: { primary: '#FF7A70', primaryDark: '#FFA098', primaryLight: '#45211F', onPrimary: '#1A0C0A' },
    neutral: { primary: '#D5DBD7', primaryDark: '#F1F4F2', primaryLight: '#303633', onPrimary: '#111412' },
  },
};

const fontScales = { small: 0.9, standard: 1, large: 1.15 } as const;

/** 将“跟随系统”解析为当前真正用于渲染的模式。 */
export function resolveColorMode(mode: ColorMode, systemScheme: ResolvedColorMode | null): ResolvedColorMode {
  return mode === 'system' ? systemScheme ?? 'light' : mode;
}

/** 根据持久化设置生成全 App 共用的不可变语义令牌。 */
export function createThemeTokens(settings: AppSettings, systemScheme: ResolvedColorMode | null) {
  const mode = resolveColorMode(settings.colorMode, systemScheme);
  const scale = fontScales[settings.fontSize];
  const weights: Record<ThemeFontRole, ThemeFontWeight> = settings.fontWeight === 'bold'
    ? { body: '600', medium: '700', strong: '800' }
    : { body: '400', medium: '600', strong: '700' };

  return {
    mode,
    colors: {
      ...(mode === 'dark' ? darkBase : lightBase),
      ...schemeColors[mode][settings.colorScheme],
    },
    accentColors,
    spacing,
    radii,
    shadow: { ...shadow, shadowColor: mode === 'dark' ? '#000000' : shadow.shadowColor },
    fontSize: (base: number) => Math.round(base * scale),
    fontWeight: (role: ThemeFontRole) => weights[role],
  } as const;
}

export type AppTheme = ReturnType<typeof createThemeTokens>;
