import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listDecks } from '../api/decks';
import { CaptureSection } from '../features/add/CaptureSection';
import { ManualAddSection } from '../features/add/ManualAddSection';
import { TargetDeckSelector } from '../features/add/TargetDeckSelector';
import { useActiveTargetLanguage } from '../hooks/useActiveTargetLanguage';
import { useAddQueue } from '../hooks/useAddQueue';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui';

export function AddScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const { targetLanguage, loading: languageLoading, error: languageError, refresh: refreshLanguage } = useActiveTargetLanguage();
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof listDecks>>>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const { pendingCount } = useAddQueue();

  useEffect(() => {
    if (!targetLanguage) {
      setDecks([]);
      setSelectedDeckId(null);
      return;
    }

    setDecksLoading(true);
    setDecksError(null);
    listDecks(targetLanguage)
      .then((loaded) => {
        setDecks(loaded);
        const defaultDeck = loaded.find((d) => d.is_default);
        setSelectedDeckId((prev) => prev ?? defaultDeck?.id ?? loaded[0]?.id ?? null);
      })
      .catch(() => {
        setDecksError(t('add.deckLoadFailed'));
      })
      .finally(() => {
        setDecksLoading(false);
      });
  }, [targetLanguage, t]);

  const hasPendingJobs = pendingCount > 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg, paddingBottom: spacing.xl * 2 }]}>
        <View style={[styles.header, { marginBottom: spacing.lg }]}>
          <Text variant="heading" style={{ marginBottom: spacing.md }}>
            {t('add.title')}
          </Text>
          <TargetDeckSelector
            decks={decks}
            selectedId={selectedDeckId}
            onSelect={setSelectedDeckId}
            loading={decksLoading || languageLoading}
            error={languageError ?? decksError}
            onRetry={() => {
              refreshLanguage();
            }}
            disabled={hasPendingJobs}
          />
        </View>

        {selectedDeckId && (
          <>
            <CaptureSection selectedDeckId={selectedDeckId} />
            <ManualAddSection selectedDeckId={selectedDeckId} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  header: {
    zIndex: 1,
  },
});
