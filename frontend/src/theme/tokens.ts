export const colors = {
  // Brand
  primary: '#2563eb',
  primaryPressed: '#1d4ed8',
  onPrimary: '#ffffff',

  secondary: '#64748b',
  secondaryPressed: '#475569',
  onSecondary: '#ffffff',

  // Semantic
  success: '#16a34a',
  successSurface: '#dcfce7',
  successBorder: '#86efac',

  warning: '#d97706',
  warningSurface: '#fef3c7',
  warningBorder: '#fcd34d',

  danger: '#dc2626',
  dangerSurface: '#fee2e2',
  dangerBorder: '#fca5a5',

  info: '#0891b2',
  infoSurface: '#cffafe',
  infoBorder: '#67e8f9',

  // Surfaces
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceAlt: '#f8fafc',

  // Text
  text: '#0f172a',
  textMuted: '#64748b',
  textInverse: '#ffffff',

  // Borders
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  fontFamily: undefined as string | undefined,
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  iconSizes,
  typography,
} as const;

export type Theme = typeof theme;
