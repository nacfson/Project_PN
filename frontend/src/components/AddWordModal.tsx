import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listDecks } from '../api/decks';
import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import { useAddWord } from '../hooks/useAddWord';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Icon, Input, Text } from '../ui';
import { DeckSelector } from './DeckSelector';

interface AddWordModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: (result: { word: string; deckId: string; deckName: string }) => void;
  languageCode?: string;
  displayLanguageCode?: string;
}

export function AddWordModal({
  visible,
  onClose,
  onAdded,
  languageCode = DEFAULT_LANGUAGE_CODE,
  displayLanguageCode = DEFAULT_DEFINITION_LANGUAGE_CODE,
}: AddWordModalProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [word, setWord] = useState('');
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof listDecks>>>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const { addWord, isAdding, lastAdded } = useAddWord({ languageCode, displayLanguageCode });

  const defaultDeckId = useMemo(() => decks.find((d) => d.is_default)?.id ?? null, [decks]);

  useEffect(() => {
    if (!visible) {
      setWord('');
      return;
    }

    setDecksLoading(true);
    listDecks(languageCode)
      .then((loaded) => {
        setDecks(loaded);
        const defaultDeck = loaded.find((d) => d.is_default);
        setSelectedDeckId(defaultDeck?.id ?? loaded[0]?.id ?? null);
      })
      .catch(() => {
        // Silent failure: decks unavailable, add button will be disabled.
      })
      .finally(() => {
        setDecksLoading(false);
      });
  }, [visible, languageCode]);

  useEffect(() => {
    if (lastAdded && selectedDeckId) {
      const deck = decks.find((d) => d.id === selectedDeckId);
      onAdded({ ...lastAdded, deckName: deck?.name ?? lastAdded.deckId });
      onClose();
    }
  }, [lastAdded, selectedDeckId, decks, onAdded, onClose]);

  const canSubmit = word.trim().length > 0 && selectedDeckId !== null && !isAdding;

  const handleSubmit = () => {
    if (!canSubmit || !selectedDeckId) {
      return;
    }
    void addWord(word, selectedDeckId);
  };

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
            <Text variant="title">{t('add.addWord')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          <View style={{ gap: spacing.md }}>
            <DeckSelector
              decks={decks}
              selectedId={selectedDeckId ?? defaultDeckId}
              onSelect={() => {
                const current = selectedDeckId ?? defaultDeckId;
                const index = decks.findIndex((d) => d.id === current);
                const next = decks[(index + 1) % decks.length];
                if (next) {
                  setSelectedDeckId(next.id);
                }
              }}
              loading={decksLoading}
            />

            <Input
              value={word}
              onChangeText={setWord}
              placeholder={t('add.wordPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              returnKeyType="search"
              onClear={() => setWord('')}
              loading={isAdding}
              autoFocus
            />

            <Button label={t('add.addWord')} onPress={handleSubmit} disabled={!canSubmit} loading={isAdding} />
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
});
