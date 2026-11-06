import type { StatsSummary } from '../../types';

export const XP_PER_REVIEW = 10;

export function estimateMinutes(due: number): number {
  if (!Number.isFinite(due) || due <= 0) return 0;
  return Math.max(1, Math.ceil((due * 30) / 60));
}

export function totalWords(stageCounts: Partial<StatsSummary['stage_counts']> | null | undefined): number {
  if (!stageCounts) return 0;
  return Object.values(stageCounts).reduce<number>((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
}

export function nextReviewAfterToday(
  forecast: StatsSummary['forecast'] | null | undefined,
  todayIsoDate?: string,
): { date: string; count: number } | null {
  if (!forecast || forecast.length === 0) return null;
  const todayStr = todayIsoDate ?? new Date().toISOString().slice(0, 10);
  for (const entry of forecast) {
    if (entry.date > todayStr && entry.count > 0) {
      return entry;
    }
  }
  return null;
}

export function remainingCount(due: number, upNextLength: number): number {
  return Math.max(0, due - upNextLength);
}

export function goalPercent(xpToday: number, dailyGoalXp: number): number {
  if (!Number.isFinite(dailyGoalXp) || dailyGoalXp <= 0) return 0;
  if (!Number.isFinite(xpToday) || xpToday <= 0) return 0;
  return Math.min(100, Math.round((xpToday / dailyGoalXp) * 100));
}

export type MixNoteKey = 'today.mixAllNew' | 'today.mixMostlyReviews' | 'today.mixMixed';

export function mixNote(
  upNext: ReadonlyArray<{ learning_stage?: string }>,
  due: number,
): MixNoteKey {
  if (due <= 0 || upNext.length === 0) {
    return 'today.mixMixed';
  }
  const newCount = upNext.filter((item) => !item.learning_stage || item.learning_stage === 'new').length;
  if (newCount === upNext.length) {
    return 'today.mixAllNew';
  }
  if (newCount / upNext.length <= 0.25) {
    return 'today.mixMostlyReviews';
  }
  return 'today.mixMixed';
}
