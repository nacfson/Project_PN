import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
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
  const [deckRetryTick, setDeckRetryTick] = useState(0);
  const { pendingCount } = useAddQueue();
  const [activeTab, setActiveTab] = useState<'passage' | 'manual'>('passage');

  const loadDecks = useCallback(() => {
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

  useEffect(() => {
    loadDecks();
  }, [loadDecks, deckRetryTick]);

  const handleRetry = useCallback(() => {
    refreshLanguage();
    setDeckRetryTick((tick) => tick + 1);
  }, [refreshLanguage]);

  const hasPendingJobs = pendingCount > 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 }]}
      >
        <View style={[styles.header, { paddingTop: spacing.lg, paddingBottom: spacing.lg, backgroundColor: colors.background }]}>
          <Text variant="heading" style={{ marginBottom: spacing.md }}>
            {t('add.title')}
          </Text>
          <TargetDeckSelector
            decks={decks}
            selectedId={selectedDeckId}
            onSelect={setSelectedDeckId}
            loading={decksLoading || languageLoading}
            error={languageError ?? decksError}
            onRetry={handleRetry}
            disabled={hasPendingJobs}
          />
          {selectedDeckId && (
            <View style={[styles.tabContainer, { backgroundColor: colors.surfaceContainerLow, marginTop: spacing.md }]}>
              <Pressable
                testID="tab-passage"
                onPress={() => setActiveTab('passage')}
                style={[
                  styles.tabButton,
                  activeTab === 'passage' && { backgroundColor: colors.surface },
                ]}
              >
                <Text bold={activeTab === 'passage'} color={activeTab === 'passage' ? 'primary' : 'muted'}>
                  {t('add.fromPassage')}
                </Text>
              </Pressable>
              <Pressable
                testID="tab-manual"
                onPress={() => setActiveTab('manual')}
                style={[
                  styles.tabButton,
                  activeTab === 'manual' && { backgroundColor: colors.surface },
                ]}
              >
                <Text bold={activeTab === 'manual'} color={activeTab === 'manual' ? 'primary' : 'muted'}>
                  {t('add.manual')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ gap: spacing.lg }}>
          {selectedDeckId && activeTab === 'passage' && (
            <CaptureSection selectedDeckId={selectedDeckId} />
          )}
          {selectedDeckId && activeTab === 'manual' && (
            <ManualAddSection selectedDeckId={selectedDeckId} />
          )}
        </View>
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
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
});
