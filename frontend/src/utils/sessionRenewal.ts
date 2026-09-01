export const REFRESH_BUFFER_MS = 5 * 60 * 1000;
export const PROACTIVE_THRESHOLD_MS = 10 * 60 * 1000;

export function msUntilRefresh(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) {
    return null;
  }
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) {
    return null;
  }
  return Math.max(0, expires - Date.now() - REFRESH_BUFFER_MS);
}

export function shouldRefreshProactively(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) {
    return false;
  }
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) {
    return false;
  }
  return expires - Date.now() < PROACTIVE_THRESHOLD_MS;
}
