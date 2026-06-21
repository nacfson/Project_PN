import type { ReviewSettings } from '../types';
import { getJson, postJson } from './client';

export interface UpdateReviewSettingsParams {
  desired_retention: number;
}

export function getReviewSettings(): Promise<ReviewSettings> {
  return getJson<ReviewSettings>('/api/reviews/settings');
}

export function updateReviewSettings(params: UpdateReviewSettingsParams): Promise<ReviewSettings> {
  return postJson<ReviewSettings>('/api/reviews/settings', params);
}
