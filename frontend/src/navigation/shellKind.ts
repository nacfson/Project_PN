export type ShellKind = 'browser' | 'phone';

const PHONE_DEVICE = /iPhone|iPod|Android/;
const PHONE_MOBILE = /Mobile/;

export function shellKind(platform: string, userAgent: string): ShellKind {
  if (platform === 'ios' || platform === 'android') return 'phone';
  if (platform === 'web' && PHONE_DEVICE.test(userAgent) && PHONE_MOBILE.test(userAgent)) {
    return 'phone';
  }
  return 'browser';
}

export function browserScale(viewportWidth: number): number {
  if (viewportWidth < 1 || viewportWidth >= 420) return 1;
  return viewportWidth / 420;
}
