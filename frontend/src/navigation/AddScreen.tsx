import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaptureScreen } from '../screens/CaptureScreen';
import { ManualAddScreen } from '../screens/ManualAddScreen';
import { AnkiImportScreen } from '../features/import/AnkiImportScreen';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { SegmentedControl, Text } from '../ui';

type AddMode = 'capture' | 'manual' | 'import';

export function AddScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<AddMode>('capture');

  const options: { value: AddMode; label: string }[] = [
    { value: 'capture', label: t('add.capture') },
    { value: 'manual', label: t('add.manual') },
    { value: 'import', label: t('add.import') },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md }]}>
        <Text variant="heading">{t('add.manual')}</Text>
        <SegmentedControl options={options} value={mode} onChange={setMode} />
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
  header: {
    marginBottom: 8,
  },
  body: {
    flex: 1,
  },
});
