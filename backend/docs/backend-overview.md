# Backend Overview

## Product Goal

Build a personal vocabulary learning system where users add words they do not know, then study those words through evidence-based methods:

- active recall
- spaced repetition
- contextual examples
- repeated retrieval
- productive use through writing or speaking
- progress tracking based on memory strength, not only streaks

The backend should not only store vocabulary. It should store each user's learning state for each meaning they are trying to learn.

## Core Design Principle

A word is global, but memory is personal.

More specifically, the learnable unit is a user's relationship to a word sense, not only a user's relationship to a word.

For example, the word `charge` can mean:

- to ask someone to pay an amount of money
- to accuse someone officially of a crime
- to store electrical energy in a device

One user may know the payment meaning but not the legal meaning. Another user may learn all three meanings on different schedules. Because of that, review scheduling and mastery must be attached to a user-owned word sense.

## Backend Target

The MVP backend target is local PostgreSQL.

Use:

- `pgcrypto` for UUID primary keys
- normal foreign keys, unique constraints, and check constraints
- app-owned `users` table
- application-layer authentication/session handling

Do not assume:

- Supabase Auth
- Supabase Row Level Security
- Firebase Auth
- client-direct database access

## MVP Boundary

Build only the lean MVP schema until the user explicitly expands scope. The MVP schema is defined in `backend/docs/backend-schema-mvp.md`.

Future expansion tables and rules are defined in `backend/docs/backend-future-scope.md`.
