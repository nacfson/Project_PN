import type { DueItem, LearningItemsPage, ReviewAttemptParams, BatchReviewResult } from '../types';
import { getJson, postJson } from './client';

export interface ListLearningItemsParams {
  limit?: number;
  descending?: boolean;
  q?: string;
  cursor?: string | null;
  languageCode?: string;
  deckId?: string;
}

export function listLearningItems(params?: ListLearningItemsParams): Promise<LearningItemsPage> {
  const searchParams = new URLSearchParams();
  const limit = Math.min(params?.limit ?? 50, 100);
  searchParams.set('limit', String(limit));
  searchParams.set('descending', String(params?.descending ?? true));

  const q = params?.q?.trim();
  if (q) {
    searchParams.set('q', q);
  }

  if (params?.cursor) {
    searchParams.set('cursor', params.cursor);
  }

  if (params?.languageCode?.trim()) {
    searchParams.set('language_code', params.languageCode.trim());
  }

  if (params?.deckId?.trim()) {
    searchParams.set('deck_id', params.deckId.trim());
  }

  return getJson<LearningItemsPage>(`/api/learning-items?${searchParams.toString()}`);
}

export function getDueLearningItems(limit?: number): Promise<DueItem[]> {
  const searchParams = new URLSearchParams();
  if (limit) {
    searchParams.set('limit', String(limit));
  }
  return getJson<DueItem[]>(`/api/reviews/due?${searchParams.toString()}`);
}

export function recordBatchReviewAttempts(attempts: ReviewAttemptParams[]): Promise<BatchReviewResult> {
  return postJson<BatchReviewResult>('/api/reviews/batch', { attempts });
}
