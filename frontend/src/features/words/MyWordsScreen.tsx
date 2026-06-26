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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage } from '../../i18n';
import type { LearningItemListItem } from '../../types';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Icon, Input, LoadingState, Screen, Text } from '../../ui';
import type { TranslationKey } from '../../i18n';
import { SpeakButton } from '../../components/SpeakButton';
import { AddWordModal } from '../../components/AddWordModal';
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
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<WordsStackParamList, 'WordsRoot'>>();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [toast, setToast] = useState<{ word: string; deckName: string } | null>(null);
  const { items, status, isLoadingMore, isRefreshing, error, loadMore, refresh } = useLearningItems(q);

  const hasSearch = q.trim().length > 0;

  const handleAdded = useCallback(
    (result: { word: string; deckId: string; deckName: string }) => {
      setToast({ word: result.word, deckName: result.deckName });
      void refresh();
      setTimeout(() => setToast(null), 2000);
    },
    [refresh],
  );

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
    [spacing.sm, spacing.md, spacing.xs, t, navigation]
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
        <Button
          label={t('add.addWord')}
          iconLeft="add"
          onPress={() => setModalVisible(true)}
          accessibilityLabel={t('add.addWord')}
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

      <AddWordModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdded={handleAdded}
      />

      {toast && (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: colors.successSurface,
              borderColor: colors.successBorder,
              borderWidth: 1,
              borderRadius: radii.md,
            },
          ]}
        >
          <Icon name="checkmark-circle" size="md" color={colors.success} />
          <Text variant="body" style={{ color: colors.success, flex: 1 }}>
            {t('add.addedToDeck', { word: toast.word, deck: toast.deckName })}
          </Text>
        </View>
      )}
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
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
