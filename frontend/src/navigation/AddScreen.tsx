import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaptureScreen } from '../screens/CaptureScreen';
import { ManualAddScreen } from '../screens/ManualAddScreen';
import { AnkiImportScreen } from '../features/import/AnkiImportScreen';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

type AddMode = 'capture' | 'manual' | 'import';

export function AddScreen() {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<AddMode>('capture');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      <View
        style={[
          styles.tabs,
          {
            paddingHorizontal: spacing.xl,
            gap: spacing.sm,
            marginBottom: spacing.sm,
          },
        ]}
      >
        <Pressable
          onPress={() => setMode('capture')}
          style={[
            styles.tab,
            {
              borderRadius: radii.md,
              backgroundColor: mode === 'capture' ? colors.primary : colors.surface,
              borderColor: mode === 'capture' ? colors.primary : colors.border,
            },
          ]}
        >
          <Text variant="label" color={mode === 'capture' ? 'inverse' : 'muted'}>
            {t('add.capture')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('manual')}
          style={[
            styles.tab,
            {
              borderRadius: radii.md,
              backgroundColor: mode === 'manual' ? colors.primary : colors.surface,
              borderColor: mode === 'manual' ? colors.primary : colors.border,
            },
          ]}
        >
          <Text variant="label" color={mode === 'manual' ? 'inverse' : 'muted'}>
            {t('add.manual')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('import')}
          style={[
            styles.tab,
            {
              borderRadius: radii.md,
              backgroundColor: mode === 'import' ? colors.primary : colors.surface,
              borderColor: mode === 'import' ? colors.primary : colors.border,
            },
          ]}
        >
          <Text variant="label" color={mode === 'import' ? 'inverse' : 'muted'}>
            {t('add.import')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {mode === 'capture' ? <CaptureScreen /> : mode === 'manual' ? <ManualAddScreen /> : <AnkiImportScreen />}
      </View>
    </SafeAreaView>
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
    borderWidth: 1,
  },
  body: {
    flex: 1,
  },
});
