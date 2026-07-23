// DTOs shared between the frontend and browser extension.
// Keep this file platform-agnostic: no React Native or extension imports.

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'determiner';

// "Any" is a UI/lookup-only filter value. It is never persisted and never
// sent to POST /api/learning-items.
export type PosFilter = PartOfSpeech | 'Any';

export interface Example {
  sentence: string;
  difficulty: string | null;
  localized_translation: string | null;
}

export interface SenseOption {
  word_id: string;
  word_sense_id: string;
  language_code: string;
  lemma: string;
  normalized_text: string;
  part_of_speech: string;
  pronunciation: string | null;
  display_language_code: string;
  definition: string;
  short_definition: string | null;
  localized_definition: string;
  localized_short_definition: string | null;
  cefr_level: string | null;
  meaning_order: number;
  examples: Example[];
}

export interface LookupRequest {
  text: string;
  language_code?: string;
  display_language_code?: string;
  part_of_speech?: string;
  word_id?: string;
  force?: boolean;
  source_context?: string;
}

export interface LookupResponse {
  query: string;
  normalized_text: string;
  sense_options: SenseOption[];
}

export interface LearningItem {
  id: string;
  word_sense_id: string;
  learning_stage: string;
  due_at: string;
}

export interface LearningItemListItem {
  id: string;
  word_sense_id: string;
  word_id: string;
  language_code: string;
  lemma: string;
  normalized_text: string;
  part_of_speech: string;
  pronunciation: string | null;
  display_language_code: string;
  definition: string;
  short_definition: string | null;
  localized_definition: string;
  localized_short_definition: string | null;
  cefr_level: string | null;
  meaning_order: number;
  learning_stage: string;
  due_at: string;
  added_at: string;
  deck_id?: string | null;
  deck_name?: string | null;
  last_reviewed_at?: string | null;
  examples: Example[];
}

export interface LearningItemsPage {
  items: LearningItemListItem[];
  next_cursor: string | null;
}

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

export type ReviewActivityType =
  | 'word_to_meaning'
  | 'meaning_to_word'
  | 'cloze'
  | 'multiple_choice'
  | 'typing'
  | 'speaking'
  | 'writing'
  | 'sentence_creation';

export interface ReviewAttemptParams {
  user_word_sense_id: string;
  activity_type: ReviewActivityType;
  prompt: string | null;
  user_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  rating_score: number;
  response_time_ms: number | null;
  confidence_rating: number | null;
}

export interface BatchReviewResult {
  xp_earned: number;
  success: boolean;
}

export interface DueItem {
  user_word_sense_id: string;
  word_sense_id: string;
  word_id: string;
  language_code: string;
  lemma: string;
  normalized_text: string;
  part_of_speech: string;
  pronunciation: string | null;
  display_language_code: string;
  definition: string;
  short_definition: string | null;
  localized_definition: string;
  localized_short_definition: string | null;
  cefr_level: string | null;
  meaning_order: number;
  learning_stage: string;
  due_at: string;
  preview_intervals?: {
    again: string;
    hard: string;
    good: string;
    easy: string;
  };
  examples: Example[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SessionResponse {
  token: string;
  expires_at: string;
}

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

export interface LanguagePair {
  target_language: string;
  definition_language: string;
}

export interface AllowedLanguages {
  target_languages: string[];
  definition_languages: string[];
  ui_languages: string[];
}

export interface LanguageOptionsResponse {
  defaults: LanguagePair;
  allowed: AllowedLanguages;
  forced: LanguagePair;
  ui_defaults: string;
  ui_forced: string;
}

export interface UpdateLanguagePairRequest {
  new_target_language: string;
  display_language: string;
}
