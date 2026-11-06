import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { radii, spacing, useTheme } from '../../theme';
import type { Deck } from '../../types';
import { Icon, Text } from '../../ui';

export interface DeckListProps {
  decks: Deck[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onEdit: (deck: Deck) => void;
}

type IconName = React.ComponentProps<typeof Icon>['name'];

function DeckChip({
  label,
  count,
  icon,
  selected,
  onPress,
  onEdit,
  variant = 'default',
}: {
  label: string;
  count?: number;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  onEdit?: () => void;
  variant?: 'default' | 'create';
}) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  const isCreate = variant === 'create';
  const backgroundColor = isCreate
    ? colors.surface
    : selected
      ? colors.infoSurface
      : colors.surface;
  const borderColor = isCreate
    ? colors.controlBorder
    : selected
      ? colors.accent
      : colors.controlBorder;
  const iconColor = isCreate
    ? colors.accent
    : selected
      ? colors.accent
      : colors.textSecondary;
  const textColor = isCreate
    ? colors.accent
    : selected
      ? colors.accent
      : colors.textSecondary;

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor,
          borderColor,
          borderRadius: radii.md,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chipPressable,
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Icon name={icon} size={14} color={iconColor} />
        <Text
          variant="bodySmall"
          color={textColor}
          style={{ fontWeight: selected ? '600' : '500' }}
        >
          {count !== undefined ? `${label} (${count})` : label}
        </Text>
      </Pressable>
      {onEdit && (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('words.renameDeck')}
          style={styles.editButton}
        >
          <Icon name="ellipsis-vertical" size={14} color={iconColor} />
        </Pressable>
      )}
    </View>
  );
}

export function DeckList({ decks, selectedId, onSelect, onCreate, onEdit }: DeckListProps) {
  const { t } = useAppLanguage();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, { gap: spacing.sm }]}
    >
      <DeckChip
        label={t('words.allDecks')}
        count={decks.reduce((sum, deck) => sum + deck.item_count, 0)}
        icon="albums"
        selected={selectedId === null}
        onPress={() => onSelect(null)}
      />
      {decks.map((deck) => (
        <DeckChip
          key={deck.id}
          label={deck.name}
          count={deck.item_count}
          icon={deck.is_default ? 'folder' : 'folder-open'}
          selected={selectedId === deck.id}
          onPress={() => onSelect(deck.id)}
          onEdit={() => onEdit(deck)}
        />
      ))}
      <DeckChip
        label={t('words.createDeck')}
        icon="add-circle"
        selected={false}
        onPress={onCreate}
        variant="create"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    marginLeft: 2,
    marginRight: 6,
    padding: 2,
  },
});
