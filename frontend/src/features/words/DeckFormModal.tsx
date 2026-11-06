import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../../i18n';
import { PAGE_WIDTH_FRAME } from '../../navigation/shellKind';
import { radii, spacing, useTheme } from '../../theme';
import type { Deck } from '../../types';
import { Button, Icon, Input, Text } from '../../ui';

export interface DeckFormModalProps {
  visible: boolean;
  mode: 'create' | 'rename';
  deck?: Deck;
  onClose: () => void;
  onSubmit: (name: string) => void;
  onDelete?: () => void;
  isLoading?: boolean;
  error?: string;
}

export function DeckFormModal({
  visible,
  mode,
  deck,
  onClose,
  onSubmit,
  onDelete,
  isLoading,
  error: apiError,
}: DeckFormModalProps) {
  const { colors } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(mode === 'rename' && deck ? deck.name : '');
      setError(null);
      setConfirmingDelete(false);
    }
  }, [visible, mode, deck]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('words.deckNameRequired'));
      return;
    }
    if (trimmed.length > 120) {
      setError(t('words.deckNameTooLong'));
      return;
    }
    if (mode === 'rename' && deck && trimmed === deck.name) {
      onClose();
      return;
    }
    onSubmit(trimmed);
  };

  const handleDeletePress = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete?.();
  };

  const canSubmit = name.trim().length > 0 && name.trim().length <= 120 && !isLoading;
  const title = mode === 'create' ? t('words.createDeck') : t('words.renameDeck');

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
            <Text variant="sectionTitle">{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Icon name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.formBody}>
            <Input
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              placeholder={t('words.deckNamePlaceholder')}
              autoFocus
              helperText={error ?? undefined}
              error={!!error}
              onSubmitEditing={handleSubmit}
            />

            {apiError ? (
              <Text variant="bodySmall" color={colors.danger}>
                {apiError}
              </Text>
            ) : null}

            <Button
              label={title}
              variant="primary"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isLoading}
            />

            {mode === 'rename' && onDelete && deck && !deck.is_default && (
              <View style={styles.deleteSection}>
                {confirmingDelete ? (
                  <View style={styles.deleteSection}>
                    <Text variant="body" style={styles.deleteTitle}>
                      {t('words.deckDeleteConfirmTitle', { deck: deck.name })}
                    </Text>
                    <View style={styles.confirmRow}>
                      <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                        {t('words.deckDeleteConfirmMessage')}
                      </Text>
                      <Button
                        label={t('common.cancel')}
                        variant="secondary"
                        onPress={() => setConfirmingDelete(false)}
                        disabled={isLoading}
                      />
                      <Button
                        label={t('words.deckDeleteConfirm')}
                        variant="danger"
                        onPress={handleDeletePress}
                        loading={isLoading}
                      />
                    </View>
                  </View>
                ) : (
                  <Button
                    label={t('words.deleteDeck')}
                    variant="secondary"
                    iconLeft="trash"
                    onPress={handleDeletePress}
                  />
                )}
              </View>
            )}
          </View>
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
  formBody: {
    gap: spacing.md,
  },
  deleteSection: {
    gap: spacing.sm,
  },
  deleteTitle: {
    fontWeight: '600',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
