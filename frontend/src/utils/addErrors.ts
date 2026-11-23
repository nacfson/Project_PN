import { classifyApiError, type AddErrorCategory } from '@project-pn/api';
import type { TranslationKey } from '../i18n';

export type { AddErrorCategory };

export interface AddErrorInfo {
  code: string;
  reason?: string;
  category: AddErrorCategory;
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  retryable: boolean;
  canManualAdd: boolean;
}

const I18N_BY_CODE: Record<string, { titleKey: TranslationKey; messageKey: TranslationKey }> = {
  'ADD-101': { titleKey: 'add.error.networkTitle', messageKey: 'add.error.network' },
  'ADD-102': { titleKey: 'add.error.providerTimeoutTitle', messageKey: 'add.error.providerTimeout' },
  'ADD-301': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.invalidRequest' },
  'ADD-302': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.senseNotFound' },
  'ADD-303': { titleKey: 'add.error.noAdditionalSenseTitle', messageKey: 'add.error.noAdditionalSense' },
  'ADD-304': { titleKey: 'add.error.translationUnavailableTitle', messageKey: 'add.error.translationUnavailable' },
  'ADD-305': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.deckNotFound' },
  'ADD-306': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.deckUnavailable' },
  'ADD-307': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.languageInvalid' },
  'ADD-308': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.alreadyAdded' },
  'ADD-309': { titleKey: 'add.error.wordNotFoundTitle', messageKey: 'add.error.wordNotFound' },
  'ADD-310': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.personalMeaningRequired' },
  'ADD-401': { titleKey: 'add.error.languageUnsupportedTitle', messageKey: 'add.error.languageUnsupported' },
  'ADD-402': { titleKey: 'add.error.enrichmentUnavailableTitle', messageKey: 'add.error.enrichmentUnavailable' },
  'ADD-403': { titleKey: 'add.error.providerUnavailableTitle', messageKey: 'add.error.providerUnavailable' },
  'ADD-404': { titleKey: 'add.error.providerInvalidTitle', messageKey: 'add.error.providerInvalid' },
  'ADD-405': { titleKey: 'add.error.providerTimeoutTitle', messageKey: 'add.error.providerTimeout' },
  'AUTH-101': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.signInRequired' },
  'AUTH-102': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.authUnavailable' },
  'AUTH-201': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.signInRequired' },
  'AUTH-599': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.unknown' },
  'SEC-101': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.securityCheck' },
  'SEC-102': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.securityCheck' },
  'SEC-599': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.unknown' },
  'API-599': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.unknown' },
  'ADD-599': { titleKey: 'add.error.genericTitle', messageKey: 'add.error.unknown' },
};

export function classifyAddError(error: unknown): AddErrorInfo {
  const classified = classifyApiError(error);
  const copy = I18N_BY_CODE[classified.code] ?? I18N_BY_CODE['ADD-599'];
  return {
    code: classified.code,
    reason: classified.reason,
    category: classified.category,
    titleKey: copy.titleKey,
    messageKey: copy.messageKey,
    retryable: classified.retryable,
    canManualAdd: classified.canManualAdd,
  };
}
