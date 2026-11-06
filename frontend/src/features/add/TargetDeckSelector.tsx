import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Input, Text } from '../../ui';
import type { Deck } from '../../api/decks';

interface TargetDeckSelectorProps {
  decks: Deck[];
  selectedId: string | null;
  onSelect: (deckId: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  disabled?: boolean;
}

export function TargetDeckSelector({
  decks,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  disabled,
}: TargetDeckSelectorProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => decks.find((d) => d.id === selectedId), [decks, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return decks;
    return decks.filter((d) => d.name.toLowerCase().includes(normalized));
  }, [decks, query]);

  const canInteract = !disabled && !loading;

  return (
    <View style={styles.container}>
      {error && (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: colors.dangerSurface,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <Text variant="body" color="danger">
            {error}
          </Text>
          {onRetry && (
            <Pressable onPress={onRetry}>
              <Text variant="caption" color="accent">
                {t('add.deckLoadRetry')}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.inlineRow}>
        <Text variant="bodySmall" color="muted">
          {t('add.addingTo')}{' '}
        </Text>
        <Pressable
          onPress={() => canInteract && setIsOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen, disabled: !canInteract }}
          style={[styles.inlineTrigger, { opacity: disabled ? 0.5 : 1 }]}
          testID="target-deck-selector-trigger"
        >
          <Text variant="bodySmall" style={[styles.deckLinkText, { color: colors.text }]}>
            {selected?.name ?? t('add.noDeck')}
          </Text>
          {loading ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        </Pressable>
      </View>

      {isOpen && (
        <>
          <Pressable style={styles.overlay} onPress={() => setIsOpen(false)} />
          <View
            style={[
              styles.dropdown,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.md,
                borderColor: colors.controlBorder,
              },
            ]}
          >
            <View style={{ padding: spacing.sm }}>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder={t('add.searchDecks')}
                autoFocus
              />
            </View>
            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
              {filtered.map((deck) => {
                const isSelected = deck.id === selectedId;
                return (
                  <Pressable
                    key={deck.id}
                    onPress={() => {
                      onSelect(deck.id);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    style={[
                      styles.item,
                      {
                        backgroundColor: isSelected ? colors.fill : colors.surface,
                        borderBottomColor: colors.hairline,
                      },
                    ]}
                  >
                    <Text variant="body" style={{ fontWeight: isSelected ? '600' : '400' }}>
                      {deck.name}
                    </Text>
                    <Text variant="caption" color="muted">
                      {t('add.deckCardCount', { count: deck.item_count })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  inlineTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  deckLinkText: {
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  dropdown: {
    position: 'relative',
    marginTop: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
    minWidth: 240,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  errorBox: {
    gap: 8,
    zIndex: 2,
  },
});
