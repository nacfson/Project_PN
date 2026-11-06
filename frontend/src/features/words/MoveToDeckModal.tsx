import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../../i18n';
import { PAGE_WIDTH_FRAME } from '../../navigation/shellKind';
import { radii, spacing, useTheme } from '../../theme';
import type { Deck } from '../../types';
import { Button, Icon, LoadingState, Text } from '../../ui';

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
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const destinationDecks = decks.filter((deck) => deck.id !== excludeDeckId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <View
          testID="bottom-sheet"
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderColor: colors.hairline,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.controlBorder }]} />
          </View>

          <View style={styles.header}>
            <Text variant="sectionTitle">{t('words.moveToDeckTitle')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Icon name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {isLoading ? (
            <LoadingState />
          ) : (
            <>
              {error ? (
                <Text variant="bodySmall" color={colors.danger} style={styles.errorText}>
                  {error}
                </Text>
              ) : null}

              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.list}>
                  {destinationDecks.map((deck) => (
                    <Pressable
                      key={deck.id}
                      testID={`move-to-deck-option-${deck.id}`}
                      onPress={() => onSelect(deck.id)}
                      style={({ pressed }) => [
                        styles.deckRow,
                        {
                          backgroundColor: pressed ? colors.fill : colors.surface,
                          borderColor: colors.hairline,
                        },
                      ]}
                      accessibilityRole="button"
                    >
                      <View style={styles.deckRowLeft}>
                        <Icon
                          name={deck.is_default ? 'folder' : 'folder-open'}
                          size={18}
                          color={colors.accent}
                        />
                        <Text variant="body" style={styles.deckName}>
                          {deck.name}
                        </Text>
                      </View>
                      <Text variant="caption" tabular color={colors.textSecondary}>
                        {t('add.deckCardCount', { count: deck.item_count })}
                      </Text>
                    </Pressable>
                  ))}
                  {destinationDecks.length === 0 && (
                    <Text variant="body" color={colors.textSecondary} style={styles.emptyText}>
                      {t('words.noOtherDecks')}
                    </Text>
                  )}
                </View>
              </ScrollView>

              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={onClose}
                style={styles.cancelButton}
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
    ...PAGE_WIDTH_FRAME,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
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
    marginBottom: spacing.md,
  },
  errorText: {
    marginBottom: spacing.md,
  },
  scroll: {
    maxHeight: 320,
  },
  list: {
    gap: spacing.xs,
  },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  deckRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deckName: {
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
});
