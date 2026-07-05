import type { Deck, SenseOption } from '@project-pn/api';

export interface AddToastPayload {
  text: string;
  senseOptions: SenseOption[];
  decks: Deck[];
  defaultSenseId?: string;
  defaultDeckId?: string;
  displayLanguage: string;
}
