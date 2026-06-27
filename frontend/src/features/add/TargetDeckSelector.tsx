import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Input, Text } from '../../ui';
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
        <View style={[styles.errorBox, { backgroundColor: colors.errorContainer, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md }]}>
          <Text variant="body" color="danger">{error}</Text>
          {onRetry && (
            <Pressable onPress={onRetry}>
              <Text variant="caption" color="primary">{t('add.deckLoadRetry')}</Text>
            </Pressable>
          )}
        </View>
      )}

      <Text variant="label" color="muted" style={{ marginBottom: spacing.sm }}>
        {t('add.targetDeck')}
      </Text>
      <Pressable
        onPress={() => canInteract && setIsOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen, disabled: !canInteract }}
        style={[
          styles.selector,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderColor: colors.outlineVariant,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        testID="target-deck-selector-trigger"
      >
        <Text variant="body">{selected?.name ?? t('add.noDeck')}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.onSurfaceVariant} />
        )}
      </Pressable>

      {isOpen && (
        <>
          <Pressable style={styles.overlay} onPress={() => setIsOpen(false)} />
          <View style={[styles.dropdown, { backgroundColor: colors.surface, borderRadius: radii.md, borderColor: colors.outlineVariant }]}>
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
                    style={[styles.item, { backgroundColor: isSelected ? colors.primaryContainer : colors.surface, borderBottomColor: colors.outlineVariant }]}
                  >
                    <Text variant="body" color={isSelected ? 'primary' : 'default'}>{deck.name}</Text>
                    <Text variant="caption" color="muted">{t('add.deckCardCount', { count: deck.item_count })}</Text>
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
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    zIndex: 2,
  },
  dropdown: {
    position: 'relative',
    marginTop: 8,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
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
