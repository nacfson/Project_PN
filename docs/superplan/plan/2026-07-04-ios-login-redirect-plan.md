# iOS Login Redirect & SSO Authentication Plan

**Date:** 2026-07-04
**Topic:** Implementation Plan for Resolving iOS Login Redirect and Session Authentication Failure

---

## Plan Overview

This plan details the step-by-step changes to fix the iOS authentication redirect failure by replacing the buggy native JavaScript `URL` constructor with robust regular expression parsing, and integrating `WebBrowser.openAuthSessionAsync` (`ASWebAuthenticationSession`) for a secure, in-app SSO flow on native platforms.

---

## Detailed Steps

### Step 1: Replace `URL` constructor with Regex in `extractTokenFromUrl`

* **Objective:** Ensure URL parameters are parsed correctly on native platforms without throwing or failing on custom schemes (like `projectpn://` or `exp://`).
* **Target Files:**
  * `[frontend/src/utils/authLaunch.ts](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/utils/authLaunch.ts)`
* **Surgical Edits:**
  * Remove `new URL(absoluteUrl)` from `extractTokenFromUrl`.
  * Implement regex-based extraction to capture `token` query parameters in both standard query parts and hash fragments.
* **Verification Command:**
  ```bash
  npm run test
  ```
* **Expected Output:**
  * All tests pass successfully, especially the test suite in `src/utils/authLaunch.test.ts`.

---

### Step 2: Implement Native in-app Browser SSO in `CentralAuthScreen`

* **Objective:** Enable a premium, secure in-app browser session (`ASWebAuthenticationSession` / Custom Tabs) on native platforms instead of redirecting the user to external Safari.
* **Target Files:**
  * `[frontend/src/screens/CentralAuthScreen.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/src/screens/CentralAuthScreen.tsx)`
* **Surgical Edits:**
  * Import `* as WebBrowser` from `expo-web-browser`.
  * Add optional `onTokenReceived` callback prop to the `CentralAuthScreen` component.
  * In `handleSignIn`, check if the platform is native, and call `WebBrowser.openAuthSessionAsync(authUrl, redirectUrl)`.
  * If the session resolves with `success`, parse the token, write it to `sessionStorage`, and call `onTokenReceived()`.
* **Verification Command:**
  ```bash
  npm run test
  ```
* **Expected Output:**
  * The test `src/screens/CentralAuthScreen.test.tsx` and other test suites compile and pass successfully.

---

### Step 3: Integrate SSO Callback in `App.tsx`

* **Objective:** Automatically transition the application to the authenticated state when `CentralAuthScreen` receives a token.
* **Target Files:**
  * `[frontend/App.tsx](file:///Users/hyungjuyu/Projects/iOS/Project_PN/frontend/App.tsx)`
* **Surgical Edits:**
  * Pass the existing `checkAuth` callback function as the `onTokenReceived` prop to `<CentralAuthScreen />`.
* **Verification Command:**
  ```bash
  npm run test
  ```
* **Expected Output:**
  * The app builds, compiles, and passes the entire Jest test suite.
