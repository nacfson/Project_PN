import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage } from '../../i18n';
import type { LearningItemListItem } from '../../types';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, Input, LoadingState, Screen, Text } from '../../ui';
import { useLearningItems } from './useLearningItems';

export function MyWordsScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [q, setQ] = useState('');
  const { items, status, isLoadingMore, isRefreshing, error, loadMore, refresh } = useLearningItems(q);

  const hasSearch = q.trim().length > 0;

  const renderItem: ListRenderItem<LearningItemListItem> = useCallback(
    ({ item }) => (
      <Card style={{ marginBottom: spacing.md }}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="title" bold>
              {item.lemma}
            </Text>
            <Text variant="caption" color="muted">
              {item.short_definition ?? item.definition}
            </Text>
          </View>
          <Icon name="chevron-forward" size="md" />
        </View>
        <View style={[styles.badgeRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
          <Badge label={item.part_of_speech} variant="default" />
          <Badge label={item.learning_stage} variant="primary" />
        </View>
      </Card>
    ),
    [spacing.sm, spacing.md, spacing.xs]
  );

  const listEmpty = () => {
    if (status === 'loading') {
      return <LoadingState />;
    }

    if (status === 'error') {
      return <ErrorState message={error ?? t('words.loadFailed')} onRetry={() => void refresh()} />;
    }

    if (hasSearch) {
      return (
        <EmptyState
          icon="search"
          title={t('words.noMatches', { query: q.trim() })}
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
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: spacing.lg },
          items.length === 0 && styles.listEmpty,
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
