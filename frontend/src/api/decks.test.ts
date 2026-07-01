import {
  createDeck as createDeckApi,
  deleteDeck as deleteDeckApi,
  listDecks as listDecksApi,
  renameDeck as renameDeckApi,
  moveItemsToDeck as moveItemsToDeckApi,
} from '@project-pn/api';
import { createDeck, deleteDeck, listDecks, renameDeck, moveItemsToDeck } from './decks';

jest.mock('@project-pn/api');

const mockedListDecksApi = jest.mocked(listDecksApi);
const mockedCreateDeckApi = jest.mocked(createDeckApi);
const mockedRenameDeckApi = jest.mocked(renameDeckApi);
const mockedDeleteDeckApi = jest.mocked(deleteDeckApi);
const mockedMoveItemsToDeckApi = jest.mocked(moveItemsToDeckApi);

const baseDeck = {
  user_id: 'u1',
  target_language: 'en',
  item_count: 0,
  created_at: '',
  updated_at: '',
};

describe('deck API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listDecks', () => {
    it('fetches decks with optionally supplied languageCode', async () => {
      const decks = [{ id: 'deck-1', name: 'Deck 1', is_default: true, ...baseDeck }];
      mockedListDecksApi.mockResolvedValue(decks);

      const res = await listDecks('en');

      expect(res).toBe(decks);
      expect(mockedListDecksApi).toHaveBeenCalledWith('en');
    });
  });

  describe('createDeck', () => {
    it('creates a new deck', async () => {
      const newDeck = { id: 'deck-2', name: 'New Deck', is_default: false, ...baseDeck };
      mockedCreateDeckApi.mockResolvedValue(newDeck);

      const res = await createDeck('New Deck', 'en');

      expect(res).toBe(newDeck);
      expect(mockedCreateDeckApi).toHaveBeenCalledWith('New Deck', 'en');
    });
  });

  describe('renameDeck', () => {
    it('renames the deck', async () => {
      await renameDeck('deck-2', 'Renamed');

      expect(mockedRenameDeckApi).toHaveBeenCalledWith('deck-2', 'Renamed');
    });
  });

  describe('deleteDeck', () => {
    it('deletes the deck', async () => {
      await deleteDeck('deck-2');

      expect(mockedDeleteDeckApi).toHaveBeenCalledWith('deck-2');
    });
  });

  describe('moveItemsToDeck', () => {
    it('posts user_word_sense_ids to the move-items endpoint', async () => {
      mockedMoveItemsToDeckApi.mockResolvedValue(undefined);

      await moveItemsToDeck('deck-2', ['uws-1', 'uws-2']);

      expect(mockedMoveItemsToDeckApi).toHaveBeenCalledWith('deck-2', ['uws-1', 'uws-2']);
    });
  });
});
