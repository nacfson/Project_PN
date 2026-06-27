import type { Deck } from '../types';
import { deleteJson, getJson, patchJson, postJson } from './client';

export function listDecks(languageCode?: string): Promise<Deck[]> {
  const searchParams = new URLSearchParams();
  if (languageCode) {
    searchParams.set('language_code', languageCode);
  }
  const query = searchParams.toString();
  return getJson<{ decks: Deck[] }>(`/api/decks${query ? `?${query}` : ''}`).then((res) => res.decks);
}

export function createDeck(name: string, targetLanguage: string): Promise<Deck> {
  return postJson<Deck>('/api/decks', { name, target_language: targetLanguage });
}

export function renameDeck(deckId: string, name: string): Promise<void> {
  return patchJson<void>(`/api/decks/${deckId}`, { name });
}

export function deleteDeck(deckId: string): Promise<void> {
  return deleteJson<void>(`/api/decks/${deckId}`);
}
