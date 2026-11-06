import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { shellKind } from '../navigation/shellKind';
import { Text } from './Text';

export interface KbdProps {
  children: string;
  color?: string;
}

export function Kbd({ children, color }: KbdProps) {
  const { colors, radii } = useTheme();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const currentShell = shellKind(Platform.OS, ua);

  if (Platform.OS !== 'web' || currentShell !== 'browser') {
    return null;
  }

  const textColor = color ?? colors.textMuted;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...({ 'aria-hidden': true } as Record<string, unknown>)}
      style={[
        styles.kbd,
        {
          borderRadius: radii.kbd,
          borderColor: textColor,
        },
      ]}
    >
      <Text
        variant="kbd"
        role="mono"
        style={{
          color: textColor,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kbd: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    opacity: 0.65,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
