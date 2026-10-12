/**
 * Development-only diagnostics for an unreachable backend (spec 002, FR-010).
 * Environment hints are only produced when running with __DEV__.
 */

const REPEAT_WINDOW_MS = 10_000;
let lastReportedAt = 0;

export function formatUnreachableBackendMessage(baseUrls: string[]): string {
  const attempted = baseUrls.length > 0 ? baseUrls.join(', ') : '(no API base URL configured)';
  return (
    `[Project PN] Backend unreachable at ${attempted}. ` +
    'The API server or database may not be running. ' +
    'Run `npm run verify` from the repo root to see which part of the local stack is down.'
  );
}

export function reportUnreachableBackend(
  info: { baseUrls: string[] },
  now: () => number = Date.now,
  log: (message: string) => void = (message) => console.error(message),
): boolean {
  if (!__DEV__) {
    return false;
  }
  const current = now();
  if (current - lastReportedAt < REPEAT_WINDOW_MS) {
    return false;
  }
  lastReportedAt = current;
  log(formatUnreachableBackendMessage(info.baseUrls));
  return true;
}

/** Test helper: allow the next report regardless of the repeat window. */
export function resetUnreachableBackendReport(): void {
  lastReportedAt = 0;
}
