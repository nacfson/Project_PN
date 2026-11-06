const semanticPalette = {
  // KidLearn Design System Palette
  brandPrimary: '#EF4444',
  brandPrimaryDark: '#DC2626',
  brandSecondary: '#3B82F6',
  brandSecondaryDark: '#2563EB',
  brandTertiary: '#FACC15',
  surfaceBase: '#FFFFFF',
  surfaceHighlight: '#FEF3C7',
  surfaceHighlightBorder: '#F59E0B',

  canvas: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#1F2937',
  textSecondary: '#374151',
  textMuted: '#4B5563',
  hairline: '#E5E7EB',
  divider: '#E5E7EB',
  controlBorder: '#9CA3AF',
  controlBorderHover: '#6B7280',
  controlBorderStrong: '#6B7280',
  fill: '#F3F4F6',
  fillAlt: '#E5E7EB',
  fillSubtle: '#FEF3C7',
  primary: '#DC2626',
  primaryHover: '#B91C1C',
  onPrimary: '#FFFFFF',
  accent: '#2563EB',
  accentHover: '#1D4ED8',
  danger: '#DC2626',
  dangerSurface: '#FEF2F2',
  success: '#15803D',
  successBright: '#22C55E',
  successSurface: '#DCFCE7',
  warning: '#B45309',
  warningBright: '#F59E0B',
  warningSurface: '#FEF3C7',
  infoSurface: '#DBEAFE',
  focusRing: '#2563EB',
  scrim: 'rgba(31, 41, 55, 0.4)',
} as const;

export const colors = semanticPalette;

export type Colors = typeof colors;

export const stage = {
  new: '#F59E0B',
  learning: '#60A5FA',
  recognized: '#3B82F6',
  recalled: '#8B5CF6',
  usable: '#22C55E',
  mastered: '#FACC15',
} as const;

export type StageKey = keyof typeof stage;

export function stageColor(key: string): string {
  if (key in stage) {
    return stage[key as StageKey];
  }
  return stage.new;
}

export const spacing = {
  xs: 8,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

export const radii = {
  kbd: 8,
  sm: 12,
  md: 20,
  lg: 20,
  xl: 24,
  card: 20,
  xxl: 28,
  full: 9999,
} as const;

export const controlHeight = {
  tab: 40,
  nav: 48,
  button: 48,
  buttonLg: 56,
  heroSm: 52,
  hero: 56,
} as const;

export const layout = {
  sidebarWidth: 232,
  sidebarMinPageWidth: 720,
  contentMaxWidth: 760,
  pagePadding: {
    wide: { top: 48, x: 32, bottom: 80 },
    phone: { top: 24, x: 20, bottom: 32 },
  },
  tabBarItemMinHeight: 56,
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  segment: {
    shadowColor: '#D1D5DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  playful: {
    shadowColor: '#D1D5DB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  sm: {
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: 'rgba(0, 0, 0, 0.16)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const iconSizes = {
  sm: 18,
  md: 22,
  lg: 26,
  xl: 32,
} as const;

export const typography = {
  fontFamily: 'Nunito',
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
  },
  tokens: {
    heroTitle: { fontSize: 48, lineHeight: 58, fontWeight: '700' as const, letterSpacing: -0.4 },
    heroTitlePhone: { fontSize: 36, lineHeight: 45, fontWeight: '700' as const, letterSpacing: -0.3 },
    pageTitle: { fontSize: 36, lineHeight: 45, fontWeight: '700' as const, letterSpacing: -0.3 },
    sectionTitle: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const },
    groupLabel: { fontSize: 14, lineHeight: 21, fontWeight: '600' as const },
    body: { fontSize: 16, lineHeight: 26, fontWeight: '400' as const },
    bodySmall: { fontSize: 15, lineHeight: 24, fontWeight: '600' as const },
    caption: { fontSize: 14, lineHeight: 21, fontWeight: '600' as const },
    micro: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
    stat: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
    statPhone: { fontSize: 24, lineHeight: 31, fontWeight: '700' as const },
    cardLemma: { fontSize: 48, lineHeight: 58, fontWeight: '700' as const },
    cardLemmaPhone: { fontSize: 38, lineHeight: 46, fontWeight: '700' as const },
    listLemma: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const },
    inputDisplay: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const },
    meaning: { fontSize: 28, lineHeight: 36, fontWeight: '600' as const },
    meaningPhone: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
    ipa: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
    kbd: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const },
  },
  weights: {
    regular: '400' as const,
    medium: '600' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
} as const;

export const theme = {
  colors,
  stage,
  spacing,
  radii,
  controlHeight,
  layout,
  shadows,
  iconSizes,
  typography,
} as const;

export type Theme = typeof theme;
