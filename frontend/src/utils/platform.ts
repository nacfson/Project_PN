/** True when the web bundle runs inside the Tauri desktop shell. */
export function isTauri(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}
