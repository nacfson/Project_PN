import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listDecks } from '../api/decks';
import { CaptureSection } from '../features/add/CaptureSection';
import { ManualAddSection } from '../features/add/ManualAddSection';
import { TargetDeckSelector } from '../features/add/TargetDeckSelector';
import { useActiveTargetLanguage } from '../hooks/useActiveTargetLanguage';
import { useAddQueue } from '../hooks/useAddQueue';
import { useAppLanguage } from '../i18n';
import { getLastDeckId, getLastDeckIdSync, setLastDeckId } from '../storage/lastDeck';
import { useTheme } from '../theme/ThemeProvider';
import { PageColumn, SegmentedControl, Text } from '../ui';
import { DEFAULT_LANGUAGE_CODE } from '../config';

const LAST_REFRESH_THRESHOLD_MS = 30_000;

export interface AddScreenProps {
  route?: { params?: { mode?: 'manual' | 'passage'; focusTick?: number } };
}

export function AddScreen({ route }: AddScreenProps = {}) {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const {
    targetLanguage,
    loading: languageLoading,
    error: languageError,
    refresh: refreshLanguage,
  } = useActiveTargetLanguage();
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof listDecks>>>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(() => {
    return getLastDeckIdSync(targetLanguage);
  });
  const [deckRetryTick, setDeckRetryTick] = useState(0);
  const { pendingCount } = useAddQueue();
  const [activeTab, setActiveTab] = useState<'passage' | 'manual'>('manual');

  useEffect(() => {
    if (route?.params?.mode) {
      setActiveTab(route.params.mode);
    }
  }, [route?.params?.mode, route?.params?.focusTick]);

  const resolveDeckId = useCallback(async (): Promise<string | null> => {
    if (selectedDeckId) return selectedDeckId;
    if (!targetLanguage) return null;
    try {
      const loaded = await listDecks(targetLanguage, 'private');
      setDecks(loaded);
      const storedLastId = await getLastDeckId(targetLanguage);
      const matchingLast = storedLastId ? loaded.find((d) => d.id === storedLastId) : null;
      const defaultDeck = loaded.find((d) => d.is_default);
      const fallbackId = matchingLast?.id ?? defaultDeck?.id ?? loaded[0]?.id ?? null;
      if (fallbackId) {
        setSelectedDeckId(fallbackId);
        void setLastDeckId(fallbackId, targetLanguage);
      }
      return fallbackId;
    } catch {
      return null;
    }
  }, [selectedDeckId, targetLanguage]);

  const loadDecks = useCallback(() => {
    if (!targetLanguage) {
      setDecks([]);
      setSelectedDeckId(null);
      return;
    }

    setDecksLoading(true);
    setDecksError(null);
    listDecks(targetLanguage, 'private')
      .then(async (loaded) => {
        setDecks(loaded);
        const storedLastId = await getLastDeckId(targetLanguage);
        const matchingLast = storedLastId ? loaded.find((d) => d.id === storedLastId) : null;
        const defaultDeck = loaded.find((d) => d.is_default);
        const fallbackId = matchingLast?.id ?? defaultDeck?.id ?? loaded[0]?.id ?? null;
        setSelectedDeckId((prev) => {
          const next = loaded.some((d) => d.id === prev) ? prev : fallbackId;
          if (next) {
            void setLastDeckId(next, targetLanguage);
          }
          return next;
        });
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

  const handleSelectDeck = useCallback(
    (deckId: string) => {
      setSelectedDeckId(deckId);
      if (targetLanguage) {
        void setLastDeckId(deckId, targetLanguage);
      }
    },
    [targetLanguage],
  );

  const handleRetry = useCallback(() => {
    refreshLanguage();
    setDeckRetryTick((tick) => tick + 1);
  }, [refreshLanguage]);

  const lastRefreshRef = useRef<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      const last = lastRefreshRef.current;
      const now = Date.now();
      if (!last || now - last > LAST_REFRESH_THRESHOLD_MS) {
        lastRefreshRef.current = now;
        refreshLanguage();
      }
    }, [refreshLanguage]),
  );

  const hasPendingJobs = pendingCount > 0;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: colors.canvas }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, paddingBottom: spacing.xl * 2 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <PageColumn style={{ gap: 28 }}>
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text variant="pageTitle">{t('add.title')}</Text>
              <TargetDeckSelector
                decks={decks}
                selectedId={selectedDeckId}
                onSelect={handleSelectDeck}
                loading={decksLoading || languageLoading}
                error={languageError ?? decksError}
                onRetry={handleRetry}
                disabled={hasPendingJobs}
              />
            </View>
            <SegmentedControl
              role="tablist"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: 'manual', label: t('add.manual'), testID: 'tab-manual' },
                { value: 'passage', label: t('add.fromPassage'), testID: 'tab-passage' },
              ]}
            />
          </View>

          <View style={{ gap: spacing.lg }}>
            {activeTab === 'manual' && (
              <>
                <ManualAddSection
                  selectedDeckId={selectedDeckId}
                  targetLanguage={targetLanguage || DEFAULT_LANGUAGE_CODE}
                  resolveDeckId={resolveDeckId}
                />
                <Pressable
                  testID="switch-to-passage-link"
                  onPress={() => setActiveTab('passage')}
                  style={styles.secondarySwitchWrap}
                >
                  <Text variant="bodySmall" color="secondary">
                    {t('add.switchToPassage')} →
                  </Text>
                </Pressable>
              </>
            )}
            {activeTab === 'passage' && (
              <>
                {selectedDeckId ? (
                  <CaptureSection
                    selectedDeckId={selectedDeckId}
                    targetLanguage={targetLanguage || DEFAULT_LANGUAGE_CODE}
                  />
                ) : null}
                <Pressable
                  testID="switch-to-manual-link"
                  onPress={() => setActiveTab('manual')}
                  style={styles.secondarySwitchWrap}
                >
                  <Text variant="bodySmall" color="secondary">
                    ← {t('add.backToManual')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </PageColumn>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    zIndex: 10,
  },
  headerTextCol: {
    gap: 8,
  },
  secondarySwitchWrap: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
