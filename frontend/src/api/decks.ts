import {
  createDeck as createDeckApi,
  deleteDeck as deleteDeckApi,
  listDecks,
  moveItemsToDeck as moveItemsToDeckApi,
  renameDeck as renameDeckApi,
} from '@project-pn/api';
import type { Deck } from '@project-pn/api';
import { analytics } from '../analytics/analytics';

export { listDecks };
export type { Deck };

export async function createDeck(name: string, targetLanguage: string): Promise<Deck> {
  const traceId = analytics.track('deck_created', { name, target_language: targetLanguage, phase: 'requested' });
  try {
    const deck = await createDeckApi(name, targetLanguage, traceId);
    analytics.track('deck_created', { deck_id: deck.id, name: deck.name, target_language: deck.target_language, phase: 'succeeded' }, traceId);
    return deck;
  } catch (error) {
    analytics.track('api_request_failed', { action: 'deck_create', error_code: error instanceof Error && 'code' in error ? (error as { code?: string }).code ?? 'UNKNOWN' : 'UNKNOWN', retryable: false }, traceId);
    throw error;
  }
}

export async function renameDeck(deckId: string, name: string): Promise<void> {
  const traceId = analytics.track('deck_renamed', { deck_id: deckId, name, phase: 'requested' });
  try {
    await renameDeckApi(deckId, name, traceId);
    analytics.track('deck_renamed', { deck_id: deckId, name, phase: 'succeeded' }, traceId);
  } catch (error) {
    analytics.track('api_request_failed', { action: 'deck_rename', deck_id: deckId, error_code: 'UNKNOWN', retryable: false }, traceId);
    throw error;
  }
}

export async function deleteDeck(deckId: string): Promise<void> {
  const traceId = analytics.track('deck_deleted', { deck_id: deckId, phase: 'requested' });
  try {
    await deleteDeckApi(deckId, traceId);
    analytics.track('deck_deleted', { deck_id: deckId, phase: 'succeeded' }, traceId);
  } catch (error) {
    analytics.track('api_request_failed', { action: 'deck_delete', deck_id: deckId, error_code: 'UNKNOWN', retryable: false }, traceId);
    throw error;
  }
}

export async function moveItemsToDeck(deckId: string, userWordSenseIds: string[]): Promise<void> {
  const traceId = analytics.track('deck_moved', { deck_id: deckId, learning_item_ids: userWordSenseIds, phase: 'requested' });
  try {
    await moveItemsToDeckApi(deckId, userWordSenseIds, traceId);
    analytics.track('deck_moved', { deck_id: deckId, learning_item_ids: userWordSenseIds, phase: 'succeeded' }, traceId);
  } catch (error) {
    analytics.track('api_request_failed', { action: 'deck_move', deck_id: deckId, error_code: 'UNKNOWN', retryable: false }, traceId);
    throw error;
  }
}
