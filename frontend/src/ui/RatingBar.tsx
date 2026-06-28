import { StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { RatingButton } from './RatingButton';
import { StaggeredList } from './StaggeredList';
import type { Rating } from './RatingButton';

interface RatingBarProps {
  intervals?: { again: string; hard: string; good: string; easy: string };
  onSelect: (rating: Rating) => void;
}

const ratingColors: Record<Rating, string> = {
  again: '#b3261e',
  hard: '#d97706',
  good: '#16a34a',
  easy: '#6750a4',
};

const ratingBgColors: Record<Rating, string> = {
  again: 'rgba(179, 38, 30, 0.12)',
  hard: 'rgba(217, 119, 6, 0.12)',
  good: 'rgba(22, 163, 74, 0.12)',
  easy: 'rgba(103, 80, 164, 0.12)',
};

const ratingScoreMap: Record<Rating, number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3,
};

export function RatingBar({ intervals, onSelect }: RatingBarProps) {
  const { t } = useAppLanguage();

  const labels: Record<Rating, string> = {
    again: t('practice.ratingForgot'),
    hard: t('practice.ratingHard'),
    good: t('practice.ratingGood'),
    easy: t('practice.ratingEasy'),
  };

  const defaultIntervals = { again: '-', hard: '-', good: '-', easy: '-' };
  const activeIntervals = intervals ?? defaultIntervals;

  const ratings: Rating[] = ['again', 'hard', 'good', 'easy'];

  return (
    <View style={styles.container}>
      <StaggeredList delayMs={40} style={{ flexDirection: 'row', gap: 8 }}>
        {ratings.map((rating) => (
          <RatingButton
            key={rating}
            option={{
              rating,
              label: labels[rating],
              interval: activeIntervals[rating],
              color: ratingColors[rating],
              backgroundColor: ratingBgColors[rating],
            }}
            onPress={onSelect}
            style={styles.button}
          />
        ))}
      </StaggeredList>
    </View>
  );
}

export function scoreFromRating(rating: Rating): number {
  return ratingScoreMap[rating];
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    minWidth: 0,
  },
});
