# Deprecated / Temporarily Removed Features

## Push Notifications (`expo-notifications`)

**Removed:** 2026-06-22

**Reason:** The project was using `expo-notifications`, which adds the Push Notifications capability to the iOS target. A free/personal Apple Developer team cannot create an iOS App Development provisioning profile with Push Notifications enabled, so installing on a physical iPhone failed with:

> Cannot create a iOS App Development provisioning profile for "com.projectpn.app". Personal development teams do not support the Push Notifications capability.

**What was removed:**
- `expo-notifications` plugin from `frontend/app.json`
- `expo-notifications` and `expo-device` dependencies from `frontend/package.json`
- `frontend/src/hooks/usePushNotifications.ts`

**How to restore:**
1. Re-add dependencies:
   ```bash
   cd frontend
   npx expo install expo-notifications expo-device
   ```
2. Re-add the plugin to `app.json`:
   ```json
   [
     "expo-notifications",
     {
       "icon": "./assets/icon.png",
       "color": "#ffffff"
     }
   ]
   ```
3. Restore the hook from source control or rewrite `usePushNotifications`.
4. Use a paid Apple Developer Program account and create a provisioning profile that includes Push Notifications and the `aps-environment` entitlement.
