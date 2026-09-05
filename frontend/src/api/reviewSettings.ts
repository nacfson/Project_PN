import type { ReviewSettings } from '../types';
import { getJson, patchJson } from './client';
import { analytics } from '../analytics/analytics';

export function getReviewSettings(): Promise<ReviewSettings> {
  return getJson<ReviewSettings>('/api/reviews/settings');
}

export function patchReviewSettings(body: {
  desired_retention?: number;
  daily_goal_xp?: number;
}): Promise<ReviewSettings> {
  const traceId = analytics.track('settings_changed', { setting: 'review', changes: body, phase: 'requested' });
  return patchJson<ReviewSettings>('/api/reviews/settings', body)
    .then((result) => {
      analytics.track('settings_changed', { setting: 'review', changes: body, phase: 'succeeded' }, traceId);
      return result;
    })
    .catch((error) => {
      analytics.track('api_request_failed', { action: 'review_settings', error_code: 'UNKNOWN', retryable: false }, traceId);
      throw error;
    });
}
