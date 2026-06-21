import type { ReviewSettings } from '../types';
import { getJson, patchJson } from './client';

export function getReviewSettings(): Promise<ReviewSettings> {
  return getJson<ReviewSettings>('/api/reviews/settings');
}

export function patchReviewSettings(body: {
  desired_retention?: number;
  daily_goal_xp?: number;
}): Promise<ReviewSettings> {
  return patchJson<ReviewSettings>('/api/reviews/settings', body);
}
