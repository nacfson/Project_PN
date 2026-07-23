# Add-Word Intent Lock & Sense Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock each learner card to a user-selected distinct global sense (context → select → save), enforce one example per sense, retranslate the full word cache with auto-match remaps, and let users change meaning from My Words without resetting FSRS.

**Architecture:** Enricher emits distinct senses with exactly one example. Lookup accepts optional `source_context` for ranking/force-append. Learning items persist `source_context` and support `PATCH` to swap `word_sense_id` while keeping `review_states`. A one-shot `retranslate-senses` command rebuilds every word’s senses and auto-matches existing cards. Frontend Manual Add uses the existing (currently unused) SensePicker flow with a context field; My Words adds change-meaning; practice keeps target definition primary.

**Tech Stack:** Go backend (pgx, chi), PostgreSQL migrations, Expo/React Native frontend, Jest + `go test`, OpenAI-compatible enricher.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-add-word-intent-lock-design.md`
- Mockup: `docs/superpowers/specs/2026-07-23-add-word-intent-mockup.html`
- Learnable unit remains `user_word_senses` → one `word_sense_id`; no personal gloss as answer key
- Steady-state enrich is append-only; one-time retranslate may replace a word’s sense set
- Exactly one `examples` row per `word_sense_id` (DB unique index)
- Auto-match metric: Jaccard similarity on whitespace tokens of `normalizeMatchText(definition + " " + localized_definition)`; tie-break lowest new `meaning_order`, then `id`
- Remap conflict (two user cards → same new sense): keep the card with higher `review_states.review_count`, tie-break earlier `user_word_senses.added_at`; set `archived_at = now()` on the loser
- Change-meaning conflict (target sense already active for user): HTTP 409 `sense_already_in_learning_set`
- Capture / passage auto-queue stays on `bestMatch` for this plan (Manual Add only)
- Run Go tests with `GOTOOLCHAIN=go1.26.0` from `backend/`
- Update both `en` and `ko` keys in `frontend/src/i18n/translations.ts`

## Scope note

This is one plan with three shippable phases (match spec rollout). Do not start Phase 2 UI until Phase 1 backend enrich + schema land; do not run production retranslate until enrich validation is green.

| Phase | Tasks | Shippable outcome |
|-------|-------|-------------------|
| 1 Data + enrich | 1–5 | 1 example/sense, distinct validation, unique index, retranslate cmd |
| 2 API | 6–8 | `source_context` lookup/add, change-meaning PATCH |
| 3 Frontend | 9–12 | Manual Add intent UI, My Words change meaning, practice/docs polish |

## File Map

| File | Responsibility |
|------|----------------|
| `backend/internal/enrich/enrich.go` | Add `SourceContext` on `Request` |
| `backend/internal/enrich/openai.go` | Prompt: 1 example; distinct senses; include context |
| `backend/internal/enrich/validation.go` | Shared normalize + Jaccard + sense dedupe helpers |
| `backend/internal/enrich/openai_test.go` | Parse/validation fixtures |
| `backend/db/migrations/000019_one_example_per_sense.up.sql` | Trim extras + unique index |
| `backend/db/migrations/000019_one_example_per_sense.down.sql` | Drop unique index |
| `backend/internal/words/sense_match.go` | `AutoMatchSenseID`, `normalizeMatchText`, Jaccard |
| `backend/internal/words/sense_match_test.go` | Unit tests (no DB) |
| `backend/internal/words/retranslate.go` | `RetranslateWord` per-word rebuild + remap |
| `backend/internal/words/retranslate_test.go` | Integration tests |
| `backend/cmd/retranslate-senses/main.go` | Batch CLI over all `words` |
| `backend/internal/words/service.go` | Lookup context ranking; AddLearningItem `source_context`; `ChangeLearningItemSense` |
| `backend/internal/words/types.go` | DTO fields as needed |
| `backend/internal/http/words_handler.go` | JSON fields + PATCH handler |
| `backend/internal/http/router.go` | `PATCH /api/learning-items/{id}` |
| `packages/api/src/types.ts` | Shared request/response fields |
| `packages/api/src/words.ts` | Client methods |
| `frontend/src/types/index.ts` | Mirror DTO fields |
| `frontend/src/api/words.ts` | Re-export / wrappers |
| `frontend/src/hooks/useSenseFlow.ts` | Pass `sourceContext`; confirm with context |
| `frontend/src/components/SensePicker.tsx` | Target-first + localized secondary + one example |
| `frontend/src/features/add/ManualAddSection.tsx` | Context field + picker (stop silent queue add) |
| `frontend/src/features/words/MyWordsScreen.tsx` / `WordDetailScreen.tsx` | Change-meaning entry |
| `frontend/src/features/words/ChangeMeaningSheet.tsx` | New sheet reusing SensePicker patterns |
| `frontend/src/i18n/translations.ts` | New strings |
| `backend/docs/backend-flows.md` | Document new flows |
| `backend/docs/backend-schema-mvp.md` | One-example rule |

---

### Task 1: Enrich validation — exactly one example + distinct senses

**Files:**
- Modify: `backend/internal/enrich/validation.go`
- Modify: `backend/internal/enrich/openai.go` (`parseModelOutput`)
- Test: `backend/internal/enrich/openai_test.go`

**Interfaces:**
- Consumes: `enrich.Sense`, `enrich.Result`
- Produces:
  - `func NormalizeMatchText(s string) string`
  - `func TokenJaccard(a, b string) float64`
  - `func DedupeSenses(senses []Sense) []Sense` — keeps first of each near-dup cluster where Jaccard ≥ 0.8 on definition **or** native definition
  - `parseModelOutput` rejects a sense with `len(Examples) != 1` after trim; runs `DedupeSenses` per entry

- [ ] **Step 1: Write the failing tests**

```go
func TestNormalizeMatchText(t *testing.T) {
	got := NormalizeMatchText("  Intentionally,  고의로 ")
	if got != "intentionally 고의로" {
		t.Fatalf("got %q", got)
	}
}

func TestTokenJaccardIdentical(t *testing.T) {
	if TokenJaccard("고의로 하다", "고의로 하다") != 1 {
		t.Fatal("expected 1")
	}
}

func TestDedupeSensesCollapsesNearDuplicates(t *testing.T) {
	in := []Sense{
		{Definition: "deliberately", NativeDefinition: "고의로", Examples: []Example{{Sentence: "a"}}},
		{Definition: "intentionally", NativeDefinition: "의도적으로", Examples: []Example{{Sentence: "b"}}},
		{Definition: "to accuse formally", NativeDefinition: "기소하다", Examples: []Example{{Sentence: "c"}}},
	}
	// Force high overlap on native side for first two by using same tokens:
	in[0].NativeDefinition = "고의로 의도적으로"
	in[1].NativeDefinition = "의도적으로 고의로"
	out := DedupeSenses(in)
	if len(out) != 2 {
		t.Fatalf("expected 2 senses after dedupe, got %d", len(out))
	}
}

func TestParseModelOutputRejectsWrongExampleCount(t *testing.T) {
	req := Request{Text: "charge", LanguageCode: "en", DefinitionLanguageCode: "ko"}
	raw := `{
	  "normalized_text":"charge",
	  "entries":[{
	    "lemma":"charge","part_of_speech":"verb","pronunciation":"",
	    "senses":[{
	      "definition":"to store energy","short_definition":"store energy","cefr_level":"A2",
	      "native_definition":"충전하다","native_short_definition":"충전하다",
	      "examples":[
	        {"sentence":"Charge it.","translation":"**충전**하세요.","difficulty":"easy"},
	        {"sentence":"Charge overnight.","translation":"밤새 **충전**하세요.","difficulty":"medium"}
	      ]
	    }]
	  }]
	}`
	_, err := parseModelOutput(req, raw)
	if err == nil {
		t.Fatal("expected error for 2 examples")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/enrich -run 'TestNormalizeMatchText|TestTokenJaccardIdentical|TestDedupeSenses|TestParseModelOutputRejectsWrongExampleCount' -v
```

Expected: FAIL — missing helpers and/or still accepting multi-example senses.

- [ ] **Step 3: Implement helpers + tighten `parseModelOutput`**

In `validation.go`:

```go
func NormalizeMatchText(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

func TokenJaccard(a, b string) float64 {
	ta := strings.Fields(NormalizeMatchText(a))
	tb := strings.Fields(NormalizeMatchText(b))
	if len(ta) == 0 && len(tb) == 0 {
		return 1
	}
	if len(ta) == 0 || len(tb) == 0 {
		return 0
	}
	setA := map[string]struct{}{}
	for _, t := range ta {
		setA[t] = struct{}{}
	}
	inter := 0
	setB := map[string]struct{}{}
	for _, t := range tb {
		setB[t] = struct{}{}
		if _, ok := setA[t]; ok {
			inter++
		}
	}
	union := len(setA) + len(setB) - inter
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

func sensesNearDuplicate(a, b Sense) bool {
	if TokenJaccard(a.Definition, b.Definition) >= 0.8 {
		return true
	}
	if a.NativeDefinition != "" && b.NativeDefinition != "" &&
		TokenJaccard(a.NativeDefinition, b.NativeDefinition) >= 0.8 {
		return true
	}
	return false
}

func DedupeSenses(senses []Sense) []Sense {
	out := make([]Sense, 0, len(senses))
	for _, s := range senses {
		dup := false
		for _, kept := range out {
			if sensesNearDuplicate(s, kept) {
				dup = true
				break
			}
		}
		if !dup {
			out = append(out, s)
		}
	}
	return out
}
```

In `parseModelOutput`, for each sense after basic field checks:

```go
exCount := 0
var keptExamples []Example
for _, ex := range modelSense.Examples {
	if strings.TrimSpace(ex.Sentence) == "" {
		continue
	}
	exCount++
	keptExamples = append(keptExamples, /* mapped Example */)
}
if exCount != 1 {
	continue // skip invalid sense, or fail entry — prefer skip sense; if no senses left → ErrInvalidOutput
}
sense.Examples = keptExamples[:1]
```

After building each entry’s senses, set `entry.Senses = DedupeSenses(entry.Senses)`. If all entries have zero senses, return `ErrInvalidOutput`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/enrich -run 'TestNormalizeMatchText|TestTokenJaccardIdentical|TestDedupeSenses|TestParseModelOutputRejectsWrongExampleCount' -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/enrich/validation.go backend/internal/enrich/openai.go backend/internal/enrich/openai_test.go
git commit -m "feat(enrich): require one example and dedupe near-duplicate senses"
```

---

### Task 2: Enrich prompt — one example, distinct intents, source context

**Files:**
- Modify: `backend/internal/enrich/enrich.go`
- Modify: `backend/internal/enrich/openai.go` (`buildUserPrompt`)
- Test: `backend/internal/enrich/openai_test.go`

**Interfaces:**
- Consumes: none new beyond Task 1
- Produces: `Request.SourceContext string` included in user prompt when non-empty

- [ ] **Step 1: Write the failing test**

```go
func TestBuildUserPromptIncludesContextAndOneExample(t *testing.T) {
	prompt := buildUserPrompt(Request{
		Text:                   "charge",
		LanguageCode:           "en",
		DefinitionLanguageCode: "ko",
		SourceContext:          "Please charge it overnight before the trip.",
	})
	if !strings.Contains(prompt, "Please charge it overnight") {
		t.Fatal("expected source context in prompt")
	}
	if strings.Contains(prompt, "3-5 distinct example") {
		t.Fatal("old multi-example instruction still present")
	}
	if !strings.Contains(prompt, "exactly one example") {
		t.Fatal("expected one-example instruction")
	}
	if !strings.Contains(strings.ToLower(prompt), "distinct") {
		t.Fatal("expected distinct-sense instruction")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/enrich -run TestBuildUserPromptIncludesContextAndOneExample -v
```

Expected: FAIL

- [ ] **Step 3: Implement**

Add to `Request`:

```go
// SourceContext is an optional sentence/situation that steers which
// distinct sense(s) to generate. Empty means no extra steering.
SourceContext string
```

Replace the multi-example closing lines in `buildUserPrompt` with instructions equivalent to:

- Provide mutually distinct senses (different intents); do not emit near-synonym gloss pairs as separate senses
- Exactly one example sentence per sense
- If `SourceContext` non-empty: prioritize senses that fit that context; still return other clearly distinct common senses for the lemma

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/enrich -run TestBuildUserPromptIncludesContextAndOneExample -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/enrich/enrich.go backend/internal/enrich/openai.go backend/internal/enrich/openai_test.go
git commit -m "feat(enrich): steer prompts with context and single-example senses"
```

---

### Task 3: Migration — one example per sense

**Files:**
- Create: `backend/db/migrations/000019_one_example_per_sense.up.sql`
- Create: `backend/db/migrations/000019_one_example_per_sense.down.sql`

**Interfaces:**
- Consumes: existing `examples` / `example_translations`
- Produces: `examples_one_per_sense_uidx` unique on `word_sense_id`

- [ ] **Step 1: Write the up migration**

```sql
-- 000019_one_example_per_sense.up.sql
delete from examples e
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by word_sense_id
        order by created_at asc, id asc
      ) as rn
    from examples
  ) ranked
  where rn > 1
) doomed
where e.id = doomed.id;

create unique index examples_one_per_sense_uidx on examples (word_sense_id);
```

Down:

```sql
drop index if exists examples_one_per_sense_uidx;
```

- [ ] **Step 2: Apply migration locally**

```bash
cd backend && GOTOOLCHAIN=go1.26.0 go run ./cmd/migrate
```

Expected: migrates to 000019 without error.

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations/000019_one_example_per_sense.up.sql backend/db/migrations/000019_one_example_per_sense.down.sql
git commit -m "db: enforce one example sentence per word sense"
```

---

### Task 4: Auto-match helper

**Files:**
- Create: `backend/internal/words/sense_match.go`
- Create: `backend/internal/words/sense_match_test.go`

**Interfaces:**
- Consumes: `enrich.NormalizeMatchText`, `enrich.TokenJaccard` (or duplicate thin wrappers in `words` that call enrich helpers to avoid import cycles — prefer exporting from enrich)
- Produces:

```go
type SenseMatchInput struct {
	ID                  string
	Definition          string
	LocalizedDefinition string
	MeaningOrder        int
}

func AutoMatchSenseID(old SenseMatchInput, candidates []SenseMatchInput) string
```

Returns best candidate ID; empty candidates → `""`. Score = max(Jaccard(oldBlob, candBlob)); ties → lower `MeaningOrder`, then lexical `ID`.

- [ ] **Step 1: Write the failing test**

```go
func TestAutoMatchSenseIDPicksClosest(t *testing.T) {
	old := SenseMatchInput{ID: "old", Definition: "deliberately", LocalizedDefinition: "고의로"}
	cands := []SenseMatchInput{
		{ID: "a", Definition: "to accuse", LocalizedDefinition: "기소하다", MeaningOrder: 1},
		{ID: "b", Definition: "intentionally; deliberately", LocalizedDefinition: "의도적으로", MeaningOrder: 2},
	}
	got := AutoMatchSenseID(old, cands)
	if got != "b" {
		t.Fatalf("got %q want b", got)
	}
}

func TestAutoMatchSenseIDTieBreakMeaningOrder(t *testing.T) {
	old := SenseMatchInput{ID: "old", Definition: "alpha beta", LocalizedDefinition: ""}
	cands := []SenseMatchInput{
		{ID: "z", Definition: "alpha beta", LocalizedDefinition: "", MeaningOrder: 2},
		{ID: "y", Definition: "alpha beta", LocalizedDefinition: "", MeaningOrder: 1},
	}
	if AutoMatchSenseID(old, cands) != "y" {
		t.Fatal("expected lower meaning_order")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/words -run TestAutoMatchSenseID -v
```

Expected: FAIL

- [ ] **Step 3: Implement `sense_match.go`**

```go
package words

import "project-pn/internal/enrich"

type SenseMatchInput struct {
	ID                  string
	Definition          string
	LocalizedDefinition string
	MeaningOrder        int
}

func senseBlob(s SenseMatchInput) string {
	return enrich.NormalizeMatchText(s.Definition + " " + s.LocalizedDefinition)
}

func AutoMatchSenseID(old SenseMatchInput, candidates []SenseMatchInput) string {
	if len(candidates) == 0 {
		return ""
	}
	bestID := candidates[0].ID
	bestScore := enrich.TokenJaccard(senseBlob(old), senseBlob(candidates[0]))
	bestOrder := candidates[0].MeaningOrder
	for i := 1; i < len(candidates); i++ {
		c := candidates[i]
		score := enrich.TokenJaccard(senseBlob(old), senseBlob(c))
		if score > bestScore ||
			(score == bestScore && c.MeaningOrder < bestOrder) ||
			(score == bestScore && c.MeaningOrder == bestOrder && c.ID < bestID) {
			bestID, bestScore, bestOrder = c.ID, score, c.MeaningOrder
		}
	}
	return bestID
}
```

Export `NormalizeMatchText` / `TokenJaccard` from enrich if still unexported.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/words -run TestAutoMatchSenseID -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/words/sense_match.go backend/internal/words/sense_match_test.go backend/internal/enrich/validation.go
git commit -m "feat(words): add auto-match helper for sense remapping"
```

---

### Task 5: Retranslate-all command

**Files:**
- Create: `backend/internal/words/retranslate.go`
- Create: `backend/internal/words/retranslate_test.go`
- Create: `backend/cmd/retranslate-senses/main.go`

**Interfaces:**
- Consumes: `Service.enricher`, pool, `AutoMatchSenseID`, `appendSenses` / persist helpers
- Produces:

```go
func (s *Service) RetranslateWord(ctx context.Context, wordID string) error
```

**Per-word algorithm (must be resume-safe):**
1. Load word row (`language_code`, `normalized_text`, `part_of_speech`).
2. Load old senses + optional `sense_translations` for default display lang.
3. Call `enricher.Enrich` with empty `Existing` (full fresh set) and no source context.
4. In a DB transaction:
   - Insert new senses via existing append path (continue `meaning_order` after max, or insert then renumber — prefer append after current max).
   - Build candidate `SenseMatchInput` from **new** senses only (those just inserted).
   - For each `user_word_senses` whose `word_sense_id` is in the **old** set: `AutoMatchSenseID` → `UPDATE user_word_senses SET word_sense_id = $new`.
   - Conflict resolution: before update, if another active row already has `(user_id, new_id)`, archive the row with lower `review_count` / later `added_at` per Global Constraints, then update the survivor if needed.
   - `DELETE FROM word_senses WHERE word_id = $1 AND id IN (old_ids)` (cascades examples/translations). Only delete old IDs after remaps succeed.
5. If enrich fails, return error and leave old senses untouched.

CLI:

```bash
go run ./cmd/retranslate-senses -limit 0
# flags: -limit N, -word-id UUID (optional single), -dry-run
```

- [ ] **Step 1: Write failing integration test** (skip without `DATABASE_URL`)

```go
func TestRetranslateWordRemapsAndPreservesReviewState(t *testing.T) {
	pool := deckTestPool(t)
	// insert word + 2 near-dup senses + examples
	// insert user_word_senses + review_states with review_count=3
	// stub enricher returns 1 distinct sense matching intent
	svc := /* service with stub */
	if err := svc.RetranslateWord(ctx, wordID); err != nil {
		t.Fatal(err)
	}
	// assert: same user_word_senses.id, new word_sense_id, review_count still 3
	// assert: old sense rows gone; exactly one example on new sense
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable \
  GOTOOLCHAIN=go1.26.0 go test ./internal/words -run TestRetranslateWordRemapsAndPreservesReviewState -v
```

Expected: FAIL — `RetranslateWord` undefined

- [ ] **Step 3: Implement `RetranslateWord` + CLI**

Keep SQL explicit in `retranslate.go`. CLI loads config, opens pool, constructs enricher like `cmd/api`, iterates:

```go
rows, err := pool.Query(ctx, `select id from words order by id`)
```

Log progress; continue on per-word error when `-continue-on-error` set (default false for safety).

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/words/retranslate.go backend/internal/words/retranslate_test.go backend/cmd/retranslate-senses/main.go
git commit -m "feat(words): add retranslate-all senses command with auto-match remap"
```

---

### Task 6: Lookup `source_context` + ranking

**Files:**
- Modify: `backend/internal/enrich/enrich.go` (already has field)
- Modify: `backend/internal/words/service.go` — `Lookup` signature + ranking
- Modify: `backend/internal/http/words_handler.go` — `lookupRequest.SourceContext`
- Test: `backend/internal/words/service_test.go`, `backend/internal/http/words_handler_test.go`

**Interfaces:**
- Produces:

```go
func (s *Service) Lookup(ctx context.Context, userID, text, langCode, defLangCode, sourceContext string, pos *string) (LookupResult, error)
```

Behavior:
- Pass `SourceContext` into `enricher.Enrich` on cache miss and force paths.
- On cache hit with non-empty context: stable-sort `sense_options` by descending `TokenJaccard(context, definition+" "+localized_definition)` (do not drop senses).
- Force-generate continues to append; include context in enrich request.

- [ ] **Step 1: Write failing HTTP test**

```go
func TestLookupAcceptsSourceContext(t *testing.T) {
	// router with stub enricher recording Request.SourceContext
	body := `{"text":"charge","source_context":"Charge the battery overnight.","language_code":"en","display_language_code":"ko"}`
	// POST /api/words/lookup
	// assert stub saw SourceContext
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable \
  GOTOOLCHAIN=go1.26.0 go test ./internal/http -run TestLookupAcceptsSourceContext -v
```

Expected: FAIL (field ignored or not decoded)

- [ ] **Step 3: Implement decode + service plumbing + optional sort helper `rankSenseOptions(options []SenseOption, ctx string)`**

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/http -run TestLookupAcceptsSourceContext -v
cd backend && GOTOOLCHAIN=go1.26.0 go test ./internal/words -run TestLookup -count=1
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/words/service.go backend/internal/http/words_handler.go backend/internal/http/words_handler_test.go
git commit -m "feat(words): accept source_context on lookup and rank senses"
```

---

### Task 7: Persist `source_context` on add learning item

**Files:**
- Modify: `backend/internal/words/service.go` — `AddLearningItem`
- Modify: `backend/internal/http/words_handler.go`
- Test: `backend/internal/http/words_handler_test.go` and/or `backend/internal/words/service_test.go`

**Interfaces:**
- Produces:

```go
func (s *Service) AddLearningItem(ctx context.Context, userID, wordSenseID, displayLangCode, deckID, sourceContext string) (LearningItem, error)
```

Upsert SQL (conceptually):

```sql
insert into user_word_senses (user_id, word_sense_id, deck_id, source_context)
values ($1, $2, $3, nullif($4, ''))
on conflict (user_id, word_sense_id) do update set
  deck_id = excluded.deck_id,
  source_context = coalesce(nullif(excluded.source_context, ''), user_word_senses.source_context),
  updated_at = now()
returning id, word_sense_id, learning_stage;
```

- [ ] **Step 1: Write the failing test**

```go
func TestAddLearningItemPersistsSourceContext(t *testing.T) {
	// arrange: pool, user, senseID
	body := fmt.Sprintf(`{"word_sense_id":%q,"display_language_code":"ko","source_context":"Charge it overnight."}`, senseID)
	// POST /api/learning-items with auth
	var got *string
	err := pool.QueryRow(ctx,
		`select source_context from user_word_senses where user_id=$1 and word_sense_id=$2::uuid`,
		userID, senseID,
	).Scan(&got)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || *got != "Charge it overnight." {
		t.Fatalf("source_context=%v", got)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable \
  GOTOOLCHAIN=go1.26.0 go test ./internal/http -run TestAddLearningItemPersistsSourceContext -v
```

Expected: FAIL — column still null / field not decoded.

- [ ] **Step 3: Implement**

Add `SourceContext string \`json:"source_context"\`` to `addLearningItemRequest`. Thread into `AddLearningItem`. Update the upsert to write `source_context` as above. Update all existing `AddLearningItem(` call sites to pass `""` when unused.

- [ ] **Step 4: Run test to verify it passes**

Same command as Step 2. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/internal/words/service.go backend/internal/http/words_handler.go backend/internal/http/words_handler_test.go
git commit -m "feat(words): persist source_context on learning items"
```

---

### Task 8: Change-meaning API

**Files:**
- Modify: `backend/internal/words/service.go`
- Modify: `backend/internal/words/types.go` — add `ErrSenseConflict` if needed
- Modify: `backend/internal/http/words_handler.go`
- Modify: `backend/internal/http/router.go`
- Test: `backend/internal/words/*_test.go`, `backend/internal/http/words_handler_test.go`

**Interfaces:**
- Produces:

```go
func (s *Service) ChangeLearningItemSense(ctx context.Context, userID, itemID, newWordSenseID, displayLangCode string) (LearningItem, error)
```

Rules:
1. Load item by `id` + `user_id`; 404 if missing.
2. New sense must exist; ensure translations for display lang (same as add).
3. New sense’s word must match current item’s word (`word_id` join).
4. If another **active** (`archived_at is null`) row exists for `(user_id, newWordSenseID)` and its `id != itemID` → `ErrSenseConflict` → HTTP 409.
5. `UPDATE user_word_senses SET word_sense_id = $new, updated_at = now() WHERE id = $item`.
6. Do **not** touch `review_states`.

Route: `PATCH /api/learning-items/{id}` body `{"word_sense_id":"...","display_language_code":"..."}`.

- [ ] **Step 1: Write failing tests** — happy path preserves `review_count`; conflict returns 409; cross-word sense rejected 422

- [ ] **Step 2: Run to fail**

- [ ] **Step 3: Implement service + handler + router**

- [ ] **Step 4: Run to pass**

```bash
cd backend && DATABASE_URL=postgres://project_pn:project_pn_dev_password@localhost:5433/project_pn_dev?sslmode=disable \
  GOTOOLCHAIN=go1.26.0 go test ./internal/words ./internal/http -run 'ChangeLearningItem|ChangeMeaning' -v
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): allow changing learning item sense without resetting schedule"
```

---

### Task 9: Shared API client + types

**Files:**
- Modify: `packages/api/src/types.ts`
- Modify: `packages/api/src/words.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/words.ts`
- Test: existing package/frontend tests if any; add focused unit test for request shaping if present pattern exists

**Interfaces:**
- Produces:

```ts
// LookupRequest
source_context?: string;

// addLearningItem body
source_context?: string;

export function changeLearningItemSense(
  itemId: string,
  wordSenseId: string,
  displayLanguageCode?: string,
): Promise<LearningItem>;
// PATCH /api/learning-items/${itemId}
```

Mirror camelCase options on frontend wrappers: `sourceContext` in `LookupOptions`.

- [ ] **Step 1: Update types and client methods**

- [ ] **Step 2: Run**

```bash
cd packages/api && npm test --if-present
cd frontend && npm test -- --testPathPattern='words|useAddQueue' --passWithNoTests
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api-client): source_context and changeLearningItemSense"
```

---

### Task 10: Manual Add — context + SensePicker (no silent bestMatch)

**Files:**
- Modify: `frontend/src/hooks/useSenseFlow.ts`
- Modify: `frontend/src/components/SensePicker.tsx`
- Modify: `frontend/src/features/add/ManualAddSection.tsx`
- Modify: `frontend/src/i18n/translations.ts`
- Test: `ManualAddSection.test.tsx`, add/extend SensePicker tests if present

**Interfaces:**
- `useSenseFlow.lookup(text, pos, sourceContext, languageCode?)`
- `confirm(wordSenseId, deckId, sourceContext)` → `addLearningItem(..., sourceContext)`
- Manual Add: textarea for context; button “Find my sense” opens picker; **do not** call `enqueue` for the primary one-word path

SensePicker UI rules:
- Show `definition` (target) as primary title
- Show `localized_definition` secondary when different
- Show **first** example only (`examples[0]`)
- Keep “none of these match” → force paths; pass last `sourceContext` on force lookup

- [ ] **Step 1: Write failing RTL test** — entering word+context and confirming calls `lookupWord` with `sourceContext` and `addLearningItem` with selected id + context (mock APIs)

- [ ] **Step 2: Run to fail**

```bash
cd frontend && npm test -- --testPathPattern=ManualAddSection -v
```

- [ ] **Step 3: Implement UI wiring per mockup steps (can be modal steps rather than three full screens)**

- [ ] **Step 4: Run to pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(frontend): manual add context-first sense selection"
```

---

### Task 11: My Words — change meaning

**Files:**
- Create: `frontend/src/features/words/ChangeMeaningSheet.tsx`
- Modify: `frontend/src/features/words/WordDetailScreen.tsx` (preferred entry) and/or `MyWordsScreen.tsx`
- Modify: `frontend/src/i18n/translations.ts`
- Test: `WordDetailScreen.test.tsx` / new sheet test

**Interfaces:**
- On open: `lookupWord(lemma, { languageCode })` (no force) → list senses
- On select: `changeLearningItemSense(item.id, wordSenseId)` then refresh detail/list
- Show 409 error with translated conflict message

- [ ] **Step 1: Failing test** — tap change meaning → select sense → PATCH called; schedule fields unchanged in mocked response handling

- [ ] **Step 2: Run to fail**

- [ ] **Step 3: Implement sheet + entry button**

- [ ] **Step 4: Run to pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(frontend): change word meaning from My Words without reset"
```

---

### Task 12: Practice hierarchy check + docs

**Files:**
- Modify: `frontend/src/features/practice/Flashcard.tsx` only if localized currently outranks target (today target is already primary — verify + tighten styles: target `title`, localized `muted`)
- Modify: `backend/docs/backend-flows.md`
- Modify: `backend/docs/backend-schema-mvp.md` (one example rule; retranslate note)
- Test: `Flashcard.test.tsx` assert target definition renders before/above localized

- [ ] **Step 1: Assert Flashcard order in test; adjust styles if needed**

- [ ] **Step 2: Document Lookup `source_context`, Change-meaning PATCH, retranslate command, one-example invariant in backend docs**

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: document intent-lock flows and confirm target-first practice UI"
```

---

## Spec self-review checklist (author)

| Spec requirement | Task |
|------------------|------|
| Context → select → save | 6, 7, 10 |
| Distinct senses / near-dup collapse | 1, 2, 5 |
| One example per sense + migrate trim | 1, 3, 5 |
| Retranslate all words | 5 |
| Auto-match remap | 4, 5 |
| My Words change meaning, keep schedule | 8, 11 |
| Practice target-first | 12 |
| `source_context` provenance | 7, 10 |
| Capture out of scope | noted in constraints |
| Conflict policies | Global Constraints + Tasks 5, 8 |

## Locked open questions (from spec)

| Topic | Decision in this plan |
|-------|------------------------|
| Similarity metric | Token Jaccard on normalized definition+gloss |
| Low-confidence remap | Still auto-assign; fix in My Words |
| Dual-card collapse | Higher `review_count`, else earlier `added_at`; archive loser |
| Staging | Insert new senses → remap → delete old IDs in one transaction after enrich |
| Capture tab | Follow-up; unchanged `useAddQueue`/`bestMatch` |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-23-add-word-intent-lock.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints  

Which approach?
