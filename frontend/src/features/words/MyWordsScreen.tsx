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
import type { LearningItemListItem } from '../../types';
import { Badge, Button, Card, Input, Screen, Text } from '../../ui';
import { useLearningItems } from './useLearningItems';

export function MyWordsScreen() {
  const { colors, spacing } = useTheme();
  const [q, setQ] = useState('');
  const { items, status, isLoadingMore, isRefreshing, error, loadMore, refresh } = useLearningItems(q);

  const hasSearch = q.trim().length > 0;

  const renderItem: ListRenderItem<LearningItemListItem> = useCallback(
    ({ item }) => (
      <Card style={{ marginBottom: spacing.md }}>
        <View style={styles.row}>
          <Text variant="title">{item.lemma}</Text>
          <Badge label={item.part_of_speech} />
        </View>
        <Text muted style={{ marginTop: spacing.sm }}>
          {item.short_definition ?? item.definition}
        </Text>
        <Badge label={item.learning_stage} variant="primary" style={{ marginTop: spacing.sm }} />
      </Card>
    ),
    [spacing.sm, spacing.md],
  );

  const listEmpty = () => {
    if (status === 'loading') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    if (status === 'error') {
      return (
        <View style={styles.centered}>
          <Text muted style={{ marginBottom: spacing.md, textAlign: 'center' }}>
            {error ?? 'Failed to load words.'}
          </Text>
          <Button label="Retry" onPress={() => void refresh()} />
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Text muted>{hasSearch ? `No matches for "${q.trim()}"` : 'No words yet'}</Text>
      </View>
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
        <Text variant="heading">My Words</Text>
        <Input
          value={q}
          onChangeText={setQ}
          placeholder="Search your words"
          autoCapitalize="none"
          autoCorrect={false}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
