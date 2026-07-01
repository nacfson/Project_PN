import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, LoadingState, Text } from '../../ui';
import type { Deck } from '../../types';

export interface MoveToDeckModalProps {
  visible: boolean;
  decks: Deck[];
  excludeDeckId?: string | null;
  onClose: () => void;
  onSelect: (deckId: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function MoveToDeckModal({
  visible,
  decks,
  excludeDeckId,
  onClose,
  onSelect,
  isLoading,
  error,
}: MoveToDeckModalProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const destinationDecks = decks.filter((deck) => deck.id !== excludeDeckId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderTopLeftRadius: radii.xxl,
              borderTopRightRadius: radii.xxl,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.outlineVariant }]} />
          </View>

          <View style={[styles.header, { marginBottom: spacing.md }]}>
            <Text variant="title">{t('words.moveToDeckTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          {isLoading ? (
            <LoadingState />
          ) : (
            <>
              {error ? (
                <Text variant="body" color="danger" style={{ marginBottom: spacing.md }}>
                  {error}
                </Text>
              ) : null}

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: spacing.sm }}>
                  {destinationDecks.map((deck) => (
                    <Pressable
                      key={deck.id}
                      onPress={() => onSelect(deck.id)}
                      style={({ pressed }) => [
                        styles.deckRow,
                        {
                          backgroundColor: colors.surface,
                          borderRadius: radii.md,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Icon name={deck.is_default ? 'folder' : 'folder-open'} size="md" color={colors.primary} />
                        <Text variant="body" bold>
                          {deck.name}
                        </Text>
                      </View>
                      <Text variant="caption" color="muted">
                        {t('add.deckCardCount', { count: deck.item_count })}
                      </Text>
                    </Pressable>
                  ))}
                  {destinationDecks.length === 0 && (
                    <Text variant="body" color="muted" style={{ textAlign: 'center', paddingVertical: spacing.lg }}>
                      {t('words.noOtherDecks')}
                    </Text>
                  )}
                </View>
              </ScrollView>

              <Button
                label={t('common.cancel')}
                variant="outline"
                onPress={onClose}
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
