import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage, type TranslationKey } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import { Badge, Button, Card, Screen, Text } from '../../ui';
import { SpeakButton } from '../../components/SpeakButton';
import { listDecks, moveItemsToDeck } from '../../api/decks';
import { archiveLearningItem } from '../../api/learningItems';
import type { Deck, LearningItemListItem } from '../../types';
import { MoveToDeckModal } from './MoveToDeckModal';
import { ChangeMeaningSheet } from './ChangeMeaningSheet';
import { getPosColor, getPosBadgeVariant } from '../../utils/text';
import { displayGloss } from '../../utils/meanings';

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
  const { colors, spacing } = useTheme();
  const posColor = getPosColor(item.part_of_speech, colors);
  const { t, language } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [changeMeaningOpen, setChangeMeaningOpen] = useState(false);

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
        navigation.goBack();
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : t('words.moveToDeckFailed'));
      } finally {
        setMoveLoading(false);
      }
    },
    [item.id, navigation, t],
  );

  const handleRemove = useCallback(async () => {
    setRemoveLoading(true);
    setRemoveError(null);
    try {
      await archiveLearningItem(item.id);
      navigation.goBack();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : t('words.removeFromDeckFailed'));
    } finally {
      setRemoveLoading(false);
    }
  }, [item.id, navigation, t]);

  const gloss = displayGloss(item);
  const cefrLabel = item.cefr_level ? `CEFR ${item.cefr_level}` : null;

  return (
    <Screen padded>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(spacing.lg, insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { gap: spacing.sm, marginBottom: spacing.md }]}>
          <View style={[styles.row, { gap: spacing.md }]}>
            <Text variant="headline" bold style={[styles.flex, { color: posColor }]}>
              {item.lemma}
            </Text>
            <SpeakButton language={item.language_code} text={item.lemma} />
          </View>
          {item.pronunciation && (
            <Text variant="caption" color="muted">
              {item.pronunciation}
            </Text>
          )}
        </View>

        <View style={[styles.badgeRow, { gap: spacing.sm, marginBottom: spacing.lg }]}>
          <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey)} variant={getPosBadgeVariant(item.part_of_speech)} />
          <Badge label={t(`home.stage.${item.learning_stage}` as TranslationKey)} variant="primary" />
          {cefrLabel && <Badge label={cefrLabel} variant="info" />}
        </View>

        {gloss ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text variant="headline" bold style={{ color: posColor }}>
              {gloss}
            </Text>
            <Text variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
              {t('words.glossAttribution')}
            </Text>
          </Card>
        ) : null}

        <Card>
          <View style={[styles.metaRow, { gap: spacing.sm }]}>
            <Text variant="label" color="muted">
              {t('words.detailAdded')}
            </Text>
            <Text variant="body">{formatDate(item.added_at, language)}</Text>
          </View>
          <View style={[styles.metaRow, { gap: spacing.sm, marginTop: spacing.sm }]}>
            <Text variant="label" color="muted">
              {t('words.detailDue')}
            </Text>
            <Text variant="body">{formatDate(item.due_at, language)}</Text>
          </View>
        </Card>

        <Button
          label={t('words.changeMeaning')}
          variant="outline"
          onPress={() => setChangeMeaningOpen(true)}
          style={{ marginTop: spacing.md }}
        />

        <Button
          label={t('words.moveToDeck')}
          variant="tonal"
          iconLeft="folder-open-outline"
          onPress={() => setMoveModalOpen(true)}
          style={{ marginTop: spacing.sm }}
        />

        <Button
          label={t('words.removeFromDeck')}
          variant="outline"
          iconLeft="trash-outline"
          onPress={() => void handleRemove()}
          loading={removeLoading}
          style={{ marginTop: spacing.sm }}
        />
        {removeError ? (
          <Text variant="caption" color="error" style={{ marginTop: spacing.xs }}>
            {removeError}
          </Text>
        ) : null}

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
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 8,
  },
  flex: {
    flex: 1,
  },
  header: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
