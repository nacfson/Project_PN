import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainTabs';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Button, Card, Screen, Text } from '../../ui';
import {
  getDueLearningItems,
  listLearningItems,
  recordBatchReviewAttempts,
} from '../../api/learningItems';
import type { DueItem, ReviewAttemptParams, Example } from '../../types';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Practice'>;
type SessionStatus =
  | 'idle'
  | 'loading_due'
  | 'loading_preview'
  | 'active'
  | 'submitting'
  | 'success'
  | 'error';

// Piecewise linear mapping from ratingScore (0.0 to 3.0) to SM-2 Quality (0.0 to 5.0)
// This mirrors the backend scheduler.go logic exactly.
export function mapScoreToQuality(score: number): number {
  if (score < 1.0) {
    return score * 3.0;
  }
  return 3.0 + (score - 1.0) * 1.0;
}

// Helpers for the custom SVG-less morphing Face component
interface FaceProps {
  stateVal: number;
  color: string;
}

function Face({ stateVal, color }: FaceProps) {
  return (
    <View style={faceStyles.faceContainer}>
      <View style={faceStyles.eyesRow}>
        <Eye stateVal={stateVal} color={color} />
        <Eye stateVal={stateVal} color={color} />
      </View>
      <Mouth stateVal={stateVal} color={color} />
    </View>
  );
}

function Eye({ stateVal, color }: { stateVal: number; color: string }) {
  if (stateVal === 0) {
    // Forgot: X eyes
    return (
      <View style={faceStyles.eyeXContainer}>
        <View style={[faceStyles.eyeXLine, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
        <View style={[faceStyles.eyeXLine, { backgroundColor: color, transform: [{ rotate: '-45deg' }] }]} />
      </View>
    );
  }
  if (stateVal === 1) {
    // Hard: flat lines
    return <View style={[faceStyles.eyeFlat, { backgroundColor: color }]} />;
  }
  // Good/Easy (stateVal 2 or 3): Arches
  const isExcited = stateVal === 3;
  return (
    <View
      style={[
        faceStyles.eyeArch,
        {
          borderColor: color,
          height: isExcited ? 6 : 4,
          borderTopWidth: isExcited ? 2.5 : 2,
        },
      ]}
    />
  );
}

function Mouth({ stateVal, color }: { stateVal: number; color: string }) {
  if (stateVal === 0) {
    // Forgot: frown
    return <View style={[faceStyles.mouthFrown, { borderColor: color }]} />;
  }
  if (stateVal === 1) {
    // Hard: flat line
    return <View style={[faceStyles.mouthFlat, { backgroundColor: color }]} />;
  }
  // Good/Easy (stateVal 2 or 3): Smile / Big Smile
  const isBig = stateVal === 3;
  return (
    <View
      style={[
        faceStyles.mouthSmile,
        {
          borderColor: color,
          height: isBig ? 10 : 6,
          width: isBig ? 18 : 14,
          borderBottomWidth: isBig ? 3.5 : 2.5,
          borderBottomLeftRadius: isBig ? 9 : 7,
          borderBottomRightRadius: isBig ? 9 : 7,
          marginTop: isBig ? 0 : 2,
        },
      ]}
    />
  );
}

// Custom horizontal Slidebar with integrated Character handle
interface SlidebarProps {
  ratingScore: number;
  onChange: (score: number) => void;
}

const handleWidth = 44;
const sliderColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
const sliderBgColors = [
  'rgba(239, 68, 68, 0.15)',
  'rgba(245, 158, 11, 0.15)',
  'rgba(16, 185, 129, 0.15)',
  'rgba(59, 130, 246, 0.15)',
];
const sliderLabels = ['Forgot', 'Hard', 'Good', 'Easy'];

function Slidebar({ ratingScore, onChange }: SlidebarProps) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const startRatingScore = useRef(ratingScore);

  const stateVal =
    ratingScore < 0.75 ? 0 : ratingScore < 1.5 ? 1 : ratingScore < 2.25 ? 2 : 3;

  const color = sliderColors[stateVal];
  const label = sliderLabels[stateVal];
  const bgColor = sliderBgColors[stateVal];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRatingScore.current = ratingScore;
      },
      onPanResponderMove: (evt, gestureState) => {
        const maxLeft = trackWidth - handleWidth;
        if (maxLeft <= 0) return;

        const startPercent = startRatingScore.current / 3.0;
        const startX = startPercent * maxLeft;
        let targetX = startX + gestureState.dx;

        if (targetX < 0) targetX = 0;
        if (targetX > maxLeft) targetX = maxLeft;

        const newPercent = targetX / maxLeft;
        const score = Math.max(0, Math.min(3.0, newPercent * 3.0));
        onChange(score);
      },
    })
  ).current;

  const maxLeft = trackWidth - handleWidth;
  const currentPercent = ratingScore / 3.0;
  const leftPos = maxLeft > 0 ? currentPercent * maxLeft : 0;

  return (
    <View style={sliderStyles.container}>
      <View
        style={sliderStyles.trackWrapper}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <View style={[sliderStyles.track, { backgroundColor: colors.border }]} />
        <View
          style={[
            sliderStyles.fill,
            {
              width: `${currentPercent * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
        <View
          {...panResponder.panHandlers}
          style={[
            sliderStyles.handle,
            {
              left: leftPos,
              borderColor: color,
              backgroundColor: bgColor,
              shadowColor: color,
            },
          ]}
        >
          <Face stateVal={stateVal} color={color} />
        </View>
      </View>
      <Text style={[sliderStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

// Cloze replacement helper
function getBlankedSentence(sentence: string, word: string) {
  if (!sentence || !word) return sentence || '';
  const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}[a-zA-Z]*\\b`, 'gi');
  const blanked = sentence.replace(regex, '_____');
  if (blanked === sentence) {
    return sentence.replace(new RegExp(escaped, 'gi'), '_____');
  }
  return blanked;
}

export function PracticeScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // Review states
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [queue, setQueue] = useState<DueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [ratingScore, setRatingScore] = useState(2.0); // Default to Good

  // Custom feedback state
  const [attempts, setAttempts] = useState<ReviewAttemptParams[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic examples tracking
  const [exampleIndexMap, setExampleIndexMap] = useState<Record<string, number>>({});
  const [failedMap, setFailedMap] = useState<Record<string, boolean>>({});

  // Fetch due cards
  const loadDueItems = useCallback(() => {
    setStatus('loading_due');
    setErrorMsg(null);
    getDueLearningItems()
      .then((items) => {
        setDueItems(items);
        if (items.length > 0) {
          setQueue([...items]);
          setCurrentIndex(0);
          setAttempts([]);
          setFailedMap({});
          setExampleIndexMap({});
          setIsFlipped(false);
          setRatingScore(2.0);
          setStatus('active');
        } else {
          setStatus('idle');
        }
      })
      .catch((err) => {
        console.error('Error fetching due reviews:', err);
        setErrorMsg(err.message || 'Failed to load due review items.');
        setStatus('idle');
      });
  }, []);

  // Fetch due items on mount when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Only load automatically if we are not currently in an active or success state
      if (status !== 'active' && status !== 'success' && status !== 'submitting') {
        loadDueItems();
      }
    }, [loadDueItems, status])
  );

  // Start preview session using all words
  const startPreviewSession = () => {
    setStatus('loading_preview');
    setErrorMsg(null);
    listLearningItems({ limit: 15 })
      .then((res) => {
        if (res.items.length > 0) {
          const previewItems: DueItem[] = res.items.map((item) => ({
            user_word_sense_id: item.id,
            word_sense_id: item.word_sense_id,
            word_id: item.word_id,
            language_code: item.language_code,
            lemma: item.lemma,
            normalized_text: item.normalized_text,
            part_of_speech: item.part_of_speech,
            display_language_code: item.display_language_code,
            definition: item.definition,
            short_definition: item.short_definition,
            localized_definition: item.localized_definition,
            localized_short_definition: item.localized_short_definition,
            cefr_level: item.cefr_level,
            meaning_order: item.meaning_order,
            learning_stage: item.learning_stage,
            due_at: item.due_at,
            examples: [], // Empty examples in preview lists
          }));
          setDueItems(previewItems);
          setQueue(previewItems);
          setCurrentIndex(0);
          setAttempts([]);
          setFailedMap({});
          setExampleIndexMap({});
          setIsFlipped(false);
          setRatingScore(2.0);
          setStatus('active');
        } else {
          setStatus('idle');
          setErrorMsg('No words in your library. Add some words first!');
        }
      })
      .catch((err) => {
        console.error('Error starting preview session:', err);
        setErrorMsg(err.message || 'Failed to start preview session.');
        setStatus('idle');
      });
  };

  // Submit reviews when queue finishes
  useEffect(() => {
    if (status === 'active' && queue.length > 0 && currentIndex === queue.length) {
      setStatus('submitting');
      recordBatchReviewAttempts(attempts)
        .then((res) => {
          setXpEarned(res.xp_earned);
          setStatus('success');
        })
        .catch((err) => {
          console.error('Error submitting batch reviews:', err);
          setErrorMsg(err.message || 'Failed to submit review attempts.');
          setStatus('error');
        });
    }
  }, [currentIndex, queue.length, status, attempts]);

  // Handle grade confirmations
  const confirmGrade = () => {
    const currentItem = queue[currentIndex];
    if (!currentItem) return;

    const examplesList = currentItem.examples || [];
    const activeExIndex = exampleIndexMap[currentItem.user_word_sense_id] ?? 0;
    const example = examplesList.length > 0 ? examplesList[activeExIndex] : null;
    const activityType: ReviewAttemptParams['activity_type'] = example ? 'cloze' : 'meaning_to_word';
    const prompt = example
      ? getBlankedSentence(example.sentence, currentItem.normalized_text)
      : 'Definition: ' + currentItem.definition;

    // Create review attempt parameters matching backend schema exactly
    const attempt: ReviewAttemptParams = {
      user_word_sense_id: currentItem.user_word_sense_id,
      activity_type: activityType,
      prompt,
      user_answer: currentItem.normalized_text,
      correct_answer: currentItem.normalized_text,
      is_correct: ratingScore >= 0.75, // true if rating score >= 0.75 (i.e. not Forgot)
      rating_score: ratingScore,
      response_time_ms: null,
      confidence_rating: null,
    };

    // Append attempt
    setAttempts((prev) => [...prev, attempt]);

    // Handle Fail (Forgot) -> Re-queue item at the end and cycle sentence example
    if (ratingScore < 0.75) {
      setFailedMap((prev) => ({ ...prev, [currentItem.user_word_sense_id]: true }));
      if (examplesList.length > 1) {
        setExampleIndexMap((prev) => {
          const nextIdx = (activeExIndex + 1) % examplesList.length;
          return { ...prev, [currentItem.user_word_sense_id]: nextIdx };
        });
      }
      setQueue((prev) => [...prev, currentItem]);
    }

    // Advance queue
    setCurrentIndex((prev) => prev + 1);
    setIsFlipped(false);
    setRatingScore(2.0); // Reset score to Good
  };

  // UI state renderers
  if (status === 'loading_due' || status === 'loading_preview') {
    return (
      <Screen padded>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md }} muted>
            Preparing practice session...
          </Text>
        </View>
      </Screen>
    );
  }

  if (status === 'submitting') {
    return (
      <Screen padded>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md }} muted>
            Syncing results with server...
          </Text>
        </View>
      </Screen>
    );
  }

  if (status === 'success') {
    return (
      <Screen padded>
        <View style={[styles.center, { gap: spacing.lg }]}>
          <Text variant="heading" style={{ color: colors.success }}>
            🎉 Practice Complete!
          </Text>
          <Card style={{ width: '100%', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title" bold>
              XP Earned
            </Text>
            <Badge label={`+${xpEarned} XP`} variant="success" />
            <Text muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              Excellent job completing your review session! Your spaced-repetition progress has been saved.
            </Text>
          </Card>
          <Button
            label="Back to Home"
            variant="primary"
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('idle');
              navigation.navigate('Learn');
            }}
          />
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen padded>
        <View style={[styles.center, { gap: spacing.lg }]}>
          <Text variant="heading" style={{ color: colors.danger }}>
            Submission Failed
          </Text>
          <Text muted style={{ textAlign: 'center' }}>
            {errorMsg || 'An error occurred while saving your session attempts.'}
          </Text>
          <Button
            label="Retry Sync"
            variant="primary"
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('submitting');
              recordBatchReviewAttempts(attempts)
                .then((res) => {
                  setXpEarned(res.xp_earned);
                  setStatus('success');
                })
                .catch((err) => {
                  console.error('Retry submission error:', err);
                  setErrorMsg(err.message || 'Failed to submit review attempts.');
                  setStatus('error');
                });
            }}
          />
          <Button
            label="Discard Progress"
            variant="ghost"
            style={{ width: '100%' }}
            onPress={() => {
              setStatus('idle');
              navigation.navigate('Learn');
            }}
          />
        </View>
      </Screen>
    );
  }

  if (status === 'idle') {
    return (
      <Screen padded>
        <View style={[styles.center, { gap: spacing.lg }]}>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text variant="heading">Practice</Text>
            <Text muted style={{ textAlign: 'center' }}>
              All caught up! You have no words due for review today.
            </Text>
          </View>

          {errorMsg && (
            <Text style={{ color: colors.danger, textAlign: 'center' }}>
              {errorMsg}
            </Text>
          )}

          <Button
            label="Refresh Due Words"
            variant="primary"
            style={{ width: '100%' }}
            onPress={loadDueItems}
          />

          <Button
            label="Preview Practice Session (All Words)"
            variant="secondary"
            style={{ width: '100%' }}
            onPress={startPreviewSession}
          />
        </View>
      </Screen>
    );
  }

  // Active Practice Session
  const currentItem = queue[currentIndex];
  if (!currentItem) return null;

  const examplesList = currentItem.examples || [];
  const activeExIndex = exampleIndexMap[currentItem.user_word_sense_id] ?? 0;
  const example = examplesList.length > 0 ? examplesList[activeExIndex] : null;
  const isPreviouslyFailed = failedMap[currentItem.user_word_sense_id] ?? false;

  // Session Progress (from original due items list)
  const dueItemsReviewedCount = attempts.filter((att) =>
    dueItems.some((di) => di.user_word_sense_id === att.user_word_sense_id)
  ).length;
  const progressPercent =
    dueItems.length > 0
      ? Math.min(100, Math.floor((dueItemsReviewedCount / dueItems.length) * 100))
      : 0;

  return (
    <Screen padded>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress header */}
        <View style={[styles.progressHeader, { gap: spacing.sm }]}>
          <Text variant="caption" muted>
            Review Session: {currentIndex + 1} / {queue.length}
          </Text>
          <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: colors.success,
                },
              ]}
            />
          </View>
          {isPreviouslyFailed && (
            <Badge label="Retrying Failed Card" variant="danger" style={{ alignSelf: 'center' }} />
          )}
        </View>

        {/* Flashcard */}
        <Pressable onPress={() => setIsFlipped(!isFlipped)} style={styles.cardPressable}>
          <Card style={styles.flashcard}>
            {!isFlipped ? (
              // Front Face (Question)
              <View style={styles.cardContent}>
                <Badge
                  label={currentItem.part_of_speech.toUpperCase()}
                  variant="primary"
                />
                <Text variant="title" bold style={styles.definitionText}>
                  {currentItem.definition}
                </Text>
                {example ? (
                  <Text style={styles.clozeText}>
                    "{getBlankedSentence(example.sentence, currentItem.normalized_text)}"
                  </Text>
                ) : (
                  <Text style={styles.clozePlaceholder} muted>
                    No example sentence. Use definition to recall.
                  </Text>
                )}
                <Text variant="caption" style={styles.tapPrompt} muted>
                  ⚡ TAP TO REVEAL ANSWER
                </Text>
              </View>
            ) : (
              // Back Face (Answer)
              <View style={styles.cardContent}>
                <Badge
                  label={currentItem.part_of_speech.toUpperCase()}
                  variant="primary"
                />
                <Text variant="heading" style={styles.wordText}>
                  {currentItem.lemma}
                </Text>
                <Text variant="body" muted style={styles.backDefinitionText}>
                  {currentItem.definition}
                </Text>
                {example && (
                  <View style={styles.exampleContainer}>
                    <Text style={styles.exampleSentence}>
                      "{example.sentence}"
                    </Text>
                    {example.localized_translation && (
                      <Text style={styles.exampleTranslation} muted>
                        {example.localized_translation}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </Card>
        </Pressable>

        {/* Grading panel (only when flipped) */}
        {isFlipped && (
          <View style={[styles.gradingPanel, { gap: spacing.md }]}>
            <Text style={{ textAlign: 'center' }} bold>
              Rate your memory recall:
            </Text>
            <Slidebar ratingScore={ratingScore} onChange={setRatingScore} />
            <Button
              label="Confirm Grade"
              variant="primary"
              style={{ width: '100%', marginTop: spacing.xs }}
              onPress={confirmGrade}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// Styles
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressHeader: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardPressable: {
    width: '100%',
    minHeight: 280,
  },
  flashcard: {
    flex: 1,
    minHeight: 280,
    justifyContent: 'center',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  definitionText: {
    textAlign: 'center',
    lineHeight: 26,
    marginVertical: 10,
  },
  clozeText: {
    fontSize: 17,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
    color: '#475569',
  },
  clozePlaceholder: {
    fontStyle: 'italic',
    textAlign: 'center',
  },
  tapPrompt: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 20,
  },
  wordText: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  backDefinitionText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  exampleContainer: {
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  exampleSentence: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  exampleTranslation: {
    fontSize: 14,
    textAlign: 'center',
  },
  gradingPanel: {
    width: '100%',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
});

const faceStyles = StyleSheet.create({
  faceContainer: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 22,
    marginBottom: 4,
  },
  eyeXContainer: {
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeXLine: {
    position: 'absolute',
    width: 8,
    height: 1.8,
    borderRadius: 0.9,
  },
  eyeFlat: {
    width: 8,
    height: 1.8,
    borderRadius: 0.9,
  },
  eyeArch: {
    width: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  mouthFrown: {
    width: 14,
    height: 6,
    borderTopWidth: 2.5,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 3,
  },
  mouthFlat: {
    width: 10,
    height: 1.8,
    borderRadius: 0.9,
    marginTop: 4,
  },
  mouthSmile: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  trackWrapper: {
    width: '90%',
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 8,
    borderRadius: 4,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    height: 8,
    borderRadius: 4,
    left: 0,
  },
  handle: {
    position: 'absolute',
    width: handleWidth,
    height: handleWidth,
    borderRadius: handleWidth / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },
});
