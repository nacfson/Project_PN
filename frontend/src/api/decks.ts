import type { Deck } from '../types';
import { getJson } from './client';

export function listDecks(languageCode?: string): Promise<Deck[]> {
  const searchParams = new URLSearchParams();
  if (languageCode) {
    searchParams.set('language_code', languageCode);
  }
  const query = searchParams.toString();
  return getJson<{ decks: Deck[] }>(`/api/decks${query ? `?${query}` : ''}`).then((res) => res.decks);
}
