import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listDecks, moveItemsToDeck } from '../../api/decks';
import { archiveLearningItem } from '../../api/learningItems';
import { SpeakButton } from '../../components/SpeakButton';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import { spacing, useTheme } from '../../theme';
import type { Deck, LearningItemListItem } from '../../types';
import { Badge, Button, Card, ConfirmDialog, PageColumn, Screen, Text } from '../../ui';
import { displayGloss } from '../../utils/meanings';
import { ChangeMeaningSheet } from './ChangeMeaningSheet';
import { MoveToDeckModal } from './MoveToDeckModal';

type WordDetailScreenProps = NativeStackScreenProps<WordsStackParamList, 'WordDetail'>;

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function WordDetailScreen({ route, navigation }: WordDetailScreenProps) {
  const { item: routeItem } = route.params;
  const [item, setItem] = useState<LearningItemListItem>(routeItem);
  const { colors } = useTheme();
  const { t, language } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [changeMeaningOpen, setChangeMeaningOpen] = useState(false);
  const [changeMeaningBusy, setChangeMeaningBusy] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setDecksLoading(true);
    listDecks(item.language_code, 'private')
      .then((loaded) => {
        if (!active) return;
        setDecks(loaded);
      })
      .catch(() => {
        if (!active) return;
        setDecks([]);
      })
      .finally(() => {
        if (active) setDecksLoading(false);
      });
    return () => {
      active = false;
    };
  }, [item.language_code]);

  const handleMove = useCallback(
    async (deckId: string) => {
      setMoveLoading(true);
      setMoveError(null);
      try {
        await moveItemsToDeck(deckId, [item.id]);
        setMoveModalOpen(false);
        navigation?.goBack?.();
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : t('words.moveToDeckFailed'));
      } finally {
        setMoveLoading(false);
      }
    },
    [item.id, navigation, t],
  );

  const handleConfirmRemove = useCallback(async () => {
    setConfirmRemoveOpen(false);
    setRemoveLoading(true);
    try {
      await archiveLearningItem(item.id);
      navigation?.goBack?.();
    } finally {
      setRemoveLoading(false);
    }
  }, [item.id, navigation]);

  const gloss = displayGloss(item);
  const cefrLabel = item.cefr_level ? `CEFR ${item.cefr_level}` : null;

  return (
    <Screen>
      <PageColumn>
          <View style={styles.header}>
            <View style={styles.row}>
              <Text variant="cardLemma" style={styles.flex}>
                {item.lemma}
              </Text>
              <SpeakButton language={item.language_code} text={item.lemma} />
            </View>
            {item.pronunciation && (
              <Text variant="ipa" color={colors.textMuted}>
                {item.pronunciation}
              </Text>
            )}
          </View>

          <View style={styles.badgeRow}>
            <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey)} variant="neutral" />
            <Badge label={t(`home.stage.${item.learning_stage}` as TranslationKey)} variant="accent" />
            {item.is_leech ? <Badge label={t('words.stuckBadge')} variant="danger" /> : null}
            {cefrLabel && <Badge label={cefrLabel} variant="neutral" />}
          </View>

          {gloss ? (
            <Card style={styles.cardSpacing}>
              <Text variant="meaning" color={colors.text}>
                {gloss}
              </Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.attribution}>
                {item.personal_note?.trim()
                  ? t('practice.yourMeaning')
                  : t('words.glossAttribution')}
              </Text>
            </Card>
          ) : null}

          <Card>
            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.textSecondary}>
                {t('words.detailAdded')}
              </Text>
              <Text variant="body" tabular>
                {formatDate(item.added_at, language)}
              </Text>
            </View>
            <View style={[styles.metaRow, styles.metaRowSpacing]}>
              <Text variant="caption" color={colors.textSecondary}>
                {t('words.detailDue')}
              </Text>
              <Text variant="body" tabular>
                {formatDate(item.due_at, language)}
              </Text>
            </View>
          </Card>

          <View style={styles.actions}>
            <Button
              label={t('words.changeMeaning')}
              variant="secondary"
              onPress={() => setChangeMeaningOpen(true)}
              loading={changeMeaningBusy}
              disabled={changeMeaningBusy}
            />

            <Button
              testID="word-detail-move"
              label={t('words.moveToDeck')}
              variant="secondary"
              iconLeft="folder-open-outline"
              onPress={() => setMoveModalOpen(true)}
            />

            <Button
              testID="word-detail-remove"
              label={t('words.removeFromDeck')}
              variant="danger"
              iconLeft="trash-outline"
              onPress={() => setConfirmRemoveOpen(true)}
              loading={removeLoading}
              disabled={removeLoading}
            />
          </View>

          <MoveToDeckModal
            visible={moveModalOpen}
            decks={decks}
            excludeDeckId={item.deck_id ?? null}
            onClose={() => setMoveModalOpen(false)}
            onSelect={handleMove}
            isLoading={moveLoading || decksLoading}
            error={moveError}
          />

          <ChangeMeaningSheet
            visible={changeMeaningOpen}
            item={item}
            onClose={() => setChangeMeaningOpen(false)}
            onChanged={setItem}
            onBusyChange={setChangeMeaningBusy}
          />

          <ConfirmDialog
            visible={confirmRemoveOpen}
            title={t('words.removeConfirmTitle')}
            body={t('words.removeConfirmBody')}
            confirmLabel={t('words.removeConfirmAction')}
            cancelLabel={t('common.cancel')}
            tone="danger"
            onConfirm={() => void handleConfirmRemove()}
            onCancel={() => setConfirmRemoveOpen(false)}
          />
        </PageColumn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  cardSpacing: {
    marginBottom: spacing.md,
  },
  attribution: {
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaRowSpacing: {
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
