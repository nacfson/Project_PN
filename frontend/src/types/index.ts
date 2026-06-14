// DTOs mirroring the Go backend (backend/internal/words/types.go) exactly.

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
}

export interface LearningItemsPage {
  items: LearningItemListItem[];
  next_cursor: string | null;
}

export interface ReviewAttemptParams {
  user_word_sense_id: string;
  activity_type: string;
  prompt: string | null;
  user_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  rating_score: number; // raw float score 0.0 to 3.0
  response_time_ms: number | null;
  confidence_rating: number | null;
}

export interface DueItem {
  user_word_sense_id: string;
  word_sense_id: string;
  word_id: string;
  language_code: string;
  lemma: string;
  normalized_text: string;
  part_of_speech: string;
  display_language_code: string;
  definition: string;
  short_definition: string | null;
  localized_definition: string;
  localized_short_definition: string | null;
  cefr_level: string | null;
  meaning_order: number;
  learning_stage: string;
  due_at: string;
  examples: Example[];
}

export interface BatchReviewResult {
  xp_earned: number;
  success: boolean;
}

