import { extensionStorage } from '../auth/storage';
import { listDecks, me } from '../api/client';
import { openLoginWindow } from '../auth/login';

const content = document.getElementById('content')!;

async function render() {
  const token = await extensionStorage.getToken();
  if (!token) {
    content.innerHTML = `
      <div class="status">Sign in to add words from any webpage.</div>
      <button id="signInBtn">Sign In</button>
    `;
    document.getElementById('signInBtn')!.addEventListener('click', openLoginWindow);
    return;
  }

  try {
    const targetLanguage = (await extensionStorage.getTargetLanguage()) ?? undefined;
    const [decks, user] = await Promise.all([listDecks(targetLanguage), me()]);
    const defaultDeck = decks.find((d) => d.is_default) ?? decks[0];
    await extensionStorage.setDefaultDeckId(defaultDeck?.id ?? '');

    content.innerHTML = `
      <div class="status">Signed in as ${escapeHtml(user.email)}</div>
      <div class="deck-row">
        <div>
          <div class="label">Default deck</div>
          <div class="value">${escapeHtml(defaultDeck?.name ?? 'None')}</div>
        </div>
      </div>
      <button id="signOutBtn">Sign Out</button>
    `;
    document.getElementById('signOutBtn')!.addEventListener('click', async () => {
      await extensionStorage.clearSession();
      await render();
    });
  } catch (err) {
    content.innerHTML = `<div class="status error">Failed to load account info.</div>`;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

render();
