import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export interface KeyboardShortcutOptions {
  enabled?: boolean;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as HTMLElement;
  const tagName = el.tagName?.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return false;
}

export function useKeyboardShortcut(
  keyOrKeys: string | string[],
  handler: (event: KeyboardEvent) => void,
  options?: KeyboardShortcutOptions,
): void {
  const enabled = options?.enabled ?? true;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const keysKey = Array.isArray(keyOrKeys) ? keyOrKeys.join('\u0000') : keyOrKeys;

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      !enabled ||
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function'
    ) {
      return;
    }

    const keys = keysKey.split('\u0000');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableElement(event.target)) return;
      if (!keys.includes(event.key)) return;

      event.preventDefault();
      handlerRef.current(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, keysKey]);
}
