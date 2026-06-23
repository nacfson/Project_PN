import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

interface ScreenProps extends ViewProps {
  padded?: boolean;
}

export function Screen({ padded, style, children, ...rest }: ScreenProps) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.inner,
          padded && { paddingHorizontal: spacing.xl },
          style,
        ]}
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
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
});
