import {
  formatUnreachableBackendMessage,
  reportUnreachableBackend,
  resetUnreachableBackendReport,
} from './devBackendHint';

describe('devBackendHint', () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    resetUnreachableBackendReport();
  });

  afterEach(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('names the attempted address and points to npm run verify', () => {
    const message = formatUnreachableBackendMessage(['http://localhost:8080']);
    expect(message).toContain('http://localhost:8080');
    expect(message).toContain('npm run verify');
  });

  it('reports in development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const log = jest.fn();
    expect(reportUnreachableBackend({ baseUrls: ['http://localhost:8080'] }, () => 1_000_000, log)).toBe(true);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('http://localhost:8080');
  });

  it('shows no environment hints outside development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const log = jest.fn();
    expect(reportUnreachableBackend({ baseUrls: ['http://localhost:8080'] }, () => 1_000_000, log)).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it('does not repeat within the repeat window', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const log = jest.fn();
    reportUnreachableBackend({ baseUrls: ['x'] }, () => 1_000_000, log);
    expect(reportUnreachableBackend({ baseUrls: ['x'] }, () => 1_000_500, log)).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
