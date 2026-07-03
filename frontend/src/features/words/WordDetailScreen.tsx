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
import type { Deck } from '../../types';
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
  const { item } = route.params;
  const { colors, spacing } = useTheme();
  const { t, language } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDecksLoading(true);
    listDecks(item.language_code)
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

  const definition = item.localized_definition || item.definition;
  const shortDefinition = item.localized_short_definition || item.short_definition;
  const cefrLabel = item.cefr_level ? `CEFR ${item.cefr_level}` : null;
  const examples = item.examples ?? [];

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
            <Text variant="headline" bold style={styles.flex}>
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
          <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey)} variant="default" />
          <Badge label={t(`home.stage.${item.learning_stage}` as TranslationKey)} variant="primary" />
          {cefrLabel && <Badge label={cefrLabel} variant="info" />}
        </View>

        <Card style={{ marginBottom: spacing.md }}>
          <Text variant="label" color="muted" style={{ marginBottom: spacing.xs }}>
            {t('words.detailDefinition')}
          </Text>
          <Text variant="body">{definition}</Text>
          {shortDefinition && shortDefinition !== definition && (
            <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
              {shortDefinition}
            </Text>
          )}
        </Card>

        {examples.length > 0 && (
          <Card style={{ marginBottom: spacing.md }}>
            <Text variant="label" color="muted" style={{ marginBottom: spacing.sm }}>
              {t('words.detailExamples')}
            </Text>
            <View style={{ gap: spacing.md }}>
              {examples.map((example, index) => (
                <View
                  key={index}
                  style={[
                    styles.example,
                    index !== examples.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.outlineVariant,
                      paddingBottom: spacing.md,
                    },
                  ]}
                >
                  <Text variant="body">{example.sentence}</Text>
                  {example.localized_translation && (
                    <Text variant="caption" color="muted" style={{ marginTop: spacing.xs }}>
                      {example.localized_translation}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </Card>
        )}

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
          label={t('words.moveToDeck')}
          variant="tonal"
          iconLeft="folder-open-outline"
          onPress={() => setMoveModalOpen(true)}
          style={{ marginTop: spacing.md }}
        />

        <MoveToDeckModal
          visible={moveModalOpen}
          decks={decks}
          excludeDeckId={item.deck_id ?? null}
          onClose={() => setMoveModalOpen(false)}
          onSelect={handleMove}
          isLoading={moveLoading || decksLoading}
          error={moveError}
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
  example: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
