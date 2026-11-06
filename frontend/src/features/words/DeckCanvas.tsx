import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { radii, spacing, useTheme } from '../../theme';
import type { Deck } from '../../types';
import { Card, HoverReveal, Icon, Text } from '../../ui';

export interface DeckCanvasProps {
  decks: Deck[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit?: (deck: Deck) => void;
  onInspect?: (deck: Deck) => void;
}

export function DeckCanvas({
  decks,
  selectedId,
  onSelect,
  onCreate,
  onEdit,
  onInspect,
}: DeckCanvasProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View style={styles.grid}>
      {decks.map((deck) => {
        const selected = selectedId === deck.id;
        return (
          <View key={deck.id} style={styles.cell}>
            <Card
              onPress={() => onSelect(deck.id)}
              style={[
                styles.deckCard,
                {
                  backgroundColor: selected ? colors.infoSurface : colors.surface,
                  borderColor: selected ? colors.accent : colors.hairline,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text
                  variant="body"
                  color={selected ? colors.accent : colors.text}
                  style={styles.deckName}
                >
                  {deck.name}
                </Text>
                <HoverReveal>
                  <View style={styles.actions}>
                    {onInspect && (
                      <Pressable
                        onPress={() => onInspect(deck)}
                        hitSlop={8}
                        accessibilityRole="button"
                      >
                        <Icon
                          name="information-circle-outline"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    )}
                    {onEdit && (
                      <Pressable
                        onPress={() => onEdit(deck)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('words.renameDeck')}
                      >
                        <Icon name="create-outline" size={18} color={colors.textSecondary} />
                      </Pressable>
                    )}
                  </View>
                </HoverReveal>
              </View>
              <Text
                variant="caption"
                tabular
                color={selected ? colors.accent : colors.textSecondary}
              >
                {t('add.deckCardCount', { count: deck.item_count })}
              </Text>
            </Card>
          </View>
        );
      })}
      <Pressable onPress={onCreate} accessibilityRole="button" style={styles.cell}>
        <View
          style={[
            styles.newDeckCard,
            {
              borderColor: colors.controlBorder,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Icon name="add-circle" size={20} color={colors.accent} />
          <Text variant="bodySmall" color={colors.accent} style={styles.newDeckLabel}>
            {t('words.newDeck')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cell: {
    width: '48%',
    minWidth: 160,
  },
  deckCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deckName: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  newDeckCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacing.lg,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  newDeckLabel: {
    fontWeight: '500',
  },
});
