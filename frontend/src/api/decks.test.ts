import { createDeck, deleteDeck, listDecks, renameDeck } from './decks';
import { deleteJson, getJson, patchJson, postJson } from './client';

jest.mock('./client');

const mockedGetJson = jest.mocked(getJson);
const mockedPostJson = jest.mocked(postJson);
const mockedPatchJson = jest.mocked(patchJson);
const mockedDeleteJson = jest.mocked(deleteJson);

const baseDeck = {
  user_id: 'u1',
  target_language: 'en',
  item_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('deck API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listDecks', () => {
    it('returns decks for the given language', async () => {
      const decks = [{ id: 'deck-1', name: 'Daily', is_default: true, ...baseDeck }];
      mockedGetJson.mockResolvedValue({ decks });

      const result = await listDecks('en');

      expect(mockedGetJson).toHaveBeenCalledWith('/api/decks?language_code=en');
      expect(result).toEqual(decks);
    });

    it('returns all decks when no language is given', async () => {
      const decks = [
        { id: 'deck-1', name: 'Daily', is_default: true, ...baseDeck },
        { id: 'deck-2', name: 'Weekly', target_language: 'es', is_default: true, ...baseDeck },
      ];
      mockedGetJson.mockResolvedValue({ decks });

      const result = await listDecks();

      expect(mockedGetJson).toHaveBeenCalledWith('/api/decks');
      expect(result).toEqual(decks);
    });
  });

  describe('createDeck', () => {
    it('posts name and target language', async () => {
      const deck = { id: 'deck-2', name: 'Verbs', is_default: false, ...baseDeck };
      mockedPostJson.mockResolvedValue(deck);

      const result = await createDeck('Verbs', 'en');

      expect(mockedPostJson).toHaveBeenCalledWith('/api/decks', {
        name: 'Verbs',
        target_language: 'en',
      });
      expect(result).toEqual(deck);
    });
  });

  describe('renameDeck', () => {
    it('patches the new name', async () => {
      mockedPatchJson.mockResolvedValue(undefined);

      await renameDeck('deck-2', 'Nouns');

      expect(mockedPatchJson).toHaveBeenCalledWith('/api/decks/deck-2', { name: 'Nouns' });
    });
  });

  describe('deleteDeck', () => {
    it('sends a DELETE request', async () => {
      mockedDeleteJson.mockResolvedValue(undefined);

      await deleteDeck('deck-2');

      expect(mockedDeleteJson).toHaveBeenCalledWith('/api/decks/deck-2');
    });
  });
});
