import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type CompositeNavigationProp,
  type NavigatorScreenParams,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Animated from 'react-native-reanimated';
import { createDeck, listDecks, moveItemsToDeck } from '../../api/decks';
import { archiveLearningItem, archiveLearningItems } from '../../api/learningItems';
import { SpeakButton } from '../../components/SpeakButton';
import { useActiveTargetLanguage } from '../../hooks/useActiveTargetLanguage';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import type { MainTabParamList } from '../../navigation/MainTabs';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import { radii, spacing, stageColor, useTheme } from '../../theme';
import type { Deck, LearningItemListItem } from '../../types';
import {
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  ContextualCommandBar,
  EmptyState,
  ErrorState,
  HoverReveal,
  Icon,
  Input,
  Kbd,
  LoadingState,
  PageColumn,
  Screen,
  Text,
} from '../../ui';
import { splitMeanings } from '../../utils/meanings';
import { adjustDeckCountsForMove, adjustDeckCountsForRemovedItems } from './deckCounts';
import { DeckFilterMenu } from './DeckFilterMenu';
import { DeckFormModal } from './DeckFormModal';
import { MoveToDeckModal } from './MoveToDeckModal';
import { distanceFromListBottom, readScrollMetrics } from './scrollPagination';
import { useLearningItems } from './useLearningItems';

const WIDE_LAYOUT_MIN_WIDTH = 720;

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

export interface MyWordsScreenProps {
  route?: { params?: { deckId?: string } };
}

function formatDueLabel(dueAt: string | null | undefined, todayLabel: string, locale: string): string {
  if (!dueAt) return '—';
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (date.getTime() <= endOfToday.getTime()) {
    return todayLabel;
  }
  try {
    return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dueAt.slice(0, 10);
  }
}

export function MyWordsScreen(props: MyWordsScreenProps = {}) {
  const { colors, layout } = useTheme();
  const { t, language } = useAppLanguage();
  const navigation = useNavigation<MyWordsScreenNavigationProp>();
  const { width: windowWidth } = useWindowDimensions();

  let navRouteDeckId: string | undefined;
  try {
    const navRoute = useRoute<RouteProp<WordsStackParamList, 'WordsRoot'>>();
    navRouteDeckId = navRoute?.params?.deckId;
  } catch {
    navRouteDeckId = undefined;
  }
  const routeDeckId = props.route?.params?.deckId ?? navRouteDeckId;

  const searchInputRef = useRef<TextInput>(null);
  const [q, setQ] = useState('');
  const [headerWidth, setHeaderWidth] = useState(0);
  const effectiveWidth = headerWidth > 0 ? headerWidth : windowWidth;
  const wideLayout = effectiveWidth >= WIDE_LAYOUT_MIN_WIDTH;

  const handleHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    setHeaderWidth(e.nativeEvent.layout.width);
  }, []);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(routeDeckId ?? null);

  useEffect(() => {
    if (routeDeckId !== undefined) {
      setSelectedDeckId(routeDeckId);
    }
  }, [routeDeckId]);

  const [formMode, setFormMode] = useState<'create' | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveItemIds, setMoveItemIds] = useState<string[]>([]);
  const [moveExcludeDeckId, setMoveExcludeDeckId] = useState<string | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [pendingRemoveIds, setPendingRemoveIds] = useState<string[] | null>(null);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);

  useKeyboardShortcut(
    '/',
    () => {
      searchInputRef.current?.focus();
    },
    { enabled: Platform.OS === 'web' },
  );

  const {
    targetLanguage,
    loading: languageLoading,
    error: languageError,
    refresh: refreshLanguage,
  } = useActiveTargetLanguage();

  const deckFilter = selectedDeckId ?? undefined;
  const {
    items,
    status,
    isSearching,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    loadMore,
    maybeLoadMoreFromScroll,
    refresh,
    removeItemsLocally,
  } = useLearningItems(q, deckFilter, !!targetLanguage, targetLanguage ?? undefined);

  const loadDecks = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!targetLanguage) return;
      if (!options?.silent) {
        setDecksLoading(true);
      }
      setDecksError(null);
      try {
        const loaded = await listDecks(targetLanguage, 'private');
        setDecks(loaded);
        setSelectedDeckId((prev) => {
          if (routeDeckId && loaded.some((d) => d.id === routeDeckId)) {
            return routeDeckId;
          }
          return loaded.some((d) => d.id === prev) ? prev : null;
        });
      } catch (err) {
        setDecksError(err instanceof Error ? err.message : t('words.deckLoadFailed'));
      } finally {
        if (!options?.silent) {
          setDecksLoading(false);
        }
      }
    },
    [targetLanguage, t, routeDeckId],
  );

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  useFocusEffect(
    useCallback(() => {
      refreshLanguage();
      void loadDecks({ silent: true });
      void refresh();
    }, [refreshLanguage, loadDecks, refresh]),
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

  const handleCloseModal = useCallback(() => {
    setFormMode(null);
    setOperationError(null);
  }, []);

  const openCreate = useCallback(() => {
    setFormMode('create');
    setOperationError(null);
  }, []);

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
      const movedItems = items.filter((item) => moveItemIds.includes(item.id));
      const leavesCurrentDeck = selectedDeckId != null && selectedDeckId !== deckId;

      setMoveLoading(true);
      setMoveError(null);
      setDecks((prev) => adjustDeckCountsForMove(prev, movedItems, deckId));
      if (leavesCurrentDeck) {
        removeItemsLocally(moveItemIds);
      }

      try {
        await moveItemsToDeck(deckId, moveItemIds);
        closeMoveModal();
        setSelectedItemIds(new Set());
        void loadDecks({ silent: true });
        if (!leavesCurrentDeck) {
          await refresh();
        }
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : t('words.moveToDeckFailed'));
        await refresh();
        await loadDecks({ silent: true });
      } finally {
        setMoveLoading(false);
      }
    },
    [moveItemIds, items, selectedDeckId, t, removeItemsLocally, loadDecks, refresh, closeMoveModal],
  );

  const handleRemoveItems = useCallback(
    async (itemIds: string[]) => {
      if (itemIds.length === 0) return;
      const removedItems = items.filter((item) => itemIds.includes(item.id));

      setRemoveLoading(true);
      setOperationError(null);
      removeItemsLocally(itemIds);
      setDecks((prev) => adjustDeckCountsForRemovedItems(prev, removedItems));

      try {
        if (itemIds.length === 1) {
          await archiveLearningItem(itemIds[0]!);
        } else {
          await archiveLearningItems(itemIds);
        }
        setSelectedItemIds(new Set());
        void loadDecks({ silent: true });
      } catch (err) {
        setOperationError(err instanceof Error ? err.message : t('words.removeFromDeckFailed'));
        await refresh();
        await loadDecks({ silent: true });
      } finally {
        setRemoveLoading(false);
      }
    },
    [items, t, removeItemsLocally, loadDecks, refresh],
  );

  const requestRemoveItems = useCallback((itemIds: string[]) => {
    if (itemIds.length === 0) return;
    setPendingRemoveIds(itemIds);
  }, []);

  const confirmRemoveItems = useCallback(() => {
    const ids = pendingRemoveIds;
    setPendingRemoveIds(null);
    if (ids && ids.length > 0) {
      void handleRemoveItems(ids);
    }
  }, [pendingRemoveIds, handleRemoveItems]);

  const cancelRemoveItems = useCallback(() => {
    setPendingRemoveIds(null);
  }, []);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const clearItemSelection = useCallback(() => setSelectedItemIds(new Set()), []);

  const handleRowPress = useCallback(
    (item: LearningItemListItem) => {
      if (selectedItemIds.size > 0) {
        toggleItemSelection(item.id);
        return;
      }
      navigation.navigate('WordDetail', { item });
    },
    [navigation, selectedItemIds.size, toggleItemSelection],
  );

  const handleRowLongPress = useCallback((item: LearningItemListItem) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }, []);

  const hasSearch = q.trim().length > 0;

  const stageCounts = useMemo(() => {
    const counts: Record<(typeof FILTERS)[number]['key'], number> = {
      all: items.length,
      new: 0,
      learning: 0,
      recognized: 0,
      recalled: 0,
      usable: 0,
      mastered: 0,
    };
    for (const item of items) {
      if (counts[item.learning_stage] !== undefined) {
        counts[item.learning_stage] += 1;
      }
    }
    return counts;
  }, [items]);

  const totalWordsCount = useMemo(() => {
    const deckSum = decks.reduce((sum, d) => sum + (d.item_count ?? 0), 0);
    return Math.max(items.length, deckSum);
  }, [items.length, decks]);

  const filteredItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === 'all' || item.learning_stage === filter;
      const matchesTerm =
        !term ||
        item.lemma.toLowerCase().includes(term) ||
        (item.short_definition ?? item.definition).toLowerCase().includes(term) ||
        (item.localized_definition ?? '').toLowerCase().includes(term) ||
        (item.localized_short_definition ?? '').toLowerCase().includes(term) ||
        (splitMeanings(item).simple ?? '').toLowerCase().includes(term);
      return matchesFilter && matchesTerm;
    });
  }, [items, filter, q]);

  const renderWordRow = useCallback(
    (item: LearningItemListItem, index: number) => {
      const selected = selectedItemIds.has(item.id);
      const gloss = splitMeanings(item).simple ?? item.short_definition ?? item.definition;
      const stageSwatchColor = stageColor(item.learning_stage);
      const stageLabel = t(`home.stage.${item.learning_stage}` as TranslationKey);
      const dueLabel = formatDueLabel(item.due_at, t('words.dueToday'), language);

      return (
        <Pressable
          key={item.id}
          testID={`word-row-${item.id}`}
          accessibilityRole="button"
          onPress={() => handleRowPress(item)}
          onLongPress={() => handleRowLongPress(item)}
          style={(state) => {
            const hovered = Boolean((state as { hovered?: boolean }).hovered);
            return [
              styles.tableRow,
              {
                minHeight: 56,
                backgroundColor: selected
                  ? colors.infoSurface
                  : state.pressed
                    ? colors.infoSurface
                    : hovered
                      ? colors.fill
                      : colors.surfaceBase,
                borderLeftWidth: 2,
                borderRightWidth: 2,
                borderBottomWidth: 1,
                borderColor: colors.hairline,
              },
              index === 0 && !wideLayout && {
                borderTopWidth: 2,
                borderTopLeftRadius: radii.lg,
                borderTopRightRadius: radii.lg,
              },
            ];
          }}
        >
          <View style={styles.colWord}>
            <Text variant="listLemma" style={styles.shrinkText}>
              {item.lemma}
            </Text>
            {item.pronunciation ? (
              <Text variant="ipa" color={colors.textMuted}>
                {item.pronunciation}
              </Text>
            ) : null}
          </View>

          {wideLayout ? (
            <View style={styles.colMeaning}>
              <Text
                variant="body"
                color={colors.textSecondary}
                testID={`word-gloss-${item.id}`}
                style={styles.shrinkText}
              >
                {gloss}
              </Text>
            </View>
          ) : null}

          {wideLayout ? (
            <View style={styles.colType}>
              <Text variant="caption" color={colors.textSecondary} testID={`word-type-${item.id}`}>
                {t(`pos.${item.part_of_speech}` as TranslationKey)}
              </Text>
            </View>
          ) : null}

          <View style={styles.colStage} testID={`word-stage-${item.id}`}>
            <View style={[styles.stageDot, { backgroundColor: stageSwatchColor }]} />
            <Text variant="caption" color={colors.text}>
              {stageLabel}
            </Text>
            {item.is_leech ? <Badge label={t('words.stuckBadge')} variant="danger" /> : null}
          </View>

          {wideLayout ? (
            <View style={styles.colDue}>
              <Text
                variant="caption"
                tabular
                color={dueLabel === t('words.dueToday') ? colors.accent : colors.textSecondary}
                testID={`word-due-${item.id}`}
              >
                {dueLabel}
              </Text>
            </View>
          ) : null}

          <HoverReveal>
            <View style={styles.rowActions}>
              <SpeakButton language={item.language_code} size="sm" text={item.lemma} />
              <Pressable
                testID={`word-move-${item.id}`}
                onPress={() => openMoveModal([item.id], item.deck_id ?? null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('words.moveToDeck')}
                style={styles.actionIconBtn}
              >
                <Icon name="folder-open-outline" size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable
                testID={`word-remove-${item.id}`}
                onPress={() => requestRemoveItems([item.id])}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('words.removeFromDeck')}
                disabled={removeLoading}
                style={styles.actionIconBtn}
              >
                <Icon name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
          </HoverReveal>
        </Pressable>
      );
    },
    [
      selectedItemIds,
      t,
      language,
      colors,
      wideLayout,
      handleRowPress,
      handleRowLongPress,
      openMoveModal,
      requestRemoveItems,
      removeLoading,
    ],
  );

  const renderItem: ListRenderItem<LearningItemListItem> = useCallback(
    ({ item, index }) => renderWordRow(item, index),
    [renderWordRow],
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

  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) {
      viewportHeightRef.current = height;
    }
  }, []);

  const webViewportFallback =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerHeight : 0;

  const tryLoadMoreFromMetrics = useCallback(
    (nativeEvent: NativeScrollEvent | null | undefined, offsetYOverride?: number) => {
      const metrics = readScrollMetrics(nativeEvent, {
        contentHeight: contentHeightRef.current,
        viewportHeight: viewportHeightRef.current || webViewportFallback,
      });
      if (!metrics) {
        return;
      }
      if (nativeEvent?.contentSize?.height) {
        contentHeightRef.current = nativeEvent.contentSize.height;
      }
      if (nativeEvent?.layoutMeasurement?.height) {
        viewportHeightRef.current = nativeEvent.layoutMeasurement.height;
      }
      const offsetY = offsetYOverride ?? metrics.offsetY;
      const distanceFromBottom = distanceFromListBottom(
        metrics.contentHeight,
        metrics.viewportHeight,
        offsetY,
      );
      if (distanceFromBottom != null) {
        maybeLoadMoreFromScroll(distanceFromBottom);
      }
    },
    [maybeLoadMoreFromScroll, webViewportFallback],
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeightRef.current = height;
      tryLoadMoreFromMetrics(null, 0);
    },
    [tryLoadMoreFromMetrics],
  );

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      tryLoadMoreFromMetrics(event.nativeEvent);
    },
    [tryLoadMoreFromMetrics],
  );

  const listFooter = () => (
    <View style={styles.footerWrap}>
      {filteredItems.length > 0 ? (
        <Text variant="caption" color={colors.textMuted} style={styles.rowHint}>
          {t('words.rowHint')}
        </Text>
      ) : null}
      {isLoadingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : hasMore ? (
        <View style={styles.footer}>
          <Button
            label={t('words.loadMore')}
            variant="secondary"
            onPress={() => void loadMore()}
            disabled={isLoadingMore}
          />
        </View>
      ) : null}
    </View>
  );

  const listHeader = useMemo(() => {
    const filterChips = FILTERS.map((f) => (
      <Chip
        key={f.key}
        testID={`stage-tab-${f.key}`}
        label={t(f.labelKey as never)}
        count={stageCounts[f.key]}
        selected={filter === f.key}
        onPress={() => setFilter(f.key)}
      />
    ));

    return (
      <View testID="words-header" style={styles.headerBlock} onLayout={handleHeaderLayout}>
        <View style={[styles.topBar, { borderBottomColor: colors.hairline }]}>
          <View style={styles.titleStack}>
            <Text variant="pageTitle">{t('words.title')}</Text>
            <Text variant="bodySmall" color={colors.textSecondary} testID="words-summary">
              {t('words.summary', { words: totalWordsCount, decks: decks.length })}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <DeckFilterMenu
              decks={decks}
              selectedDeckId={selectedDeckId}
              totalWordsCount={totalWordsCount}
              onSelectDeck={(id) => setSelectedDeckId(id)}
              onNewDeck={openCreate}
              onManageDecks={() => navigation.navigate('Decks')}
            />
            <Button
              testID="words-new-deck"
              label={t('words.newDeck')}
              variant="primary"
              size="md"
              iconLeft="add"
              onPress={openCreate}
            />
          </View>
        </View>

        <Input
          ref={searchInputRef}
          testID="words-search-input"
          value={q}
          onChangeText={setQ}
          placeholder={t('words.searchPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          leading={<Icon name="search" size={16} color={colors.textMuted} />}
          trailing={!q ? <Kbd>/</Kbd> : undefined}
          onClear={() => setQ('')}
          loading={isSearching}
        />

        {wideLayout ? (
          <View testID="words-filter-row" style={[styles.filterRow, styles.filterRowWrap]}>
            {filterChips}
          </View>
        ) : (
          <ScrollView
            testID="words-filter-row"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterChips}
          </ScrollView>
        )}

        {wideLayout && filteredItems.length > 0 ? (
          <View
            testID="words-table-header"
            style={[
              styles.tableHeader,
              {
                backgroundColor: colors.surfaceHighlight,
                borderColor: colors.hairline,
                borderTopWidth: 2,
                borderLeftWidth: 2,
                borderRightWidth: 2,
                borderBottomWidth: 2,
                borderTopLeftRadius: radii.lg,
                borderTopRightRadius: radii.lg,
              },
            ]}
          >
            <View style={styles.colWord}>
              <Text variant="groupLabel">{t('words.colWord')}</Text>
            </View>
            <View style={styles.colMeaning}>
              <Text variant="groupLabel">{t('words.colMeaning')}</Text>
            </View>
            <View style={styles.colType}>
              <Text variant="groupLabel">{t('words.colType')}</Text>
            </View>
            <View style={styles.colStage}>
              <Text variant="groupLabel">{t('words.colStage')}</Text>
            </View>
            <View style={styles.colDue}>
              <Text variant="groupLabel">{t('words.colDue')}</Text>
            </View>
            <View style={styles.rowActionsSpacer} />
          </View>
        ) : null}
      </View>
    );
  }, [
    t,
    stageCounts,
    filter,
    handleHeaderLayout,
    colors.hairline,
    colors.textSecondary,
    colors.textMuted,
    totalWordsCount,
    decks,
    selectedDeckId,
    openCreate,
    navigation,
    q,
    isSearching,
    wideLayout,
    filteredItems.length,
  ]);

  if (!languageLoading && languageError) {
    return (
      <Screen title={t('words.title')}>
        <PageColumn>
          <ErrorState message={languageError} onRetry={() => void refreshLanguage()} />
        </PageColumn>
      </Screen>
    );
  }

  if (!languageLoading && !targetLanguage) {
    return (
      <Screen title={t('words.title')}>
        <PageColumn>
          <EmptyState
            icon="language-outline"
            title={t('words.noLanguagePairTitle')}
            message={t('words.noLanguagePairMessage')}
            actionLabel={t('words.noLanguagePairAction')}
            onAction={() => navigation.navigate('Settings', { screen: 'LanguagePairs' })}
          />
        </PageColumn>
      </Screen>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={() => void refresh()}
      tintColor={colors.accent}
      colors={[colors.accent]}
    />
  );

  const listContentStyle = [
    styles.list,
    filteredItems.length === 0 && styles.listEmpty,
  ];

  const confirmDialogTitle =
    pendingRemoveIds && pendingRemoveIds.length > 1
      ? t('words.removeConfirmTitleMany', { count: pendingRemoveIds.length })
      : t('words.removeConfirmTitle');

  const overlays = (
    <>
      <DeckFormModal
        visible={formMode !== null}
        mode="create"
        onClose={handleCloseModal}
        onSubmit={handleCreate}
        isLoading={formLoading}
        error={operationError ?? undefined}
      />

      <MoveToDeckModal
        visible={moveModalOpen}
        decks={decks}
        excludeDeckId={moveExcludeDeckId}
        onClose={closeMoveModal}
        onSelect={handleMoveToDeck}
        isLoading={moveLoading}
        error={moveError}
      />

      <ConfirmDialog
        visible={pendingRemoveIds !== null && pendingRemoveIds.length > 0}
        title={confirmDialogTitle}
        body={t('words.removeConfirmBody')}
        confirmLabel={t('words.removeConfirmAction')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={confirmRemoveItems}
        onCancel={cancelRemoveItems}
      />

      <ContextualCommandBar
        selectedCount={selectedItemIds.size}
        onClear={clearItemSelection}
        actions={[
          {
            id: 'move',
            label: t('words.moveToDeck'),
            icon: 'folder-open-outline',
            onPress: () => openMoveModal(Array.from(selectedItemIds), selectedDeckId),
          },
          {
            id: 'remove',
            label: t('words.removeFromDeck'),
            icon: 'trash-outline',
            onPress: () => requestRemoveItems(Array.from(selectedItemIds)),
            disabled: removeLoading,
          },
        ]}
      />
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <>
        <Screen
          testID="words-screen-scroll"
          refreshControl={refreshControl}
          onScroll={handleListScroll}
          onLayout={handleListLayout}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
          contentContainerStyle={listContentStyle}
        >
          <PageColumn>
            {listHeader}
            {filteredItems.length === 0 ? (
              listEmpty()
            ) : (
              <View
                testID="words-table"
                style={[
                  styles.tableSurface,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.hairline,
                  },
                ]}
              >
                {filteredItems.map((item, idx) => renderWordRow(item, idx))}
              </View>
            )}
            {listFooter()}
          </PageColumn>
        </Screen>
        {overlays}
      </>
    );
  }

  return (
    <>
      <Screen
        testID="words-screen-flatlist"
        as={Animated.FlatList}
        data={filteredItems}
        keyExtractor={(item: LearningItemListItem) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          listContentStyle,
          { paddingHorizontal: layout.pagePadding.phone.x },
        ]}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.2}
        onLayout={handleListLayout}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        nestedScrollEnabled
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        ListHeaderComponent={listHeader}
        refreshControl={refreshControl}
        style={styles.flex}
      />
      {overlays}
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  headerBlock: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  titleStack: {
    gap: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterRow: {
    paddingVertical: 2,
    gap: spacing.xs,
  },
  filterRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  tableSurface: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    minHeight: 56,
  },
  colWord: {
    flex: 1.4,
    minWidth: 120,
    gap: 2,
  },
  colMeaning: {
    flex: 2,
    minWidth: 140,
  },
  colType: {
    width: 84,
  },
  colStage: {
    width: 110,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  colDue: {
    width: 80,
    alignItems: 'flex-end',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowActionsSpacer: {
    width: 96,
  },
  actionIconBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  shrinkText: {
    flexShrink: 1,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  listEmpty: {
    flexGrow: 1,
  },
  footerWrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  rowHint: {
    paddingHorizontal: spacing.xs,
  },
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
