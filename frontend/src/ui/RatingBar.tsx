import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { shellKind, shellLayout } from '../navigation/shellKind';
import { RatingButton } from './RatingButton';
import type { Rating } from './RatingButton';
import { Text } from './Text';

interface RatingBarProps {
  intervals?: { again: string; hard: string; good: string; easy: string };
  onSelect: (rating: Rating) => void;
}

const ratingScoreMap: Record<Rating, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
};

const ratingShortcutMap: Record<Rating, string> = {
  again: '1',
  hard: '2',
  good: '3',
  easy: '4',
};

export function RatingBar({ intervals, onSelect }: RatingBarProps) {
  const { t } = useAppLanguage();
  const { width } = useWindowDimensions();

  const labels: Record<Rating, string> = {
    again: t('practice.ratingForgot'),
    hard: t('practice.ratingHard'),
    good: t('practice.ratingGood'),
    easy: t('practice.ratingEasy'),
  };

  const defaultIntervals = { again: '-', hard: '-', good: '-', easy: '-' };
  const activeIntervals = intervals ?? defaultIntervals;

  const ratings: Rating[] = ['again', 'hard', 'good', 'easy'];
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const compact = shellLayout(shellKind(Platform.OS, ua), width) === 'bottom' || width < 520;
  const showKeyboardHint = Platform.OS === 'web' && !compact;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, compact ? styles.containerCompact : styles.containerDesktop]}>
        {ratings.map((rating) => (
          <RatingButton
            key={rating}
            option={{
              rating,
              label: labels[rating],
              interval: activeIntervals[rating],
              shortcutKey: ratingShortcutMap[rating],
              compact,
            }}
            onPress={onSelect}
            style={compact ? styles.buttonCompact : styles.buttonDesktop}
          />
        ))}
      </View>
      {showKeyboardHint ? (
        <Text variant="caption" color="muted" style={styles.hint}>
          {t('practice.rateHint')}
        </Text>
      ) : null}
    </View>
  );
}

export function scoreFromRating(rating: Rating): number {
  return ratingScoreMap[rating];
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: 10,
  },
  container: {
    width: '100%',
    flexDirection: 'row',
  },
  containerDesktop: {
    flexWrap: 'wrap',
    gap: 10,
  },
  containerCompact: {
    gap: 8,
  },
  buttonDesktop: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
  },
  buttonCompact: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    textAlign: 'center',
  },
});
