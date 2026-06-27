import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage } from '../../i18n';
import type { Deck, LearningItemListItem } from '../../types';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import { Badge, Card, Chip, EmptyState, ErrorState, Icon, Input, LoadingState, Screen, Text } from '../../ui';
import type { TranslationKey } from '../../i18n';
import { SpeakButton } from '../../components/SpeakButton';
import { useLearningItems } from './useLearningItems';
import { useActiveTargetLanguage } from '../../hooks/useActiveTargetLanguage';
import { createDeck, deleteDeck, listDecks, renameDeck } from '../../api/decks';
import { DeckList } from './DeckList';
import { DeckFormModal } from './DeckFormModal';

const FILTERS: Array<{ key: 'all' | LearningItemListItem['learning_stage']; labelKey: string }> = [
  { key: 'all', labelKey: 'words.filterAll' },
  { key: 'new', labelKey: 'home.stage.new' },
  { key: 'learning', labelKey: 'home.stage.learning' },
  { key: 'recognized', labelKey: 'home.stage.recognized' },
  { key: 'recalled', labelKey: 'home.stage.recalled' },
  { key: 'usable', labelKey: 'home.stage.usable' },
  { key: 'mastered', labelKey: 'home.stage.mastered' },
];

export function MyWordsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<WordsStackParamList, 'WordsRoot'>>();

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

  const { targetLanguage, loading: languageLoading, error: languageError, refresh: refreshLanguage } =
    useActiveTargetLanguage();

  const deckFilter = selectedDeckId ?? undefined;
  const { items, status, isLoadingMore, isRefreshing, error, loadMore, refresh } = useLearningItems(q, deckFilter);

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

  const handleCreate = async (name: string) => {
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
  };

  const handleRename = async (name: string) => {
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
  };

  const handleDelete = async () => {
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
  };

  const openCreate = () => {
    setFormDeck(undefined);
    setFormMode('create');
    setOperationError(null);
  };

  const openEdit = (deck: Deck) => {
    setFormDeck(deck);
    setFormMode('rename');
    setOperationError(null);
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
    ({ item }) => (
      <Card
        style={{ marginBottom: spacing.md }}
        onPress={() => navigation.navigate('WordDetail', { item })}
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
        <View style={[styles.badgeRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
          <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey)} variant="default" />
          <Badge label={t(`home.stage.${item.learning_stage}` as TranslationKey)} variant="primary" />
        </View>
      </Card>
    ),
    [spacing.sm, spacing.md, spacing.xs, t, navigation],
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

  return (
    <Screen padded>
      <View style={[styles.header, { paddingTop: spacing.lg, gap: spacing.md }]}>
        <Text variant="heading">{t('words.title')}</Text>

        {operationError ? (
          <Card style={{ borderColor: colors.error, borderWidth: 1, gap: spacing.sm }}>
            <Text style={{ color: colors.error }}>{operationError}</Text>
          </Card>
        ) : null}

        {languageLoading || decksLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <DeckList
            decks={decks}
            selectedId={selectedDeckId}
            onSelect={setSelectedDeckId}
            onCreate={openCreate}
            onEdit={openEdit}
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
        onClose={() => setFormMode(null)}
        onSubmit={formMode === 'create' ? handleCreate : handleRename}
        onDelete={formMode === 'rename' && formDeck && !formDeck.is_default ? handleDelete : undefined}
        isLoading={formLoading}
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
