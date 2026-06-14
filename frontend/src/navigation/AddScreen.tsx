import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CaptureScreen } from '../screens/CaptureScreen';
import { ManualAddScreen } from '../screens/ManualAddScreen';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

type AddMode = 'capture' | 'manual';

export function AddScreen() {
  const { colors, spacing, radii } = useTheme();
  const [mode, setMode] = useState<AddMode>('capture');

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.tabs, { paddingHorizontal: spacing.xl, gap: spacing.sm, marginBottom: spacing.sm }]}>
        <Pressable
          onPress={() => setMode('capture')}
          style={[
            styles.tab,
            {
              borderRadius: radii.md,
              backgroundColor: mode === 'capture' ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            variant="label"
            style={{ color: mode === 'capture' ? colors.surface : colors.textMuted }}
          >
            Capture
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('manual')}
          style={[
            styles.tab,
            {
              borderRadius: radii.md,
              backgroundColor: mode === 'manual' ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            variant="label"
            style={{ color: mode === 'manual' ? colors.surface : colors.textMuted }}
          >
            Manual Add
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>{mode === 'capture' ? <CaptureScreen /> : <ManualAddScreen />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
});
