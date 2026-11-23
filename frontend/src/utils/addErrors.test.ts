import { ApiError } from '../api/client';
import { classifyAddError } from './addErrors';

describe('classifyAddError', () => {
  it('identifies a no-response failure as a retryable network error', () => {
    expect(classifyAddError(new ApiError(0, 'Network request failed. Is the backend running?'))).toMatchObject({
      code: 'ADD-101',
      category: 'network',
      titleKey: 'add.error.networkTitle',
      messageKey: 'add.error.network',
      retryable: true,
      canManualAdd: false,
    });
  });

  it('identifies client timeout as ADD-102', () => {
    expect(classifyAddError(new ApiError(0, 'Request timed out', 'ADD-102', true, 'request_timeout'))).toMatchObject({
      code: 'ADD-102',
      category: 'provider_timeout',
      titleKey: 'add.error.providerTimeoutTitle',
      messageKey: 'add.error.providerTimeout',
      retryable: true,
      canManualAdd: true,
    });
  });

  it('identifies a translation gap and word-not-found explicitly', () => {
    expect(classifyAddError(new ApiError(422, 'localized translation unavailable', 'ADD-304', false))).toMatchObject({
      code: 'ADD-304',
      category: 'translation_missing',
      titleKey: 'add.error.translationUnavailableTitle',
      messageKey: 'add.error.translationUnavailable',
      retryable: false,
      canManualAdd: true,
    });

    expect(classifyAddError(new ApiError(404, 'word not found', 'ADD-309', false, 'word_not_found'))).toMatchObject({
      code: 'ADD-309',
      category: 'not_found',
      titleKey: 'add.error.wordNotFoundTitle',
      messageKey: 'add.error.wordNotFound',
      retryable: false,
      canManualAdd: true,
    });
  });

  it('labels an error without a known cause as unknown instead of misclassifying it', () => {
    expect(classifyAddError(new Error('proxy returned invalid HTML'))).toMatchObject({
      code: 'ADD-599',
      category: 'unknown',
      titleKey: 'add.error.genericTitle',
      messageKey: 'add.error.unknown',
      retryable: true,
    });
  });

  it.each([
    'ADD-101', 'ADD-102', 'ADD-301', 'ADD-302', 'ADD-303', 'ADD-304', 'ADD-305', 'ADD-306', 'ADD-307', 'ADD-308',
    'ADD-309', 'ADD-310', 'ADD-401', 'ADD-402', 'ADD-403', 'ADD-404', 'ADD-405',
    'AUTH-101', 'AUTH-102', 'AUTH-201', 'SEC-101', 'SEC-102', 'API-599',
  ])('keeps known code %s distinct from the unknown bucket', (code) => {
    expect(classifyAddError(new ApiError(400, 'known error', code)).code).toBe(code);
  });
});
