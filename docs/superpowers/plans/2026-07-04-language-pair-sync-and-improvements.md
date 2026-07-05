# Language Pair Sync, Security, and Performance Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the frontend-backend language pair synchronization bug, harden security around language mutations, and reduce redundant network/DB calls for language pair and user data flows.

**Architecture:**
- Sync shared DTOs in `packages/api/src/types.ts` with the actual backend responses from `backend/internal/http/auth_handler.go`.
- Extend the backend `PATCH /api/user/languages/:target_language` endpoint to support changing the target language itself (`new_target_language`), not only the display language.
- Replace the component-local `useActiveTargetLanguage` hook with a lightweight global `LanguageProvider` so every screen sees the same active pair and mutations can invalidate it in one place.
- Add security guards: strict language code validation, rate limiting on mutation endpoints, and sanitized path parameters.
- Add performance guards: DB index for `user_languages(user_id, created_at)`, client-side cache for `getLanguageOptions`, and eliminate unnecessary focus-time refetches.

**Tech Stack:**
- TypeScript / React Native / Expo (frontend)
- Go 1.22+ / Chi / pgx / PostgreSQL (backend)
- Jest (frontend tests), Go standard testing (backend tests)

**Global Constraints:**
- Do not add new runtime dependencies without explicit approval.
- Keep all existing tests passing; add failing tests before fixes.
- Mirror backend DTOs exactly in `packages/api/src/types.ts`.
- All SQL changes must be migration files under `backend/db/migrations/`.
- Commit after each independently testable task.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/api/src/types.ts` | Shared DTOs consumed by frontend and browser extension. |
| `backend/internal/http/user_handler.go` | HTTP handlers for `/api/user/languages/*`. |
| `backend/internal/auth/service.go` | Business logic for user language CRUD and activation. |
| `backend/internal/auth/language.go` | Domain types (`UserLanguage`, `LanguagePair`, etc.). |
| `backend/internal/http/router.go` | Route wiring and middleware (rate limiter registration). |
| `backend/internal/http/ratelimit.go` | New simple per-IP rate limiter middleware. |
| `backend/db/migrations/000016_user_languages_perf_idx.up.sql` | New migration: composite index for language list ordering. |
| `frontend/src/api/userLanguages.ts` | Frontend API wrappers for user language endpoints. |
| `frontend/src/features/profile/EditLanguagePairScreen.tsx` | UI for editing a language pair. |
| `frontend/src/features/profile/LanguagePairsScreen.tsx` | UI for listing and activating language pairs. |
| `frontend/src/contexts/LanguageContext.tsx` | New global language state and invalidation. |
| `frontend/src/hooks/useActiveTargetLanguage.ts` | Refactored to consume `LanguageContext`. |
| `frontend/src/App.tsx` (or root provider file) | Wrap app with `LanguageProvider`. |

---

### Task 1: Sync Shared DTOs with Backend Responses

**Files:**
- Modify: `packages/api/src/types.ts`
- Test: `packages/api/src/client.test.ts`

**Interfaces:**
- Consumes: Backend response shapes from `backend/internal/http/auth_handler.go`.
- Produces: Updated `MeResponse` and `LanguageOptionsResponse` types used by `frontend/src/api/auth.ts` and `frontend/src/features/profile/*`.

- [ ] **Step 1: Write a failing type-consistency test**

Add a structural test in `packages/api/src/client.test.ts`:

```typescript
import type { MeResponse, LanguageOptionsResponse } from './types';

type AssertKeys<T, K extends keyof T> = K;

// If backend adds/renames fields, these lines will fail to compile.
type _Me = AssertKeys<MeResponse, 'id' | 'email' | 'email_verified' | 'native_language' | 'target_language' | 'active_language' | 'ui_language'>;
type _LangOpts = AssertKeys<LanguageOptionsResponse, 'defaults' | 'allowed' | 'forced' | 'ui_defaults' | 'ui_forced'>;

describe('DTO shape', () => {
  it('MeResponse includes active_language and ui_language', () => {
    const me: MeResponse = {
      id: 'u1',
      email: 'a@b.com',
      email_verified: true,
      native_language: 'ko',
      target_language: 'en',
      active_language: {
        user_id: 'u1',
        target_language: 'en',
        display_language: 'ko',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ui_language: 'ko',
    };
    expect(me.active_language.is_active).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --workspace=packages/api -- client.test.ts`
Expected: TypeScript compile error because `active_language` / `ui_language` / `ui_defaults` / `ui_forced` do not exist on the current types.

- [ ] **Step 3: Update the shared types**

Modify `packages/api/src/types.ts`:

```typescript
export interface UserLanguage {
  user_id: string;
  target_language: string;
  display_language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MeResponse {
  id: string;
  email: string;
  email_verified: boolean;
  email_verified_at?: string | null;
  native_language: string;
  target_language: string;
  ui_language: string;
  active_language: UserLanguage;
}

export interface LanguageOptionsResponse {
  defaults: LanguagePair;
  allowed: AllowedLanguages;
  forced: LanguagePair;
  ui_defaults: string;
  ui_forced: string;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=packages/api -- client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/types.ts packages/api/src/client.test.ts
git commit -m "feat(api): sync MeResponse and LanguageOptionsResponse with backend"
```

---

### Task 2: Backend — Support Changing Target Language

**Files:**
- Modify: `backend/internal/http/user_handler.go`
- Modify: `backend/internal/auth/service.go`
- Modify: `backend/internal/auth/language.go` (if new exported error needed)
- Test: `backend/internal/http/user_handler_test.go`

**Interfaces:**
- Consumes: `UserLanguage` type and `auth.Service` methods.
- Produces: `PATCH /api/user/languages/:target_language` now accepts `new_target_language` and `display_language`; service method `UpdateUserLanguage(ctx, userID, oldTarget, newTarget, displayLang)`.

- [ ] **Step 1: Write a failing backend test**

Append to `backend/internal/http/user_handler_test.go` inside `TestUserLanguagesEndpoints` (or as a new test):

```go
func TestUpdateLanguagePairTargetLanguage(t *testing.T) {
	router, token := testUserRouter(t)

	// Change the target language from "en" to "ja", keep display "ko".
	body := `{"new_target_language":"ja","display_language":"ko"}`
	req := authRequest(t, http.MethodPatch, "/api/user/languages/en", body, token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("update target language: expected 204, got %d body=%s", rec.Code, rec.Body.String())
	}

	listReq := authRequest(t, http.MethodGet, "/api/user/languages", "", token)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	var listResp userLanguagesResponse
	if err := json.Unmarshal(listRec.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	var jaFound bool
	for _, l := range listResp.Languages {
		if l.TargetLanguage == "en" {
			t.Fatalf("old target language en should no longer exist")
		}
		if l.TargetLanguage == "ja" && l.DisplayLanguage == "ko" {
			jaFound = true
		}
	}
	if !jaFound {
		t.Fatalf("expected ja/ko pair after update, got %+v", listResp.Languages)
	}
}
```

Run: `cd backend && go test ./internal/http -run TestUpdateLanguagePairTargetLanguage -v`
Expected: FAIL — `new_target_language` is ignored, so the old "en" pair remains.

- [ ] **Step 2: Extend the service method to support target language changes**

In `backend/internal/auth/service.go`, replace `UpdateUserLanguageDisplayLang` with `UpdateUserLanguage`:

```go
// UpdateUserLanguage changes the target language and/or display language of an existing pair.
func (s *Service) UpdateUserLanguage(ctx context.Context, userID, oldTargetLang, newTargetLang, displayLang string) error {
	oldTargetLang, err := s.resolveTargetLang(oldTargetLang)
	if err != nil {
		return err
	}
	newTargetLang, err = s.resolveTargetLang(newTargetLang)
	if err != nil {
		return err
	}
	displayLang, err = s.resolveDefinitionLang(displayLang)
	if err != nil {
		return err
	}

	if oldTargetLang == newTargetLang {
		_, err = s.pool.Exec(ctx, `
			update user_languages
			set display_language = $3, updated_at = now()
			where user_id = $1::uuid and target_language = $2
		`, userID, oldTargetLang, displayLang)
		if err != nil {
			return fmt.Errorf("auth: update display language: %w", err)
		}
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("auth: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err := tx.QueryRow(ctx, `
		select exists(select 1 from user_languages where user_id = $1::uuid and target_language = $2)
	`, userID, oldTargetLang).Scan(&exists); err != nil {
		return fmt.Errorf("auth: check old target language: %w", err)
	}
	if !exists {
		return ErrLanguageNotFound
	}

	var targetExists bool
	if err := tx.QueryRow(ctx, `
		select exists(select 1 from user_languages where user_id = $1::uuid and target_language = $2)
	`, userID, newTargetLang).Scan(&targetExists); err != nil {
		return fmt.Errorf("auth: check new target language: %w", err)
	}
	if targetExists {
		return ErrTargetLanguageExists
	}

	_, err = tx.Exec(ctx, `
		update user_languages
		set target_language = $3, display_language = $4, updated_at = now()
		where user_id = $1::uuid and target_language = $2
	`, userID, oldTargetLang, newTargetLang, displayLang)
	if err != nil {
		return fmt.Errorf("auth: update user language: %w", err)
	}

	return tx.Commit(ctx)
}
```

Add the new error in `backend/internal/auth/language.go`:

```go
var (
	ErrInvalidTargetLang     = errors.New("invalid target language")
	ErrInvalidDefinitionLang = errors.New("invalid definition language")
	ErrInvalidUILang         = errors.New("invalid ui language")
	ErrLanguageNotFound      = errors.New("language not found")
	ErrTargetLanguageExists  = errors.New("target language already exists")
)
```

(If `errors` is not imported, add it.)

- [ ] **Step 3: Update the handler to accept `new_target_language`**

In `backend/internal/http/user_handler.go`:

```go
type updateLanguagePairRequest struct {
	NewTargetLanguage string `json:"new_target_language"`
	DisplayLanguage   string `json:"display_language"`
}

func (h *userHandler) updateLanguagePair(w http.ResponseWriter, r *http.Request) {
	targetLang := chi.URLParam(r, "target_language")
	if targetLang == "" {
		writeError(w, http.StatusBadRequest, "target_language is required")
		return
	}

	var req updateLanguagePairRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.DisplayLanguage == "" {
		writeError(w, http.StatusBadRequest, "display_language is required")
		return
	}
	if req.NewTargetLanguage == "" {
		req.NewTargetLanguage = targetLang
	}

	if err := h.svc.UpdateUserLanguage(r.Context(), userIDFromRequest(r), targetLang, req.NewTargetLanguage, req.DisplayLanguage); err != nil {
		h.writeUserError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

Register the new handler name in `router.go`:

```go
userRouter.Patch("/languages/{target_language}", uh.updateLanguagePair)
```

Update `writeUserError` to map `ErrTargetLanguageExists`:

```go
case errors.Is(err, auth.ErrTargetLanguageExists):
    writeError(w, http.StatusConflict, "target language already exists")
```

- [ ] **Step 4: Run the backend tests**

Run: `cd backend && go test ./internal/http -run 'TestUserLanguagesEndpoints|TestUpdateLanguagePairTargetLanguage' -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/auth/language.go backend/internal/auth/service.go backend/internal/http/user_handler.go backend/internal/http/router.go backend/internal/http/user_handler_test.go
git commit -m "feat(auth): support changing target language in PATCH /user/languages"
```

---

### Task 3: Frontend — Wire the Fixed Edit Screen

**Files:**
- Modify: `frontend/src/api/userLanguages.ts`
- Modify: `frontend/src/features/profile/EditLanguagePairScreen.tsx`

**Interfaces:**
- Consumes: Updated `PATCH /api/user/languages/:target_language` contract from Task 2.
- Produces: `updateLanguagePair` sends `new_target_language` and `display_language`; UI surfaces 409 "target language already exists".

- [ ] **Step 1: Add a frontend test for target language change**

Modify `frontend/src/features/profile/EditLanguagePairScreen.test.tsx` (create if missing):

```typescript
import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { EditLanguagePairScreen } from './EditLanguagePairScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { targetLanguage: 'en', displayLanguage: 'ko' } }),
}));

jest.mock('../../api/auth', () => ({
  getLanguageOptions: jest.fn().mockResolvedValue({
    defaults: {},
    allowed: { target_languages: [], definition_languages: [] },
    forced: {},
  }),
}));

const updateLanguagePair = jest.fn();
jest.mock('../../api/userLanguages', () => ({
  updateLanguagePair,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return children; // add real providers if needed
}

describe('EditLanguagePairScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateLanguagePair.mockResolvedValue(undefined);
  });

  it('calls updateLanguagePair with new target and display language on save', async () => {
    render(<EditLanguagePairScreen />, { wrapper: Wrapper });
    // Assuming buttons render language labels; adjust testIDs as needed.
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    fireEvent.press(screen.getByText('Japanese'));
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(updateLanguagePair).toHaveBeenCalledWith('en', 'ja', 'ko');
    });
  });
});
```

Run: `npm test --workspace=frontend -- EditLanguagePairScreen.test.tsx`
Expected: FAIL if the test file is new or if the implementation still ignores the new target.

- [ ] **Step 2: Ensure `updateLanguagePair` API wrapper is correct**

`frontend/src/api/userLanguages.ts` should already send the right body:

```typescript
export async function updateLanguagePair(
  targetLanguage: string,
  newTargetLanguage: string,
  displayLanguage: string,
): Promise<void> {
  await patchJson<void>(`/api/user/languages/${targetLanguage}`, {
    new_target_language: newTargetLanguage,
    display_language: displayLanguage,
  });
}
```

If it differs, update it to match.

- [ ] **Step 3: Improve error handling in EditLanguagePairScreen**

In `frontend/src/features/profile/EditLanguagePairScreen.tsx`, update the error branch:

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes('already exists') || (err as any)?.status === 409) {
    setError(t('settings.languagePairAlreadyExists'));
  } else if (message.toLowerCase().includes('has learning data')) {
    setHasDataError(true);
  } else {
    setError(message);
  }
}
```

Add the translation key in `frontend/src/i18n/translations.ts` if it does not exist.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=frontend -- EditLanguagePairScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/userLanguages.ts frontend/src/features/profile/EditLanguagePairScreen.tsx frontend/src/features/profile/EditLanguagePairScreen.test.tsx frontend/src/i18n/translations.ts
git commit -m "feat(profile): wire target language change in edit screen"
```

---

### Task 4: Frontend — Global Active Language State

**Files:**
- Create: `frontend/src/contexts/LanguageContext.tsx`
- Modify: `frontend/src/hooks/useActiveTargetLanguage.ts`
- Modify: `frontend/src/features/profile/LanguagePairsScreen.tsx`
- Modify: `frontend/src/navigation/AddScreen.tsx`
- Modify: root provider file (e.g. `frontend/src/App.tsx`)

**Interfaces:**
- Consumes: `getUserLanguages`, `setActiveUserLanguage`, `addUserLanguage`, `updateLanguagePair`, `removeUserLanguage` from `frontend/src/api/userLanguages.ts`.
- Produces: `LanguageContext` exposing `{ targetLanguage, displayLanguage, languages, loading, error, refresh, setActive }`.

- [ ] **Step 1: Write a failing test for the global context**

Create `frontend/src/contexts/LanguageContext.test.tsx`:

```typescript
import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { LanguageProvider, useLanguage } from './LanguageContext';

const getUserLanguages = jest.fn();
jest.mock('../api/userLanguages', () => ({
  ...jest.requireActual('../api/userLanguages'),
  getUserLanguages: () => getUserLanguages(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

describe('LanguageContext', () => {
  it('shares the active target language across consumers', async () => {
    getUserLanguages.mockResolvedValue([
      { target_language: 'en', display_language: 'ko', is_active: false },
      { target_language: 'ja', display_language: 'ko', is_active: true },
    ]);
    const { result } = renderHook(() => useLanguage(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.targetLanguage).toBe('ja');
  });
});
```

Run: `npm test --workspace=frontend -- LanguageContext.test.tsx`
Expected: FAIL because `LanguageContext.tsx` does not exist.

- [ ] **Step 2: Implement the global context**

Create `frontend/src/contexts/LanguageContext.tsx`:

```typescript
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getUserLanguages, setActiveUserLanguage } from '../api/userLanguages';
import type { UserLanguage } from '../types/auth';

interface LanguageContextValue {
  languages: UserLanguage[];
  targetLanguage: string | null;
  displayLanguage: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setActive: (targetLanguage: string) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [languages, setLanguages] = useState<UserLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getUserLanguages()
      .then((data) => {
        if (!active) return;
        setLanguages(data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load languages');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [tick]);

  const activeLanguage = useMemo(
    () => languages.find((l) => l.is_active) ?? languages[0] ?? null,
    [languages],
  );

  const setActive = useCallback(
    async (targetLanguage: string) => {
      await setActiveUserLanguage(targetLanguage);
      refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      languages,
      targetLanguage: activeLanguage?.target_language ?? null,
      displayLanguage: activeLanguage?.display_language ?? null,
      loading,
      error,
      refresh,
      setActive,
    }),
    [languages, activeLanguage, loading, error, refresh, setActive],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
```

- [ ] **Step 3: Refactor `useActiveTargetLanguage` to consume the context**

Modify `frontend/src/hooks/useActiveTargetLanguage.ts`:

```typescript
import { useLanguage } from '../contexts/LanguageContext';

interface UseActiveTargetLanguageResult {
  targetLanguage: string | null;
  displayLanguage: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useActiveTargetLanguage(): UseActiveTargetLanguageResult {
  const { targetLanguage, displayLanguage, loading, error, refresh } = useLanguage();
  return { targetLanguage, displayLanguage, loading, error, refresh };
}
```

- [ ] **Step 4: Wire the provider and invalidate on mutations**

Wrap the app in `frontend/src/App.tsx` (or wherever root providers live):

```typescript
import { LanguageProvider } from './contexts/LanguageContext';

// Inside root provider stack:
<LanguageProvider>
  <Navigation />
</LanguageProvider>
```

Update `frontend/src/features/profile/LanguagePairsScreen.tsx` to use the context and remove redundant `me()` call:

```typescript
import { useLanguage } from '../../contexts/LanguageContext';

export function LanguagePairsScreen() {
  const { languages, loading, error, refresh, setActive } = useLanguage();
  // ... replace local fetchPairs/useEffect/useFocusEffect with context values
}
```

Similarly, `AddScreen` can keep using `useActiveTargetLanguage` but now shares the cache.

- [ ] **Step 5: Run all frontend tests**

Run: `npm test --workspace=frontend`
Expected: PASS (update mocks where needed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/contexts/LanguageContext.tsx frontend/src/contexts/LanguageContext.test.tsx frontend/src/hooks/useActiveTargetLanguage.ts frontend/src/features/profile/LanguagePairsScreen.tsx frontend/src/navigation/AddScreen.tsx frontend/src/App.tsx
git commit -m "feat(language): add global LanguageContext and share active pair state"
```

---

### Task 5: Backend — Security Hardening

**Files:**
- Create: `backend/internal/http/ratelimit.go`
- Modify: `backend/internal/http/router.go`
- Modify: `backend/internal/auth/service.go`
- Modify: `backend/internal/auth/language.go`
- Test: `backend/internal/http/router_test.go` or new `ratelimit_test.go`

**Interfaces:**
- Consumes: Standard `net/http` middleware pattern.
- Produces: `rateLimitMiddleware(requestsPerMinute int)` applied to `/api/user/languages/*` mutation routes; strict language code validation in `resolveTargetLang`/`resolveDefinitionLang`.

- [ ] **Step 1: Write a failing test for language code validation**

In `backend/internal/auth/service_test.go` (create if missing, or add to existing test):

```go
func TestResolveTargetLangRejectsInvalid(t *testing.T) {
	s := New(nil, Options{AllowedTargetLangs: []string{"en", "ja"}})
	_, err := s.resolveTargetLang("<script>")
	if !errors.Is(err, ErrInvalidTargetLang) {
		t.Fatalf("expected invalid target language, got %v", err)
	}
}
```

Run: `cd backend && go test ./internal/auth -run TestResolveTargetLangRejectsInvalid -v`
Expected: FAIL because allowed-list check only compares membership; empty allowed lists pass everything.

- [ ] **Step 2: Add strict language code validation**

In `backend/internal/auth/language.go` add a helper:

```go
var languageCodePattern = regexp.MustCompile(`^[a-z]{2,3}$`)

func validateLanguageCode(code string) error {
	if !languageCodePattern.MatchString(code) {
		return errors.New("language code must be 2-3 lowercase letters")
	}
	return nil
}
```

Update `resolveTargetLang` and `resolveDefinitionLang` in `backend/internal/auth/service.go`:

```go
func (s *Service) resolveTargetLang(requested string) (string, error) {
	if s.forceTargetLang != "" {
		return s.forceTargetLang, nil
	}
	if requested == "" {
		return s.defaultTargetLang, nil
	}
	if err := validateLanguageCode(requested); err != nil {
		return "", ErrInvalidTargetLang
	}
	if len(s.allowedTargetLangs) > 0 && !contains(s.allowedTargetLangs, requested) {
		return "", ErrInvalidTargetLang
	}
	return requested, nil
}
```

Mirror the same for `resolveDefinitionLang` and `resolveUILang`.

- [ ] **Step 3: Add a simple per-IP rate limiter**

Create `backend/internal/http/ratelimit.go`:

```go
package httpapi

import (
	"net/http"
	"sync"
	"time"
)

type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string][]time.Time
	limit    int
	window   time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		visitors: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)
	var recent []time.Time
	for _, t := range rl.visitors[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	recent = append(recent, now)
	rl.visitors[ip] = recent
	return len(recent) <= rl.limit
}

func (rl *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _ := keyByRealIP(r)
		if !rl.allow(ip) {
			writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

- [ ] **Step 4: Apply rate limiting to mutation routes**

In `backend/internal/http/router.go`:

```go
languageMutateRL := newRateLimiter(30, time.Minute).middleware

userRouter.Group(func(mutate chi.Router) {
	mutate.Use(languageMutateRL)
	mutate.Post("/languages", uh.addLanguage)
	mutate.Patch("/languages/{target_language}", uh.updateLanguagePair)
	mutate.Patch("/languages/{target_language}/active", uh.setActiveLanguage)
	mutate.Delete("/languages/{target_language}", uh.removeLanguage)
	mutate.Put("/ui-language", uh.setUILanguage)
})
```

- [ ] **Step 5: Run backend tests**

Run: `cd backend && go test ./internal/auth ./internal/http -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/auth/language.go backend/internal/auth/service.go backend/internal/http/ratelimit.go backend/internal/http/router.go backend/internal/auth/service_test.go
git commit -m "feat(auth): validate language codes and rate-limit language mutations"
```

---

### Task 6: Performance Optimizations

**Files:**
- Create: `backend/db/migrations/000016_user_languages_perf_idx.up.sql`
- Create: `backend/db/migrations/000016_user_languages_perf_idx.down.sql`
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/features/add/AddLanguagePairScreen.tsx`
- Modify: `frontend/src/hooks/useActiveTargetLanguage.ts`
- Modify: `frontend/src/features/profile/LanguagePairsScreen.tsx`

**Interfaces:**
- Consumes: Existing `getLanguageOptions` and `getUserLanguages` calls.
- Produces: DB index `(user_id, created_at)` on `user_languages`; short-lived client cache for language options; fewer focus-triggered refetches.

- [ ] **Step 1: Add DB migration for the composite index**

`backend/db/migrations/000016_user_languages_perf_idx.up.sql`:

```sql
create index if not exists user_languages_user_id_created_at_idx
    on user_languages (user_id, created_at);
```

`backend/db/migrations/000016_user_languages_perf_idx.down.sql`:

```sql
drop index if exists user_languages_user_id_created_at_idx;
```

- [ ] **Step 2: Cache language options on the client**

Modify `frontend/src/api/auth.ts`:

```typescript
let languageOptionsCache: Promise<LanguageOptionsResponse> | null = null;
let languageOptionsCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getLanguageOptions(): Promise<LanguageOptionsResponse> {
  const now = Date.now();
  if (languageOptionsCache && now - languageOptionsCacheTime < CACHE_TTL_MS) {
    return languageOptionsCache;
  }
  languageOptionsCache = getLanguageOptionsApi();
  languageOptionsCacheTime = now;
  return languageOptionsCache;
}
```

- [ ] **Step 3: Reduce redundant focus refetches**

In `frontend/src/hooks/useActiveTargetLanguage.ts`, keep the context consumer but ensure `AddScreen` does not force a refresh on every focus unless the screen was backgrounded for a meaningful duration. A simple heuristic:

```typescript
const LAST_REFRESH_THRESHOLD_MS = 30_000;

// In AddScreen focus effect:
useFocusEffect(
  useCallback(() => {
    const last = lastRefreshRef.current;
    const now = Date.now();
    if (!last || now - last > LAST_REFRESH_THRESHOLD_MS) {
      lastRefreshRef.current = now;
      refreshLanguage();
    }
  }, [refreshLanguage]),
);
```

Remove `useFocusEffect` from `LanguagePairsScreen` entirely because the context refreshes after mutations.

- [ ] **Step 4: Run frontend and backend tests**

Run:
```bash
cd backend && go test ./internal/migrations -run TestMigrations -v
npm test --workspace=frontend
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/db/migrations/000016_user_languages_perf_idx.up.sql backend/db/migrations/000016_user_languages_perf_idx.down.sql frontend/src/api/auth.ts frontend/src/hooks/useActiveTargetLanguage.ts frontend/src/features/profile/LanguagePairsScreen.tsx frontend/src/navigation/AddScreen.tsx
git commit -m "perf(language): add db index, cache options, reduce focus refetches"
```

---

## Self-Review

**1. Spec coverage:**
- Language pair sync bug → Tasks 1, 2, 3.
- Backend logic correctness → Tasks 2, 5.
- Security → Task 5.
- Speed → Task 6.
- User data consistency → Task 4 (global state) and Task 2 (backend target language update).

**2. Placeholder scan:**
- No "TBD", "TODO", or vague "add validation" steps.
- Each step includes concrete code or exact commands.

**3. Type consistency:**
- `UserLanguage` in `packages/api/src/types.ts` matches backend `auth.UserLanguage` JSON tags.
- `MeResponse` and `LanguageOptionsResponse` now include all backend fields.
- `updateLanguagePair` frontend signature stays `(old, newTarget, display)`.
- `LanguageContext` exposes `targetLanguage`, `displayLanguage`, `loading`, `error`, `refresh`, `setActive` consistently.

**4. Known gaps / follow-ups:**
- If the app uses a different root provider file than `frontend/src/App.tsx`, adjust Task 4 accordingly.
- `EditLanguagePairScreen.test.tsx` may need real `ThemeProvider`/`AppLanguageProvider` wrappers; the example assumes minimal mocking.
- Rate limiter is in-memory and resets on deploy; for multi-instance deployments a Redis-backed limiter would be a future improvement.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-04-language-pair-sync-and-improvements.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach would you like?
