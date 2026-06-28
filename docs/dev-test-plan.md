# Project PN — Local Dev Manual Test Plan

## Purpose

Test the full local web stack while treating the account/login system as a dev-only formality. A single pre-authenticated guest account is assumed so QA can focus on vocabulary flows.

## Scope

- **In scope**: onboarding bypass, add word, capture passage, Anki import, browse words, word detail, practice/review, language pairs, deck CRUD, settings, logout.
- **Out of scope**: real email delivery, Google OAuth, magic-link flows, push notifications.

## Assumptions

- `scripts/start-web-dev.sh` is running (PostgreSQL, migrations, Go API, Expo web).
- Docker Desktop is available and healthy.
- The dev script overrides `EXPO_PUBLIC_API_BASE_URL` to `http://localhost:8080`, so a stale `frontend/.env` pointing at a deploy server will not break local testing.
- Word enrichment is optional: lookups return data if cached; otherwise they return 503 unless `ENRICH_BASE_URL` is configured.

---

## 1. Guest account setup

`scripts/start-web-dev.sh` seeds the local guest account automatically after migrations, and the frontend auto-logs in as the guest when running a **dev build against a local API**. The seed is **not a migration** and is only applied by the local dev script, so it will never run on deployed environments.

The seed creates a verified session for the existing dev user (migration `000002`) using the plain token `local-dev-guest`. Because the local Postgres volume persists across restarts, the guest account data remains available until the Docker volume is removed.

### 1.1 First load

1. Start the stack with `scripts/start-web-dev.sh`.
2. Open `http://localhost:8081`.
3. Complete or skip onboarding.

**Expected result**: After onboarding, the app auto-logs in as the guest and `RootNavigator` renders the main tab bar (Learn, Words, Add, Practice, Settings).

### 1.2 Manual re-seed

If you ever reset the local database or want to re-run the seed by hand:

```bash
scripts/seed-dev-guest.sh
```

To start the dev stack without seeding, pass `--skip-seed`:

```bash
scripts/start-web-dev.sh --skip-seed
```

---

## 2. Test scenarios

### S1 — Onboarding

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Clear site storage / open incognito. | App starts fresh. |
| 2 | Load `http://localhost:8081`. | Three onboarding slides appear. |
| 3 | Tap **Skip** or complete the flow. | Onboarding closes; app auto-logs in as guest. |
| 4 | Confirm main tabs appear. | `RootNavigator` is rendered. |
| 5 | Reload again. | Onboarding does not reappear; app remains logged in. |

**Note**: To test the real login screen, pass `--skip-seed` when starting the stack or start a production build.

---

### S2 — Add a word from the modal

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Open **Add Word** from **Home** or **Add → Manual**. | `AddWordModal` opens as a bottom sheet. |
| 2 | Confirm the default deck is selected (`en (Default)`). | Deck selector shows the active default deck. |
| 3 | Type a cached word, e.g. `apple`. | Lookup returns senses and examples. |
| 4 | Tap **Add**. | Modal closes; toast shows `Added "apple" to en (Default)`. |
| 5 | Go to **Words** tab. | The new item appears in the list. |
| 6 | Tap the item. | `WordDetailScreen` shows target-language example with the word emphasized and the start-language meaning. |

**With enricher disabled**: if the word is not cached, lookup returns an error toast or silent failure per the current implementation. For a stable test, seed a few words/examples first or configure `ENRICH_BASE_URL`.

---

### S3 — Capture passage flow

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Go to **Add → Capture**. | `CaptureScreen` appears with a passage input. |
| 2 | Paste a short sentence in the target language. | Text renders; words are tappable. |
| 3 | Tap one or more words, then tap **Add selected**. | `QueueBanner` shows the queue progressing. |
| 4 | Wait for the queue to finish. | Words appear in **Words** tab. |
| 5 | Return to **Home**. | Capture re-entry card shows the last passage. |

---

### S4 — Anki import

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Go to **Add → Import**. | `AnkiImportScreen` appears. |
| 2 | Paste a small Anki CSV export. | Preview list renders rows. |
| 3 | If conflicts appear, choose an action (skip / overwrite / merge). | Conflicts resolve in preview. |
| 4 | Tap **Import**. | Import completes; count message appears. |
| 5 | Go to **Words** tab. | Imported items appear. |

---

### S5 — Browse words

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Go to **Words** tab. | List loads with learning items. |
| 2 | Pull to refresh / tap reload. | List refreshes without a full blank state. |
| 3 | Type a prefix in the search field. | List filters to matching words (server-side prefix search). |
| 4 | Scroll to the bottom. | Next page loads if more than 50 items exist. |
| 5 | Tap a word. | `WordDetailScreen` opens with examples and scheduling info. |

---

### S6 — Practice session

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Add at least one word and, if needed, backdate its `review_states.due_at` in the DB so it is due. | `GET /api/reviews/due` returns the item. |
| 2 | Go to **Practice** tab. | Practice loads the due card. |
| 3 | For a typing card, type the target word and submit. | Answer reveals; grading buttons appear. |
| 4 | Tap **Good**. | Next card loads; stats update. |
| 5 | Complete all due cards. | Completion screen appears. |
| 6 | Return to **Home**. | Due count decreased; daily progress updated. |

**Note**: New cards are not due immediately by default. For quick practice tests, seed a due item or adjust `review_states.due_at` directly in Postgres.

---

### S7 — Language pairs

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Go to **Settings → Language pairs**. | Existing active pair (`en → ko`) is listed. |
| 2 | Tap **Add language pair**. | Choose a new target language (e.g. `ja`) and display language `ko`. |
| 3 | Save. | New pair appears; app can switch to it. |
| 4 | Tap the new pair and set it active. | Home / Words / Add reflect the new target language. |
| 5 | Remove the new pair. | Pair is deleted; app returns to the original active pair. |

---

### S8 — Settings persistence

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Change **Daily goal**, **Desired retention**, and **Theme**. | UI updates immediately. |
| 2 | Toggle **Vacation mode** / streak freeze if available. | Toggle state persists. |
| 3 | Change **App language** to `ko`. | UI strings switch to Korean. |
| 4 | Reload the page. | All settings survive reload. |

---

### S9 — Logout

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Go to **Settings**. | Profile / logout option visible. |
| 2 | Tap **Logout**. | Token is removed; app returns to `LoginScreen`. |
| 3 | Reload the page. | Dev auto-login runs again; app returns to main tabs. |

**Note**: Auto-login is suppressed for the rest of the session after an explicit logout, so step 2 is the only chance to inspect `LoginScreen` without `--skip-seed`.

---

### S10 — Deck management in the Words tab

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Go to **Words** tab. | A horizontal deck chip row appears: **All decks**, the default deck (`en (Default)`), and **New deck**. |
| 2 | Tap **New deck**. | `DeckFormModal` opens with title **Create deck**. |
| 3 | Leave the name empty and try to submit. | The submit button is disabled. |
| 4 | Type a name over 120 characters. | The submit button becomes disabled (or inline validation appears). |
| 5 | Type a unique name, e.g. `Fruits`, and tap **Create deck**. | Modal closes; the new `Fruits` chip appears with count `0`. |
| 6 | Add a word to the new deck via **Add → Manual** or the **Home** add button. | In `AddWordModal`, the deck selector cycles to `Fruits`; after adding, the word lands in that deck. |
| 7 | Return to **Words** and tap the `Fruits` chip. | Only the word added to `Fruits` appears; the count chips update. |
| 8 | Tap **All decks**. | Every learning item across all decks is shown. |
| 9 | Tap the edit icon on `Fruits`. | `DeckFormModal` opens with **Rename deck**. |
| 10 | Change the name to `Berries` and save. | The chip updates to `Berries` (count unchanged). |
| 11 | Try renaming `Berries` to the same name as the default deck. | Inline API error is shown; rename is rejected. |
| 12 | Open rename for `Berries` and tap **Delete deck**, then confirm. | The deck is removed; its items move to the default deck; default-deck count increases. |
| 13 | Open rename for the default deck. | **Delete deck** is not offered; renaming is allowed but deletion is blocked. |

**Precondition helper**: if no cached words are available or the enricher is off, use the SQL in **3.3 Seed a custom deck with an item** so the deck selector and filter have data to show.

---

## 3. Test data helpers

### 3.1 Make a card due immediately

```sql
update review_states
set due_at = now() - interval '1 minute'
where id in (
    select rs.id
    from review_states rs
    join user_word_senses uws on uws.id = rs.user_word_sense_id
    join word_senses ws on ws.id = uws.word_sense_id
    join words w on w.id = ws.word_id
    where uws.user_id = '00000000-0000-0000-0000-000000000001'
    limit 1
);
```

### 3.2 Seed a cached word (optional)

Useful when the enricher is not configured:

```sql
insert into words (id, language_code, text, normalized_text, part_of_speech)
values (gen_random_uuid(), 'en', 'apple', 'apple', 'noun');

-- Then add senses/examples and translations as needed.
```

### 3.3 Seed a custom deck with an item

Useful for exercising the Words tab deck chips and filters without configuring the enricher:

```sql
-- Create a custom deck for the dev user and active target language.
insert into decks (id, user_id, target_language, name, is_default)
values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    'en',
    'Fruits',
    false
);

-- Move one active learning item into the new deck.
-- (Run this after at least one user_word_senses row exists.)
update user_word_senses
set deck_id = (
    select id
    from decks
    where user_id = '00000000-0000-0000-0000-000000000001'
      and target_language = 'en'
      and name = 'Fruits'
)
where id = (
    select id
    from user_word_senses
    where user_id = '00000000-0000-0000-0000-000000000001'
      and archived_at is null
    limit 1
);
```

---

## 4. Known gaps and workarounds

| Gap | Workaround |
|-----|------------|
| No production guest mode. | Local dev builds auto-log in as the seeded guest; production still requires normal auth. |
| No seeded vocabulary; enricher may be off. | Seed words/examples manually or configure `ENRICH_BASE_URL`. |
| New cards are not due immediately. | Backdate `review_states.due_at` in SQL for practice tests. |
| Email verification is required by middleware. | Mark the dev user as verified in SQL. |
| Deck CRUD endpoints exist but bulk item-move has no UI. | Move items between decks via the API or SQL for now. |
| Push notifications are not wired. | Out of scope for manual dev QA. |

---

## 5. Sign-off checklist

Use this checklist before considering the local build ready for the next feature:

- [ ] Stack starts cleanly with `scripts/start-web-dev.sh`.
- [ ] App auto-logs in as the guest after onboarding.
- [ ] Add word from the modal succeeds and shows the added toast.
- [ ] Added word appears in **Words** with correct target/start language emphasis.
- [ ] Practice session can be completed for at least one due item.
- [ ] Create, rename, filter, and delete a deck from the **Words** tab works as expected.
- [ ] Language pair add / activate / remove works.
- [ ] Settings survive a page reload.
- [ ] Logout returns to `LoginScreen`; re-injecting token restores access.

---

## 6. Future improvements

- Add a dev-only `/api/auth/dev-guest` endpoint or frontend dev flag so testers do not need SQL.
- Seed a small canned dictionary and one due card as part of migrations for deterministic manual QA.
- Add a "make due" dev action in the UI (hidden behind `__DEV__`).
