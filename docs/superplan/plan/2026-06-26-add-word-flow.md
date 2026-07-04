# Add-Word Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual sense-selection add flow with an AI-driven, one-tap-per-word bottom-sheet modal that adds the best sense to a pre-selected deck.

**Architecture:** A reusable `AddWordModal` component owns the bottom-sheet UI, a `useAddWord` hook orchestrates lookup → auto-pick → add, and `MyWordsScreen` hosts the modal plus a success toast. The existing backend endpoints (`POST /api/words/lookup`, `POST /api/learning-items`, `GET /api/decks`) are used without change.

**Tech Stack:** React Native / Expo, TypeScript, React Navigation, React Native testing-library.

## Global Constraints

- Target platforms: iOS, Android, Web, Tauri desktop.
- Reuse the shared `Input` component (`frontend/src/ui/Input.tsx`).
- Add translation keys to both `en` and `ko` in `frontend/src/i18n/translations.ts`.
- No inline network calls in UI code; keep data fetching in repository wrappers under `frontend/src/api/`.
- The add-word flow does not show error UI; failures close the modal silently.
- No user editing of AI-generated senses/examples/definitions.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/types/index.ts` | Add `Deck` type. |
| `frontend/src/api/decks.ts` | Fetch user decks from `GET /api/decks`. |
| `frontend/src/api/words.ts` | Extend `addLearningItem` to accept an optional `deckId`. |
| `frontend/src/hooks/useAddWord.ts` | Orchestrate lookup, auto-pick first sense, add to deck. |
| `frontend/src/components/DeckSelector.tsx` | Reusable deck selector row. |
| `frontend/src/components/AddWordModal.tsx` | Bottom-sheet modal UI. |
| `frontend/src/components/AddWordModal.test.tsx` | Component tests for the modal. |
| `frontend/src/features/words/MyWordsScreen.tsx` | Add entry button, host modal, show success toast, refresh list. |
| `frontend/src/i18n/translations.ts` | New translation keys. |

---

### Task 1: Add Deck type and deck API client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/decks.ts`
- Test: `frontend/src/api/decks.test.ts`

**Interfaces:**
- Consumes: `getJson` from `frontend/src/api/client.ts`
- Produces: `Deck` type, `listDecks(languageCode?: string): Promise<Deck[]>`

- [ ] **Step 1: Add Deck type**

Append to `frontend/src/types/index.ts` after the existing `LearningItemsPage` interface:

```typescript
export interface Deck {
  id: string;
  user_id: string;
  target_language: string;
  name: string;
  is_default: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Create deck API client**

Create `frontend/src/api/decks.ts`:

```typescript
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
```

- [ ] **Step 3: Write the failing test**

Create `frontend/src/api/decks.test.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/api/decks.test.ts
```

Expected: FAIL because jest is not configured.

- [ ] **Step 5: Add jest-expo and testing-library**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npm install --save-dev jest-expo @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 6: Configure jest**

Create `frontend/jest.config.js`:

```javascript
const config = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((react-native.*)?|@react-native.*|@react-navigation.*|expo.*|@expo.*))',
  ],
};

module.exports = config;
```

Add to `frontend/package.json` scripts:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Run test to verify it passes**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/api/decks.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/types/index.ts frontend/src/api/decks.ts frontend/src/api/decks.test.ts frontend/jest.config.js frontend/package.json frontend/package-lock.json
git commit -m "feat(api): add deck client and type"
```

---

### Task 2: Extend addLearningItem to accept deckId

**Files:**
- Modify: `frontend/src/api/words.ts`
- Test: `frontend/src/api/words.test.ts`

**Interfaces:**
- Consumes: `postJson` from `frontend/src/api/client.ts`
- Produces: `addLearningItem(wordSenseId, displayLanguageCode?, deckId?): Promise<LearningItem>`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/api/words.test.ts`:

```typescript
import { addLearningItem, lookupWord } from './words';
import { postJson } from './client';

jest.mock('./client');

const mockedPostJson = jest.mocked(postJson);

describe('addLearningItem', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes deck_id when provided', async () => {
    const item = { id: 'item-1', word_sense_id: 'sense-1', learning_stage: 'new', due_at: '2026-01-01T00:00:00Z' };
    mockedPostJson.mockResolvedValue(item);

    const result = await addLearningItem('sense-1', 'ko', 'deck-1');

    expect(mockedPostJson).toHaveBeenCalledWith('/api/learning-items', {
      word_sense_id: 'sense-1',
      display_language_code: 'ko',
      deck_id: 'deck-1',
    });
    expect(result).toEqual(item);
  });

  it('omits deck_id when not provided', async () => {
    const item = { id: 'item-1', word_sense_id: 'sense-1', learning_stage: 'new', due_at: '2026-01-01T00:00:00Z' };
    mockedPostJson.mockResolvedValue(item);

    await addLearningItem('sense-1', 'ko');

    expect(mockedPostJson).toHaveBeenCalledWith('/api/learning-items', {
      word_sense_id: 'sense-1',
      display_language_code: 'ko',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/api/words.test.ts
```

Expected: FAIL because `addLearningItem` does not accept `deckId`.

- [ ] **Step 3: Update addLearningItem signature**

Modify `frontend/src/api/words.ts`:

```typescript
export async function addLearningItem(
  wordSenseId: string,
  displayLanguageCode: string = DEFAULT_DEFINITION_LANGUAGE_CODE,
  deckId?: string,
): Promise<LearningItem> {
  const body: Record<string, unknown> = {
    word_sense_id: wordSenseId,
    display_language_code: displayLanguageCode,
  };
  if (deckId) {
    body.deck_id = deckId;
  }
  return postJson<LearningItem>('/api/learning-items', body);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/api/words.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/api/words.ts frontend/src/api/words.test.ts
git commit -m "feat(api): support optional deck_id in addLearningItem"
```

---

### Task 3: Create useAddWord hook

**Files:**
- Create: `frontend/src/hooks/useAddWord.ts`
- Test: `frontend/src/hooks/useAddWord.test.ts`

**Interfaces:**
- Consumes: `lookupWord` and `addLearningItem` from `frontend/src/api/words.ts`
- Produces: `useAddWord(options) -> { addWord, isAdding, lastAdded }`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useAddWord.test.ts`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAddWord } from './useAddWord';
import { lookupWord, addLearningItem } from '../api/words';

jest.mock('../api/words');

const mockedLookupWord = jest.mocked(lookupWord);
const mockedAddLearningItem = jest.mocked(addLearningItem);

describe('useAddWord', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('looks up the word, picks the first sense, and adds it', async () => {
    const sense = {
      word_id: 'w1',
      word_sense_id: 's1',
      language_code: 'en',
      lemma: 'apple',
      normalized_text: 'apple',
      part_of_speech: 'noun',
      pronunciation: null,
      display_language_code: 'ko',
      definition: '사과',
      short_definition: null,
      cefr_level: 'A1',
      meaning_order: 1,
      examples: [],
    };
    mockedLookupWord.mockResolvedValue({ query: 'apple', normalized_text: 'apple', sense_options: [sense] });
    mockedAddLearningItem.mockResolvedValue({ id: 'item-1', word_sense_id: 's1', learning_stage: 'new', due_at: '2026-01-01T00:00:00Z' });

    const { result } = renderHook(() => useAddWord({ displayLanguageCode: 'ko' }));

    await act(async () => {
      await result.current.addWord('apple', 'deck-1');
    });

    expect(mockedLookupWord).toHaveBeenCalledWith('apple', { displayLanguageCode: 'ko' });
    expect(mockedAddLearningItem).toHaveBeenCalledWith('s1', 'ko', 'deck-1');
    expect(result.current.lastAdded).toEqual({ word: 'apple', deckId: 'deck-1' });
  });

  it('does nothing when sense_options is empty', async () => {
    mockedLookupWord.mockResolvedValue({ query: 'xyz', normalized_text: 'xyz', sense_options: [] });

    const { result } = renderHook(() => useAddWord({ displayLanguageCode: 'ko' }));

    await act(async () => {
      await result.current.addWord('xyz', 'deck-1');
    });

    expect(mockedAddLearningItem).not.toHaveBeenCalled();
    expect(result.current.lastAdded).toBeNull();
  });

  it('closes silently on error', async () => {
    mockedLookupWord.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useAddWord({ displayLanguageCode: 'ko' }));

    await act(async () => {
      await result.current.addWord('apple', 'deck-1');
    });

    expect(mockedAddLearningItem).not.toHaveBeenCalled();
    expect(result.current.lastAdded).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/hooks/useAddWord.test.ts
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useAddWord.ts`:

```typescript
import { useCallback, useState } from 'react';
import { lookupWord, addLearningItem } from '../api/words';

interface UseAddWordOptions {
  languageCode?: string;
  displayLanguageCode?: string;
}

interface AddedResult {
  word: string;
  deckId: string;
}

export function useAddWord(options: UseAddWordOptions = {}) {
  const [isAdding, setIsAdding] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddedResult | null>(null);

  const addWord = useCallback(
    async (word: string, deckId: string) => {
      const trimmed = word.trim();
      if (trimmed.length === 0 || !deckId) {
        return;
      }

      setIsAdding(true);
      setLastAdded(null);

      try {
        const response = await lookupWord(trimmed, {
          languageCode: options.languageCode,
          displayLanguageCode: options.displayLanguageCode,
        });
        const firstSense = response.sense_options[0];
        if (!firstSense) {
          return;
        }

        await addLearningItem(firstSense.word_sense_id, options.displayLanguageCode, deckId);
        setLastAdded({ word: trimmed, deckId });
      } catch {
        // Silent failure per design.
      } finally {
        setIsAdding(false);
      }
    },
    [options.languageCode, options.displayLanguageCode],
  );

  return { addWord, isAdding, lastAdded };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/hooks/useAddWord.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/hooks/useAddWord.ts frontend/src/hooks/useAddWord.test.ts
git commit -m "feat(hooks): add useAddWord for auto-pick add flow"
```

---

### Task 4: Create DeckSelector component

**Files:**
- Create: `frontend/src/components/DeckSelector.tsx`
- Test: `frontend/src/components/DeckSelector.test.tsx`

**Interfaces:**
- Consumes: `Deck` type from `frontend/src/types/index.ts`
- Produces: `DeckSelector` component with `decks`, `selectedId`, `onSelect`, `loading`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/DeckSelector.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DeckSelector } from './DeckSelector';

const decks = [
  { id: 'd1', name: 'Daily', target_language: 'en', is_default: true, item_count: 0, user_id: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'd2', name: 'Weekly', target_language: 'en', is_default: false, item_count: 0, user_id: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

describe('DeckSelector', () => {
  it('renders the selected deck name', () => {
    render(<DeckSelector decks={decks} selectedId="d2" onSelect={jest.fn()} loading={false} />);
    expect(screen.getByText('Weekly')).toBeTruthy();
  });

  it('calls onSelect when pressed', () => {
    const onSelect = jest.fn();
    render(<DeckSelector decks={decks} selectedId="d1" onSelect={onSelect} loading={false} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<DeckSelector decks={[]} selectedId={null} onSelect={jest.fn()} loading={true} />);
    expect(screen.queryByText('Daily')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/components/DeckSelector.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/DeckSelector.tsx`:

```typescript
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, Text } from '../ui';
import type { Deck } from '../types';

interface DeckSelectorProps {
  decks: Deck[];
  selectedId: string | null;
  onSelect: () => void;
  loading: boolean;
}

export function DeckSelector({ decks, selectedId, onSelect, loading }: DeckSelectorProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();

  const selected = decks.find((d) => d.id === selectedId);

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={t('add.selectDeck')}
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerHighest,
          borderRadius: radii.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.left}>
        <Text variant="caption" color="muted">
          {t('add.targetDeck')}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.xs }} />
        ) : (
          <Text variant="body" bold style={{ marginTop: spacing.xs }}>
            {selected?.name ?? t('add.noDeck')}
          </Text>
        )}
      </View>
      <Icon name="chevron-forward" size="md" color={colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/components/DeckSelector.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/components/DeckSelector.tsx frontend/src/components/DeckSelector.test.tsx
git commit -m "feat(ui): add DeckSelector component"
```

---

### Task 5: Create AddWordModal component

**Files:**
- Create: `frontend/src/components/AddWordModal.tsx`
- Test: `frontend/src/components/AddWordModal.test.tsx`

**Interfaces:**
- Consumes: `DeckSelector`, `useAddWord`, `Input`, `Button`, `listDecks`
- Produces: `AddWordModal` component with `visible`, `onClose`, `onAdded`, `defaultDeckId?`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/AddWordModal.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AddWordModal } from './AddWordModal';
import { listDecks } from '../api/decks';
import { lookupWord, addLearningItem } from '../api/words';

jest.mock('../api/decks');
jest.mock('../api/words');

const mockedListDecks = jest.mocked(listDecks);
const mockedLookupWord = jest.mocked(lookupWord);
const mockedAddLearningItem = jest.mocked(addLearningItem);

describe('AddWordModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('adds the first sense and calls onAdded on success', async () => {
    mockedListDecks.mockResolvedValue([
      { id: 'd1', name: 'Daily', target_language: 'en', is_default: true, item_count: 0, user_id: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedLookupWord.mockResolvedValue({
      query: 'apple',
      normalized_text: 'apple',
      sense_options: [
        {
          word_id: 'w1',
          word_sense_id: 's1',
          language_code: 'en',
          lemma: 'apple',
          normalized_text: 'apple',
          part_of_speech: 'noun',
          pronunciation: null,
          display_language_code: 'ko',
          definition: '사과',
          short_definition: null,
          cefr_level: 'A1',
          meaning_order: 1,
          examples: [],
        },
      ],
    });
    mockedAddLearningItem.mockResolvedValue({ id: 'item-1', word_sense_id: 's1', learning_stage: 'new', due_at: '2026-01-01T00:00:00Z' });

    const onAdded = jest.fn();
    const onClose = jest.fn();

    render(<AddWordModal visible={true} onClose={onClose} onAdded={onAdded} />);

    fireEvent.changeText(screen.getByPlaceholderText('Type a word to add'), 'apple');
    fireEvent.press(screen.getByText('Add Word'));

    await waitFor(() => {
      expect(mockedAddLearningItem).toHaveBeenCalledWith('s1', expect.any(String), 'd1');
    });
    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledWith({ word: 'apple', deckId: 'd1', deckName: 'Daily' });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/components/AddWordModal.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/AddWordModal.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listDecks } from '../api/decks';
import { DEFAULT_DEFINITION_LANGUAGE_CODE, DEFAULT_LANGUAGE_CODE } from '../config';
import { useAddWord } from '../hooks/useAddWord';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Icon, Input, Text } from '../ui';
import { DeckSelector } from './DeckSelector';

interface AddWordModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: (result: { word: string; deckId: string; deckName: string }) => void;
  languageCode?: string;
  displayLanguageCode?: string;
}

export function AddWordModal({
  visible,
  onClose,
  onAdded,
  languageCode = DEFAULT_LANGUAGE_CODE,
  displayLanguageCode = DEFAULT_DEFINITION_LANGUAGE_CODE,
}: AddWordModalProps) {
  const { colors, radii, spacing } = useTheme();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const [word, setWord] = useState('');
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof listDecks>>>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const { addWord, isAdding, lastAdded } = useAddWord({ languageCode, displayLanguageCode });

  const defaultDeckId = useMemo(() => decks.find((d) => d.is_default)?.id ?? null, [decks]);

  useEffect(() => {
    if (!visible) {
      setWord('');
      return;
    }

    setDecksLoading(true);
    listDecks(languageCode)
      .then((loaded) => {
        setDecks(loaded);
        const defaultDeck = loaded.find((d) => d.is_default);
        setSelectedDeckId(defaultDeck?.id ?? loaded[0]?.id ?? null);
      })
      .catch(() => {
        // Silent failure: decks unavailable, add button will be disabled.
      })
      .finally(() => {
        setDecksLoading(false);
      });
  }, [visible, languageCode]);

  useEffect(() => {
    if (lastAdded && selectedDeckId) {
      const deck = decks.find((d) => d.id === selectedDeckId);
      onAdded({ ...lastAdded, deckName: deck?.name ?? lastAdded.deckId });
      onClose();
    }
  }, [lastAdded, selectedDeckId, decks, onAdded, onClose]);

  const canSubmit = word.trim().length > 0 && selectedDeckId !== null && !isAdding;

  const handleSubmit = () => {
    if (!canSubmit || !selectedDeckId) {
      return;
    }
    void addWord(word, selectedDeckId);
  };

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
            <Text variant="title">{t('add.addWord')}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size="lg" />
            </Pressable>
          </View>

          <View style={{ gap: spacing.md }}>
            <DeckSelector
              decks={decks}
              selectedId={selectedDeckId ?? defaultDeckId}
              onSelect={() => {
                // Deck management is out of scope for this flow;
                // cycle to the next deck as a minimal in-place selector.
                const current = selectedDeckId ?? defaultDeckId;
                const index = decks.findIndex((d) => d.id === current);
                const next = decks[(index + 1) % decks.length];
                if (next) {
                  setSelectedDeckId(next.id);
                }
              }}
              loading={decksLoading}
            />

            <Input
              value={word}
              onChangeText={setWord}
              placeholder={t('add.wordPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              returnKeyType="search"
              onClear={() => setWord('')}
              loading={isAdding}
              autoFocus
            />

            <Button label={t('add.addWord')} onPress={handleSubmit} disabled={!canSubmit} loading={isAdding} />
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
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/components/AddWordModal.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/components/AddWordModal.tsx frontend/src/components/AddWordModal.test.tsx
git commit -m "feat(ui): add AddWordModal bottom sheet"
```

---

### Task 6: Add translations

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

- [ ] **Step 1: Add English and Korean keys**

Add these keys to the `en` object (around the existing `add` section):

```typescript
'add.addWord': 'Add Word',
'add.targetDeck': 'Target Deck',
'add.selectDeck': 'Select deck',
'add.noDeck': 'No deck',
'add.addedToDeck': 'Added "{{word}}" to {{deck}}',
```

Add these keys to the `ko` object:

```typescript
'add.addWord': '단어 추가',
'add.targetDeck': '대상 덱',
'add.selectDeck': '덱 선택',
'add.noDeck': '덱 없음',
'add.addedToDeck': '"{{word}}"를 {{deck}}에 추가했습니다',
```

- [ ] **Step 2: Verify TypeScript**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/i18n/translations.ts
git commit -m "feat(i18n): add add-word modal translations"
```

---

### Task 7: Wire AddWordModal into MyWordsScreen

**Files:**
- Modify: `frontend/src/features/words/MyWordsScreen.tsx`
- Test: `frontend/src/features/words/MyWordsScreen.test.tsx`

**Interfaces:**
- Consumes: `AddWordModal`, `listLearningItems` via `useLearningItems`
- Produces: MyWordsScreen renders an "Add word" button, hosts the modal, shows toast, refreshes list

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/words/MyWordsScreen.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MyWordsScreen } from './MyWordsScreen';
import { listLearningItems } from '../../api/learningItems';
import { listDecks } from '../../api/decks';
import { lookupWord, addLearningItem } from '../../api/words';

jest.mock('../../api/learningItems');
jest.mock('../../api/decks');
jest.mock('../../api/words');

const mockedListLearningItems = jest.mocked(listLearningItems);
const mockedListDecks = jest.mocked(listDecks);
const mockedLookupWord = jest.mocked(lookupWord);
const mockedAddLearningItem = jest.mocked(addLearningItem);

describe('MyWordsScreen', () => {
  beforeEach(() => {
    mockedListLearningItems.mockResolvedValue({ items: [], next_cursor: null });
    mockedListDecks.mockResolvedValue([
      { id: 'd1', name: 'Daily', target_language: 'en', is_default: true, item_count: 0, user_id: 'u1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    ]);
    mockedLookupWord.mockResolvedValue({ query: 'apple', normalized_text: 'apple', sense_options: [{ word_id: 'w1', word_sense_id: 's1', language_code: 'en', lemma: 'apple', normalized_text: 'apple', part_of_speech: 'noun', pronunciation: null, display_language_code: 'ko', definition: '사과', short_definition: null, cefr_level: 'A1', meaning_order: 1, examples: [] }] });
    mockedAddLearningItem.mockResolvedValue({ id: 'item-1', word_sense_id: 's1', learning_stage: 'new', due_at: '2026-01-01T00:00:00Z' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens the add modal and refreshes after adding', async () => {
    render(<MyWordsScreen />);

    fireEvent.press(screen.getByLabelText('Add word'));
    fireEvent.changeText(screen.getByPlaceholderText('Type a word to add'), 'apple');
    fireEvent.press(screen.getByText('Add Word'));

    await waitFor(() => {
      expect(mockedAddLearningItem).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockedListLearningItems).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/features/words/MyWordsScreen.test.tsx
```

Expected: FAIL because MyWordsScreen does not have the button or modal.

- [ ] **Step 3: Update MyWordsScreen**

Modify `frontend/src/features/words/MyWordsScreen.tsx`:

Add imports:

```typescript
import { useCallback, useMemo, useState } from 'react';
import { AddWordModal } from '../../components/AddWordModal';
```

Add state and handlers inside the component:

```typescript
const [modalVisible, setModalVisible] = useState(false);
const [toast, setToast] = useState<{ word: string; deckName: string } | null>(null);

const handleAdded = useCallback(
  (result: { word: string; deckId: string; deckName: string }) => {
    setToast({ word: result.word, deckName: result.deckName });
    void refresh();
    setTimeout(() => setToast(null), 2000);
  },
  [refresh],
);
```

Add the add button inside the header View (after the Input):

```tsx
<Button
  label={t('add.addWord')}
  iconLeft="add"
  onPress={() => setModalVisible(true)}
  accessibilityLabel={t('add.addWord')}
/>
```

Add the modal and toast at the bottom of the return, before `</Screen>`:

```tsx
<AddWordModal
  visible={modalVisible}
  onClose={() => setModalVisible(false)}
  onAdded={handleAdded}
/>

{toast && (
  <View
    style={[
      styles.toast,
      {
        backgroundColor: colors.successSurface,
        borderColor: colors.successBorder,
        borderWidth: 1,
        borderRadius: radii.md,
      },
    ]}
  >
    <Icon name="checkmark-circle" size="md" color={colors.success} />
    <Text variant="body" style={{ color: colors.success, flex: 1 }}>
      {t('add.addedToDeck', { word: toast.word, deck: toast.deckName })}
    </Text>
  </View>
)}
```

Add toast styles:

```typescript
toast: {
  position: 'absolute',
  bottom: 24,
  left: 20,
  right: 20,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingHorizontal: 16,
  paddingVertical: 12,
},
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx jest src/features/words/MyWordsScreen.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/features/words/MyWordsScreen.tsx frontend/src/features/words/MyWordsScreen.test.tsx
git commit -m "feat(words): wire AddWordModal into MyWordsScreen"
```

---

### Task 8: Wire AddWordModal into HomeScreen

**Files:**
- Modify: `frontend/src/features/learn/HomeScreen.tsx`

- [ ] **Step 1: Add modal state and handler**

Add imports:

```typescript
import { AddWordModal } from '../../components/AddWordModal';
```

Add state inside the component (near existing useState calls):

```typescript
const [addModalVisible, setAddModalVisible] = useState(false);
```

- [ ] **Step 2: Add an "Add Word" button in the header**

Inside the header area of the return (after the greeting title), add:

```tsx
<Button
  label={t('add.addWord')}
  iconLeft="add"
  variant="tonal"
  onPress={() => setAddModalVisible(true)}
  accessibilityLabel={t('add.addWord')}
/>
```

- [ ] **Step 3: Render the modal**

At the bottom of the return, before `</Screen>`:

```tsx
<AddWordModal
  visible={addModalVisible}
  onClose={() => setAddModalVisible(false)}
  onAdded={() => setAddModalVisible(false)}
/>
```

- [ ] **Step 4: Verify TypeScript**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/features/learn/HomeScreen.tsx
git commit -m "feat(home): add AddWordModal entry point to HomeScreen"
```

---

### Task 9: Update AddScreen manual mode

**Files:**
- Modify: `frontend/src/navigation/AddScreen.tsx`

- [ ] **Step 1: Replace ManualAddScreen with AddWordModal entry**

Modify `frontend/src/navigation/AddScreen.tsx`:

```typescript
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaptureScreen } from '../screens/CaptureScreen';
import { AnkiImportScreen } from '../features/import/AnkiImportScreen';
import { AddWordModal } from '../components/AddWordModal';
import { useAppLanguage } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { Button, SegmentedControl, Text } from '../ui';

type AddMode = 'capture' | 'manual' | 'import';

export function AddScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useAppLanguage();
  const [mode, setMode] = useState<AddMode>('capture');
  const [manualModalVisible, setManualModalVisible] = useState(false);

  const options: { value: AddMode; label: string }[] = [
    { value: 'capture', label: t('add.capture') },
    { value: 'manual', label: t('add.manual') },
    { value: 'import', label: t('add.import') },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md }]}>
        <Text variant="heading">{t('add.manual')}</Text>
        <SegmentedControl options={options} value={mode} onChange={setMode} />
      </View>

      <View style={styles.body}>
        {mode === 'capture' ? (
          <CaptureScreen />
        ) : mode === 'manual' ? (
          <View style={[styles.manualPlaceholder, { padding: spacing.xl }]}>
            <Button label={t('add.addWord')} iconLeft="add" onPress={() => setManualModalVisible(true)} />
          </View>
        ) : (
          <AnkiImportScreen />
        )}
      </View>

      <AddWordModal
        visible={manualModalVisible}
        onClose={() => setManualModalVisible(false)}
        onAdded={() => setManualModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 8,
  },
  body: {
    flex: 1,
  },
  manualPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

- [ ] **Step 2: Verify TypeScript**

Run:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add frontend/src/navigation/AddScreen.tsx
git commit -m "feat(navigation): use AddWordModal in Add screen manual mode"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run all frontend tests**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Manual smoke test**

Run the web dev server:

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
npm run web
```

Then:
1. Navigate to the Words tab.
2. Tap "Add Word".
3. Select a deck.
4. Type a known word (e.g., "apple").
5. Tap "Add Word".
6. Confirm the modal closes and a success toast appears.
7. Confirm the word appears in the learning list after refresh.

- [ ] **Step 4: Commit any final fixes**

```bash
cd /Users/hyungjuyu/Projects/iOS/Project_PN
git add .
git commit -m "fix: address review feedback / smoke test issues"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| Bottom-sheet modal | Task 5 |
| Deck selector before search | Tasks 1, 4, 5 |
| AI auto-picks first sense | Task 3 |
| Silent add + toast | Tasks 3, 5, 7 |
| No error UI | Tasks 3, 5 |
| No user editing | N/A (flow never offers editing) |
| Reuse shared Input | Tasks 5 |
| Translations en + ko | Task 6 |
| No backend changes | N/A (uses existing endpoints) |
| Entry point from learning list / home | Tasks 7, 8 |

### Placeholder Scan

No TBD, TODO, or vague steps. Each step includes exact file paths, code, commands, and expected output.

### Type Consistency

- `Deck` type is defined once and reused.
- `addLearningItem` signature accepts optional `deckId` consistently.
- `useAddWord` returns `{ word, deckId }`.
- `AddWordModal` enriches it with `deckName` and forwards `{ word, deckId, deckName }` to `onAdded`.
- `MyWordsScreen` consumes `{ word, deckId, deckName }`.

### Gaps

None identified.
