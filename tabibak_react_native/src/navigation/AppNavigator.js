/**
 * AppNavigator.js — Root Navigation + Push Notification Bridge
 *
 * Extends the original AppNavigator with two responsibilities:
 *
 *   1. TOKEN SYNC (token rotation)
 *      When Expo issues a new push token while the app is running (reinstall,
 *      device transfer, APNs/FCM credential rotation), the onTokenRefresh
 *      callback re-syncs the new token to users/{uid} so the Firestore
 *      fast-lookup path stays current between logins.
 *
 *      On login, AuthContext already calls
 *      notificationService.registerDeviceToken(uid, role) which writes to
 *      BOTH Firestore locations (userTokens/{uid} and users/{uid}). This
 *      bridge only handles mid-session rotation.
 *
 *   2. DEEP-LINK ROUTING (notification tap → screen)
 *      When the user taps a push notification in the system tray, the
 *      onNotificationResponse callback resolves a screen name from the
 *      notification's data.type field + the active userRole, then calls
 *      navigationRef.navigate(screenName).
 *
 * ── Cold-start handling ───────────────────────────────────────────────────────
 *
 *  If the app is killed when the user taps a notification, the NavigationContainer
 *  may not be mounted when the response fires (AuthContext initializing = true
 *  shows the loading spinner instead). The response is buffered in a ref and
 *  consumed in NavigationContainer's onReady callback.
 *
 * ── Placement rationale ───────────────────────────────────────────────────────
 *
 *  usePushNotifications is called unconditionally at the AppNavigator root
 *  (NOT inside a role-specific stack) so its listeners and token handler stay
 *  alive across auth state changes, stack swaps, and screen re-mounts.
 *
 * ── Route map ─────────────────────────────────────────────────────────────────
 *
 *  ROUTE_MAP[userRole][notificationType] → React Navigation screen name.
 *  Screen names must match Tab.Screen name= props in the role stacks:
 *
 *    DoctorStack tabs:       'Dashboard' | 'Appointments' | 'Profile'
 *    PatientStack tabs:      'Home' | 'Appointments' | 'Documents' | 'Profile'
 *    ReceptionistStack tabs: 'Dashboard' | 'Appointments' | 'Notifications' | 'Profile'
 *
 *  React Navigation resolves screen names within the currently mounted tree:
 *  navigationRef.navigate('Appointments') while in DoctorStack switches the
 *  DoctorTabs navigator to the Appointments tab.
 *
 * ── Notification data payload contract ────────────────────────────────────────
 *
 *  Senders must include a `type` key in the dataPayload passed to
 *  notificationService.sendPushNotification(token, title, body, dataPayload):
 *
 *    { type: 'new_appointment',       appointmentId: string }
 *    { type: 'appointment_confirmed', appointmentId: string }
 *    { type: 'appointment_cancelled', appointmentId: string }
 *    { type: 'appointment_reminder',  appointmentId: string }
 *    { type: 'new_prescription',      appointmentId: string }
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';

import { useAuth }              from '../contexts/AuthContext';
import { USER_ROLES }           from '../config/firebase';
import { Colors }               from '../config/theme';
import { usePushNotifications } from '../hooks/usePushNotifications';
import notificationService      from '../services/notificationService';

// ── Auth screens ──────────────────────────────────────────────────────────────
import PhoneAuthScreen       from '../screens/auth/PhoneAuthScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import RoleSelectionScreen   from '../screens/auth/RoleSelectionScreen';
import EmailLoginScreen      from '../screens/auth/EmailLoginScreen';
import ProfileSetupScreen    from '../screens/auth/ProfileSetupScreen';

// ── Role stacks ───────────────────────────────────────────────────────────────
import PatientStack      from './PatientStack';
import DoctorStack       from './DoctorStack';
import ReceptionistStack from './ReceptionistStack';

const Stack = createNativeStackNavigator();

// ─────────────────────────────────────────────────────────────────────────────
// Deep-link route map
//
// Maps { [userRole]: { [notificationType]: tabScreenName } }
//
// Each value is the `name` prop of a Tab.Screen in the role's tab navigator.
// Unmapped types fall back to DEFAULT_TAB[role].
// ─────────────────────────────────────────────────────────────────────────────
const ROUTE_MAP = {
  // ── Doctor tab names: 'Dashboard' | 'Appointments' | 'Profile' ────────────
  [USER_ROLES.DOCTOR]: {
    new_appointment:       'Appointments', // new booking created by patient
    appointment_cancelled: 'Appointments', // patient cancelled their booking
    appointment_reminder:  'Appointments', // upcoming appointment reminder
  },

  // ── Patient tab names: 'Home' | 'Appointments' | 'Documents' | 'Profile' ──
  [USER_ROLES.PATIENT]: {
    appointment_confirmed: 'Appointments', // doctor/receptionist confirmed
    appointment_cancelled: 'Appointments', // doctor/clinic cancelled
    appointment_reminder:  'Appointments', // upcoming appointment reminder
    new_prescription:      'Appointments', // doctor issued a prescription
  },

  // ── Receptionist tab names: 'Dashboard' | 'Appointments' | 'Notifications' | 'Profile'
  [USER_ROLES.RECEPTIONIST]: {
    new_appointment:       'Appointments', // new booking needs confirmation
    appointment_cancelled: 'Appointments', // cancellation to process
  },
};

// Fallback landing tab per role when no ROUTE_MAP entry matches the type
const DEFAULT_TAB = {
  [USER_ROLES.DOCTOR]:       'Dashboard',
  [USER_ROLES.PATIENT]:      'Home',
  [USER_ROLES.RECEPTIONIST]: 'Dashboard',
};

// ─────────────────────────────────────────────────────────────────────────────
// AppNavigator
// ─────────────────────────────────────────────────────────────────────────────
const AppNavigator = () => {
  const { user, userRole, userProfile, loading, initializing } = useAuth();

  // ── Navigation ref ─────────────────────────────────────────────────────────
  // useNavigationContainerRef() returns a NavigationContainerRef whose
  // methods (.navigate, .isReady, etc.) are exposed directly on the ref
  // object (not via .current). Pass as ref={navigationRef} to NavigationContainer.
  const navigationRef = useNavigationContainerRef();

  // Buffer for notification responses received before the NavigationContainer
  // is ready (cold-start: user taps notification → app launches from killed state).
  // Drained in the NavigationContainer onReady callback.
  const pendingNotificationResponseRef = useRef(null);

  // ── Stable refs for mutable auth state ────────────────────────────────────
  // Notification callbacks are created once (useCallback with empty or minimal
  // deps) and read the latest auth state through refs to avoid stale closures
  // without re-creating / re-registering listeners on every role/user change.
  const userRoleRef = useRef(userRole);
  const userRef     = useRef(user);

  useEffect(() => { userRoleRef.current = userRole; }, [userRole]);
  useEffect(() => { userRef.current     = user;     }, [user]);

  // ── Route resolver ─────────────────────────────────────────────────────────
  // Pure function: (notificationType) → tabScreenName | null
  // Reads the current role from userRoleRef so it is always up-to-date.
  const resolveRoute = useCallback((notificationType) => {
    const role       = userRoleRef.current;
    const roleRoutes = ROUTE_MAP[role] ?? {};
    return roleRoutes[notificationType] ?? DEFAULT_TAB[role] ?? null;
  }, []); // no deps — reads role via ref (stable)

  // ── Navigate to notification screen ───────────────────────────────────────
  const navigateToNotification = useCallback((response) => {
    const type         = response?.notification?.request?.content?.data?.type ?? '';
    const targetScreen = resolveRoute(type);

    if (!targetScreen) {
      console.warn(
        '[AppNavigator] No route for notification —',
        'type:', type, '| role:', userRoleRef.current,
      );
      return;
    }

    console.log(
      '[AppNavigator] Deep link from notification →', targetScreen,
      '(type:', type, '| role:', userRoleRef.current, ')',
    );

    // navigate() switches to the tab with this name within the currently
    // mounted tab navigator. If the user is on DoctorStack > DoctorTabs,
    // navigate('Appointments') switches to the Appointments tab directly.
    navigationRef.navigate(targetScreen);
  }, [navigationRef, resolveRoute]);

  // ── onNotificationResponse (usePushNotifications callback) ────────────────
  // Fired when the user taps a push notification (foreground or system tray).
  // If the NavigationContainer is not yet ready (cold-start), buffer the
  // response and process it once onReady fires.
  const handleNotificationResponse = useCallback((response) => {
    if (!navigationRef.isReady()) {
      // Cold-start: NavigationContainer hasn't mounted yet (initializing = true
      // is showing the spinner instead of the nav tree). Buffer and drain onReady.
      pendingNotificationResponseRef.current = response;
      return;
    }
    navigateToNotification(response);
  }, [navigationRef, navigateToNotification]);

  // ── onReady (NavigationContainer prop) ────────────────────────────────────
  // Called once the navigator tree is fully mounted and navigationRef.isReady()
  // returns true. Drains the pending cold-start notification response, if any.
  const handleNavigationReady = useCallback(() => {
    const pending = pendingNotificationResponseRef.current;
    if (pending) {
      pendingNotificationResponseRef.current = null;
      navigateToNotification(pending);
    }
  }, [navigateToNotification]);

  // ── onTokenRefresh (usePushNotifications callback) ────────────────────────
  // Fired when Expo issues a rotated push token mid-session.
  // Re-syncs the new token to users/{uid} (Firestore fast-lookup path).
  // The userTokens/{uid} record is updated on the NEXT login via
  // AuthContext → notificationService.registerDeviceToken.
  const handleTokenRefresh = useCallback((newToken) => {
    const uid = userRef.current?.uid;
    const role = userRoleRef.current;
    // Fix: Added explicit null checks for uid and role before token sync
    if (!uid || !role || !newToken) {
      console.log('[AppNavigator] Token refresh skipped - missing uid or role');
      return;
    }

    notificationService.syncTokenToUserDocument(uid, newToken).catch((err) =>
      console.warn('[AppNavigator] Token refresh Firestore sync failed:', err),
    );
  }, []); // stable — reads uid via ref

  // ── onNotificationReceived (usePushNotifications callback) ────────────────
  // Fired when a push arrives while the app is FOREGROUNDED.
  // The system banner / sound / badge update are already handled by
  // setNotificationHandler in usePushNotifications. This callback is the
  // hook point for any additional in-app UI reactions.
  const handleNotificationReceived = useCallback((notification) => {
    const type = notification?.request?.content?.data?.type ?? 'unknown';
    console.log('[AppNavigator] Foreground notification received:', type);
    // Future: trigger a global state update, badge counter refresh, etc.
  }, []);

  // ── Mount push notification lifecycle ─────────────────────────────────────
  // Called unconditionally at the root — never unmounts between role/screen
  // changes. Token acquisition, foreground handler, and all three listeners
  // (token rotation, notification received, notification response) are active
  // for the full app session.
  usePushNotifications({
    onTokenRefresh:         handleTokenRefresh,
    onNotificationReceived: handleNotificationReceived,
    onNotificationResponse: handleNotificationResponse,
  });

  // ── Auth loading spinner ───────────────────────────────────────────────────
  // Show while Firebase resolves the initial auth state OR while AuthContext
  // is fetching the user's role/profile from Firestore after sign-in.
  // Once loading=false the role is definitively known (null = no profile yet).
  if (initializing || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Navigation tree ────────────────────────────────────────────────────────
  //
  // Three clear states so the navigator always has at least one screen:
  //
  //  1. !user              → Unauthenticated flow (RoleSelection → PhoneAuth …)
  //  2. user && !userRole  → New user: Firebase auth done but no Firestore
  //                          profile yet. Show ProfileSetup directly.
  //  3. user && userRole   → Fully authenticated; show the correct role stack.
  //
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={handleNavigationReady}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user || !userRole ? (
          // ── 1. Unauthenticated / role not yet resolved ─────────────────────
          // New patients are auto-registered in AuthContext.verifyOTP so
          // !userRole with a logged-in user is a transient state only.
          <>
            <Stack.Screen name="RoleSelection"   component={RoleSelectionScreen} />
            <Stack.Screen name="PhoneAuth"        component={PhoneAuthScreen} />
            <Stack.Screen name="OTPVerification"  component={OTPVerificationScreen} />
            <Stack.Screen name="EmailLogin"       component={EmailLoginScreen} />
          </>
        ) : (
          // ── 2. Fully authenticated — role-based stack ──────────────────────
          <>
            {userRole === USER_ROLES.PATIENT && (
              // Gate: if fullName or dateOfBirth is missing, force profile completion first
              (!userProfile?.fullName?.trim() || !userProfile?.dateOfBirth)
                ? <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                : <Stack.Screen name="PatientStack" component={PatientStack} />
            )}
            {userRole === USER_ROLES.DOCTOR && (
              <Stack.Screen name="DoctorStack" component={DoctorStack} />
            )}
            {userRole === USER_ROLES.RECEPTIONIST && (
              <Stack.Screen name="ReceptionistStack" component={ReceptionistStack} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: Colors.white,
  },
});

export default AppNavigator;