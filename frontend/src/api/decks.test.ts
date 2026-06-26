import { listDecks } from './decks';
import { getJson } from './client';

jest.mock('./client');

const mockedGetJson = jest.mocked(getJson);

describe('listDecks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns decks for the given language', async () => {
    const decks = [
      { id: 'deck-1', name: 'Daily', target_language: 'en', is_default: true, item_count: 0, user_id: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ];
    mockedGetJson.mockResolvedValue({ decks });

    const result = await listDecks('en');

    expect(mockedGetJson).toHaveBeenCalledWith('/api/decks?language_code=en');
    expect(result).toEqual(decks);
  });

  it('returns all decks when no language is given', async () => {
    const decks = [
      { id: 'deck-1', name: 'Daily', target_language: 'en', is_default: true, item_count: 0, user_id: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'deck-2', name: 'Weekly', target_language: 'es', is_default: true, item_count: 0, user_id: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ];
    mockedGetJson.mockResolvedValue({ decks });

    const result = await listDecks();

    expect(mockedGetJson).toHaveBeenCalledWith('/api/decks');
    expect(result).toEqual(decks);
  });
});
