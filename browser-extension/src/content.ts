import { showAddToast } from './inlineToast';
import type { AddToastPayload } from './types';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SHOW_ADD_TOAST') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const payload = message.payload as AddToastPayload;
    const { close } = showAddToast(
      range,
      payload,
      (wordSenseId, deckId) => {
        chrome.runtime.sendMessage(
          { type: 'ADD_ITEM', payload: { wordSenseId, deckId, displayLanguage: payload.displayLanguage } },
          (result) => {
            close();
            if (result?.success) {
              showStatusToast(`Added “${payload.text}” to deck`);
            } else {
              showStatusToast(`Failed to add “${payload.text}”`);
            }
            sendResponse({ handled: true });
          },
        );
      },
      () => {
        close();
        sendResponse({ handled: true });
      },
    );
    return true;
  }

  if (message.type === 'SHOW_ERROR_TOAST') {
    showStatusToast(message.payload.message);
  }
});

function showStatusToast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1c1b1f;color:#fff;padding:12px 20px;border-radius:999px;z-index:2147483647;font-family:sans-serif;font-size:14px;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
