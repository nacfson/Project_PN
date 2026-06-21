import type { StreakSettings } from '../types';
import { getJson, patchJson } from './client';

export function getStreakSettings(): Promise<StreakSettings> {
  return getJson<StreakSettings>('/api/streaks/settings');
}

export function patchStreakSettings(body: {
  vacation_mode_until?: string | null;
  use_streak_freeze?: boolean;
}): Promise<StreakSettings> {
  return patchJson<StreakSettings>('/api/streaks/settings', body);
}
