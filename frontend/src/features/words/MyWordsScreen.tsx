import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFocusEffect, useNavigation, type CompositeNavigationProp, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import type { Deck, LearningItemListItem } from '../../types';
import { Badge, Button, Chip, EmptyState, ErrorState, Icon, Input, LoadingState, Screen, Text } from '../../ui';
import { SpeakButton } from '../../components/SpeakButton';
import { useLearningItems } from './useLearningItems';
import { useActiveTargetLanguage } from '../../hooks/useActiveTargetLanguage';
import { createDeck, deleteDeck, listDecks, moveItemsToDeck, renameDeck } from '../../api/decks';
import { DeckCanvas } from './DeckCanvas';
import { DeckFormModal } from './DeckFormModal';
import { MoveToDeckModal } from './MoveToDeckModal';
import { InspectorPanel } from '../web/InspectorPanel';
import { ContextualCommandBar } from '../../ui/ContextualCommandBar';
import { CinematicCard } from '../../ui/CinematicCard';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import type { MainTabParamList } from '../../navigation/MainTabs';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';

const FILTERS: Array<{ key: 'all' | LearningItemListItem['learning_stage']; labelKey: string }> = [
  { key: 'all', labelKey: 'words.filterAll' },
  { key: 'new', labelKey: 'home.stage.new' },
  { key: 'learning', labelKey: 'home.stage.learning' },
  { key: 'recognized', labelKey: 'home.stage.recognized' },
  { key: 'recalled', labelKey: 'home.stage.recalled' },
  { key: 'usable', labelKey: 'home.stage.usable' },
  { key: 'mastered', labelKey: 'home.stage.mastered' },
];

type MyWordsScreenTabParamList = Omit<MainTabParamList, 'Settings'> & {
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};

type MyWordsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<WordsStackParamList, 'WordsRoot'>,
  BottomTabNavigationProp<MyWordsScreenTabParamList>
>;

function formatRelativeTime(iso: string, locale: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) {
    return locale === 'ko' ? '방금 전' : 'just now';
  }

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isKo = locale === 'ko';

  if (diffSecs < 60) {
    return isKo ? '방금 전' : 'just now';
  }
  if (diffMins < 60) {
    return isKo ? `${diffMins}분 전` : `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return isKo ? `${diffHours}시간 전` : `${diffHours}h ago`;
  }
  return isKo ? `${diffDays}일 전` : `${diffDays}d ago`;
}

export function MyWordsScreen() {
  const { colors, spacing } = useTheme();
  const { t, language } = useAppLanguage();
  const navigation = useNavigation<MyWordsScreenNavigationProp>();

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<'create' | 'rename' | null>(null);
  const [formDeck, setFormDeck] = useState<Deck | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());
  const [inspectorDeck, setInspectorDeck] = useState<Deck | null>(null);

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveItemIds, setMoveItemIds] = useState<string[]>([]);
  const [moveExcludeDeckId, setMoveExcludeDeckId] = useState<string | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const { targetLanguage, loading: languageLoading, error: languageError, refresh: refreshLanguage } =
    useActiveTargetLanguage();

  const deckFilter = selectedDeckId ?? undefined;
  const { items, status, isLoadingMore, isRefreshing, error, loadMore, refresh } = useLearningItems(
    q,
    deckFilter,
    !!targetLanguage,
  );

  const loadDecks = useCallback(async () => {
    if (!targetLanguage) return;
    setDecksLoading(true);
    setDecksError(null);
    try {
      const loaded = await listDecks(targetLanguage);
      setDecks(loaded);
      setSelectedDeckId((prev) => (loaded.some((d) => d.id === prev) ? prev : null));
    } catch (err) {
      setDecksError(err instanceof Error ? err.message : t('words.deckLoadFailed'));
    } finally {
      setDecksLoading(false);
    }
  }, [targetLanguage, t]);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  useFocusEffect(
    useCallback(() => {
      refreshLanguage();
    }, [refreshLanguage]),
  );

  const handleCreate = useCallback(
    async (name: string) => {
      if (!targetLanguage) return;
      setFormLoading(true);
      setOperationError(null);
      try {
        await createDeck(name, targetLanguage);
        setFormMode(null);
        await loadDecks();
        await refresh();
      } catch (err) {
        setOperationError(err instanceof Error ? err.message : t('words.deckCreateFailed'));
      } finally {
        setFormLoading(false);
      }
    },
    [targetLanguage, t, loadDecks, refresh],
  );

  const handleRename = useCallback(
    async (name: string) => {
      if (!formDeck) return;
      setFormLoading(true);
      setOperationError(null);
      try {
        await renameDeck(formDeck.id, name);
        setFormMode(null);
        await loadDecks();
      } catch (err) {
        setOperationError(err instanceof Error ? err.message : t('words.deckRenameFailed'));
      } finally {
        setFormLoading(false);
      }
    },
    [formDeck, t, loadDecks],
  );

  const handleDelete = useCallback(
    async () => {
      if (!formDeck) return;
      setFormLoading(true);
      setOperationError(null);
      try {
        await deleteDeck(formDeck.id);
        setSelectedDeckId(null);
        setFormMode(null);
        await loadDecks();
        await refresh();
      } catch (err) {
        setOperationError(err instanceof Error ? err.message : t('words.deckDeleteFailed'));
      } finally {
        setFormLoading(false);
      }
    },
    [formDeck, t, loadDecks, refresh],
  );

  const handleCloseModal = useCallback(() => {
    setFormMode(null);
    setOperationError(null);
  }, []);

  const openCreate = useCallback(() => {
    setFormDeck(undefined);
    setFormMode('create');
    setOperationError(null);
  }, []);

  const openEdit = useCallback((deck: Deck) => {
    setFormDeck(deck);
    setFormMode('rename');
    setOperationError(null);
  }, []);

  const toggleDeckSelection = (deckId: string) => {
    setSelectedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  };

  const clearDeckSelection = () => setSelectedDeckIds(new Set());

  const handleSetDefault = async () => {
    // Future backend endpoint; for now no-op with console warning.
    console.warn('Set default deck not yet implemented');
  };

  const openMoveModal = useCallback((itemIds: string[], excludeDeckId?: string | null) => {
    setMoveItemIds(itemIds);
    setMoveExcludeDeckId(excludeDeckId ?? null);
    setMoveError(null);
    setMoveModalOpen(true);
  }, []);

  const closeMoveModal = useCallback(() => {
    setMoveModalOpen(false);
    setMoveItemIds([]);
    setMoveExcludeDeckId(null);
    setMoveError(null);
  }, []);

  const handleMoveToDeck = useCallback(
    async (deckId: string) => {
      if (moveItemIds.length === 0) return;
      setMoveLoading(true);
      setMoveError(null);
      try {
        await moveItemsToDeck(deckId, moveItemIds);
        closeMoveModal();
        setSelectedItemIds(new Set());
        await refresh();
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : t('words.moveToDeckFailed'));
      } finally {
        setMoveLoading(false);
      }
    },
    [moveItemIds, t, refresh, closeMoveModal],
  );

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const clearItemSelection = useCallback(() => setSelectedItemIds(new Set()), []);

  const handleCardPress = useCallback(
    (item: LearningItemListItem) => {
      if (selectedItemIds.size > 0) {
        toggleItemSelection(item.id);
        return;
      }
      navigation.navigate('WordDetail', { item });
    },
    [navigation, selectedItemIds.size, toggleItemSelection],
  );

  const handleCardLongPress = useCallback(
    (item: LearningItemListItem) => {
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    },
    [],
  );

  const handleBatchRename = () => {
    const first = decks.find((d) => selectedDeckIds.has(d.id));
    if (first) {
      setFormDeck(first);
      setFormMode('rename');
    }
  };

  const handleBatchDelete = async () => {
    const toDelete = decks.filter((d) => selectedDeckIds.has(d.id) && !d.is_default);
    for (const deck of toDelete) {
      try {
        await deleteDeck(deck.id);
      } catch (err) {
        console.error('Batch delete failed for', deck.id, err);
      }
    }
    setSelectedDeckIds(new Set());
    await loadDecks();
    await refresh();
  };

  const hasSearch = q.trim().length > 0;

  const filteredItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === 'all' || item.learning_stage === filter;
      const matchesTerm =
        !term ||
        item.lemma.toLowerCase().includes(term) ||
        (item.short_definition ?? item.definition).toLowerCase().includes(term);
      return matchesFilter && matchesTerm;
    });
  }, [items, filter, q]);

  const renderItem: ListRenderItem<LearningItemListItem> = useCallback(
    ({ item }) => {
      const selected = selectedItemIds.has(item.id);
      return (
        <CinematicCard
          onPress={() => handleCardPress(item)}
          onLongPress={() => handleCardLongPress(item)}
          style={{
            marginBottom: spacing.md,
            backgroundColor: selected ? colors.primaryContainer : undefined,
            borderColor: selected ? colors.primary : undefined,
          }}
          revealActions={
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => openMoveModal([item.id], item.deck_id ?? null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('words.moveToDeck')}
              >
                <Icon name="folder-open-outline" size="md" color={colors.primary} />
              </Pressable>
            </View>
          }
        >
        <View style={styles.row}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="title" bold>
                {item.lemma}
              </Text>
              <SpeakButton language={item.language_code} size="sm" text={item.lemma} />
            </View>
            {item.pronunciation && (
              <Text variant="caption" color="muted">
                {item.pronunciation}
              </Text>
            )}
            <Text variant="caption" color="muted">
              {item.short_definition ?? item.definition}
            </Text>
          </View>
          <Icon name="chevron-forward" size="md" />
        </View>
        <View style={[styles.badgeRow, { marginTop: spacing.sm, gap: spacing.sm, flexWrap: 'wrap' }]}>
          <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey)} variant="default" />
          <Badge label={t(`home.stage.${item.learning_stage}` as TranslationKey)} variant="primary" />
          {item.deck_name ? (
            <Badge label={`📁 ${item.deck_name}`} variant="default" />
          ) : null}
          {item.last_reviewed_at ? (
            <Badge
              label={t('words.lastReviewed', {
                time: formatRelativeTime(item.last_reviewed_at, language),
              })}
              variant="info"
            />
          ) : null}
        </View>
      </CinematicCard>
      );
    },
    [spacing.sm, spacing.md, spacing.xs, t, navigation, language, colors, handleCardPress, handleCardLongPress, openMoveModal, selectedItemIds],
  );

  const listEmpty = () => {
    if (status === 'loading' || languageLoading || decksLoading) {
      return <LoadingState />;
    }

    if (status === 'error') {
      return <ErrorState message={error ?? t('words.loadFailed')} onRetry={() => void refresh()} />;
    }

    if (languageError) {
      return <ErrorState message={languageError} onRetry={() => void refreshLanguage()} />;
    }

    if (decksError) {
      return <ErrorState message={decksError} onRetry={() => void loadDecks()} />;
    }

    if (hasSearch || filter !== 'all') {
      return (
        <EmptyState
          icon="search"
          title={t('words.noMatches', { query: q.trim() || t('words.filterAll') })}
          message={t('words.noMatchesMessage')}
        />
      );
    }

    return (
      <EmptyState
        icon="book-outline"
        title={t('words.emptyTitle')}
        message={t('words.emptyMessage')}
      />
    );
  };

  const listFooter = () => {
    if (!isLoadingMore) {
      return null;
    }
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  if (!languageLoading && languageError) {
    return (
      <Screen padded>
        <View style={[styles.header, { paddingTop: spacing.lg, gap: spacing.md, flex: 1 }]}>
          <Text variant="heading">{t('words.title')}</Text>
          <ErrorState message={languageError} onRetry={() => void refreshLanguage()} />
        </View>
      </Screen>
    );
  }

  if (!languageLoading && !targetLanguage) {
    return (
      <Screen padded>
        <View style={[styles.header, { paddingTop: spacing.lg, gap: spacing.md, flex: 1 }]}>
          <Text variant="heading">{t('words.title')}</Text>
          <EmptyState
            icon="language-outline"
            title={t('words.noLanguagePairTitle')}
            message={t('words.noLanguagePairMessage')}
            actionLabel={t('words.noLanguagePairAction')}
            onAction={() => navigation.navigate('Settings', { screen: 'LanguagePairs' })}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded>
      <View style={[styles.header, { paddingTop: spacing.lg, gap: spacing.md }]}>
        <Text variant="heading">{t('words.title')}</Text>

        {languageLoading || decksLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <DeckCanvas
            decks={decks}
            selectedId={selectedDeckId}
            onSelect={(id) => {
              if (Platform.OS === 'web') {
                toggleDeckSelection(id);
              }
              setSelectedDeckId(id);
            }}
            onCreate={openCreate}
            onEdit={(deck) => {
              setSelectedDeckId(deck.id);
              openEdit(deck);
            }}
            onInspect={(deck) => setInspectorDeck(deck)}
          />
        )}

        <Input
          value={q}
          onChangeText={setQ}
          placeholder={t('words.searchPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          onClear={() => setQ('')}
          loading={status === 'loading'}
        />
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterRow, { gap: spacing.sm }]}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={t(f.labelKey as never)}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: spacing.lg },
          filteredItems.length === 0 && styles.listEmpty,
        ]}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        style={styles.flex}
      />

      <DeckFormModal
        visible={formMode !== null}
        mode={formMode ?? 'create'}
        deck={formDeck}
        onClose={handleCloseModal}
        onSubmit={formMode === 'create' ? handleCreate : handleRename}
        onDelete={formMode === 'rename' && formDeck && !formDeck.is_default ? handleDelete : undefined}
        isLoading={formLoading}
        error={operationError ?? undefined}
      />

      <InspectorPanel
        visible={inspectorDeck !== null}
        onClose={() => setInspectorDeck(null)}
        title={inspectorDeck?.name}
      >
        <View style={{ gap: spacing.md }}>
          <Text variant="caption" color="muted">
            {t('add.deckCardCount', { count: inspectorDeck?.item_count ?? 0 })}
          </Text>
          <Button
            label={t('words.renameDeck')}
            variant="tonal"
            onPress={() => {
              if (inspectorDeck) openEdit(inspectorDeck);
              setInspectorDeck(null);
            }}
          />
          {inspectorDeck && !inspectorDeck.is_default && (
            <Button
              label={t('words.deleteDeck')}
              variant="outline"
              onPress={async () => {
                try {
                  await deleteDeck(inspectorDeck.id);
                  setSelectedDeckId(null);
                  await loadDecks();
                  await refresh();
                } catch (err) {
                  console.error(err);
                }
                setInspectorDeck(null);
              }}
            />
          )}
        </View>
      </InspectorPanel>

      <MoveToDeckModal
        visible={moveModalOpen}
        decks={decks}
        excludeDeckId={moveExcludeDeckId}
        onClose={closeMoveModal}
        onSelect={handleMoveToDeck}
        isLoading={moveLoading}
        error={moveError}
      />

      <ContextualCommandBar
        selectedCount={selectedItemIds.size > 0 ? selectedItemIds.size : selectedDeckIds.size}
        onClear={selectedItemIds.size > 0 ? clearItemSelection : clearDeckSelection}
        actions={
          selectedItemIds.size > 0
            ? [
                {
                  id: 'move',
                  label: t('words.moveToDeck'),
                  icon: 'folder-open-outline',
                  onPress: () => openMoveModal(Array.from(selectedItemIds), selectedDeckId),
                },
              ]
            : [
                {
                  id: 'rename',
                  label: t('words.renameDeck'),
                  icon: 'create-outline',
                  onPress: handleBatchRename,
                  disabled: selectedDeckIds.size !== 1,
                },
                {
                  id: 'delete',
                  label: t('words.deleteDeck'),
                  icon: 'trash-outline',
                  onPress: handleBatchDelete,
                  disabled: Array.from(selectedDeckIds).some(
                    (id) => decks.find((d) => d.id === id)?.is_default,
                  ),
                },
              ]
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {},
  filterRow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  list: {
    paddingTop: 8,
  },
  listEmpty: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
