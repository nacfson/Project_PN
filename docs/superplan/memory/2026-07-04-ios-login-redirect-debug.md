# Debug Summary: iOS Login Redirect & SSO Authentication Failure

**Date:** 2026-07-04
**Topic:** Resolving iOS authentication redirect loop and enabling secure native SSO

---

## 1. Problem Characterization

* **Symptom:** When a user attempted to log in on the iOS app, they were redirected to Safari to complete the authentication, but after logging in, the browser did not redirect back to the app and the login state remained unchanged.
* **Root Cause:**
  1. **SSO Redirect Allowed-List Mismatch:** The central authentication service (`ProcessManager/internal/auth`) validates the redirect URL parameter (`rd`). If the scheme is not `https` (such as `projectpn://`), the service fails the validation with `"redirect must use https"` unless the URL is explicitly listed in `AUTH_ALLOWED_REDIRECTS`. The deployment was configured with `AUTH_ALLOWED_REDIRECTS="http://localhost:8081"`, which did not include `projectpn://auth`.
  2. **Buggy URL Parsing on Native JS:** The helper `extractTokenFromUrl` used the native JS `URL` constructor which throws exceptions or behaves unpredictably when parsing custom schemes on native platforms.
  3. **External Browser Flow:** Tapping "Sign In" redirected the user to external Safari, which creates a poor UX and complicates cookie/session handoff back to the app.

---

## 2. Surgical Fixes

### A. Central Auth Service (Backend & Infrastructure)
* **Configuration Update:** Modified `ProcessManager/k8s/auth/deployment.yaml` to include `projectpn://auth` in the allowed redirects:
  ```yaml
  - name: AUTH_ALLOWED_REDIRECTS
    value: "http://localhost:8081,projectpn://auth"
  ```
* **Deployment Rollout:** Successfully applied and rolled out the update on the remote `zlUbuntu` Kubernetes cluster via `kubectl apply`.

### B. App Frontend
* **Regex-based Token Extraction:** Modified `frontend/src/utils/authLaunch.ts` to replace the fragile `URL` constructor with a robust regex pattern that extracts the token query parameter from both standard search parameters and hash segments on custom URL schemes:
  ```typescript
  const searchMatch = urlStr.match(/[?&]token=([^&#]+)/);
  ```
* **Secure In-App SSO Browser:** Updated `frontend/src/screens/CentralAuthScreen.tsx` to use `WebBrowser.openAuthSessionAsync` on native platforms. This invokes `ASWebAuthenticationSession` (iOS) / Custom Tabs (Android) which:
  - Keeps the user inside the app flow.
  - Correctly prompts and executes the deep link redirection when Nacfson Cloud redirects to `projectpn://auth?token=XYZ`.
  - Captures the token, writes it to `sessionStorage`, and calls `onTokenReceived` callback to update the app state.
* **Callback Integration:** Integrated the `onTokenReceived={checkAuth}` callback in `frontend/App.tsx` so the app immediately transitions to `authenticated` state upon a successful login.

---

## 3. Verification

* **Unit Tests:** Ran the entire frontend test suite using `npm test`. All 35 test suites (121 tests) passed successfully.
* **Kubernetes Verification:** Confirmed the environment variable was correctly updated on the live `auth-service` deployment inside `zlUbuntu`.
