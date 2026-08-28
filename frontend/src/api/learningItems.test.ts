import { listLearningItems as listLearningItemsApi, archiveLearningItems as archiveLearningItemsApi } from '@project-pn/api';
import { listLearningItems, archiveLearningItems } from './learningItems';

jest.mock('@project-pn/api');

const mockedListLearningItemsApi = jest.mocked(listLearningItemsApi);
const mockedArchiveLearningItemsApi = jest.mocked(archiveLearningItemsApi);

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

describe('archiveLearningItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('posts item_ids to archive endpoint', async () => {
    mockedArchiveLearningItemsApi.mockResolvedValue({ archived: 2 });

    const result = await archiveLearningItems(['a', 'b']);

    expect(mockedArchiveLearningItemsApi).toHaveBeenCalledWith(['a', 'b']);
    expect(result).toEqual({ archived: 2 });
  });
});
