import { listLearningItems as listLearningItemsApi } from '@project-pn/api';
import { listLearningItems } from './learningItems';

jest.mock('@project-pn/api');

const mockedListLearningItemsApi = jest.mocked(listLearningItemsApi);

describe('listLearningItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes language_code and deck_id when provided', async () => {
    mockedListLearningItemsApi.mockResolvedValue({ items: [], next_cursor: null });

    await listLearningItems({ languageCode: 'en', deckId: 'deck-1' });

    expect(mockedListLearningItemsApi).toHaveBeenCalledWith({
      languageCode: 'en',
      deckId: 'deck-1',
    });
  });

  it('omits optional params when not provided', async () => {
    mockedListLearningItemsApi.mockResolvedValue({ items: [], next_cursor: null });

    await listLearningItems();

    expect(mockedListLearningItemsApi).toHaveBeenCalledWith();
  });
});
