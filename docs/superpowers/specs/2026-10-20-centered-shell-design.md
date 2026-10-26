# Centered shell

## Intent

The browser site is a page in the middle of the window. It grows with the window from 420px up to 1200px; width past 1200px is empty padding, the same on both sides. The phone is a different screen. Neither layout may resize or restyle the other. A label may not paint outside its button.

## Goals

- Browser page width is the window width, at least 420px and at most 1200px, centered. Left empty space equals right empty space. (Changed by issue #71: the fixed 420px page left wide windows as a thin strip.)
- The bottom bar is the bottom of that page. It is not the width of the window.
- If the browser window is narrower than 420px, the whole page, cards and bar together, scales down and stays centered. It does not reflow, and it does not become the phone screen.
- Phone (native iOS, native Android, and a phone browser) is its own full-device screen. It does not use the browser page width.
- The bottom highlight is the tab button. The label is inside that button. A long word is cut off inside the button. It does not cover the next tab.
- The floating web dock does not pin to the window edge outside the browser page.

## Non-goals

- Redesigning Learn cards, theme chips, forecast, or progress.
- Using monitor width beyond 1200px as layout space.
- New tabs or new copy.
- Turning a narrowed desktop window into the phone screen.

## Decisions

- 420 is the minimum browser page width. It was the page selected in the layout review. 1200 is the maximum (issue #71). Screens that want more than one column decide that from their own measured width, not from the window.
- Phone versus browser is not a window-width check. Width only scales the browser page. Native iOS and Android are phone. A web user agent matching `iPhone`, `iPod`, or `Android` plus `Mobile` is phone. Desktop web, Tauri, and iPad web stay the browser page. This is the call that keeps a narrowed desktop window from becoming the phone UI.
- The two frames live in separate files and do not import each other.
- The sliding 75% pill behind the label goes away. That pill is narrower than the word, which is the overlap.

## What must not change

- Add tab still opens on Manual. Do not edit the Add-tab cluster for this fix.
- Learn card content stays. A 420px page may stack the existing bento. That is fine.
- `TabBarScrollContext` still hides the bar while practice chrome is up.
