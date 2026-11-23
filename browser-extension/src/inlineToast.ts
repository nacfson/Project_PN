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
    .pn-toast-notice {
      font-size: 12px;
      line-height: 1.4;
      color: #7c2d12;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .pn-toast-code { font-size: 11px; color: #605d66; margin-top: 2px; }
    .pn-toast-label { font-size: 11px; color: #605d66; margin-bottom: 4px; }
    .pn-toast-select, .pn-toast-input {
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #cac4d0;
      background: #fff;
      font-size: 13px;
      color: #1c1b1f;
    }
    .pn-toast-input.invalid { border-color: #dc2626; }
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
  onAdd: (wordSenseId: string, deckId: string, personalNote?: string) => void,
  onAddManual: (personalNote: string, deckId: string) => void,
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

  const manualOnly = Boolean(payload.manualOnly || payload.senseOptions.length === 0);
  const needsManualNote = manualOnly || Boolean(payload.translationMissing);

  if (payload.errorMessage || payload.translationMissing) {
    const notice = document.createElement('div');
    notice.className = 'pn-toast-notice';
    const msg = document.createElement('div');
    msg.textContent =
      payload.errorMessage ??
      'No localized meaning found — enter your own meaning below to save.';
    notice.appendChild(msg);
    if (payload.errorCode) {
      const code = document.createElement('div');
      code.className = 'pn-toast-code';
      code.textContent = `Code: ${payload.errorCode}`;
      notice.appendChild(code);
    }
    wrapper.appendChild(notice);
  }

  let senseSelect: HTMLSelectElement | null = null;
  if (!manualOnly) {
    const senseLabel = document.createElement('div');
    senseLabel.className = 'pn-toast-label';
    senseLabel.textContent = 'Sense';
    wrapper.appendChild(senseLabel);

    senseSelect = document.createElement('select');
    senseSelect.className = 'pn-toast-select';
    payload.senseOptions.forEach((sense) => {
      const option = document.createElement('option');
      option.value = sense.word_sense_id;
      const gloss = payload.translationMissing
        ? sense.definition
        : sense.localized_short_definition ?? sense.localized_definition;
      option.textContent = `${sense.lemma} · ${sense.part_of_speech} · ${gloss}`;
      senseSelect!.appendChild(option);
    });
    if (payload.defaultSenseId) {
      senseSelect.value = payload.defaultSenseId;
    }
    wrapper.appendChild(senseSelect);
  }

  let noteInput: HTMLInputElement | null = null;
  if (needsManualNote) {
    const noteLabel = document.createElement('div');
    noteLabel.className = 'pn-toast-label';
    noteLabel.textContent = 'Your meaning';
    wrapper.appendChild(noteLabel);

    noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'pn-toast-input';
    noteInput.placeholder = 'Type the meaning to remember';
    wrapper.appendChild(noteInput);
  }

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

  let progressBar: HTMLDivElement | null = null;
  if (!needsManualNote) {
    const progress = document.createElement('div');
    progress.className = 'pn-toast-progress';
    progressBar = document.createElement('div');
    progressBar.className = 'pn-toast-progress-bar';
    progress.appendChild(progressBar);
    wrapper.appendChild(progress);
  }

  const actions = document.createElement('div');
  actions.className = 'pn-toast-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'pn-toast-btn primary';
  addBtn.textContent = manualOnly ? 'Save meaning' : 'Add';
  actions.appendChild(addBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'pn-toast-btn secondary';
  cancelBtn.textContent = 'Cancel';
  actions.appendChild(cancelBtn);

  wrapper.appendChild(actions);
  document.body.appendChild(wrapper);

  const canAutoAdd = !needsManualNote && payload.senseOptions.length > 0 && payload.decks.length > 0;
  const hasDeck = payload.decks.length > 0;
  if (!hasDeck || (!manualOnly && payload.senseOptions.length === 0)) {
    addBtn.disabled = true;
    addBtn.title = 'No deck available';
  }

  let closed = false;
  let timer = 0;
  let animFrame = 0;
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
    const deckId = deckSelect.value;
    if (!deckId) return;
    if (needsManualNote) {
      const note = noteInput?.value.trim() ?? '';
      if (!note) {
        noteInput?.classList.add('invalid');
        noteInput?.focus();
        return;
      }
      if (manualOnly) {
        close();
        onAddManual(note, deckId);
        return;
      }
      const senseId = senseSelect?.value;
      if (!senseId) return;
      close();
      onAdd(senseId, deckId, note);
      return;
    }
    const senseId = senseSelect?.value;
    if (!senseId) return;
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
    } else if (e.key === 'Enter' && needsManualNote && document.activeElement === noteInput) {
      doAdd();
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

  if (canAutoAdd && progressBar) {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const remaining = Math.max(0, AUTO_ADD_MS - elapsed);
      const pct = remaining / AUTO_ADD_MS;
      progressBar!.style.transform = `scaleX(${pct})`;
      if (remaining > 0 && !closed) {
        animFrame = requestAnimationFrame(animate);
      }
    };
    animFrame = requestAnimationFrame(animate);

    timer = window.setTimeout(() => {
      if (!closed && canAutoAdd) {
        doAdd();
      }
    }, AUTO_ADD_MS);
  }

  return { close };
}
