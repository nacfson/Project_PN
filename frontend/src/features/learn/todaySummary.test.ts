import {
  estimateMinutes,
  totalWords,
  nextReviewAfterToday,
  remainingCount,
  goalPercent,
  mixNote,
} from './todaySummary';

describe('todaySummary helpers', () => {
  it('computes estimateMinutes from due count and hides at 0', () => {
    expect(estimateMinutes(16)).toBe(8);
    expect(estimateMinutes(1)).toBe(1);
    expect(estimateMinutes(0)).toBe(0);
    expect(estimateMinutes(-3)).toBe(0);
  });

  it('sums stage_counts in totalWords', () => {
    expect(
      totalWords({
        new: 16,
        learning: 2,
        recognized: 3,
        recalled: 1,
        usable: 0,
        mastered: 4,
      }),
    ).toBe(26);
    expect(totalWords({})).toBe(0);
  });

  it('finds nextReviewAfterToday after today with count > 0, or null', () => {
    const forecast = [
      { date: '2026-11-05', count: 16 },
      { date: '2026-11-06', count: 0 },
      { date: '2026-11-07', count: 4 },
      { date: '2026-11-08', count: 2 },
    ];
    expect(nextReviewAfterToday(forecast, '2026-11-05')).toEqual({
      date: '2026-11-07',
      count: 4,
    });
    expect(
      nextReviewAfterToday(
        [
          { date: '2026-11-05', count: 16 },
          { date: '2026-11-06', count: 0 },
        ],
        '2026-11-05',
      ),
    ).toBeNull();
  });

  it('computes remainingCount as max(0, due - upNext.length)', () => {
    expect(remainingCount(16, 5)).toBe(11);
    expect(remainingCount(3, 5)).toBe(0);
    expect(remainingCount(0, 0)).toBe(0);
  });

  it('computes goalPercent capped at 100 and returns 0 when goal is 0', () => {
    expect(goalPercent(0, 200)).toBe(0);
    expect(goalPercent(100, 200)).toBe(50);
    expect(goalPercent(250, 200)).toBe(100);
    expect(goalPercent(100, 0)).toBe(0);
  });

  it('selects mixNote for all-new, mostly-reviews, and mixed items', () => {
    expect(
      mixNote(
        [{ learning_stage: 'new' }, { learning_stage: 'new' }],
        16,
      ),
    ).toBe('today.mixAllNew');

    expect(
      mixNote(
        [
          { learning_stage: 'learning' },
          { learning_stage: 'recognized' },
          { learning_stage: 'recalled' },
          { learning_stage: 'usable' },
        ],
        4,
      ),
    ).toBe('today.mixMostlyReviews');

    expect(
      mixNote(
        [
          { learning_stage: 'new' },
          { learning_stage: 'learning' },
        ],
        2,
      ),
    ).toBe('today.mixMixed');
  });
});
