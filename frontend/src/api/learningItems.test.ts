import { listLearningItems } from './learningItems';
import { getJson } from './client';

jest.mock('./client');

const mockedGetJson = jest.mocked(getJson);

describe('listLearningItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes language_code and deck_id when provided', async () => {
    mockedGetJson.mockResolvedValue({ items: [], next_cursor: null });

    await listLearningItems({ languageCode: 'en', deckId: 'deck-1' });

    expect(mockedGetJson).toHaveBeenCalledWith(
      '/api/learning-items?limit=50&descending=true&language_code=en&deck_id=deck-1',
    );
  });

  it('omits optional params when not provided', async () => {
    mockedGetJson.mockResolvedValue({ items: [], next_cursor: null });

    await listLearningItems();

    expect(mockedGetJson).toHaveBeenCalledWith('/api/learning-items?limit=50&descending=true');
  });
});
