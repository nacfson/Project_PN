# Frontend Features

## Overview
Groups the frontend's vertical feature modules (screens, feature-scoped UI components, hooks, and pure domain helpers) separated by learner workflow: vocabulary addition, authentication helpers, Anki import, home learning summary, spaced-repetition practice, profile/settings management, web-only desktop chrome, and word/deck library management.

## Subdirectories & Boundaries
- [Add Feature](./add/README.md) - Manual word/phrase lookup, passage span capture queue, and searchable target deck selector.
- [Auth Feature](./auth/README.md) - Account merge confirmation screen, Brand Pulse auth loading card, visitor guest banner, and in-memory auth profile change event bus.
- [Import Feature](./import/README.md) - Anki CSV paste, preview, per-card conflict resolution, and batch import workflow.
- [Learn Feature](./learn/README.md) - Today/Home dashboard, due-review preview, six-stage mastery bar, and pure daily summary helpers.
- [Practice Feature](./practice/README.md) - Interactive spaced-repetition review sessions, 3D swipeable flashcards, batch review syncing, and queue/progress state helpers.
- [Profile Feature](./profile/README.md) - Settings, connected accounts, language-pair management, daily XP goal/retention tuning, and streak controls.
- [Web Feature](./web/README.md) - Web-only desktop floating command dock and slide-over inspector drawer.
- [Words Feature](./words/README.md) - Vocabulary library list/table, deck management, word detail view, meaning/personal-note editing, and cursor pagination.
