# Simplify Home Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Word of the Day", "From your captures", and "Themed challenges" sections from the Home screen, leaving only greeting, primary add action, due-review hero, stats, and XP progress.

**Architecture:** Delete the JSX blocks and their supporting state/API imports from `HomeScreen.tsx`, update `HomeScreen.test.tsx` mocks accordingly, and remove now-unused translation keys from `translations.ts`. No new components or dependencies.

**Tech Stack:** React Native / Expo, TypeScript, Jest, React Testing Library.

## Global Constraints
- Target platforms: iOS, Android, Web, Tauri.
- Keep all remaining Home screen behavior unchanged.
- Follow existing file structure and import style.
- Run `npx jest --no-coverage` and `npx tsc --noEmit` after code changes.
- Do not run `git commit` without explicit user approval.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/features/learn/HomeScreen.tsx` | Renders the Home screen. Remove the three sections and their data fetching. |
| `frontend/src/features/learn/HomeScreen.test.tsx` | Tests the Home screen. Remove mocks for deleted APIs/storage. |
| `frontend/src/i18n/translations.ts` | Translation strings. Remove keys only used by the deleted sections. |

---

### Task 1: Remove Word of the Day block

**Files:**
- Modify: `frontend/src/features/learn/HomeScreen.tsx:150-153, 346-371`
- Test: `frontend/src/features/learn/HomeScreen.test.tsx:9`

**Interfaces:**
- Consumes: existing `HomeScreen` component structure and `useFocusEffect` data load.
- Produces: `HomeScreen` no longer renders `wordOfTheDay` or calls `getWordOfTheDay`.

- [ ] **Step 1: Write the failing test update**

  In `frontend/src/features/learn/HomeScreen.test.tsx`, remove the `getWordOfTheDay` mock from the `../../api/content` mock:

  ```typescript
  jest.mock('../../api/content', () => ({ getContentChallenges: jest.fn() }));
  ```

- [ ] **Step 2: Remove Word of the Day JSX**

  In `frontend/src/features/learn/HomeScreen.tsx`, delete the entire conditional block:

  ```tsx
  {wordOfTheDay ? (
    <Card style={{ gap: spacing.sm, padding: spacing.lg }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={[styles.smallIconCircle, { backgroundColor: colors.tertiaryContainer }]}>
          <Icon name="bulb" size="md" color={colors.tertiary} />
        </View>
        <Text variant="label" color="muted">
          {t('home.wordOfTheDayTitle')}
        </Text>
      </View>
      <Text variant="title" bold>
        {wordOfTheDay.lemma}
      </Text>
      <Text color="muted">{wordOfTheDay.localized_definition || wordOfTheDay.definition}</Text>
      <Button
        label={t('home.wordOfTheDayAdd')}
        variant="tonal"
        onPress={() => enqueue(wordOfTheDay.lemma, 'Any')}
      />
    </Card>
  ) : (
    <Card style={{ gap: spacing.sm, padding: spacing.lg }}>
      <Text variant="title">{t('home.wordOfTheDayTitle')}</Text>
      <Text color="muted">{t('home.wordOfTheDayEmpty')}</Text>
    </Card>
  )}
  ```

- [ ] **Step 3: Remove supporting state and import**

  Delete from `HomeScreen.tsx`:

  ```typescript
  const [wordOfTheDay, setWordOfTheDay] = useState<SenseOption | null>(null);
  ```

  Delete the destructured `wotd` from the `Promise.all` in `useFocusEffect` and remove `setWordOfTheDay(wotd.sense_options[0] ?? null);`.

  Remove `getWordOfTheDay` from the import on line 7:

  ```typescript
  import { getContentChallenges } from '../../api/content';
  ```

  Remove `SenseOption` from the import on line 12 if it is no longer used elsewhere.

- [ ] **Step 4: Run tests**

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx jest --no-coverage src/features/learn/HomeScreen.test.tsx
  ```

  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/features/learn/HomeScreen.tsx frontend/src/features/learn/HomeScreen.test.tsx
  git commit -m "feat(home): remove word of the day section"
  ```

---

### Task 2: Remove Capture Reentry block

**Files:**
- Modify: `frontend/src/features/learn/HomeScreen.tsx:154, 373-390`
- Test: `frontend/src/features/learn/HomeScreen.test.tsx:11`

**Interfaces:**
- Consumes: existing `HomeScreen` component structure.
- Produces: `HomeScreen` no longer renders `captureWords` or calls `recentCaptureWords`.

- [ ] **Step 1: Write the failing test update**

  Remove the `recentCaptureWords` mock from `frontend/src/features/learn/HomeScreen.test.tsx`:

  ```typescript
  jest.mock('../../storage/captureHistory', () => ({}));
  ```

  Or delete the entire line if no other exports from that module are mocked.

- [ ] **Step 2: Remove Capture Reentry JSX**

  In `frontend/src/features/learn/HomeScreen.tsx`, delete the entire block:

  ```tsx
  <Card style={{ gap: spacing.sm, padding: spacing.lg }}>
    <Text variant="title">{t('home.captureReentryTitle')}</Text>
    <Text variant="caption" color="muted">
      {t('home.captureReentrySubtitle')}
    </Text>
    {captureWords.length > 0 ? (
      <>
        <Text>{captureWords.join(', ')}</Text>
        <Button
          label={t('home.captureReentryAdd')}
          variant="tonal"
          onPress={() => enqueueMany(captureWords, 'Any')}
        />
      </>
    ) : (
      <Text color="muted">{t('home.captureReentryEmpty')}</Text>
    )}
  </Card>
  ```

- [ ] **Step 3: Remove supporting state and import**

  Delete from `HomeScreen.tsx`:

  ```typescript
  const [captureWords, setCaptureWords] = useState<string[]>([]);
  ```

  Delete `recentCaptures` from the `Promise.all` destructuring in `useFocusEffect` and remove `setCaptureWords(recentCaptures);`.

  Remove the import:

  ```typescript
  import { recentCaptureWords } from '../../storage/captureHistory';
  ```

- [ ] **Step 4: Run tests**

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx jest --no-coverage src/features/learn/HomeScreen.test.tsx
  ```

  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/features/learn/HomeScreen.tsx frontend/src/features/learn/HomeScreen.test.tsx
  git commit -m "feat(home): remove capture reentry section"
  ```

---

### Task 3: Remove Themed Challenges block

**Files:**
- Modify: `frontend/src/features/learn/HomeScreen.tsx:155, 392-407`
- Test: `frontend/src/features/learn/HomeScreen.test.tsx:9`

**Interfaces:**
- Consumes: existing `HomeScreen` component structure.
- Produces: `HomeScreen` no longer renders `challenges` or calls `getContentChallenges`.

- [ ] **Step 1: Remove Themed Challenges JSX**

  In `frontend/src/features/learn/HomeScreen.tsx`, delete the entire block:

  ```tsx
  {challenges.length > 0 ? (
    <Card style={{ gap: spacing.md, padding: spacing.lg }}>
      <Text variant="title">{t('home.challengesTitle')}</Text>
      {challenges.map((challenge) => (
        <View key={challenge.id} style={{ gap: spacing.xs }}>
          <Text>{challenge.title}</Text>
          <Text variant="caption" color="muted">
            {challenge.description}
          </Text>
          {challenge.status === 'coming_soon' ? (
            <Badge label={t('home.challengesComingSoon')} variant="default" />
          ) : null}
        </View>
      ))}
    </Card>
  ) : null}
  ```

- [ ] **Step 2: Remove supporting state and import**

  Delete from `HomeScreen.tsx`:

  ```typescript
  const [challenges, setChallenges] = useState<ContentChallenge[]>([]);
  ```

  Delete `challengeResponse` from the `Promise.all` destructuring in `useFocusEffect` and remove `setChallenges(challengeResponse.challenges);`.

  Remove the import on line 7:

  ```typescript
  import { getWordOfTheDay } from '../../api/content';
  ```

  (If Task 1 already removed `getWordOfTheDay`, this import should now be removed entirely.)

  Remove `ContentChallenge` from the import on line 12 if it is no longer used elsewhere.

- [ ] **Step 3: Update test mock**

  Remove the `getContentChallenges` mock from `frontend/src/features/learn/HomeScreen.test.tsx`. The line:

  ```typescript
  jest.mock('../../api/content', () => ({ getContentChallenges: jest.fn(), getWordOfTheDay: jest.fn() }));
  ```

  should become:

  ```typescript
  jest.mock('../../api/content', () => ({}));
  ```

  Or delete the mock entirely if `../../api/content` is no longer used by `HomeScreen`.

- [ ] **Step 4: Run tests**

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx jest --no-coverage src/features/learn/HomeScreen.test.tsx
  ```

  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/features/learn/HomeScreen.tsx frontend/src/features/learn/HomeScreen.test.tsx
  git commit -m "feat(home): remove themed challenges section"
  ```

---

### Task 4: Simplify the `useFocusEffect` data load

**Files:**
- Modify: `frontend/src/features/learn/HomeScreen.tsx:157-185`

**Interfaces:**
- Consumes: cleaned-up component state from Tasks 1–3.
- Produces: `useFocusEffect` only fetches stats and user profile.

- [ ] **Step 1: Update the fetch Promise**

  Replace the current `Promise.all` in `useFocusEffect`:

  ```typescript
  Promise.all([getStatsSummary(), me(), getWordOfTheDay(), getContentChallenges(), recentCaptureWords()])
    .then(([summary, user, wotd, challengeResponse, recentCaptures]) => {
  ```

  with:

  ```typescript
  Promise.all([getStatsSummary(), me()])
    .then(([summary, user]) => {
  ```

- [ ] **Step 2: Remove unused destructured values**

  Delete `wotd`, `challengeResponse`, and `recentCaptures` from the `.then` callback body.

- [ ] **Step 3: Run tests**

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx jest --no-coverage src/features/learn/HomeScreen.test.tsx
  ```

  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/features/learn/HomeScreen.tsx
  git commit -m "refactor(home): simplify focus effect data load"
  ```

---

### Task 5: Remove unused translation keys

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

**Interfaces:**
- Consumes: deleted JSX strings from Tasks 1–3.
- Produces: `translations.ts` no longer contains keys solely used by deleted sections.

- [ ] **Step 1: Identify keys to remove**

  Search `frontend/src/i18n/translations.ts` for the following keys and remove both their `en` and `ko` entries if they are no longer referenced anywhere:

  - `home.wordOfTheDayTitle`
  - `home.wordOfTheDayAdd`
  - `home.wordOfTheDayEmpty`
  - `home.captureReentryTitle`
  - `home.captureReentrySubtitle`
  - `home.captureReentryAdd`
  - `home.captureReentryEmpty`
  - `home.challengesTitle`
  - `home.challengesComingSoon`

  Command to verify a key is unused:

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  grep -R "home.wordOfTheDayTitle" src/
  ```

  Expected: no matches.

- [ ] **Step 2: Run tests and typecheck**

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx jest --no-coverage src/features/learn/HomeScreen.test.tsx
  npx tsc --noEmit
  ```

  Expected: both PASS with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/i18n/translations.ts
  git commit -m "chore(i18n): remove unused home screen translation keys"
  ```

---

### Task 6: Final verification

**Files:**
- All files modified in Tasks 1–5.

- [ ] **Step 1: Run full frontend test suite**

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx jest --no-coverage
  ```

  Expected: all suites pass.

- [ ] **Step 2: Run TypeScript check**

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Manual smoke check**

  Launch the web dev server and open the Home screen:

  ```bash
  cd /Users/hyungjuyu/Projects/iOS/Project_PN/frontend
  npx expo start --web
  ```

  Confirm the Home screen shows only: greeting, Add Word button, words-due hero, stats cards, and XP progress. Confirm "Word of the Day", "From your captures", and "Themed challenges" are absent.

---

## Self-Review

**1. Spec coverage:** Each deleted section has a dedicated task (Word of the Day, Capture Reentry, Themed Challenges). Supporting cleanup (state, imports, data load, translations, tests) is covered.

**2. Placeholder scan:** No TBD/TODO/filler steps. Each step includes exact file paths, code blocks, and commands.

**3. Type consistency:** The plan uses the same names and imports found in the current `HomeScreen.tsx` (`spacing`, `colors`, `t`, `enqueue`, `enqueueMany`, etc.). Removed types (`SenseOption`, `ContentChallenge`) are only removed after confirming they are no longer referenced.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-01-simplify-home-screen.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
