import { ApiError } from '../api/client';
import type { TranslationKey } from '../i18n';

export interface AddErrorInfo {
  code: string;
  messageKey: TranslationKey;
  retryable: boolean;
}

const ADD_ERROR_INFO: Record<string, AddErrorInfo> = {
  'ADD-301': { code: 'ADD-301', messageKey: 'add.error.invalidRequest', retryable: false },
  'ADD-302': { code: 'ADD-302', messageKey: 'add.error.senseNotFound', retryable: false },
  'ADD-303': { code: 'ADD-303', messageKey: 'add.error.noAdditionalSense', retryable: false },
  'ADD-304': { code: 'ADD-304', messageKey: 'add.error.translationUnavailable', retryable: false },
  'ADD-305': { code: 'ADD-305', messageKey: 'add.error.deckNotFound', retryable: false },
  'ADD-306': { code: 'ADD-306', messageKey: 'add.error.deckUnavailable', retryable: false },
  'ADD-307': { code: 'ADD-307', messageKey: 'add.error.languageInvalid', retryable: false },
  'ADD-308': { code: 'ADD-308', messageKey: 'add.error.alreadyAdded', retryable: false },
  'ADD-401': { code: 'ADD-401', messageKey: 'add.error.languageUnsupported', retryable: false },
  'ADD-402': { code: 'ADD-402', messageKey: 'add.error.enrichmentUnavailable', retryable: false },
  'ADD-403': { code: 'ADD-403', messageKey: 'add.error.providerUnavailable', retryable: true },
  'ADD-404': { code: 'ADD-404', messageKey: 'add.error.providerInvalid', retryable: true },
  'AUTH-101': { code: 'AUTH-101', messageKey: 'add.error.signInRequired', retryable: false },
  'AUTH-102': { code: 'AUTH-102', messageKey: 'add.error.authUnavailable', retryable: true },
  'AUTH-201': { code: 'AUTH-201', messageKey: 'add.error.emailVerification', retryable: false },
  'AUTH-599': { code: 'AUTH-599', messageKey: 'add.error.unknown', retryable: true },
  'SEC-101': { code: 'SEC-101', messageKey: 'add.error.securityCheck', retryable: true },
  'SEC-102': { code: 'SEC-102', messageKey: 'add.error.securityCheck', retryable: true },
  'SEC-599': { code: 'SEC-599', messageKey: 'add.error.unknown', retryable: true },
};

const UNKNOWN: AddErrorInfo = {
  code: 'ADD-599',
  messageKey: 'add.error.unknown',
  retryable: true,
};

export function classifyAddError(error: unknown): AddErrorInfo {
  if (!(error instanceof ApiError)) {
    return UNKNOWN;
  }
  if (error.status === 0) {
    return { code: 'ADD-101', messageKey: 'add.error.network', retryable: true };
  }
  if (error.code && ADD_ERROR_INFO[error.code]) {
    return ADD_ERROR_INFO[error.code];
  }
  return UNKNOWN;
}
