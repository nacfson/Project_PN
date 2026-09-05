import type { StreakSettings } from '../types';
import { getJson, patchJson } from './client';
import { analytics } from '../analytics/analytics';

export function getStreakSettings(): Promise<StreakSettings> {
  return getJson<StreakSettings>('/api/streaks/settings');
}

export function patchStreakSettings(body: {
  vacation_mode_until?: string | null;
  use_streak_freeze?: boolean;
}): Promise<StreakSettings> {
  const traceId = analytics.track('settings_changed', { setting: 'streak', changes: body, phase: 'requested' });
  return patchJson<StreakSettings>('/api/streaks/settings', body)
    .then((result) => {
      analytics.track('settings_changed', { setting: 'streak', changes: body, phase: 'succeeded' }, traceId);
      return result;
    })
    .catch((error) => {
      analytics.track('api_request_failed', { action: 'streak_settings', error_code: 'UNKNOWN', retryable: false }, traceId);
      throw error;
    });
}
