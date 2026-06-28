import { Pressable, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Card, HoverReveal, Icon, Text } from '../../ui';
import type { Deck } from '../../types';

export interface DeckCanvasProps {
  decks: Deck[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit?: (deck: Deck) => void;
  onInspect?: (deck: Deck) => void;
}

export function DeckCanvas({ decks, selectedId, onSelect, onCreate, onEdit, onInspect }: DeckCanvasProps) {
  const { colors, spacing, radii } = useTheme();
  const { t } = useAppLanguage();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {decks.map((deck) => {
        const selected = selectedId === deck.id;
        return (
          <View key={deck.id} style={{ width: '46%', minWidth: 140 }}>
            <Card
              onPress={() => onSelect(deck.id)}
              hoverElevation
              hoverScale
              style={{
                backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainerLow,
                borderColor: selected ? colors.primary : colors.outlineVariant,
                borderRadius: radii.xxl,
                padding: spacing.lg,
                minHeight: 100,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text variant="title" bold color={selected ? 'onPrimaryContainer' : 'default'}>
                  {deck.name}
                </Text>
                <HoverReveal>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {onInspect && (
                      <Pressable onPress={() => onInspect(deck)} hitSlop={8} accessibilityRole="button">
                        <Icon name="information-circle-outline" size="md" color={colors.primary} />
                      </Pressable>
                    )}
                    {onEdit && (
                      <Pressable onPress={() => onEdit(deck)} hitSlop={8} accessibilityRole="button">
                        <Icon name="create-outline" size="md" color={colors.primary} />
                      </Pressable>
                    )}
                  </View>
                </HoverReveal>
              </View>
              <Text variant="caption" color={selected ? 'onPrimaryContainer' : 'muted'}>
                {t('add.deckCardCount', { count: deck.item_count })}
              </Text>
            </Card>
          </View>
        );
      })}
      <Pressable onPress={onCreate} style={{ width: '46%', minWidth: 140 }}>
        <View
          style={{
            borderRadius: radii.xxl,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.outlineVariant,
            padding: spacing.lg,
            minHeight: 100,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          <Icon name="add-circle" size="lg" color={colors.primary} />
          <Text variant="label" color="primary">
            {t('words.createDeck')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
