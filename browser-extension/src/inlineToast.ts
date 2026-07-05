import type { AddToastPayload } from './types';

const AUTO_ADD_MS = 5000;

function createStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .pn-toast {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #1c1b1f;
      background: #f3f0f4;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      padding: 16px;
      width: 320px;
      position: absolute;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pn-toast * { box-sizing: border-box; }
    .pn-toast-title { font-weight: 700; font-size: 15px; }
    .pn-toast-word { font-weight: 600; color: #4a4458; word-break: break-word; }
    .pn-toast-label { font-size: 11px; color: #605d66; margin-bottom: 4px; }
    .pn-toast-select {
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #cac4d0;
      background: #fff;
      font-size: 13px;
    }
    .pn-toast-actions { display: flex; gap: 8px; margin-top: 4px; }
    .pn-toast-btn {
      flex: 1;
      padding: 9px 12px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    .pn-toast-btn.primary { background: #4a4458; color: #fff; }
    .pn-toast-btn.secondary { background: #e6e0e9; color: #1c1b1f; }
    .pn-toast-progress {
      height: 3px;
      background: #d0bcff;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 4px;
    }
    .pn-toast-progress-bar {
      height: 100%;
      width: 100%;
      background: #4a4458;
      transform-origin: left;
    }
  `;
  return style;
}

export function showAddToast(
  target: Range,
  payload: AddToastPayload,
  onAdd: (wordSenseId: string, deckId: string) => void,
  onCancel: () => void,
): { close: () => void } {
  const rect = target.getBoundingClientRect();
  const wrapper = document.createElement('div');
  wrapper.className = 'pn-toast';
  wrapper.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
  wrapper.style.top = `${Math.max(8, rect.bottom + window.scrollY + 8)}px`;

  const style = createStyles();
  wrapper.appendChild(style);

  const title = document.createElement('div');
  title.className = 'pn-toast-title';
  title.textContent = 'Add to Project PN';
  wrapper.appendChild(title);

  const word = document.createElement('div');
  word.className = 'pn-toast-word';
  word.textContent = payload.text;
  wrapper.appendChild(word);

  const senseLabel = document.createElement('div');
  senseLabel.className = 'pn-toast-label';
  senseLabel.textContent = 'Sense';
  wrapper.appendChild(senseLabel);

  const senseSelect = document.createElement('select');
  senseSelect.className = 'pn-toast-select';
  payload.senseOptions.forEach((sense) => {
    const option = document.createElement('option');
    option.value = sense.word_sense_id;
    option.textContent = `${sense.lemma} · ${sense.part_of_speech} · ${sense.localized_definition}`;
    senseSelect.appendChild(option);
  });
  if (payload.defaultSenseId) {
    senseSelect.value = payload.defaultSenseId;
  }
  wrapper.appendChild(senseSelect);

  const deckLabel = document.createElement('div');
  deckLabel.className = 'pn-toast-label';
  deckLabel.textContent = 'Deck';
  wrapper.appendChild(deckLabel);

  const deckSelect = document.createElement('select');
  deckSelect.className = 'pn-toast-select';
  payload.decks.forEach((deck) => {
    const option = document.createElement('option');
    option.value = deck.id;
    option.textContent = deck.name;
    deckSelect.appendChild(option);
  });
  if (payload.defaultDeckId) {
    deckSelect.value = payload.defaultDeckId;
  }
  wrapper.appendChild(deckSelect);

  const progress = document.createElement('div');
  progress.className = 'pn-toast-progress';
  const progressBar = document.createElement('div');
  progressBar.className = 'pn-toast-progress-bar';
  progress.appendChild(progressBar);
  wrapper.appendChild(progress);

  const actions = document.createElement('div');
  actions.className = 'pn-toast-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'pn-toast-btn primary';
  addBtn.textContent = 'Add';
  actions.appendChild(addBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'pn-toast-btn secondary';
  cancelBtn.textContent = 'Cancel';
  actions.appendChild(cancelBtn);

  wrapper.appendChild(actions);
  document.body.appendChild(wrapper);

  const canAdd = payload.senseOptions.length > 0 && payload.decks.length > 0;
  if (!canAdd) {
    addBtn.disabled = true;
    addBtn.title = 'No sense or deck available';
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    cancelAnimationFrame(animFrame);
    wrapper.remove();
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', onClickOutside);
  };

  const doAdd = () => {
    if (closed) return;
    const senseId = senseSelect.value;
    const deckId = deckSelect.value;
    if (!senseId || !deckId) return;
    close();
    onAdd(senseId, deckId);
  };

  addBtn.addEventListener('click', doAdd);
  cancelBtn.addEventListener('click', () => {
    close();
    onCancel();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      onCancel();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const onClickOutside = (e: MouseEvent) => {
    if (!wrapper.contains(e.target as Node)) {
      close();
      onCancel();
    }
  };
  document.addEventListener('click', onClickOutside);

  const start = performance.now();
  let animFrame = 0;
  const animate = (now: number) => {
    const elapsed = now - start;
    const remaining = Math.max(0, AUTO_ADD_MS - elapsed);
    const pct = remaining / AUTO_ADD_MS;
    progressBar.style.transform = `scaleX(${pct})`;
    if (remaining > 0 && !closed) {
      animFrame = requestAnimationFrame(animate);
    }
  };
  animFrame = requestAnimationFrame(animate);

  const timer = window.setTimeout(() => {
    if (!closed && canAdd) {
      doAdd();
    }
  }, AUTO_ADD_MS);

  return { close };
}
