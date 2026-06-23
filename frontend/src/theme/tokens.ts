export type ThemeMode = 'light' | 'dark';

const md3Light = {
  primary: '#6750a4',
  onPrimary: '#ffffff',
  primaryContainer: '#eaddff',
  onPrimaryContainer: '#21005d',

  secondary: '#625b71',
  onSecondary: '#ffffff',
  secondaryContainer: '#e8def8',
  onSecondaryContainer: '#1d192b',

  tertiary: '#7d5260',
  onTertiary: '#ffffff',
  tertiaryContainer: '#ffd8e4',
  onTertiaryContainer: '#31111d',

  error: '#b3261e',
  onError: '#ffffff',
  errorContainer: '#f9dedc',
  onErrorContainer: '#410e0b',

  background: '#fffbfe',
  onBackground: '#1c1b1f',

  surface: '#fffbfe',
  onSurface: '#1c1b1f',
  surfaceVariant: '#e7e0ec',
  onSurfaceVariant: '#49454f',

  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f7f2fa',
  surfaceContainer: '#f3edf7',
  surfaceContainerHigh: '#ece6f0',
  surfaceContainerHighest: '#e6e0e9',

  outline: '#79747e',
  outlineVariant: '#cab6cc',

  inverseSurface: '#322f35',
  inverseOnSurface: '#f5eff7',
  inversePrimary: '#d0bcff',
} as const;

const md3Dark = {
  primary: '#d0bcff',
  onPrimary: '#381e72',
  primaryContainer: '#4f378b',
  onPrimaryContainer: '#eaddff',

  secondary: '#ccc2dc',
  onSecondary: '#332d41',
  secondaryContainer: '#4a4458',
  onSecondaryContainer: '#e8def8',

  tertiary: '#efb8c8',
  onTertiary: '#492532',
  tertiaryContainer: '#633b48',
  onTertiaryContainer: '#ffd8e4',

  error: '#f2b8b5',
  onError: '#601410',
  errorContainer: '#8c1d18',
  onErrorContainer: '#f9dedc',

  background: '#141218',
  onBackground: '#e6e1e5',

  surface: '#141218',
  onSurface: '#e6e1e5',
  surfaceVariant: '#49454f',
  onSurfaceVariant: '#cab6cc',

  surfaceContainerLowest: '#0f0d13',
  surfaceContainerLow: '#1d1b20',
  surfaceContainer: '#211f26',
  surfaceContainerHigh: '#272229',
  surfaceContainerHighest: '#322f35',

  outline: '#938f99',
  outlineVariant: '#49454f',

  inverseSurface: '#e6e0e9',
  inverseOnSurface: '#322f35',
  inversePrimary: '#6750a4',
} as const;

export interface MD3Colors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

function semanticColors(mode: ThemeMode): MD3Colors {
  return mode === 'dark' ? md3Dark : md3Light;
}

function legacyColors(mode: ThemeMode) {
  const md3 = semanticColors(mode);
  return {
    // Brand (legacy aliases for existing code)
    primary: md3.primary,
    primaryPressed: md3.primaryContainer,
    onPrimary: md3.onPrimary,

    secondary: md3.secondary,
    secondaryPressed: md3.secondaryContainer,
    onSecondary: md3.onSecondary,

    // Semantic
    success: '#16a34a',
    successSurface: mode === 'dark' ? '#1b3b25' : '#dcfce7',
    successBorder: mode === 'dark' ? '#81c995' : '#86efac',

    warning: '#d97706',
    warningSurface: mode === 'dark' ? '#3d2a15' : '#fef3c7',
    warningBorder: mode === 'dark' ? '#fcd34d' : '#fcd34d',

    danger: md3.error,
    dangerSurface: md3.errorContainer,
    dangerBorder: mode === 'dark' ? '#f28b82' : '#fca5a5',

    info: '#0891b2',
    infoSurface: mode === 'dark' ? '#0f2f38' : '#cffafe',
    infoBorder: mode === 'dark' ? '#67e8f9' : '#67e8f9',

    // Surfaces
    surface: md3.surface,
    surfaceRaised: md3.surfaceContainerHigh,
    surfaceAlt: md3.surfaceContainerLow,

    // Text
    text: md3.onSurface,
    textMuted: md3.onSurfaceVariant,
    textInverse: md3.inverseOnSurface,

    // Borders
    border: md3.outlineVariant,
    borderStrong: md3.outline,
  } as const;
}

export function colorsFor(mode: ThemeMode) {
  return {
    ...semanticColors(mode),
    ...legacyColors(mode),
  } as const;
}

export type Colors = ReturnType<typeof colorsFor>;

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
  xxl: 28,
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
    xxxl: 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
} as const;

export function themeFor(mode: ThemeMode) {
  return {
    mode,
    colors: colorsFor(mode),
    spacing,
    radii,
    shadows,
    iconSizes,
    typography,
  } as const;
}

export type Theme = ReturnType<typeof themeFor>;
