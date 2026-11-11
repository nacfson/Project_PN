import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDeck, deleteDeck, listDecks, renameDeck } from '../../api/decks';
import { useActiveTargetLanguage } from '../../hooks/useActiveTargetLanguage';
import { useAppLanguage } from '../../i18n';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import { radii, spacing, useTheme } from '../../theme';
import type { Deck } from '../../types';
import { Button, ErrorState, Icon, LoadingState, PageColumn, Screen, Text } from '../../ui';
import { DeckFormModal } from './DeckFormModal';

type Props = NativeStackScreenProps<WordsStackParamList, 'Decks'>;

export function DecksScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const { targetLanguage } = useActiveTargetLanguage();
  const activeLang = targetLanguage ?? 'en';

  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<'create' | 'rename' | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | undefined>(undefined);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | undefined>(undefined);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDecks(activeLang, 'private');
      setDecks(list);
    } catch {
      setError(t('words.deckLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [activeLang, t]);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  const handleOpenCreate = () => {
    setEditingDeck(undefined);
    setModalError(undefined);
    setModalMode('create');
  };

  const handleOpenRename = (deck: Deck) => {
    setEditingDeck(deck);
    setModalError(undefined);
    setModalMode('rename');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setEditingDeck(undefined);
    setModalError(undefined);
  };

  const handleSubmitModal = async (name: string) => {
    setModalLoading(true);
    setModalError(undefined);
    try {
      if (modalMode === 'create') {
        const created = await createDeck(name, activeLang);
        setDecks((prev) => [...prev, created]);
      } else if (modalMode === 'rename' && editingDeck) {
        await renameDeck(editingDeck.id, name);
        setDecks((prev) =>
          prev.map((d) => (d.id === editingDeck.id ? { ...d, name } : d)),
        );
      }
      handleCloseModal();
    } catch {
      setModalError(
        modalMode === 'create' ? t('words.deckCreateFailed') : t('words.deckRenameFailed'),
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteDeck = async (targetDeck?: Deck) => {
    const deckToDelete = targetDeck ?? editingDeck;
    if (!deckToDelete || deckToDelete.is_default) return;
    setModalLoading(true);
    setModalError(undefined);
    try {
      await deleteDeck(deckToDelete.id);
      setDecks((prev) => prev.filter((d) => d.id !== deckToDelete.id));
      handleCloseModal();
    } catch {
      setModalError(t('words.deckDeleteFailed'));
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <Screen>
      <PageColumn style={styles.page}>
        <View style={[styles.header, { borderBottomColor: colors.hairline }]}>
          <Text variant="pageTitle">{t('words.decksTitle')}</Text>
          <Button
            testID="decks-create-button"
            label={t('words.newDeck')}
            variant="primary"
            size="md"
            iconLeft="add"
            onPress={handleOpenCreate}
          />
        </View>

        {loading && decks.length === 0 ? (
          <LoadingState />
        ) : error && decks.length === 0 ? (
          <ErrorState message={error} onRetry={loadDecks} />
        ) : (
          <View
            style={[
              styles.listCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.hairline,
              },
            ]}
          >
            {decks.map((deck, index) => (
              <View
                key={deck.id}
                style={[
                  styles.row,
                  index > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: colors.hairline,
                  },
                ]}
              >
                <Pressable
                  testID={`deck-row-${deck.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={deck.name}
                  onPress={() => navigation.navigate('WordsRoot', { deckId: deck.id })}
                  style={styles.rowMain}
                >
                  <View style={styles.rowTitleGroup}>
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

                <View style={styles.rowActions}>
                  <Pressable
                    testID={`deck-rename-${deck.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('words.renameDeck')}
                    onPress={() => handleOpenRename(deck)}
                    hitSlop={8}
                    style={styles.iconBtn}
                  >
                    <Icon name="create-outline" size={18} color={colors.textSecondary} />
                  </Pressable>
                  {!deck.is_default ? (
                    <Pressable
                      testID={`deck-delete-${deck.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('words.deleteDeck')}
                      onPress={() => void handleDeleteDeck(deck)}
                      hitSlop={8}
                      style={styles.iconBtn}
                    >
                      <Icon name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <DeckFormModal
          visible={modalMode !== null}
          mode={modalMode ?? 'create'}
          deck={editingDeck}
          onClose={handleCloseModal}
          onSubmit={(name) => void handleSubmitModal(name)}
          onDelete={
            editingDeck && !editingDeck.is_default ? () => void handleDeleteDeck() : undefined
          }
          isLoading={modalLoading}
          error={modalError}
        />
      </PageColumn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  listCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deckName: {
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
});
