# Frontend Navigation & Responsive Shell (`frontend/src/navigation`)

## Overview
React Navigation hierarchy, deep-linking configuration, and responsive desktop/phone shell framing for Project PN. Coordinates the root `NavigationContainer`, five top-level destinations (`Learn`, `Words`, `Add`, `Practice`, `Settings`), nested `WordsStack` and `SettingsStack` navigators, wide-viewport `Sidebar` vs. narrow/phone `BottomTabBar` layouts, and the canonical `AddScreen` tab host.

## Interface
- `[RootNavigator.tsx:RootNavigator]` — top-level `NavigationContainer` wired with `navigationRef`, `linkingConfig` (prefixes `Linking.createURL('/')`, `https://pn.nacfson.cloud`, `http://localhost:8081`), and `screen_viewed` analytics.
- `[MainTabs.tsx:MainTabs]` / `[MainTabs.tsx:MainTabParamList]` / `[MainTabs.tsx:MainTabsProps]` — bottom/left tab navigator hosting `Learn` (`HomeScreen`), `Words` (`WordsStack`), `Add` (`AddScreen`), `Practice` (`PracticeScreen`), and `Settings` (`SettingsStack`), plus `TabBarScrollContext`, `QueueBanner`, and `CommandDock`.
- `[AddScreen.tsx:AddScreen]` / `[AddScreen.tsx:AddScreenProps]` — Add-tab host rendering `TargetDeckSelector`, `SegmentedControl`, `ManualAddSection`, and `CaptureSection`.
- `[WordsStack.tsx:WordsStack]` / `[WordsStack.tsx:WordsStackParamList]` — native stack for `WordsRoot` (`MyWordsScreen`), `WordDetail` (`WordDetailScreen`), and `Decks` (`DecksScreen`).
- `[SettingsStack.tsx:SettingsStack]` / `[SettingsStack.tsx:SettingsStackParamList]` — native stack for `SettingsRoot` (`ProfileScreen`), `LanguagePairs`, `AddLanguagePair`, `EditLanguagePair`, `ConnectedAccounts`, and `AccountMerge`.
- `[Sidebar.tsx:Sidebar]` — desktop/wide left navigation rail (`232px` width) displaying brand badge, tab items, and active language-pair footer.
- `[TabSlot.tsx:TabSlot]` — bottom tab bar button slot with icon and single-line ellipsized label.
- `[browserFrame.tsx:BrowserFrame]` / `[browserFrame.tsx:BROWSER_PAGE_WIDTH]` — centered responsive container scaling down viewports narrower than `420px` and capping width at `1200px`.
- `[phoneFrame.tsx:PhoneFrame]` — full-width flex frame used for mobile/native shells.
- `[shellKind.ts:shellKind]` / `[shellKind.ts:shellLayout]` / `[shellKind.ts:browserScale]` / `[shellKind.ts:browserPageWidth]` / `[shellKind.ts:PAGE_WIDTH_FRAME]` — responsive breakpoint helpers and layout constants (`BROWSER_PAGE_MIN_WIDTH = 420`, `BROWSER_PAGE_MAX_WIDTH = 1200`, `SIDEBAR_MIN_PAGE_WIDTH = 720`, `CONTENT_MAX_WIDTH = 760`, `ShellKind`, `ShellLayout`).
- `[linkingConfig.ts:linkingConfig]` — URL path mapping for `Learn` (`''`, alias `['learn']`), `Words` (`'words'`), `Add` (`'add'`), `Practice` (`'practice'`), and `Settings` (`'settings'` with `SettingsRoot: ''` and `ConnectedAccounts: 'connected-accounts'` exact).
- `[navigationRef.ts:navigationRef]` — shared `createNavigationContainerRef<MainTabParamList>()` singleton.

## Invariants
- `AddScreen` defaults `activeTab` to `'manual'` and places the `'manual'` segment first in `SegmentedControl`; switching decks is disabled while `pendingCount > 0`, and focus-triggered language refreshes are throttled to `LAST_REFRESH_THRESHOLD_MS` (`30_000ms`) `[AddScreen.tsx:AddScreen]`.
- `shellKind` returns `'phone'` for iOS/Android native platforms or web user agents matching both `iPhone|iPod|Android` and `Mobile`, and `'browser'` otherwise; `shellLayout` returns `'sidebar'` only for `'browser'` when `browserPageWidth(windowWidth) >= 720` `[shellKind.ts:shellKind]`, `[shellKind.ts:shellLayout]`.
- `browserPageWidth` clamps viewport widths into `[420, 1200]` while `browserScale` proportionally scales viewports below `420px`; `PAGE_WIDTH_FRAME` re-applies `maxWidth: 1200` for web modal portals that escape `BrowserFrame` `[shellKind.ts:browserPageWidth]`, `[shellKind.ts:browserScale]`, `[shellKind.ts:PAGE_WIDTH_FRAME]`.
- When `chromeHidden` is true, `MainTabs` hides both the tab bar (`Sidebar`/`BottomTabBar`) and `CommandDock` `[MainTabs.tsx:MainTabs]`.
- `linkingConfig` reserves empty path `''` for `Learn` so fresh-tab and post-login `/` URLs land on `Learn` `[linkingConfig.ts:linkingConfig]`.

## Side Effects
- Emits `screen_viewed` analytics events on navigation ready and route changes `[RootNavigator.tsx:RootNavigator]`.
- Registers global web keyboard shortcut `'a'` to navigate to `Add` (`{ mode: 'manual', focusTick }`) via `navigationRef` `[MainTabs.tsx:MainTabs]`.
- Fetches private decks via `listDecks(targetLanguage, 'private')` and reads/writes last-used deck IDs via `getLastDeckId`/`getLastDeckIdSync`/`setLastDeckId` `[AddScreen.tsx:AddScreen]`.
- Reads `navigator.userAgent` and window dimensions to pick shell frame and layout `[MainTabs.tsx:MainTabs]`, `[browserFrame.tsx:BrowserFrame]`.

## Verification
- Run: `npm test -w frontend` and `npm run typecheck -w frontend`
