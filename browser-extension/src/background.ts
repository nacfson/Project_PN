import './auth/login';
import { createContextMenu, removeContextMenu } from './contextMenu';
import { extensionStorage } from './auth/storage';
import { lookupWord, addLearningItem, listDecks } from './api/client';
import { openLoginWindow } from './auth/login';

chrome.runtime.onInstalled.addListener(() => {
  removeContextMenu();
  createContextMenu();
});

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return;
  } catch {
    // Content script not loaded; inject it now.
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function sendToContentScript(tabId: number, message: unknown): Promise<void> {
  await ensureContentScript(tabId);
  await chrome.tabs.sendMessage(tabId, message);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'pn-add-word' || !tab?.id) return;

  const token = await extensionStorage.getToken();
  if (!token) {
    openLoginWindow();
    return;
  }

  const [selection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection()?.toString().trim().replace(/^[^\w]+|[^\w]+$/g, '') ?? '',
  });
  const text = selection.result as string;
  if (!text) return;

  try {
    const targetLanguage = (await extensionStorage.getTargetLanguage()) ?? 'en';
    const displayLanguage = (await extensionStorage.getDisplayLanguage()) ?? 'ko';
    const response = await lookupWord(text, {
      languageCode: targetLanguage,
      displayLanguageCode: displayLanguage,
    });
    const decks = await listDecks(targetLanguage);
    const defaultDeckId = (await extensionStorage.getDefaultDeckId()) ?? decks.find((d) => d.is_default)?.id;

    await sendToContentScript(tab.id, {
      type: 'SHOW_ADD_TOAST',
      payload: {
        text,
        senseOptions: response.sense_options,
        decks,
        defaultSenseId: response.sense_options[0]?.word_sense_id,
        defaultDeckId,
        displayLanguage,
      },
    });
  } catch (err) {
    await sendToContentScript(tab.id, {
      type: 'SHOW_ERROR_TOAST',
      payload: { text, message: err instanceof Error ? err.message : 'Add failed' },
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ADD_ITEM' && sender.tab?.id) {
    addLearningItem(message.payload.wordSenseId, message.payload.displayLanguage, message.payload.deckId)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  }
});
