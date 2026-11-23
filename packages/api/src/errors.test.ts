import { ApiError } from './client';
import { classifyApiError } from './errors';

describe('classifyApiError', () => {
  it('classifies network errors and timeouts separately for status 0', () => {
    expect(classifyApiError(new ApiError(0, 'Network request failed. Is the backend running?'))).toMatchObject({
      code: 'ADD-101',
      category: 'network',
      retryable: true,
      canManualAdd: false,
    });

    expect(classifyApiError(new ApiError(0, 'Request timed out', 'ADD-102', true, 'request_timeout'))).toMatchObject({
      code: 'ADD-102',
      category: 'provider_timeout',
      retryable: true,
      canManualAdd: true,
    });
  });

  it('distinguishes word not found, missing translation, provider outage, and timeout', () => {
    expect(classifyApiError(new ApiError(404, 'word not found', 'ADD-309', false, 'word_not_found'))).toMatchObject({
      code: 'ADD-309',
      reason: 'word_not_found',
      category: 'not_found',
      retryable: false,
      canManualAdd: true,
    });

    expect(classifyApiError(new ApiError(422, 'no localized meaning', 'ADD-304', false, 'translation_unavailable'))).toMatchObject({
      code: 'ADD-304',
      reason: 'translation_unavailable',
      category: 'translation_missing',
      retryable: false,
      canManualAdd: true,
    });

    expect(classifyApiError(new ApiError(503, 'unavailable', 'ADD-403', true, 'provider_unavailable'))).toMatchObject({
      code: 'ADD-403',
      category: 'provider_unavailable',
      retryable: true,
      canManualAdd: true,
    });

    expect(classifyApiError(new ApiError(504, 'timed out', 'ADD-405', true, 'provider_timeout'))).toMatchObject({
      code: 'ADD-405',
      category: 'provider_timeout',
      retryable: true,
      canManualAdd: true,
    });
  });

  it('falls back to ADD-599 for unknown errors', () => {
    expect(classifyApiError(new Error('unexpected failure'))).toMatchObject({
      code: 'ADD-599',
      category: 'unknown',
      retryable: true,
      canManualAdd: true,
    });
  });

  it.each([
    'ADD-101', 'ADD-102', 'ADD-301', 'ADD-302', 'ADD-303', 'ADD-304', 'ADD-305',
    'ADD-306', 'ADD-307', 'ADD-308', 'ADD-309', 'ADD-310', 'ADD-401', 'ADD-402',
    'ADD-403', 'ADD-404', 'ADD-405', 'AUTH-101', 'AUTH-102', 'AUTH-201', 'SEC-101',
    'SEC-102', 'API-599',
  ])('keeps known code %s distinct', (code) => {
    expect(classifyApiError(new ApiError(400, 'err', code)).code).toBe(code);
  });
});
