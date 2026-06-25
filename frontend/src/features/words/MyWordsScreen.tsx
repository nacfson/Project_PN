import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage } from '../../i18n';
import type { LearningItemListItem } from '../../types';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Icon, Input, LoadingState, Screen, Text } from '../../ui';
import type { TranslationKey } from '../../i18n';
import { SpeakButton } from '../../components/SpeakButton';
import { useLearningItems } from './useLearningItems';

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
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const { items, status, isLoadingMore, isRefreshing, error, loadMore, refresh } = useLearningItems(q);

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
      <Card style={{ marginBottom: spacing.md }}>
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
    [spacing.sm, spacing.md, spacing.xs, t]
  );

  const listEmpty = () => {
    if (status === 'loading') {
      return <LoadingState />;
    }

    if (status === 'error') {
      return <ErrorState message={error ?? t('words.loadFailed')} onRetry={() => void refresh()} />;
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { gap: spacing.sm }]}>
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
