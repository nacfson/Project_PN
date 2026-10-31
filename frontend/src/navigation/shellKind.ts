export type ShellKind = 'browser' | 'phone';

const PHONE_DEVICE = /iPhone|iPod|Android/;
const PHONE_MOBILE = /Mobile/;

export const BROWSER_PAGE_MIN_WIDTH = 420;
export const BROWSER_PAGE_MAX_WIDTH = 1200;

// Modal portals to document.body on web and escapes BrowserFrame, so overlays apply the cap themselves.
export const PAGE_WIDTH_FRAME = {
  width: '100%',
  maxWidth: BROWSER_PAGE_MAX_WIDTH,
  alignSelf: 'center',
} as const;

export function shellKind(platform: string, userAgent: string): ShellKind {
  if (platform === 'ios' || platform === 'android') return 'phone';
  if (platform === 'web' && PHONE_DEVICE.test(userAgent) && PHONE_MOBILE.test(userAgent)) {
    return 'phone';
  }
  return 'browser';
}

export function browserScale(viewportWidth: number): number {
  if (viewportWidth < 1 || viewportWidth >= BROWSER_PAGE_MIN_WIDTH) return 1;
  return viewportWidth / BROWSER_PAGE_MIN_WIDTH;
}

// Under the minimum the page keeps its minimum width and browserScale shrinks it.
export function browserPageWidth(viewportWidth: number): number {
  if (viewportWidth < BROWSER_PAGE_MIN_WIDTH) return BROWSER_PAGE_MIN_WIDTH;
  return Math.min(viewportWidth, BROWSER_PAGE_MAX_WIDTH);
}
