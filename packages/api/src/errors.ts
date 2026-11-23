import { ApiError } from './client';

export type AddErrorCategory =
  | 'not_found'
  | 'translation_missing'
  | 'no_more_senses'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_invalid'
  | 'network'
  | 'auth'
  | 'security'
  | 'conflict'
  | 'validation'
  | 'unknown';

export interface ClassifiedApiError {
  code: string;
  reason?: string;
  category: AddErrorCategory;
  retryable: boolean;
  canManualAdd: boolean;
  fallbackMessage: string;
}

const NETWORK_ERROR: ClassifiedApiError = {
  code: 'ADD-101',
  reason: 'network_error',
  category: 'network',
  retryable: true,
  canManualAdd: false,
  fallbackMessage: 'Could not reach the server. Check your connection and try again.',
};

const TIMEOUT_CLIENT_ERROR: ClassifiedApiError = {
  code: 'ADD-102',
  reason: 'request_timeout',
  category: 'provider_timeout',
  retryable: true,
  canManualAdd: true,
  fallbackMessage: 'Dictionary lookup timed out. Try again or add your own meaning.',
};

const UNKNOWN_ERROR: ClassifiedApiError = {
  code: 'ADD-599',
  category: 'unknown',
  retryable: true,
  canManualAdd: true,
  fallbackMessage: 'Something went wrong while looking up this word. Try again or write your own meaning.',
};

const CLASSIFIED_BY_CODE: Record<string, ClassifiedApiError> = {
  'ADD-101': NETWORK_ERROR,
  'ADD-102': TIMEOUT_CLIENT_ERROR,
  'ADD-301': {
    code: 'ADD-301',
    reason: 'invalid_request',
    category: 'validation',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'The word request is incomplete. Check the word and try again.',
  },
  'ADD-302': {
    code: 'ADD-302',
    reason: 'sense_not_found',
    category: 'validation',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'This meaning is no longer available. Look up the word again.',
  },
  'ADD-303': {
    code: 'ADD-303',
    reason: 'no_additional_senses',
    category: 'no_more_senses',
    retryable: false,
    canManualAdd: true,
    fallbackMessage: 'No additional dictionary meaning was found. You can write your own meaning.',
  },
  'ADD-304': {
    code: 'ADD-304',
    reason: 'translation_unavailable',
    category: 'translation_missing',
    retryable: false,
    canManualAdd: true,
    fallbackMessage: 'No localized meaning was found for this language pair. Enter your own meaning to save.',
  },
  'ADD-305': {
    code: 'ADD-305',
    reason: 'deck_not_found',
    category: 'validation',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'The selected deck no longer exists. Choose another deck and try again.',
  },
  'ADD-306': {
    code: 'ADD-306',
    reason: 'deck_unavailable',
    category: 'validation',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'This deck cannot accept a word from the current learning language.',
  },
  'ADD-307': {
    code: 'ADD-307',
    reason: 'language_invalid',
    category: 'validation',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'Your current learning language is not available. Refresh language settings.',
  },
  'ADD-308': {
    code: 'ADD-308',
    reason: 'already_added',
    category: 'conflict',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'This meaning is already in your learning set.',
  },
  'ADD-309': {
    code: 'ADD-309',
    reason: 'word_not_found',
    category: 'not_found',
    retryable: false,
    canManualAdd: true,
    fallbackMessage: 'Could not find this word in the dictionary. Check the spelling or write your own meaning.',
  },
  'ADD-310': {
    code: 'ADD-310',
    reason: 'personal_meaning_required',
    category: 'validation',
    retryable: false,
    canManualAdd: true,
    fallbackMessage: 'Enter a meaning to save this word.',
  },
  'ADD-401': {
    code: 'ADD-401',
    reason: 'language_unsupported',
    category: 'provider_unavailable',
    retryable: false,
    canManualAdd: true,
    fallbackMessage: 'Automatic dictionary lookup is not available for this language yet. You can write your own meaning.',
  },
  'ADD-402': {
    code: 'ADD-402',
    reason: 'enrichment_not_configured',
    category: 'provider_unavailable',
    retryable: false,
    canManualAdd: true,
    fallbackMessage: 'Automatic dictionary enrichment is currently disabled. You can write your own meaning.',
  },
  'ADD-403': {
    code: 'ADD-403',
    reason: 'provider_unavailable',
    category: 'provider_unavailable',
    retryable: true,
    canManualAdd: true,
    fallbackMessage: 'The dictionary service could not be reached. Try again or write your own meaning.',
  },
  'ADD-404': {
    code: 'ADD-404',
    reason: 'provider_invalid_output',
    category: 'provider_invalid',
    retryable: true,
    canManualAdd: true,
    fallbackMessage: 'The dictionary returned unusable data for this word. Try again or write your own meaning.',
  },
  'ADD-405': {
    code: 'ADD-405',
    reason: 'provider_timeout',
    category: 'provider_timeout',
    retryable: true,
    canManualAdd: true,
    fallbackMessage: 'The dictionary took too long to respond. Try again or write your own meaning.',
  },
  'AUTH-101': {
    code: 'AUTH-101',
    reason: 'unauthorized',
    category: 'auth',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'Your sign-in session expired. Sign in again to add words.',
  },
  'AUTH-102': {
    code: 'AUTH-102',
    reason: 'auth_unavailable',
    category: 'auth',
    retryable: true,
    canManualAdd: false,
    fallbackMessage: 'Sign-in is temporarily unavailable. Try again later.',
  },
  'AUTH-201': {
    code: 'AUTH-201',
    reason: 'email_verification_required',
    category: 'auth',
    retryable: false,
    canManualAdd: false,
    fallbackMessage: 'Email verification is required before adding words.',
  },
  'AUTH-599': {
    code: 'AUTH-599',
    category: 'unknown',
    retryable: true,
    canManualAdd: false,
    fallbackMessage: 'Authentication encountered an unexpected error. Try again.',
  },
  'SEC-101': {
    code: 'SEC-101',
    reason: 'csrf_origin_failed',
    category: 'security',
    retryable: true,
    canManualAdd: false,
    fallbackMessage: 'Your session security check expired. Refresh and try again.',
  },
  'SEC-102': {
    code: 'SEC-102',
    reason: 'csrf_failed',
    category: 'security',
    retryable: true,
    canManualAdd: false,
    fallbackMessage: 'Your session security check expired. Refresh and try again.',
  },
  'SEC-599': {
    code: 'SEC-599',
    category: 'unknown',
    retryable: true,
    canManualAdd: false,
    fallbackMessage: 'Security validation encountered an unexpected error. Refresh and try again.',
  },
  'API-599': {
    code: 'API-599',
    reason: 'invalid_server_response',
    category: 'unknown',
    retryable: true,
    canManualAdd: true,
    fallbackMessage: 'The server returned an unexpected response. Try again or write your own meaning.',
  },
};

export function classifyApiError(error: unknown): ClassifiedApiError {
  if (!(error instanceof ApiError)) {
    return UNKNOWN_ERROR;
  }
  if (error.status === 0) {
    if (error.code === 'ADD-102' || /timed?\s*out/i.test(error.message)) {
      return TIMEOUT_CLIENT_ERROR;
    }
    return NETWORK_ERROR;
  }
  if (error.code && CLASSIFIED_BY_CODE[error.code]) {
    const entry = CLASSIFIED_BY_CODE[error.code];
    return error.reason ? { ...entry, reason: error.reason } : entry;
  }
  if (error.status === 504) {
    return CLASSIFIED_BY_CODE['ADD-405'];
  }
  if (error.status === 401) {
    return CLASSIFIED_BY_CODE['AUTH-101'];
  }
  return UNKNOWN_ERROR;
}
