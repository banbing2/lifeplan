import type { PlanAccent } from '@/domain/models';

/** 生活计划业务界面的语义色令牌。 */
export const colors = {
  appBackground: '#EEF2F0',
  screen: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9F8',
  text: '#151A17',
  textSecondary: '#66706A',
  textMuted: '#909893',
  border: '#E5EAE7',
  divider: '#EDF0EE',
  primary: '#169B50',
  primaryDark: '#087C38',
  primaryLight: '#E8F7EE',
  danger: '#E34E51',
  warning: '#ED8C26',
  warningLight: '#FFF1DF',
  completed: '#777E7A',
  completedLight: '#F0F2F1',
} as const;

/** 每种计划主题色对应的实体色、浅背景和文字色。 */
export const accentColors: Record<PlanAccent, { solid: string; soft: string; text: string }> = {
  green: { solid: '#43A95F', soft: '#E8F7ED', text: '#118441' },
  orange: { solid: '#FF914D', soft: '#FFF0E5', text: '#F06C21' },
  blue: { solid: '#4B86E8', soft: '#EAF1FF', text: '#2D6BD4' },
  purple: { solid: '#9B7AE8', soft: '#F0EBFF', text: '#7654CE' },
  red: { solid: '#FF777D', soft: '#FFECEE', text: '#E84C54' },
  teal: { solid: '#39B7B0', soft: '#E4F7F5', text: '#168C87' },
};

/** 业务界面统一间距尺度。 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** 业务界面统一圆角尺度。 */
export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  phone: 30,
  pill: 999,
} as const;

/** 卡片和浮动按钮共用的跨平台阴影配置。 */
export const shadow = {
  shadowColor: '#24302B',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;
