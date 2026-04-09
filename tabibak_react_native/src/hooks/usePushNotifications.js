/**
 * usePushNotifications — Push Notification Engine (Phase 5)
 *
 * Custom React hook that owns the complete Expo push-notification lifecycle
 * for a single mounted component (typically the root App or AppNavigator).
 *
 * ── Architecture Notes ──────────────────────────────────────────────────────
 *
 * ┌─ TOKEN LIFECYCLE ──────────────────────────────────────────────────────────
 * │
 * │  1. ACQUISITION (hook mounts)
 * │     registerForPushNotificationsAsync() runs on first mount:
 * │       a) Sets Notifications.setNotificationHandler so foreground alerts,
 * │          sounds, and badge updates fire even while the app is active.
 * │       b) Creates Android notification channels (API ≥ 26 requirement).
 * │       c) Requests OS permission — on Android 13+ (API 33+) this triggers
 * │          the POST_NOTIFICATIONS system dialog; on earlier Android the
 * │          permission is granted automatically at install time.
 * │       d) Calls Notifications.getExpoPushTokenAsync({ projectId }) to
 * │          obtain the 'ExponentPushToken[xxxxxxxx]' string from Expo's
 * │          push gateway. Requires a valid EAS projectId.
 * │
 * │  2. STORAGE (hook → notificationService → Firestore)
 * │     The hook exposes `expoPushToken`. The caller (App.js / AppNavigator)
 * │     should pass this token to notificationService.syncTokenToUserDocument
 * │     whenever it changes (via a useEffect watching expoPushToken + uid).
 * │     On login, AuthContext calls notificationService.registerDeviceToken
 * │     which independently fetches the token and writes it to BOTH:
 * │       • userTokens/{uid}  — rich device record (platform, model, etc.)
 * │       • users/{uid}       — pushToken field (read by the sender utility)
 * │
 * │  3. ROTATION (token refresh)
 * │     Expo push tokens can rotate when a user reinstalls the app, transfers
 * │     to a new device, or when APNs / FCM invalidates the token.
 * │     Notifications.addPushTokenListener fires whenever a new token is
 * │     issued. The hook captures this via `tokenListenerRef` and:
 * │       a) Updates `expoPushToken` state in the hook.
 * │       b) Calls onTokenRefresh(newToken) callback if supplied by the
 * │          caller — this lets App.js re-sync Firestore without needing to
 * │          unmount / remount the hook.
 * │
 * │  4. FOREGROUND DELIVERY
 * │     addNotificationReceivedListener fires while the app is foregrounded
 * │     (i.e., the screen is visible). The `notification` state value updates
 * │     on each incoming push. Components can watch this value to update their
 * │     UI reactively (e.g., badge count, in-app banner).
 * │
 * │  5. USER INTERACTION
 * │     addNotificationResponseReceivedListener fires when the user taps a
 * │     notification in the system tray (from either foreground or background).
 * │     The `notificationResponse.notification.request.content.data` object
 * │     carries the dataPayload from sendPushNotification, enabling deep-link
 * │     routing (e.g., navigate to the relevant appointment screen).
 * │
 * │  6. CLEANUP (hook unmounts)
 * │     All three subscriptions (received, response, tokenChange) are removed
 * │     via Notifications.removeNotificationSubscription in the useEffect
 * │     cleanup. This prevents memory leaks and duplicate event handling.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ INTEGRATION WITH AUTH STATE ──────────────────────────────────────────────
 * │
 * │  The hook is DECOUPLED from auth state by design:
 * │    • It does not import useAuth or AuthContext.
 * │    • It does not write to Firestore directly.
 * │    • It exposes `expoPushToken` and `onTokenRefresh` for the caller to
 * │      bridge into the auth / Firestore layer however they choose.
 * │
 * │  Recommended integration in AppNavigator (or App.js root):
 * │
 * │    const { expoPushToken } = usePushNotifications({
 * │      onTokenRefresh: (newToken) => {
 * │        if (user?.uid) notificationService.syncTokenToUserDocument(user.uid, newToken);
 * │      },
 * │    });
 * │
 * │  On login (AuthContext.onAuthStateChanged), the existing call to
 * │  notificationService.registerDeviceToken(uid, role) independently fetches
 * │  the token and writes it to Firestore, so the hook and the auth flow
 * │  complement each other without circular dependencies.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ HARDWARE WARNING ─────────────────────────────────────────────────────────
 * │
 * │  ⚠️  iOS SIMULATORS CANNOT RECEIVE PUSH NOTIFICATIONS.
 * │
 * │  The Expo push gateway delivers notifications via APNs on iOS. APNs
 * │  requires a physical device with a valid device token — the iOS Simulator
 * │  does not have one and cannot generate a real APNs device token.
 * │
 * │  This means:
 * │    • getExpoPushTokenAsync() may succeed in development (returning an
 * │      Expo-side token), but the notification will NEVER arrive on the
 * │      iOS Simulator.
 * │    • To test push notifications end-to-end on iOS you MUST use a physical
 * │      iPhone or iPad with a development or production build created via
 * │      `eas build --profile development --platform ios`.
 * │
 * │  Android Emulators CAN receive push notifications IF Google Play Services
 * │  are present (e.g., Pixel emulator image). AOSP-only images (no GMS)
 * │  cannot receive FCM-delivered notifications.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device       from 'expo-device';
import Constants         from 'expo-constants';

// ─────────────────────────────────────────────────────────────────────────────
// Android channel definitions
// Channels are required on Android API ≥ 26 (Oreo). Notifications sent without
// a matching channelId are silently dropped on Android 8+.
// ─────────────────────────────────────────────────────────────────────────────
const ANDROID_CHANNELS = [
  {
    id:               'default',
    name:             'General',
    importance:       Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#10b981',
    sound:            'default',
  },
  {
    id:               'appointments',
    name:             'Appointment Reminders',
    importance:       Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound:            'default',
  },
  {
    id:               'messages',
    name:             'Messages',
    importance:       Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150],
    sound:            'default',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// registerForPushNotificationsAsync
//
// Pure async helper — no hooks, no React context. Can be called from outside
// React (e.g., in notificationService.js) without importing the hook.
//
// Returns the 'ExponentPushToken[xxxxxxxx]' string on success, or null if:
//   • running on a simulator / emulator without push support
//   • the user denied permission
//   • no EAS projectId is configured
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {Promise<string|null>} Expo push token string or null
 */
export async function registerForPushNotificationsAsync() {
  // ── Step 1: Foreground notification handler ────────────────────────────────
  //
  // setNotificationHandler controls what happens when a push notification
  // arrives WHILE the app is in the foreground (screen visible).
  // Without this call, foreground notifications are silently swallowed on both
  // iOS and Android — no alert, no sound, no badge update.
  //
  // This is set here (before permission request) so the handler is in place
  // from the first notification, even before the token is returned to the
  // caller and stored in Firestore.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,  // Show the notification banner / alert
      shouldPlaySound: true,  // Play the notification sound
      shouldSetBadge: true,   // Increment the app icon badge count
    }),
  });

  // ── Step 2: Device guard ───────────────────────────────────────────────────
  //
  // ⚠️  iOS SIMULATOR WARNING: This guard catches the most common simulator
  // case, but getExpoPushTokenAsync may still "succeed" on simulators with
  // recent Expo SDK versions. However, the token will not receive real APNs
  // deliveries. ALWAYS test push notifications on a physical device.
  //
  // Device.isDevice is false on iOS Simulator and Android Emulator.
  if (!Device.isDevice) {
    console.warn(
      '[usePushNotifications] Push notifications require a physical device.\n' +
      '  iOS Simulator: APNs has no device token → notifications will NOT arrive.\n' +
      '  Android Emulator: only works with Pixel/GMS images, not AOSP-only.\n' +
      '  Build with `eas build --profile development` to test on device.',
    );
    return null;
  }

  // ── Step 3: Android notification channels ─────────────────────────────────
  //
  // Channels are required on Android API ≥ 26 (Android 8 Oreo) and above.
  // They must exist BEFORE any notification is delivered; without a matching
  // channelId the notification is silently dropped.
  if (Platform.OS === 'android') {
    for (const channel of ANDROID_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name:             channel.name,
        importance:       channel.importance,
        vibrationPattern: channel.vibrationPattern,
        lightColor:       channel.lightColor,
        sound:            channel.sound ?? null,
      });
    }
  }

  // ── Step 4: Permission request ────────────────────────────────────────────
  //
  // getPermissionsAsync: returns the current grant status without prompting.
  // requestPermissionsAsync: shows the OS permission dialog if needed.
  //
  // Android 13+ (API level 33, "Tiramisu") introduced POST_NOTIFICATIONS as
  // a runtime permission (analogous to iOS). expo-notifications v0.32+
  // automatically includes this permission in the request on Android 13+,
  // so no separate PermissionsAndroid.request() call is required. However,
  // your app.json / app.config.js must declare:
  //
  //   "android": {
  //     "permissions": ["android.permission.POST_NOTIFICATIONS"]
  //   }
  //
  // On Android < 13, requestPermissionsAsync is a no-op — the permission is
  // granted automatically at install time and cannot be revoked at runtime.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert:        true,
        allowBadge:        true,
        allowSound:        true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts:   false,
        provideAppNotificationSettings: true,
        allowAnnouncements:    false,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn(
      '[usePushNotifications] Push notification permission was denied. ' +
      'The user must grant permission in Settings → Notifications.',
    );
    return null;
  }

  // ── Step 5: Fetch Expo push token ─────────────────────────────────────────
  //
  // getExpoPushTokenAsync requires the EAS project ID, which ties the token
  // to your specific app in Expo's push delivery infrastructure.
  //
  // The projectId is expected in Constants.expoConfig (SDK 46+). If absent,
  // we fall through to process.env as a CI escape hatch.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.manifest?.extra?.eas?.projectId ??
    process.env.EXPO_PROJECT_ID;

  if (!projectId) {
    console.warn(
      '[usePushNotifications] EAS projectId not found in app config. ' +
      'Add `extra.eas.projectId` to app.json or set EXPO_PROJECT_ID env var. ' +
      'Push token unavailable without a valid projectId.',
    );
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data; // 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]'
  } catch (err) {
    console.error('[usePushNotifications] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// usePushNotifications  — the hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} UsePushNotificationsOptions
 * @property {(token: string) => void} [onTokenRefresh]
 *   Called whenever the push token rotates (reinstall, device transfer, etc.).
 *   Use this to re-sync the token to Firestore without remounting the hook.
 * @property {(notification: import('expo-notifications').Notification) => void} [onNotificationReceived]
 *   Called for every foreground push notification in addition to updating state.
 * @property {(response: import('expo-notifications').NotificationResponse) => void} [onNotificationResponse]
 *   Called when the user taps a notification (fore- or background) in addition
 *   to updating state. Ideal for deep-link routing.
 */

/**
 * @typedef {object} UsePushNotificationsReturn
 * @property {string|null}  expoPushToken       - Current 'ExponentPushToken[…]' or null
 * @property {string}       permissionStatus    - 'granted'|'denied'|'undetermined'|'loading'
 * @property {boolean}      isLoading           - true while acquiring the initial token
 * @property {Error|null}   error               - Any error thrown during initialisation
 * @property {import('expo-notifications').Notification|null}        notification
 *   The most-recently received foreground notification object.
 * @property {import('expo-notifications').NotificationResponse|null} notificationResponse
 *   The most-recently tapped notification response (from tray or foreground).
 */

/**
 * usePushNotifications
 *
 * Manages the full Expo push notification lifecycle for a React component tree.
 * Mount once at the app root (AppNavigator or App.js) so that the global
 * notification handler and listeners are active for the entire session.
 *
 * @param {UsePushNotificationsOptions} [options]
 * @returns {UsePushNotificationsReturn}
 */
export function usePushNotifications(options = {}) {
  const { onTokenRefresh, onNotificationReceived, onNotificationResponse } = options;

  // ── State ──────────────────────────────────────────────────────────────────
  const [expoPushToken,        setExpoPushToken]        = useState(null);
  const [permissionStatus,     setPermissionStatus]     = useState('loading');
  const [isLoading,            setIsLoading]            = useState(true);
  const [error,                setError]                = useState(null);
  const [notification,         setNotification]         = useState(null);
  const [notificationResponse, setNotificationResponse] = useState(null);

  // ── Listener refs (stable across re-renders, cleaned up in effect return) ──
  const receivedListenerRef = useRef(null);
  const responseListenerRef = useRef(null);
  const tokenListenerRef    = useRef(null);

  // Stable callback refs (avoids stale-closure issues without re-firing effect)
  const onTokenRefreshRef          = useRef(onTokenRefresh);
  const onNotificationReceivedRef  = useRef(onNotificationReceived);
  const onNotificationResponseRef  = useRef(onNotificationResponse);

  // Keep callback refs up-to-date without triggering re-renders or re-effects
  useEffect(() => { onTokenRefreshRef.current         = onTokenRefresh;         });
  useEffect(() => { onNotificationReceivedRef.current = onNotificationReceived; });
  useEffect(() => { onNotificationResponseRef.current = onNotificationResponse; });

  // ── Main effect — runs once on mount, cleans up on unmount ────────────────
  useEffect(() => {
    let isMounted = true; // guard against setState after unmount

    // ── Acquire the initial push token ─────────────────────────────────────
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();

        if (!isMounted) return;

        if (token) {
          setExpoPushToken(token);
          setPermissionStatus('granted');
        } else {
          // null → either simulator, denied, or missing projectId
          // registerForPushNotificationsAsync already logs the reason.
          const { status } = await Notifications.getPermissionsAsync().catch(
            () => ({ status: 'undetermined' }),
          );
          setPermissionStatus(status);
        }
      } catch (err) {
        if (isMounted) {
          console.error('[usePushNotifications] init error:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setPermissionStatus('undetermined');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    // ── Listener 1: Token rotation ─────────────────────────────────────────
    //
    // Fired by Expo's infrastructure when the push token changes (e.g., app
    // reinstall, device transfer, APNs / FCM credential rotation).
    // We update local state AND call the onTokenRefresh callback so the caller
    // can re-sync Firestore without needing to unmount / remount the hook.
    tokenListenerRef.current = Notifications.addPushTokenListener(({ data: newToken }) => {
      if (!isMounted || !newToken) return;
      console.log('[usePushNotifications] Token rotated:', newToken);
      setExpoPushToken(newToken);
      onTokenRefreshRef.current?.(newToken);
    });

    // ── Listener 2: Foreground notification received ───────────────────────
    //
    // Fires when a push notification arrives while the app is foregrounded.
    // Thanks to setNotificationHandler (inside registerForPushNotificationsAsync),
    // the banner / sound / badge update fires automatically — this listener
    // is for driving reactive UI (e.g., an in-app banner component, badge counter).
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(
      (incomingNotification) => {
        if (!isMounted) return;
        setNotification(incomingNotification);
        onNotificationReceivedRef.current?.(incomingNotification);
      },
    );

    // ── Listener 3: Notification response (user tap) ──────────────────────
    //
    // Fires when the user taps a notification in the system tray, whether the
    // app was foregrounded, backgrounded, or killed when the tap occurred.
    // `response.notification.request.content.data` carries the dataPayload
    // from sendPushNotification — inspect it to perform deep-link routing:
    //
    //   const { type, appointmentId } = response.notification.request.content.data;
    //   if (type === 'new_appointment') navigation.navigate('Appointments');
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (resp) => {
        if (!isMounted) return;
        setNotificationResponse(resp);
        onNotificationResponseRef.current?.(resp);
      },
    );

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      isMounted = false;

      if (tokenListenerRef.current) {
        tokenListenerRef.current.remove();
        tokenListenerRef.current = null;
      }
      if (receivedListenerRef.current) {
        receivedListenerRef.current.remove();
        receivedListenerRef.current = null;
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
        responseListenerRef.current = null;
      }
    };
  }, []); // ← empty deps: fire once on mount, clean up on unmount

  return {
    expoPushToken,
    permissionStatus,
    isLoading,
    error,
    notification,
    notificationResponse,
  };
}