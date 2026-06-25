# UI Translation Audit Report

## Scope
Audited every user-facing string in the React Native / Expo frontend:
- Translation dictionaries: `frontend/src/i18n/translations.ts` (English + Korean)
- All `t(...)` usages across `frontend/src/**/*.{ts,tsx}`
- JSX text nodes and hardcoded string literals used for labels / placeholders / messages

The working tree already contained unrelated in-progress changes (an email-verification auth refactor). Those new strings were audited and corrected as part of this pass.

## Method
1. Scanned 66 source files with the TypeScript AST.
2. Built a usage map of 202 unique translation keys.
3. Flagged 18 unused keys (mostly dynamic `pos.*` / `home.stage.*` and a handful of currently unused auth strings).
4. Checked every en/ko pair for spelling, grammar, placeholder parity, and tone consistency.

## Issues found and fixed

### Korean typos
| Key | Before | After |
|-----|--------|-------|
| `import.skip` | 걸러뛰기 | 건너뛰기 |
| `onboarding.skip` | 걸러뛰기 | 건너뛰기 |
| `import.summary` | 가져옴: {imported}, 건 넘김: {skipped}, 실패: {failed} | 가져옴: {imported}, 건너뜀: {skipped}, 실패: {failed} |
| `import.pasteInstructions` | 아래에 Anki CSV 낸 내용을 붙여넣으세요: | 아래에 Anki CSV 내보낸 내용을 붙여넣으세요: |
| `auth.verifyEmailMessage` | {email}(으)로 인증 링크를 볃습니다. 링크를 열어 계속하세요. | {email}(으)로 인증 링크를 보냈습니다. 링크를 열어 계속하세요. |
| `auth.resendVerification` | 인증 메일 다시 볂기 | 인증 메일 다시 보내기 |
| `auth.verificationSent` | 인증 메일을 볃습니다 | 인증 메일을 보냈습니다 |
| `auth.verificationFailed` | 인증 메일을 별 수 없습니다 | 인증 메일을 보낼 수 없습니다 |

### English grammar / consistency
| Key | Before | After |
|-----|--------|-------|
| `home.startReview` | Start {count} card review | Start {count}-card review |
| `home.streakFreezeAvailable` | {count} streak freeze available | Streak freezes available: {count} |
| `practice.noExample` | No example sentence. Use definition to recall. | No example sentence. Use the definition to recall. |

### Untranslated UI text
- **Part-of-speech badges** in `SensePicker`, `Flashcard`, and `MyWordsScreen` were showing raw English POS values (`noun`, `verb`, etc.). They now use the existing `pos.*` translation keys.
- **`Learner` fallback** in `HomeScreen` (used when the user email has no local part) was hardcoded English. Added `common.learner` and translated it to `학습자`.

### Removed unused keys
The following keys were present in the dictionaries but not used anywhere in the codebase:
- `common.cancel`
- `home.tapToStart`
- `import.or`
- `settings.vacationMode`

### Speech-level consistency note
Most of the app uses a polite `-요`/해요체 style. A few older strings still end in formal `습니다` (mainly error messages). They are understandable, but for a fully consistent voice those messages could be converted to `요` style in a future polish pass.

## Validation
- `frontend/src/i18n/translations.ts` parses with 0 TypeScript parse diagnostics.
- All placeholders match between English and Korean (the one expected exception is `queue.adding`, where English passes a `plural` helper that Korean does not need).
- `npx tsc --noEmit` reports no errors in the changed files (`translations.ts`, `HomeScreen.tsx`, `SensePicker.tsx`, `Flashcard.tsx`, `MyWordsScreen.tsx`). Pre-existing unrelated type errors remain elsewhere in the project.

## Recommendations
1. **Language names in `frontend/src/config.ts`** (`SUPPORTED_LANGUAGES`) are still hardcoded in English and used as button labels. Consider localizing them with the existing `language.*` keys.
2. **Smart quotes** around example sentences (`&ldquo;` / `&rdquo;`) render correctly on web but are not routed through translations; confirm they render as expected on native builds.
3. Standardize the remaining `습니다` error strings to `요` style if the product voice should be uniformly casual-polite.
