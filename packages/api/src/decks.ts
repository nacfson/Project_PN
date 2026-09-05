import { deleteJson, getJson, patchJson, postJson, postNoContent } from './client';
import type { Deck } from './types';

export function listDecks(languageCode?: string, origin?: 'private'): Promise<Deck[]> {
  const searchParams = new URLSearchParams();
  if (languageCode) {
    searchParams.set('language_code', languageCode);
  }
  if (origin) {
    searchParams.set('origin', origin);
  }
  const query = searchParams.toString();
  return getJson<{ decks: Deck[] }>(`/api/decks${query ? `?${query}` : ''}`).then((res) => res.decks);
}

export function createDeck(name: string, targetLanguage: string, traceId?: string): Promise<Deck> {
  return postJson<Deck>('/api/decks', { name, target_language: targetLanguage }, { traceId });
}

export function renameDeck(deckId: string, name: string, traceId?: string): Promise<void> {
  return patchJson<void>(`/api/decks/${deckId}`, { name }, { traceId });
}

export function deleteDeck(deckId: string, traceId?: string): Promise<void> {
  return deleteJson<void>(`/api/decks/${deckId}`, { traceId });
}

export function moveItemsToDeck(deckId: string, userWordSenseIds: string[], traceId?: string): Promise<void> {
  return postNoContent(`/api/decks/${deckId}/move-items`, {
    user_word_sense_ids: userWordSenseIds,
  }, { traceId });
}
