import { msUntilRefresh, shouldRefreshProactively } from './sessionRenewal';

describe('sessionRenewal utils', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns delay until refresh buffer', () => {
    const expiresAt = new Date(now + 20 * 60 * 1000).toISOString();
    expect(msUntilRefresh(expiresAt)).toBe(15 * 60 * 1000);
  });

  it('returns zero when inside refresh buffer', () => {
    const expiresAt = new Date(now + 2 * 60 * 1000).toISOString();
    expect(msUntilRefresh(expiresAt)).toBe(0);
  });

  it('detects proactive refresh threshold', () => {
    expect(shouldRefreshProactively(new Date(now + 5 * 60 * 1000).toISOString())).toBe(true);
    expect(shouldRefreshProactively(new Date(now + 30 * 60 * 1000).toISOString())).toBe(false);
  });
});
