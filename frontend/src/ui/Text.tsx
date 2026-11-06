import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { typography as defaultTypography, colors as defaultColors } from '../theme/tokens';
import { fontFamilyFor, type FontRole, type FontWeightName } from '../theme/fonts';

export type TextVariant =
  | 'heroTitle'
  | 'pageTitle'
  | 'sectionTitle'
  | 'groupLabel'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'micro'
  | 'stat'
  | 'cardLemma'
  | 'listLemma'
  | 'inputDisplay'
  | 'meaning'
  | 'ipa'
  | 'kbd'
  // Legacy variants kept for compatibility
  | 'title'
  | 'heading'
  | 'headline'
  | 'label';

export type TextColor =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'primary'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'onPrimaryContainer'
  | 'onSecondaryContainer';

export interface TextProps extends Omit<RNTextProps, 'role'> {
  variant?: TextVariant;
  color?: TextColor | (string & {});
  bold?: boolean;
  role?: FontRole;
  lang?: 'ko';
  tabular?: boolean;
}

function extractTextString(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextString).join('');
  }
  return '';
}

function defaultRoleForVariant(variant: TextVariant): FontRole {
  if (
    variant === 'heroTitle' ||
    variant === 'pageTitle' ||
    variant === 'sectionTitle' ||
    variant === 'title' ||
    variant === 'heading' ||
    variant === 'headline' ||
    variant === 'stat' ||
    variant === 'cardLemma' ||
    variant === 'listLemma' ||
    variant === 'inputDisplay'
  ) {
    return 'display';
  }
  if (variant === 'ipa' || variant === 'kbd') {
    return 'mono';
  }
  return 'ui';
}

function weightNameFromNumeric(weight?: TextStyle['fontWeight'], bold?: boolean): FontWeightName {
  if (bold) return 'semibold';
  if (weight === '600' || weight === '700' || weight === '800' || weight === '900' || weight === 'bold') {
    return 'semibold';
  }
  if (weight === '500') {
    return 'medium';
  }
  return 'regular';
}

export function Text({
  variant = 'body',
  color,
  bold,
  role,
  lang,
  tabular,
  style,
  children,
  ...rest
}: TextProps) {
  const { colors = defaultColors, typography = defaultTypography } = useTheme();
  const tokens = typography.tokens ?? defaultTypography.tokens;
  const weights = typography.weights ?? defaultTypography.weights;
  const sizes = typography.sizes ?? defaultTypography.sizes;

  const variantMap: Record<TextVariant, TextStyle> = {
    heroTitle: tokens.heroTitle,
    pageTitle: tokens.pageTitle,
    sectionTitle: tokens.sectionTitle,
    groupLabel: tokens.groupLabel,
    body: tokens.body,
    bodySmall: tokens.bodySmall,
    caption: tokens.caption,
    micro: tokens.micro,
    stat: { ...tokens.stat, fontVariant: ['tabular-nums'] },
    cardLemma: tokens.cardLemma,
    listLemma: tokens.listLemma,
    inputDisplay: tokens.inputDisplay,
    meaning: tokens.meaning,
    ipa: tokens.ipa,
    kbd: tokens.kbd,
    // Legacy mappings
    title: tokens.sectionTitle,
    heading: { fontSize: sizes.xl, lineHeight: 28, fontWeight: '600' },
    headline: tokens.pageTitle,
    label: { fontSize: sizes.sm, lineHeight: 18, fontWeight: '500' },
  };

  const baseVariantStyle = variantMap[variant] ?? tokens.body;
  const effectiveRole = role ?? defaultRoleForVariant(variant);
  const weightName = weightNameFromNumeric(baseVariantStyle.fontWeight, bold);
  const textContent = extractTextString(children);
  const resolvedFontFamily = fontFamilyFor(effectiveRole, weightName, {
    text: textContent,
    lang,
  });

  const resolvedColorKey: string =
    color ?? (variant === 'groupLabel' || variant === 'caption' ? 'muted' : 'default');

  const colorMap: Record<TextColor, string> = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    inverse: colors.onPrimary,
    primary: colors.accent,
    accent: colors.accent,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    onPrimaryContainer: colors.text,
    onSecondaryContainer: colors.text,
  };

  const isTabular = tabular || variant === 'stat';

  return (
    <RNText
      style={[
        baseVariantStyle,
        {
          fontFamily: resolvedFontFamily,
          color: (colorMap as Record<string, string>)[resolvedColorKey] ?? resolvedColorKey,
        },
        bold && { fontWeight: weights.semibold },
        isTabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
