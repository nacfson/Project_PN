import { PN_EXTENSION_ID } from '../config';
import type { SessionResponse } from '@project-pn/api';

export function isExtensionLoginFlow(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).get('extension') === '1';
}

export function sendSessionToExtension(session: SessionResponse): void {
  if (!PN_EXTENSION_ID) {
    return;
  }
  const runtime = (globalThis as typeof globalThis & {
    chrome?: { runtime?: { sendMessage?: (id: string, message: unknown) => void } };
  }).chrome?.runtime;
  if (!runtime?.sendMessage) {
    return;
  }
  runtime.sendMessage(PN_EXTENSION_ID, session);
}
