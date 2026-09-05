import { ApiError } from '../api/client';
import { classifyAddError } from './addErrors';

describe('classifyAddError', () => {
  it('identifies a no-response failure as a retryable network error', () => {
    expect(classifyAddError(new ApiError(0, 'Network request failed. Is the backend running?'))).toEqual({
      code: 'ADD-101',
      messageKey: 'add.error.network',
      retryable: true,
    });
  });

  it('identifies a translation gap from the API code', () => {
    expect(classifyAddError(new ApiError(422, 'localized translation unavailable', 'ADD-304', false))).toEqual({
      code: 'ADD-304',
      messageKey: 'add.error.translationUnavailable',
      retryable: false,
    });
  });

  it('labels an error without a known cause as unknown instead of misclassifying it', () => {
    expect(classifyAddError(new Error('proxy returned invalid HTML'))).toEqual({
      code: 'ADD-599',
      messageKey: 'add.error.unknown',
      retryable: true,
    });
  });

  it.each([
    'ADD-301', 'ADD-302', 'ADD-303', 'ADD-304', 'ADD-305', 'ADD-306', 'ADD-307', 'ADD-308',
    'ADD-401', 'ADD-402', 'ADD-403', 'ADD-404', 'AUTH-101', 'AUTH-102', 'AUTH-201', 'SEC-101', 'SEC-102',
  ])('keeps known code %s distinct from the unknown bucket', (code) => {
    expect(classifyAddError(new ApiError(400, 'known error', code)).code).toBe(code);
  });
});
