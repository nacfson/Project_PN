import { SafeAreaView, StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface ScreenProps extends ViewProps {
  padded?: boolean;
}

export function Screen({ padded, style, children, ...rest }: ScreenProps) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surfaceAlt }]}>
      <View
        style={[styles.inner, padded && { paddingHorizontal: spacing.xl }, style]}
        {...rest}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
});
