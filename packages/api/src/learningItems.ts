import { getJson, postJson } from './client';
import type { BatchReviewResult, DeckOrigin, DueItem, LearningItemsPage, ReviewAttemptParams } from './types';

export interface ListLearningItemsParams {
  limit?: number;
  descending?: boolean;
  q?: string;
  cursor?: string | null;
  languageCode?: string;
  deckId?: string;
  /** Filter by decks.origin. Ignored when deckId is set. */
  origin?: DeckOrigin;
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

  if (params?.origin?.trim()) {
    searchParams.set('origin', params.origin.trim());
  }

  return getJson<LearningItemsPage>(`/api/learning-items?${searchParams.toString()}`);
}

export function getDueLearningItems(
  limit?: number,
  deckId?: string,
  origin?: DeckOrigin,
): Promise<DueItem[]> {
  const searchParams = new URLSearchParams();
  if (limit) {
    searchParams.set('limit', String(limit));
  }
  if (deckId?.trim()) {
    searchParams.set('deck_id', deckId.trim());
  } else if (origin?.trim()) {
    searchParams.set('origin', origin.trim());
  }
  return getJson<DueItem[]>(`/api/reviews/due?${searchParams.toString()}`);
}

export function recordBatchReviewAttempts(attempts: ReviewAttemptParams[]): Promise<BatchReviewResult> {
  return postJson<BatchReviewResult>('/api/reviews/batch', { attempts });
}
