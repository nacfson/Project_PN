// WebKit/WKWebView (Tauri desktop) does not reliably apply CSS rules that
// react-native-web injects via CSSOM `insertRule` into an empty <style> element.
// The rules exist in `sheet.cssRules` but are never painted, so the whole app
// renders unstyled (serif font, default inputs, no flex). Chromium is unaffected.
//
// Fix: mirror every CSSOM-inserted rule into a real text-based <style> element,
// which WebKit DOES apply. The original sheet is left untouched so Chromium and
// react-native-web's internal bookkeeping keep working.

const MIRROR_ID = 'rnw-webkit-style-mirror';

function isWebKitNotChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Tauri macOS uses WKWebView (Safari/AppleWebKit, not Chrome/Chromium/Edg).
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
}

function installStyleMirror(): void {
  if (typeof document === 'undefined' || typeof CSSStyleSheet === 'undefined') return;

  const getMirror = (): HTMLStyleElement => {
    let el = document.getElementById(MIRROR_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = MIRROR_ID;
      document.head.appendChild(el);
    }
    return el;
  };

  const flush = (): void => {
    const mirror = getMirror();
    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
      if (sheet.ownerNode === mirror) continue;
      let rules: CSSRuleList | null = null;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin or inaccessible sheet
      }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        css += rule.cssText + '\n';
      }
    }
    if (mirror.textContent !== css) {
      mirror.textContent = css;
    }
  };

  // Debounce via setTimeout. (Avoid requestAnimationFrame: it is paused while
  // the webview is hidden/backgrounded, which would stall the mirror.)
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      flush();
    }, 0);
  };

  // CSSOM mutations (insertRule/deleteRule) do not trigger MutationObserver, so
  // patch the prototype methods to re-mirror after react-native-web injects
  // styles. react-native-web inserts atomic rules into `@media` group blocks, so
  // patch CSSGroupingRule (CSSMediaRule's base) in addition to CSSStyleSheet.
  const patchInsert = (proto: { insertRule: (rule: string, index?: number) => number }): void => {
    const orig = proto.insertRule;
    proto.insertRule = function (this: CSSStyleSheet, rule: string, index?: number): number {
      const result = orig.call(this, rule, index);
      schedule();
      return result;
    };
  };
  patchInsert(CSSStyleSheet.prototype);
  if (typeof CSSGroupingRule !== 'undefined') {
    patchInsert(CSSGroupingRule.prototype);
  }
  const origDelete = CSSStyleSheet.prototype.deleteRule;
  CSSStyleSheet.prototype.deleteRule = function (this: CSSStyleSheet, index: number): void {
    origDelete.call(this, index);
    schedule();
  };

  // Initial mirror, plus a couple of follow-ups to catch styles inserted shortly
  // after first paint.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule(), { once: true });
  }
  schedule();
  setTimeout(schedule, 250);
  setTimeout(schedule, 1000);
}

function shouldRun(): boolean {
  if (isWebKitNotChrome()) return true;
  // Escape hatch for verification on non-WebKit engines.
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('rnwStyleMirror') === 'force';
  } catch {
    return false;
  }
}

if (shouldRun()) {
  installStyleMirror();
}

export {};
