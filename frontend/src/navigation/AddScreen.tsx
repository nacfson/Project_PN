import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaptureSection } from '../features/add/CaptureSection';
import { AnkiImportScreen } from '../features/import/AnkiImportScreen';
import { AddWordModal } from '../components/AddWordModal';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, SegmentedControl, Text } from '../ui';

type AddMode = 'capture' | 'manual' | 'import';

export function AddScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<AddMode>('capture');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [manualModalVisible, setManualModalVisible] = useState(false);

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
        {mode === 'capture' ? (
          <CaptureSection selectedDeckId={selectedDeckId} />
        ) : mode === 'manual' ? (
          <View style={[styles.manualPlaceholder, { padding: spacing.xl }]}>
            <Button label={t('add.addWord')} iconLeft="add" onPress={() => setManualModalVisible(true)} />
          </View>
        ) : (
          <AnkiImportScreen />
        )}
      </View>

      <AddWordModal
        visible={manualModalVisible}
        onClose={() => setManualModalVisible(false)}
        onAdded={() => setManualModalVisible(false)}
      />
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
  manualPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
