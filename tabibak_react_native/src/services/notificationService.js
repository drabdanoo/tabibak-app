/**
 * notificationService.js — Push Notification Engine (Phase 5)
 *
 * Singleton class that provides:
 *   1. Permission management (with Android 13+ awareness)
 *   2. Token registration — writes to BOTH Firestore locations:
 *        • userTokens/{uid}  — rich device record used for analytics / multi-device
 *        • users/{uid}       — pushToken field read by sendPushNotification
 *   3. Token unregistration on logout
 *   4. Local notification scheduling / cancellation
 *   5. Notification listener management (foreground + tap)
 *   6. sendPushNotification — raw Expo Push API sender
 *
 * ── Architecture: Token Registry ─────────────────────────────────────────────
 *
 *  The Expo push token must be stored where the app can retrieve it at send-time.
 *  We write to TWO Firestore locations on every registration to satisfy different
 *  access patterns:
 *
 *  ┌─ userTokens/{uid} ──────────────────────────────────────────────────────┐
 *  │  Rich device record:                                                     │
 *  │    userId, role, token, platform, deviceInfo, updatedAt                 │
 *  │  Use-case: analytics, multi-device token lists, server-side queries.    │
 *  └──────────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ users/{uid}  (pushToken field) ───────────────────────────────────────┐
 *  │  Inline on the user's own profile document:                            │
 *  │    pushToken, pushTokenPlatform, pushTokenUpdatedAt                    │
 *  │  Use-case: quick lookup when sending a notification to a specific user  │
 *  │  without a secondary collection query.                                  │
 *  │  Read by: sendPushNotification callers, doctor-to-patient alerts, etc. │
 *  └──────────────────────────────────────────────────────────────────────────┘
 *
 *  Both writes use setDoc with { merge: true } so they never clobber other
 *  fields on the document.
 *
 * ── Architecture: sendPushNotification ───────────────────────────────────────
 *
 *  Uses a raw fetch POST to https://exp.host/--/api/v2/push/send — no Expo
 *  server SDK required. The function validates both the HTTP status AND the
 *  Expo-level status field inside the response body (the API returns HTTP 200
 *  even for logical errors like DeviceNotRegistered).
 *
 *  ⚠️  HARDWARE WARNING:
 *  iOS simulators CANNOT receive push notifications. APNs requires a physical
 *  device token that the iOS Simulator cannot generate. sendPushNotification
 *  will appear to succeed (HTTP 200) but the notification will never arrive.
 *  Always test end-to-end push delivery on a real iPhone / iPad built with
 *  `eas build --profile development --platform ios`.
 *
 *  Android Emulators can receive push notifications only if Google Play
 *  Services (GMS) are installed. AOSP-only emulator images will not receive
 *  FCM-routed notifications.
 *
 * ── Architecture: Android 13+ Permission ─────────────────────────────────────
 *
 *  Android 13 (API level 33 "Tiramisu") introduced POST_NOTIFICATIONS as a
 *  runtime permission. expo-notifications v0.32+ automatically includes it in
 *  requestPermissionsAsync on Android 13+ — no separate PermissionsAndroid
 *  call is required.
 *
 *  Your app.json / app.config.js MUST declare:
 *    "android": { "permissions": ["android.permission.POST_NOTIFICATIONS"] }
 *
 *  On Android < 13 the permission is auto-granted at install time; this call
 *  is a no-op on older devices.
 *
 * ── Integration with AuthContext ──────────────────────────────────────────────
 *
 *  AuthContext calls:
 *    • notificationService.registerDeviceToken(uid, role)  — on sign-in
 *    • notificationService.unregisterDeviceToken(uid)      — on sign-out
 *
 *  Both are already wired in AuthContext.js (onAuthStateChanged). No further
 *  modification to AuthContext is required for the token registry to work.
 *
 *  For token rotation (token changes while the app is running), use the
 *  usePushNotifications hook's onTokenRefresh callback:
 *
 *    const { expoPushToken } = usePushNotifications({
 *      onTokenRefresh: (newToken) => {
 *        if (uid) notificationService.syncTokenToUserDocument(uid, newToken);
 *      },
 *    });
 */

import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import Constants          from 'expo-constants';
import { Platform }       from 'react-native';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level foreground handler
//
// Called once when this module is first imported (before any class instance is
// used). Ensures foreground notifications show alerts, play sounds, and update
// the badge for the entire session — even before the usePushNotifications hook
// mounts. The hook calls setNotificationHandler again on mount (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,  // Show banner / alert while app is foregrounded
    shouldPlaySound: true,  // Play notification sound while foregrounded
    shouldSetBadge: true,   // Increment app icon badge while foregrounded
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Expo Push API
// ─────────────────────────────────────────────────────────────────────────────
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

// ─────────────────────────────────────────────────────────────────────────────
// Android channel definitions (must exist before any notification is delivered)
// ─────────────────────────────────────────────────────────────────────────────
const ANDROID_CHANNELS = [
  {
    id:               'default',
    name:             'General',
    importance:       Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor:       '#10b981',
  },
  {
    id:               'appointments',
    name:             'Appointment Reminders',
    importance:       Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound:            'default',
  },
];

class NotificationService {
  constructor() {
    this.db = getFirestore();
    this.notificationListener = null;
    this.responseListener     = null;
  }

  // ── Permission management ─────────────────────────────────────────────────

  /**
   * Request push notification permissions from the OS.
   *
   * Android 13+ (API 33): requestPermissionsAsync triggers the
   * POST_NOTIFICATIONS runtime permission dialog. expo-notifications v0.32+
   * handles this automatically — no separate PermissionsAndroid call needed.
   * Requires "android.permission.POST_NOTIFICATIONS" in app.json.
   *
   * iOS: Shows the standard "Allow Notifications?" system alert on first call.
   *
   * @returns {Promise<boolean>} true if 'granted', false otherwise
   */
  async requestPermissions() {
    try {
      // ⚠️  iOS Simulator cannot receive push notifications (no APNs device
      // token). This guard avoids the confusing "succeeded but no notification
      // arrived" scenario during development on simulator.
      if (!Device.isDevice) {
        console.warn(
          '[NotificationService] Physical device required. ' +
          'iOS Simulator and Android Emulator (AOSP) cannot receive push notifications.',
        );
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        // Android 13+ (API 33): requestPermissionsAsync includes POST_NOTIFICATIONS.
        // On Android < 13: this is a no-op (auto-granted at install time).
        // On iOS: shows the "Allow Notifications?" system dialog.
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            provideAppNotificationSettings: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Push notification permission denied.');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[NotificationService] requestPermissions error:', error);
      return false;
    }
  }

  // ── Token acquisition ─────────────────────────────────────────────────────

  /**
   * Obtain the Expo push token for this device.
   *
   * ⚠️  iOS Simulator: getExpoPushTokenAsync may not throw but the returned
   * token will NOT receive real APNs notifications. Test on a physical device.
   *
   * @returns {Promise<string|null>} 'ExponentPushToken[xxxxxxxx]' or null
   */
  async getExpoPushToken() {
    try {
      if (!Device.isDevice) {
        console.warn('[NotificationService] Push token only available on physical devices.');
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.manifest?.extra?.eas?.projectId ??
        process.env.EXPO_PROJECT_ID;

      if (!projectId) {
        console.warn(
          '[NotificationService] EAS projectId not configured. ' +
          'Add extra.eas.projectId to app.json for production push support.',
        );
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      return tokenData.data; // 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]'
    } catch (error) {
      console.error('[NotificationService] getExpoPushToken error:', error);
      return null;
    }
  }

  // ── Token registry ────────────────────────────────────────────────────────

  /**
   * Sync a push token directly to users/{uid} document as the `pushToken`
   * field. This is the fast lookup path used by sendPushNotification callers.
   *
   * Called by:
   *   • registerDeviceToken (on login)
   *   • usePushNotifications onTokenRefresh callback (on token rotation)
   *
   * Uses setDoc with { merge: true } — never clobbers other profile fields.
   *
   * @param {string} uid    - Firebase Auth user ID
   * @param {string} token  - 'ExponentPushToken[xxxxxxxx]'
   * @returns {Promise<boolean>}
   */
  async syncTokenToUserDocument(uid, token) {
    if (!uid || !token) return false;
    try {
      await setDoc(
        doc(this.db, COLLECTIONS.USERS, uid),
        {
          pushToken:            token,
          pushTokenPlatform:    Platform.OS,
          pushTokenUpdatedAt:   serverTimestamp(),
        },
        { merge: true }, // preserve all other profile fields
      );
      console.log('[NotificationService] pushToken synced to users/', uid);
      return true;
    } catch (error) {
      console.error('[NotificationService] syncTokenToUserDocument error:', error);
      return false;
    }
  }

  /**
   * Full device registration flow called by AuthContext on sign-in.
   *
   * Steps:
   *   1. Request OS permissions (Android 13+ aware)
   *   2. Create Android notification channels (required on API ≥ 26)
   *   3. Fetch the Expo push token
   *   4. Write to userTokens/{uid}  — rich device record
   *   5. Write to users/{uid}       — pushToken field (fast lookup)
   *
   * If the token has not changed since the last login, both writes are
   * idempotent (same value, serverTimestamp updated).
   *
   * @param {string} userId  - Firebase Auth UID
   * @param {string} role    - 'doctor' | 'patient' | 'receptionist'
   * @returns {Promise<boolean>}
   */
  async registerDeviceToken(userId, role) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return false;

      const token = await this.getExpoPushToken();
      if (!token) return false;

      // Android: create channels BEFORE the token is stored so the first
      // incoming notification has a valid channelId to target.
      if (Platform.OS === 'android') {
        for (const ch of ANDROID_CHANNELS) {
          await Notifications.setNotificationChannelAsync(ch.id, {
            name:             ch.name,
            importance:       ch.importance,
            vibrationPattern: ch.vibrationPattern,
            lightColor:       ch.lightColor ?? undefined,
            sound:            ch.sound ?? null,
          });
        }
      }

      // ── Write 1: userTokens/{uid} — rich device record ─────────────────
      await setDoc(
        doc(this.db, COLLECTIONS.USER_TOKENS, userId),
        {
          userId,
          role,
          token,
          platform:   Platform.OS,
          deviceInfo: {
            brand:     Device.brand,
            modelName: Device.modelName,
            osName:    Device.osName,
            osVersion: Device.osVersion,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // ── Write 2: users/{uid} — pushToken field (fast lookup) ───────────
      await this.syncTokenToUserDocument(userId, token);

      console.log('[NotificationService] Device token registered for user:', userId);
      return true;
    } catch (error) {
      console.error('[NotificationService] registerDeviceToken error:', error);
      return false;
    }
  }

  /**
   * Clear the device token on sign-out.
   *
   * Deletes the userTokens/{uid} document and nulls pushToken on users/{uid}.
   * This prevents stale tokens from receiving notifications after logout.
   *
   * Firestore permission-denied errors are swallowed — the user is signing
   * out regardless, and a stale token is preferable to blocking logout.
   *
   * @param {string} userId - Firebase Auth UID
   * @returns {Promise<boolean>}
   */
  async unregisterDeviceToken(userId) {
    try {
      // Remove the rich device record
      await deleteDoc(doc(this.db, COLLECTIONS.USER_TOKENS, userId));

      // Null the inline pushToken on the user profile
      await setDoc(
        doc(this.db, COLLECTIONS.USERS, userId),
        {
          pushToken:          null,
          pushTokenUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      console.log('[NotificationService] Device token unregistered for user:', userId);
      return true;
    } catch (error) {
      if (error.code === 'permission-denied') {
        // Expected: Firestore rules may deny delete on logout race condition.
        console.warn(
          '[NotificationService] Permission denied on token unregister — ' +
          'proceeding with logout anyway.',
        );
        return true; // Do not block logout
      }
      console.error('[NotificationService] unregisterDeviceToken error:', error);
      return true; // Still do not block logout
    }
  }

  // ── Push notification sender ──────────────────────────────────────────────

  /**
   * Send a push notification to a single device via the Expo Push API.
   *
   * Uses a raw fetch POST — no Expo server SDK dependency.
   *
   * ⚠️  iOS SIMULATOR WARNING:
   * This function will return a successful response (HTTP 200, status: 'ok')
   * when targeting a token from an iOS Simulator. However, the notification
   * will NEVER appear on the simulator because APNs requires a real device
   * token that the simulator cannot provide.
   * → ALWAYS test push delivery on a physical iOS device.
   *
   * ⚠️  Android Emulator:
   * Push notifications work on emulators with Google Play Services (e.g.,
   * Pixel emulator images). They will NOT work on AOSP-only images.
   *
   * Expo Push API error types:
   *   DeviceNotRegistered  — token is invalid / app uninstalled → remove token
   *   MessageTooBig        — payload exceeds 4096 bytes
   *   MessageRateExceeded  — sending too fast for this device
   *   InvalidCredentials   — APNs / FCM credentials invalid (EAS config issue)
   *
   * @param {string} targetToken  - 'ExponentPushToken[xxxxxxxx]' of the recipient
   * @param {string} title        - Notification title shown in the system tray
   * @param {string} body         - Notification body text
   * @param {object} [dataPayload={}] - Custom key-value data merged into
   *   notification.request.content.data. Used for deep-link routing on receipt:
   *     { type: 'new_appointment', appointmentId: 'abc123' }
   * @param {object} [options={}]
   * @param {string} [options.channelId='default'] - Android channel (must be registered)
   * @param {string} [options.priority='high']     - 'default'|'normal'|'high'
   * @param {number} [options.badge]               - Badge count to set on the icon
   * @returns {Promise<object>} Expo API response body
   * @throws {Error} On HTTP error or Expo-level logical error
   */
  async sendPushNotification(targetToken, title, body, dataPayload = {}, options = {}) {
    // ── Input guard ──────────────────────────────────────────────────────────
    if (!targetToken || typeof targetToken !== 'string') {
      throw new Error(
        '[NotificationService] sendPushNotification: targetToken must be a non-empty string.',
      );
    }
    if (!targetToken.startsWith('ExponentPushToken[')) {
      // Log a warning but proceed — non-Expo tokens (raw APNs / FCM) are not
      // supported by the Expo Push API.
      console.warn(
        '[NotificationService] sendPushNotification: token does not look like ' +
        'an Expo push token ("ExponentPushToken[…]"). Delivery may fail.',
      );
    }

    // ── Build the message payload ─────────────────────────────────────────────
    // Full Expo Push Message format:
    // https://docs.expo.dev/push-notifications/sending-notifications/#message-request-format
    const message = {
      to:        targetToken,
      title:     title       ?? '',
      body:      body        ?? '',
      data:      dataPayload ?? {},
      sound:     'default',
      priority:  options.priority  ?? 'high',
      channelId: options.channelId ?? 'default', // Android API ≥ 26 required
      ...(options.badge !== undefined && { badge: options.badge }),
    };

    // ── HTTP POST to Expo Push API ────────────────────────────────────────────
    let response;
    try {
      response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: {
          Accept:           'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type':   'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (networkError) {
      console.error('[NotificationService] sendPushNotification network error:', networkError);
      throw new Error(
        `[NotificationService] Network request to Expo Push API failed: ${networkError.message}`,
      );
    }

    // ── Parse and validate the response ──────────────────────────────────────
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error(
        `[NotificationService] Failed to parse Expo Push API response (status ${response.status}).`,
      );
    }

    // HTTP-level error (4xx / 5xx)
    if (!response.ok) {
      throw new Error(
        `[NotificationService] Expo Push API HTTP error: ${response.status} ${response.statusText}`,
      );
    }

    // Expo-level logical error — the API returns HTTP 200 even for these
    const ticketData = result?.data;
    if (ticketData?.status === 'error') {
      const errorType    = ticketData.details?.error ?? 'UnknownError';
      const errorMessage = ticketData.message ?? 'Unknown Expo Push error';

      console.error(
        `[NotificationService] Expo Push delivery error [${errorType}]:`,
        errorMessage,
      );

      // DeviceNotRegistered: the token is stale — caller should remove it from Firestore
      if (errorType === 'DeviceNotRegistered') {
        const err    = new Error(errorMessage);
        err.code     = 'DeviceNotRegistered';
        err.ticketData = ticketData;
        throw err;
      }

      throw new Error(`[NotificationService] ${errorType}: ${errorMessage}`);
    }

    console.log('[NotificationService] Push notification sent. Ticket:', ticketData);
    return result;
  }

  // ── Notification listeners (component-level management) ───────────────────
  //
  // NOTE: For React components, prefer the usePushNotifications hook which
  // manages these listeners with proper React lifecycle cleanup. Use these
  // methods only in non-React contexts (e.g., service workers, background tasks).

  /**
   * Set up notification listeners outside of React component context.
   * For React components, use usePushNotifications hook instead.
   *
   * @param {Function} onNotificationReceived - Callback for foreground notifications
   * @param {Function} onNotificationTapped   - Callback for notification tap events
   */
  setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[NotificationService] Notification received:', notification);
        onNotificationReceived?.(notification);
      },
    );

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('[NotificationService] Notification tapped:', response);
        onNotificationTapped?.(response);
      },
    );
  }

  /** Remove notification listeners registered via setupNotificationListeners. */
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  // ── Local notification scheduling ────────────────────────────────────────

  /**
   * Schedule a local notification.
   *
   * @param {string}  title       - Notification title
   * @param {string}  body        - Notification body
   * @param {object}  [data={}]   - Additional data payload
   * @param {Date|null} [triggerDate=null] - When to trigger; null = immediate
   * @returns {Promise<string|null>} Notification identifier
   */
  async scheduleNotification(title, body, data = {}, triggerDate = null) {
    try {
      const trigger = triggerDate ? { date: triggerDate } : null;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound:    'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      return notificationId;
    } catch (error) {
      console.error('[NotificationService] scheduleNotification error:', error);
      return null;
    }
  }

  /** Cancel a single scheduled notification by its identifier. */
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('[NotificationService] cancelNotification error:', error);
    }
  }

  /** Cancel all pending scheduled notifications. */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('[NotificationService] cancelAllNotifications error:', error);
    }
  }

  // ── Badge management ──────────────────────────────────────────────────────

  /** @returns {Promise<number>} Current app icon badge count */
  async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('[NotificationService] getBadgeCount error:', error);
      return 0;
    }
  }

  /** @param {number} count - New badge count (0 to clear) */
  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('[NotificationService] setBadgeCount error:', error);
    }
  }

  // ── Convenience senders ───────────────────────────────────────────────────

  /**
   * Schedule an immediate local notification simulating a new appointment alert.
   * Used when a real-time Firestore listener detects a new booking and the
   * app is backgrounded / foregrounded but the push hasn't arrived yet.
   */
  async playNotificationSound() {
    try {
      await this.scheduleNotification(
        'موعد جديد',
        'لديك طلب موعد جديد',
        { type: 'new_appointment' },
      );
    } catch (error) {
      console.error('[NotificationService] playNotificationSound error:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────────────────────────────────────
export default new NotificationService();
