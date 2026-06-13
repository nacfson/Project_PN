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
  translation: string | null;
}

export interface SenseOption {
  word_id: string;
  word_sense_id: string;
  language_code: string;
  lemma: string;
  normalized_text: string;
  part_of_speech: string;
  definition_language_code: string;
  definition: string;
  short_definition: string | null;
  cefr_level: string | null;
  meaning_order: number;
  examples: Example[];
}

export interface LookupRequest {
  text: string;
  language_code?: string;
  definition_language_code?: string;
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
