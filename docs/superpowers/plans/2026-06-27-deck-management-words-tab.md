# Deck Management in Words Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deck creation, selection, rename, and deletion to the Words tab; filter the card list by the selected deck; and remove the Add Word button/modal from the Words tab (the add flow stays in the Add tab).

**Architecture:** Extend the `decks` API wrapper with CRUD methods, extend the learning-items query to accept an optional `deckId`, and render a new `DeckList` above the existing card list in `MyWordsScreen`. Deck forms live in a reusable `DeckFormModal`. The active target language is read from the user's language pairs via a small `useActiveTargetLanguage` hook. No backend changes are required.

**Tech Stack:** React Native / Expo / TypeScript, React Navigation, Jest + React Native Testing Library, shared UI components in `frontend/src/ui`.

## Global Constraints

- Use repository wrappers in `frontend/src/api/`; never call `fetch` directly from screens.
- Keep DTOs identical to backend (`Deck` from `frontend/src/types`).
- Add translation keys to both `en` and `ko` in `frontend/src/i18n/translations.ts`.
- Use shared `Input`, `Button`, `Card`, `Icon`, `Text`, `Screen` components.
- Follow responsive flexbox; support mobile, web, and Tauri.
- Remove Add Word UI from `MyWordsScreen`; keep it in `AddScreen`.

---

### Task 1: Active target-language hook

**Files:**
- Create: `frontend/src/hooks/useActiveTargetLanguage.ts`
- Test: `frontend/src/hooks/useActiveTargetLanguage.test.ts`

**Interfaces:**
- Consumes: `getUserLanguages()` from `frontend/src/api/userLanguages.ts` returning `UserLanguage[]`.
- Produces: `{ targetLanguage: string | null; displayLanguage: string | null; loading: boolean; error: string | null; refresh: () => void }`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/hooks/useActiveTargetLanguage.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useActiveTargetLanguage } from './useActiveTargetLanguage';
import { getUserLanguages } from '../api/userLanguages';

jest.mock('../api/userLanguages');

const mockedGetUserLanguages = jest.mocked(getUserLanguages);

describe('useActiveTargetLanguage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the active target and display language', async () => {
    mockedGetUserLanguages.mockResolvedValue([
      { target_language: 'en', display_language: 'ko', is_active: true },
      { target_language: 'es', display_language: 'en', is_active: false },
    ]);

    const { result } = renderHook(() => useActiveTargetLanguage());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('en');
    expect(result.current.displayLanguage).toBe('ko');
  });

  it('falls back to the first language pair when none is active', async () => {
    mockedGetUserLanguages.mockResolvedValue([
      { target_language: 'es', display_language: 'en', is_active: false },
    ]);

    const { result } = renderHook(() => useActiveTargetLanguage());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('es');
  });

  it('surfaces fetch errors', async () => {
    mockedGetUserLanguages.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useActiveTargetLanguage());

    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest src/hooks/useActiveTargetLanguage.test.ts --no-coverage`

Expected: FAIL — `useActiveTargetLanguage` is not defined.

- [ ] **Step 3: Implement the hook**

```tsx
// frontend/src/hooks/useActiveTargetLanguage.ts
import { useCallback, useEffect, useState } from 'react';
import { getUserLanguages } from '../api/userLanguages';
import type { UserLanguage } from '../types/auth';

interface UseActiveTargetLanguageResult {
  targetLanguage: string | null;
  displayLanguage: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useActiveTargetLanguage(): UseActiveTargetLanguageResult {
  const [language, setLanguage] = useState<UserLanguage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getUserLanguages()
      .then((languages) => {
        if (!active) return;
        const activeLang = languages.find((l) => l.is_active) ?? languages[0] ?? null;
        setLanguage(activeLang);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load language pair');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tick]);

  return {
    targetLanguage: language?.target_language ?? null,
    displayLanguage: language?.display_language ?? null,
    loading,
    error,
    refresh,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest src/hooks/useActiveTargetLanguage.test.ts --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useActiveTargetLanguage.ts frontend/src/hooks/useActiveTargetLanguage.test.ts
git commit -m "feat(words): add hook for active target language pair"
```

---

### Task 2: Extend deck API client with CRUD

**Files:**
- Modify: `frontend/src/api/decks.ts`
- Test: `frontend/src/api/decks.test.ts`

**Interfaces:**
- Consumes: `postJson`, `patchJson`, `deleteJson` from `frontend/src/api/client.ts`; `Deck` type.
- Produces:
  - `createDeck(name: string, targetLanguage: string): Promise<Deck>`
  - `renameDeck(deckId: string, name: string): Promise<void>`
  - `deleteDeck(deckId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `frontend/src/api/decks.test.ts` with:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx jest src/api/decks.test.ts --no-coverage`

Expected: FAIL — `createDeck`, `renameDeck`, `deleteJson` not defined.

- [ ] **Step 3: Implement the API wrapper**

Replace the contents of `frontend/src/api/decks.ts` with:

```tsx
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx jest src/api/decks.test.ts --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/decks.ts frontend/src/api/decks.test.ts
git commit -m "feat(words): add deck create/rename/delete API wrappers"
```

---

### Task 3: Extend learning-items query params

**Files:**
- Modify: `frontend/src/api/learningItems.ts`
- Test: Create `frontend/src/api/learningItems.test.ts`

**Interfaces:**
- Consumes: `getJson` from `frontend/src/api/client.ts`.
- Produces: `ListLearningItemsParams` gains optional `languageCode?: string` and `deckId?: string`; `listLearningItems` sends them as query params.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/api/learningItems.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest src/api/learningItems.test.ts --no-coverage`

Expected: FAIL — `languageCode` / `deckId` not accepted.

- [ ] **Step 3: Implement the params**

Replace the contents of `frontend/src/api/learningItems.ts` with:

```tsx
import type { DueItem, LearningItemsPage, ReviewAttemptParams, BatchReviewResult } from '../types';
import { getJson, postJson } from './client';

export interface ListLearningItemsParams {
  limit?: number;
  descending?: boolean;
  q?: string;
  cursor?: string | null;
  languageCode?: string;
  deckId?: string;
}

export function listLearningItems(params?: ListLearningItemsParams): Promise<LearningItemsPage> {
  const searchParams = new URLSearchParams();
  const limit = Math.min(params?.limit ?? 50, 100);
  searchParams.set('limit', String(limit));
  searchParams.set('descending', String(params?.descending ?? true));

  const q = params?.q?.trim();
  if (q) {
    searchParams.set('q', q);
  }

  if (params?.cursor) {
    searchParams.set('cursor', params.cursor);
  }

  if (params?.languageCode?.trim()) {
    searchParams.set('language_code', params.languageCode.trim());
  }

  if (params?.deckId?.trim()) {
    searchParams.set('deck_id', params.deckId.trim());
  }

  return getJson<LearningItemsPage>(`/api/learning-items?${searchParams.toString()}`);
}

export function getDueLearningItems(limit?: number): Promise<DueItem[]> {
  const searchParams = new URLSearchParams();
  if (limit) {
    searchParams.set('limit', String(limit));
  }
  return getJson<DueItem[]>(`/api/reviews/due?${searchParams.toString()}`);
}

export function recordBatchReviewAttempts(attempts: ReviewAttemptParams[]): Promise<BatchReviewResult> {
  return postJson<BatchReviewResult>('/api/reviews/batch', { attempts });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest src/api/learningItems.test.ts --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/learningItems.ts frontend/src/api/learningItems.test.ts
git commit -m "feat(words): support language_code and deck_id in learning-items list"
```

---

### Task 4: Extend useLearningItems hook with deck filter

**Files:**
- Modify: `frontend/src/features/words/useLearningItems.ts`
- Test: Create `frontend/src/features/words/useLearningItems.test.ts`

**Interfaces:**
- Consumes: `listLearningItems({ ..., deckId })` from `frontend/src/api/learningItems.ts`.
- Produces: `useLearningItems(q: string, deckId?: string)` returns the same object shape as before.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/words/useLearningItems.test.ts
import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useLearningItems } from './useLearningItems';
import { listLearningItems } from '../../api/learningItems';
import { AppLanguageProvider } from '../../i18n';

jest.mock('../../api/learningItems');
jest.useFakeTimers();

const mockedListLearningItems = jest.mocked(listLearningItems);

function Wrapper({ children }: { children: ReactNode }) {
  return <AppLanguageProvider>{children}</AppLanguageProvider>;
}

describe('useLearningItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads items without a deck filter', async () => {
    mockedListLearningItems.mockResolvedValue({ items: [], next_cursor: null });

    const { result } = renderHook(() => useLearningItems(''), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockedListLearningItems).toHaveBeenCalledWith(
      expect.objectContaining({ deckId: undefined }),
    );
  });

  it('passes deckId to listLearningItems', async () => {
    mockedListLearningItems.mockResolvedValue({ items: [], next_cursor: null });

    const { result } = renderHook(() => useLearningItems('', 'deck-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockedListLearningItems).toHaveBeenCalledWith(
      expect.objectContaining({ deckId: 'deck-1' }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest src/features/words/useLearningItems.test.ts --no-coverage`

Expected: FAIL — `useLearningItems` does not accept a second argument or does not pass `deckId`.

- [ ] **Step 3: Implement the deck filter**

Replace the contents of `frontend/src/features/words/useLearningItems.ts` with:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { listLearningItems } from '../../api/learningItems';
import { ApiError } from '../../api/client';
import { useAppLanguage } from '../../i18n';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { LearningItemListItem } from '../../types';

const PAGE_SIZE = 50;

type Status = 'loading' | 'ready' | 'error';

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

export function useLearningItems(q: string, deckId?: string) {
  const { t } = useAppLanguage();
  const debouncedQ = useDebouncedValue(q, 300);
  const [items, setItems] = useState<LearningItemListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (options: { cursor?: string | null; append: boolean; requestId: number }) => {
      const page = await listLearningItems({
        limit: PAGE_SIZE,
        descending: true,
        q: debouncedQ.trim() || undefined,
        cursor: options.cursor ?? undefined,
        deckId,
      });

      if (options.requestId !== requestIdRef.current) {
        return;
      }

      setItems((prev) => (options.append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.next_cursor);
      setStatus('ready');
      setError(null);
    },
    [debouncedQ, deckId],
  );

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);
    setNextCursor(null);

    try {
      await fetchPage({ append: false, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err, t('common.somethingWrong')));
      setStatus('error');
    }
  }, [fetchPage, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || status === 'loading') {
      return;
    }

    const requestId = requestIdRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      await fetchPage({ cursor: nextCursor, append: true, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err, t('common.somethingWrong')));
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchPage, nextCursor, status, t]);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsRefreshing(true);
    setError(null);

    try {
      await fetchPage({ append: false, requestId });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(messageOf(err, t('common.somethingWrong')));
      setStatus('error');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [fetchPage, t]);

  return {
    items,
    nextCursor,
    status,
    isLoadingMore,
    isRefreshing,
    error,
    loadMore,
    refresh,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest src/features/words/useLearningItems.test.ts --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/words/useLearningItems.ts frontend/src/features/words/useLearningItems.test.ts
git commit -m "feat(words): filter learning items by deck"
```

---

### Task 5: Deck list UI component

**Files:**
- Create: `frontend/src/features/words/DeckList.tsx`
- Test: Create `frontend/src/features/words/DeckList.test.tsx`

**Interfaces:**
- Consumes: `Deck` type, theme, i18n, `Icon`, `Text`, `Pressable`, `ScrollView`.
- Produces: `DeckList` component with props:
  ```tsx
  interface DeckListProps {
    decks: Deck[];
    selectedId: string | null;
    loading?: boolean;
    onSelect: (id: string | null) => void;
    onCreate: () => void;
    onEdit: (deck: Deck) => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/words/DeckList.test.tsx
import React, { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DeckList } from './DeckList';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

const decks = [
  {
    id: 'd1',
    name: 'Default',
    target_language: 'en',
    is_default: true,
    item_count: 3,
    user_id: 'u1',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'd2',
    name: 'Verbs',
    target_language: 'en',
    is_default: false,
    item_count: 5,
    user_id: 'u1',
    created_at: '',
    updated_at: '',
  },
];

describe('DeckList', () => {
  it('renders all-decks chip, deck chips, and create chip', () => {
    render(<DeckList decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={jest.fn()} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByText('All decks (8)')).toBeTruthy();
    expect(screen.getByText('Default (3)')).toBeTruthy();
    expect(screen.getByText('Verbs (5)')).toBeTruthy();
    expect(screen.getByText('New deck')).toBeTruthy();
  });

  it('calls onSelect when a deck chip is pressed', () => {
    const onSelect = jest.fn();
    render(<DeckList decks={decks} selectedId={null} onSelect={onSelect} onCreate={jest.fn()} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getByText('Verbs (5)'));
    expect(onSelect).toHaveBeenCalledWith('d2');
  });

  it('calls onSelect with null when all-decks chip is pressed', () => {
    const onSelect = jest.fn();
    render(<DeckList decks={decks} selectedId="d2" onSelect={onSelect} onCreate={jest.fn()} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getByText('All decks (8)'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onCreate when create chip is pressed', () => {
    const onCreate = jest.fn();
    render(<DeckList decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={onCreate} onEdit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getByText('New deck'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('calls onEdit when a deck edit icon is pressed', () => {
    const onEdit = jest.fn();
    render(<DeckList decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={jest.fn()} onEdit={onEdit} />, {
      wrapper: Wrapper,
    });

    fireEvent.press(screen.getByLabelText('Rename deck'));
    expect(onEdit).toHaveBeenCalledWith(decks[0]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest src/features/words/DeckList.test.tsx --no-coverage`

Expected: FAIL — `DeckList` not defined or missing translation keys.

- [ ] **Step 3: Implement the component**

Create `frontend/src/features/words/DeckList.tsx`:

```tsx
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon, Text } from '../../ui';
import type { Deck } from '../../types';

export interface DeckListProps {
  decks: Deck[];
  selectedId: string | null;
  loading?: boolean;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onEdit: (deck: Deck) => void;
}

type IconName = React.ComponentProps<typeof Icon>['name'];

function DeckChip({
  label,
  count,
  icon,
  selected,
  onPress,
  onEdit,
}: {
  label: string;
  count?: number;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  onEdit?: () => void;
}) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.secondaryContainer : 'transparent',
          borderColor: selected ? 'transparent' : colors.outline,
          borderRadius: radii.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Icon
        name={icon}
        size="sm"
        color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant}
      />
      <Text
        variant="label"
        color={selected ? 'onSecondaryContainer' : 'muted'}
        style={{ fontWeight: selected ? '600' : '500' }}
      >
        {count !== undefined ? `${label} (${count})` : label}
      </Text>
      {onEdit && (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('words.renameDeck')}
          style={styles.editButton}
        >
          <Icon
            name="ellipsis-vertical"
            size="sm"
            color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

export function DeckList({ decks, selectedId, onSelect, onCreate, onEdit }: DeckListProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, { gap: spacing.sm }]}
    >
      <DeckChip
        label={t('words.allDecks')}
        count={decks.reduce((sum, deck) => sum + deck.item_count, 0)}
        icon="albums"
        selected={selectedId === null}
        onPress={() => onSelect(null)}
      />
      {decks.map((deck) => (
        <DeckChip
          key={deck.id}
          label={deck.name}
          count={deck.item_count}
          icon={deck.is_default ? 'folder' : 'folder-open'}
          selected={selectedId === deck.id}
          onPress={() => onSelect(deck.id)}
          onEdit={() => onEdit(deck)}
        />
      ))}
      <Pressable
        onPress={onCreate}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: 'transparent',
            borderColor: colors.outline,
            borderRadius: radii.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('words.createDeck')}
      >
        <Icon name="add-circle" size="sm" color={colors.primary} />
        <Text variant="label" color="primary" style={{ fontWeight: '500' }}>
          {t('words.createDeck')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  editButton: {
    marginLeft: 2,
    padding: 2,
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest src/features/words/DeckList.test.tsx --no-coverage`

Expected: PASS (translation keys will be added later; if tests fail on missing keys, add the keys from Task 8 first, then rerun).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/words/DeckList.tsx frontend/src/features/words/DeckList.test.tsx
git commit -m "feat(words): add deck list selector component"
```

---

### Task 6: Deck form modal

**Files:**
- Create: `frontend/src/features/words/DeckFormModal.tsx`
- Test: Create `frontend/src/features/words/DeckFormModal.test.tsx`

**Interfaces:**
- Consumes: `Input`, `Button`, `Icon`, `Text`, `Modal`, theme, i18n.
- Produces: `DeckFormModal` component with props:
  ```tsx
  interface DeckFormModalProps {
    visible: boolean;
    mode: 'create' | 'rename';
    deck?: Deck;
    onClose: () => void;
    onSubmit: (name: string) => void;
    onDelete?: () => void;
    isLoading?: boolean;
  }
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/words/DeckFormModal.test.tsx
import React, { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeckFormModal } from './DeckFormModal';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <AppLanguageProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>
  );
}

function pressByText(text: string) {
  const elements = screen.getAllByText(text);
  fireEvent.press(elements[elements.length - 1]);
}

const deck = {
  id: 'd2',
  name: 'Verbs',
  target_language: 'en',
  is_default: false,
  item_count: 0,
  user_id: 'u1',
  created_at: '',
  updated_at: '',
};

describe('DeckFormModal', () => {
  it('submits trimmed name in create mode', () => {
    const onSubmit = jest.fn();
    render(<DeckFormModal visible mode="create" onClose={jest.fn()} onSubmit={onSubmit} />, {
      wrapper: Wrapper,
    });

    fireEvent.changeText(screen.getByPlaceholderText('Deck name'), '  Nouns  ');
    pressByText('New deck');

    expect(onSubmit).toHaveBeenCalledWith('Nouns');
  });

  it('shows validation error for empty name', () => {
    const onSubmit = jest.fn();
    render(<DeckFormModal visible mode="create" onClose={jest.fn()} onSubmit={onSubmit} />, {
      wrapper: Wrapper,
    });

    pressByText('New deck');

    expect(screen.getByText('Please enter a deck name.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prefills name in rename mode', () => {
    render(<DeckFormModal visible mode="rename" deck={deck} onClose={jest.fn()} onSubmit={jest.fn()} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByDisplayValue('Verbs')).toBeTruthy();
  });

  it('confirms then calls onDelete', async () => {
    const onDelete = jest.fn();
    render(
      <DeckFormModal
        visible
        mode="rename"
        deck={deck}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        onDelete={onDelete}
      />,
      { wrapper: Wrapper },
    );

    fireEvent.press(screen.getByText('Delete deck'));
    await waitFor(() => expect(screen.getByText('Delete')).toBeTruthy());

    fireEvent.press(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest src/features/words/DeckFormModal.test.tsx --no-coverage`

Expected: FAIL — `DeckFormModal` not defined.

- [ ] **Step 3: Implement the modal**

Create `frontend/src/features/words/DeckFormModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLanguage } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { Button, Icon, Input, Text } from '../../ui';
import type { Deck } from '../../types';

export interface DeckFormModalProps {
  visible: boolean;
  mode: 'create' | 'rename';
  deck?: Deck;
  onClose: () => void;
  onSubmit: (name: string) => void;
  onDelete?: () => void;
  isLoading?: boolean;
}

export function DeckFormModal({
  visible,
  mode,
  deck,
  onClose,
  onSubmit,
  onDelete,
  isLoading,
}: DeckFormModalProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(mode === 'rename' && deck ? deck.name : '');
      setError(null);
      setConfirmingDelete(false);
    }
  }, [visible, mode, deck]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('words.deckNameRequired'));
      return;
    }
    if (trimmed.length > 120) {
      setError(t('words.deckNameTooLong'));
      return;
    }
    if (mode === 'rename' && deck && trimmed === deck.name) {
      onClose();
      return;
    }
    onSubmit(trimmed);
  };

  const handleDeletePress = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete?.();
  };

  const canSubmit = name.trim().length > 0 && !isLoading;
  const title = mode === 'create' ? t('words.createDeck') : t('words.renameDeck');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderTopLeftRadius: radii.xxl,
              borderTopRightRadius: radii.xxl,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <View style={[styles.dragIndicator, { backgroundColor: colors.outlineVariant }]} />
          </View>

          <View style={[styles.header, { marginBottom: spacing.md }]}>
            <Text variant="title">{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          <View style={{ gap: spacing.md }}>
            <Input
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              placeholder={t('words.deckNamePlaceholder')}
              autoFocus
              helperText={error ?? undefined}
              error={!!error}
              onSubmitEditing={handleSubmit}
            />

            <Button
              label={title}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={isLoading}
            />

            {mode === 'rename' && onDelete && !deck?.is_default && (
              <View style={{ gap: spacing.sm }}>
                {confirmingDelete ? (
                  <View style={[styles.confirmRow, { gap: spacing.sm }]}>
                    <Text variant="caption" color="muted" style={{ flex: 1 }}>
                      {t('words.deckDeleteConfirmMessage')}
                    </Text>
                    <Button
                      label={t('common.cancel')}
                      variant="outline"
                      onPress={() => setConfirmingDelete(false)}
                      disabled={isLoading}
                    />
                    <Button
                      label={t('words.deckDeleteConfirm')}
                      variant="danger"
                      onPress={handleDeletePress}
                      loading={isLoading}
                    />
                  </View>
                ) : (
                  <Button
                    label={t('words.deleteDeck')}
                    variant="outline"
                    iconLeft="trash"
                    onPress={handleDeletePress}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest src/features/words/DeckFormModal.test.tsx --no-coverage`

Expected: PASS (add translation keys from Task 8 first if tests fail on missing strings).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/words/DeckFormModal.tsx frontend/src/features/words/DeckFormModal.test.tsx
git commit -m "feat(words): add deck create/rename/delete modal"
```

---

### Task 7: Integrate deck management into MyWordsScreen

**Files:**
- Modify: `frontend/src/features/words/MyWordsScreen.tsx`
- Test: Create `frontend/src/features/words/MyWordsScreen.test.tsx`

**Interfaces:**
- Consumes:
  - `useActiveTargetLanguage()` → `targetLanguage`
  - `listDecks`, `createDeck`, `renameDeck`, `deleteDeck` from `frontend/src/api/decks.ts`
  - `useLearningItems(q, deckId)` from `./useLearningItems`
  - `DeckList`, `DeckFormModal`
- Produces: `MyWordsScreen` with deck chips above the search/filter/card list and no Add Word button/modal.

- [ ] **Step 1: Write the failing integration test**

```tsx
// frontend/src/features/words/MyWordsScreen.test.tsx
import React, { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MyWordsScreen } from './MyWordsScreen';
import * as useActiveTargetLanguageHook from '../../hooks/useActiveTargetLanguage';
import * as useLearningItemsHook from './useLearningItems';
import * as decksApi from '../../api/decks';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('../../hooks/useActiveTargetLanguage');
jest.mock('./useLearningItems');
jest.mock('../../api/decks');

const mockedUseActiveTargetLanguage = jest.mocked(useActiveTargetLanguageHook.useActiveTargetLanguage);
const mockedUseLearningItems = jest.mocked(useLearningItemsHook.useLearningItems);
const mockedListDecks = jest.mocked(decksApi.listDecks);

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <AppLanguageProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>
  );
}

const defaultDeck = {
  id: 'd1',
  name: 'Default',
  target_language: 'en',
  is_default: true,
  item_count: 0,
  user_id: 'u1',
  created_at: '',
  updated_at: '',
};

describe('MyWordsScreen', () => {
  beforeEach(() => {
    mockedUseActiveTargetLanguage.mockReturnValue({
      targetLanguage: 'en',
      displayLanguage: 'ko',
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockedUseLearningItems.mockReturnValue({
      items: [],
      nextCursor: null,
      status: 'ready',
      isLoadingMore: false,
      isRefreshing: false,
      error: null,
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });
    mockedListDecks.mockResolvedValue([defaultDeck]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the deck list and hides the Add Word button', async () => {
    render(<MyWordsScreen />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('All decks (0)')).toBeTruthy());
    expect(screen.getByText('Default (0)')).toBeTruthy();
    expect(screen.queryByText('Add Word')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest src/features/words/MyWordsScreen.test.tsx --no-coverage`

Expected: FAIL — Add Word button still present / deck list missing.

- [ ] **Step 3: Implement the screen changes**

Replace the contents of `frontend/src/features/words/MyWordsScreen.tsx` with:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppLanguage } from '../../i18n';
import type { Deck, LearningItemListItem } from '../../types';
import type { WordsStackParamList } from '../../navigation/WordsStack';
import { Badge, Card, Chip, EmptyState, ErrorState, Icon, Input, LoadingState, Screen, Text } from '../../ui';
import type { TranslationKey } from '../../i18n';
import { SpeakButton } from '../../components/SpeakButton';
import { useLearningItems } from './useLearningItems';
import { useActiveTargetLanguage } from '../../hooks/useActiveTargetLanguage';
import { createDeck, deleteDeck, listDecks, renameDeck } from '../../api/decks';
import { DeckList } from './DeckList';
import { DeckFormModal } from './DeckFormModal';

const FILTERS: Array<{ key: 'all' | LearningItemListItem['learning_stage']; labelKey: string }> = [
  { key: 'all', labelKey: 'words.filterAll' },
  { key: 'new', labelKey: 'home.stage.new' },
  { key: 'learning', labelKey: 'home.stage.learning' },
  { key: 'recognized', labelKey: 'home.stage.recognized' },
  { key: 'recalled', labelKey: 'home.stage.recalled' },
  { key: 'usable', labelKey: 'home.stage.usable' },
  { key: 'mastered', labelKey: 'home.stage.mastered' },
];

export function MyWordsScreen() {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<WordsStackParamList, 'WordsRoot'>>();

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<'create' | 'rename' | null>(null);
  const [formDeck, setFormDeck] = useState<Deck | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  const { targetLanguage, loading: languageLoading, error: languageError, refresh: refreshLanguage } =
    useActiveTargetLanguage();

  const deckFilter = selectedDeckId ?? undefined;
  const { items, status, isLoadingMore, isRefreshing, error, loadMore, refresh } = useLearningItems(q, deckFilter);

  const loadDecks = useCallback(async () => {
    if (!targetLanguage) return;
    setDecksLoading(true);
    setDecksError(null);
    try {
      const loaded = await listDecks(targetLanguage);
      setDecks(loaded);
      setSelectedDeckId((prev) => (loaded.some((d) => d.id === prev) ? prev : null));
    } catch (err) {
      setDecksError(err instanceof Error ? err.message : t('words.deckLoadFailed'));
    } finally {
      setDecksLoading(false);
    }
  }, [targetLanguage, t]);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  const handleCreate = async (name: string) => {
    if (!targetLanguage) return;
    setFormLoading(true);
    setOperationError(null);
    try {
      await createDeck(name, targetLanguage);
      setFormMode(null);
      await loadDecks();
      await refresh();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : t('words.deckCreateFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleRename = async (name: string) => {
    if (!formDeck) return;
    setFormLoading(true);
    setOperationError(null);
    try {
      await renameDeck(formDeck.id, name);
      setFormMode(null);
      await loadDecks();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : t('words.deckRenameFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formDeck) return;
    setFormLoading(true);
    setOperationError(null);
    try {
      await deleteDeck(formDeck.id);
      setSelectedDeckId(null);
      setFormMode(null);
      await loadDecks();
      await refresh();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : t('words.deckDeleteFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  const openCreate = () => {
    setFormDeck(undefined);
    setFormMode('create');
    setOperationError(null);
  };

  const openEdit = (deck: Deck) => {
    setFormDeck(deck);
    setFormMode('rename');
    setOperationError(null);
  };

  const hasSearch = q.trim().length > 0;

  const filteredItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === 'all' || item.learning_stage === filter;
      const matchesTerm =
        !term ||
        item.lemma.toLowerCase().includes(term) ||
        (item.short_definition ?? item.definition).toLowerCase().includes(term);
      return matchesFilter && matchesTerm;
    });
  }, [items, filter, q]);

  const renderItem: ListRenderItem<LearningItemListItem> = useCallback(
    ({ item }) => (
      <Card
        style={{ marginBottom: spacing.md }}
        onPress={() => navigation.navigate('WordDetail', { item })}
      >
        <View style={styles.row}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="title" bold>
                {item.lemma}
              </Text>
              <SpeakButton language={item.language_code} size="sm" text={item.lemma} />
            </View>
            {item.pronunciation && (
              <Text variant="caption" color="muted">
                {item.pronunciation}
              </Text>
            )}
            <Text variant="caption" color="muted">
              {item.short_definition ?? item.definition}
            </Text>
          </View>
          <Icon name="chevron-forward" size="md" />
        </View>
        <View style={[styles.badgeRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
          <Badge label={t(`pos.${item.part_of_speech}` as TranslationKey)} variant="default" />
          <Badge label={t(`home.stage.${item.learning_stage}` as TranslationKey)} variant="primary" />
        </View>
      </Card>
    ),
    [spacing.sm, spacing.md, spacing.xs, t, navigation],
  );

  const listEmpty = () => {
    if (status === 'loading' || languageLoading || decksLoading) {
      return <LoadingState />;
    }

    if (status === 'error') {
      return <ErrorState message={error ?? t('words.loadFailed')} onRetry={() => void refresh()} />;
    }

    if (languageError) {
      return <ErrorState message={languageError} onRetry={() => void refreshLanguage()} />;
    }

    if (decksError) {
      return <ErrorState message={decksError} onRetry={() => void loadDecks()} />;
    }

    if (hasSearch || filter !== 'all') {
      return (
        <EmptyState
          icon="search"
          title={t('words.noMatches', { query: q.trim() || t('words.filterAll') })}
          message={t('words.noMatchesMessage')}
        />
      );
    }

    return (
      <EmptyState
        icon="book-outline"
        title={t('words.emptyTitle')}
        message={t('words.emptyMessage')}
      />
    );
  };

  const listFooter = () => {
    if (!isLoadingMore) {
      return null;
    }
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  return (
    <Screen padded>
      <View style={[styles.header, { paddingTop: spacing.lg, gap: spacing.md }]}>
        <Text variant="heading">{t('words.title')}</Text>

        {operationError ? (
          <Card style={{ borderColor: colors.error, borderWidth: 1, gap: spacing.sm }}>
            <Text style={{ color: colors.error }}>{operationError}</Text>
          </Card>
        ) : null}

        {languageLoading || decksLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <DeckList
            decks={decks}
            selectedId={selectedDeckId}
            onSelect={setSelectedDeckId}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        )}

        <Input
          value={q}
          onChangeText={setQ}
          placeholder={t('words.searchPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          onClear={() => setQ('')}
          loading={status === 'loading'}
        />
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterRow, { gap: spacing.sm }]}
        >
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={t(f.labelKey as never)}
              selected={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: spacing.lg },
          filteredItems.length === 0 && styles.listEmpty,
        ]}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        style={styles.flex}
      />

      <DeckFormModal
        visible={formMode !== null}
        mode={formMode ?? 'create'}
        deck={formDeck}
        onClose={() => setFormMode(null)}
        onSubmit={formMode === 'create' ? handleCreate : handleRename}
        onDelete={formMode === 'rename' && formDeck && !formDeck.is_default ? handleDelete : undefined}
        isLoading={formLoading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {},
  filterRow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  list: {
    paddingTop: 8,
  },
  listEmpty: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest src/features/words/MyWordsScreen.test.tsx --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/words/MyWordsScreen.tsx frontend/src/features/words/MyWordsScreen.test.tsx
git commit -m "feat(words): integrate deck management into MyWordsScreen and remove add-word UI"
```

---

### Task 8: Add translation keys

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

**Interfaces:**
- Consumes/produces: shared `TranslationKey` dictionary; add keys to both `en` and `ko` objects.

- [ ] **Step 1: Add English keys**

In `frontend/src/i18n/translations.ts`, insert after `'common.retry': 'Try again',`:

```ts
  'common.cancel': 'Cancel',
```

Then insert after `'words.detailDue': 'Due',`:

```ts
  'words.allDecks': 'All decks',
  'words.createDeck': 'New deck',
  'words.renameDeck': 'Rename deck',
  'words.deleteDeck': 'Delete deck',
  'words.deckNamePlaceholder': 'Deck name',
  'words.deckNameRequired': 'Please enter a deck name.',
  'words.deckNameTooLong': 'Deck name must be 120 characters or less.',
  'words.deckCreateFailed': 'Could not create deck.',
  'words.deckRenameFailed': 'Could not rename deck.',
  'words.deckDeleteFailed': 'Could not delete deck.',
  'words.deckDeleteConfirmTitle': 'Delete "{deck}"?',
  'words.deckDeleteConfirmMessage': 'All cards will move to the default deck.',
  'words.deckDeleteConfirm': 'Delete',
  'words.deckLoadFailed': 'Could not load decks.',
```

- [ ] **Step 2: Add Korean keys**

In the `ko` object, insert after `'common.retry': '다시 시도',`:

```ts
  'common.cancel': '취소',
```

Then insert after `'words.detailDue': '복습 예정일',`:

```ts
  'words.allDecks': '전체 덱',
  'words.createDeck': '새 덱',
  'words.renameDeck': '덱 이름 변경',
  'words.deleteDeck': '덱 삭제',
  'words.deckNamePlaceholder': '덱 이름',
  'words.deckNameRequired': '덱 이름을 입력해 주세요.',
  'words.deckNameTooLong': '덱 이름은 120자 이하여야 합니다.',
  'words.deckCreateFailed': '덱을 만들지 못했습니다.',
  'words.deckRenameFailed': '덱 이름을 변경하지 못했습니다.',
  'words.deckDeleteFailed': '덱을 삭제하지 못했습니다.',
  'words.deckDeleteConfirmTitle': '"{deck}"을(를) 삭제할까요?',
  'words.deckDeleteConfirmMessage': '모든 카드는 기본 덱으로 이동합니다.',
  'words.deckDeleteConfirm': '삭제',
  'words.deckLoadFailed': '덱을 불러오지 못했습니다.',
```

- [ ] **Step 3: Run type-check**

Run: `cd frontend && npx tsc --noEmit`

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/translations.ts
git commit -m "feat(words): add deck management translation keys"
```

---

### Task 9: Verify the full change

**Files:**
- All files changed above.

- [ ] **Step 1: Run the frontend test suite**

Run: `cd frontend && npx tsc --noEmit && npm test -- --watchAll=false`

Expected: TypeScript passes; all tests pass.

- [ ] **Step 2: Manual smoke test**

Run the web dev server:

```bash
cd frontend && npm run web
```

Then:
1. Sign in.
2. Go to the **Words** tab.
3. Confirm the deck chips appear (`All decks`, `Default`, `New deck`) and there is no **Add Word** button.
4. Tap **New deck**, type a name, and save.
5. Tap the new deck to filter the card list.
6. Tap the edit icon on the new deck, rename it, then delete it.
7. Confirm the list refreshes and cards move back to the default deck.

- [ ] **Step 3: Final commit**

```bash
git commit -m "feat(words): deck management in Words tab"
```

---

## Self-Review

**Spec coverage:**
- Deck list in Words tab → Task 5 + Task 7.
- Deck creation → Task 2 + Task 6 + Task 7.
- Deck rename → Task 2 + Task 6 + Task 7.
- Deck deletion → Task 2 + Task 6 + Task 7.
- Filter cards by deck → Task 3 + Task 4 + Task 7.
- Remove Add Word from Words tab → Task 7.
- Keep Add tab unchanged → no changes to `AddScreen`.
- Translations for `en` and `ko` → Task 8.

**Placeholder scan:**
- No TBD/TODO placeholders.
- No vague "add error handling" steps; concrete validation and error states are shown.
- No "similar to Task N" shortcuts.

**Type consistency:**
- `Deck` type from `frontend/src/types` is used everywhere.
- `useLearningItems(q: string, deckId?: string)` matches Task 3's `listLearningItems({ deckId })`.
- `DeckListProps.onSelect: (id: string | null) => void` matches `MyWordsScreen`'s `setSelectedDeckId`.
- `DeckFormModalProps.onSubmit: (name: string) => void` matches `handleCreate`/`handleRename`.

**Gaps:** none.
