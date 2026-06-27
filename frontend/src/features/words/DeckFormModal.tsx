import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, Input, Text } from '../../ui';
import type { Deck } from '../../types';

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
  const { colors, radii, spacing } = useTheme();
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
            <Text variant="title">{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          <View style={{ gap: spacing.md }}>
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
              <Text style={{ color: colors.error }}>{apiError}</Text>
            ) : null}

            <Button
              label={title}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isLoading}
            />

            {mode === 'rename' && onDelete && deck && !deck.is_default && (
              <View style={{ gap: spacing.sm }}>
                {confirmingDelete ? (
                  <View style={{ gap: spacing.sm }}>
                    <Text variant="body" bold>
                      {t('words.deckDeleteConfirmTitle', { deck: deck.name })}
                    </Text>
                    <View style={[styles.confirmRow, { gap: spacing.sm }]}>
                      <Text variant="caption" color="muted" style={{ flex: 1 }}>
                        {t('words.deckDeleteConfirmMessage')}
                      </Text>
                      <Button
                        label={t('common.cancel')}
                        variant="outline"
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
                    variant="outline"
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
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
