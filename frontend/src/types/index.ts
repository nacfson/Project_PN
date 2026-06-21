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
  examples: Example[];
}

export interface LearningItemsPage {
  items: LearningItemListItem[];
  next_cursor: string | null;
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

export interface ReviewSettings {
  user_id: string;
  new_cards_per_day: number;
  reviews_per_day: number;
  learning_steps: number[];
  relearning_steps: number[];
  leech_threshold: number;
  leech_action: string;
  fuzz_enabled: boolean;
  desired_retention: number;
  daily_goal_xp: number;
  fsrs_weights: number[];
  weights_optimized_at: string | null;
  weights_review_count: number;
}

export interface StatsForecastDay {
  date: string;
  count: number;
}

export interface StatsSummary {
  review_streak_days: number;
  longest_streak_days: number;
  streak_freeze_tokens: number;
  vacation_mode_active: boolean;
  streak_at_risk: boolean;
  daily_goal_xp: number;
  reviews_today: number;
  correct_today: number;
  due_today: number;
  stage_counts: Record<string, number>;
  forecast: StatsForecastDay[];
}

export interface StreakSettings {
  current_streak_days: number;
  longest_streak_days: number;
  streak_freeze_tokens: number;
  vacation_mode_until: string | null;
  vacation_mode_active: boolean;
  streak_at_risk: boolean;
}

export interface AnkiCard {
  front: string;
  back: string;
  tags?: string;
  action?: ImportAction;
}

export type ImportAction = 'add' | 'overwrite_meaning' | 'create_new_meaning' | 'skip';

export interface ImportPreviewItem {
  index: number;
  front: string;
  back: string;
  status: 'new_word' | 'existing_word_match' | 'conflict';
  matched_senses: SenseOption[];
  suggested_action: ImportAction;
}

export interface ImportPreviewResponse {
  cards: AnkiCard[];
  items: ImportPreviewItem[];
}

export interface AnkiImportRequest {
  cards: AnkiCard[];
  language_code: string;
  definition_language_code: string;
}

export interface ImportError {
  index: number;
  front: string;
  error: string;
}

export interface AnkiImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
}
