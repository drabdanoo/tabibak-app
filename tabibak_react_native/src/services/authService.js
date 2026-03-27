import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  browserLocalPersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { firebaseConfig, COLLECTIONS, USER_ROLES } from '../config/firebase';

// Initialize Firebase JS SDK (for Firestore, email auth, etc.)
// Persistence is platform-conditional:
//   native → @firebase/auth RN bundle has getReactNativePersistence
//   web    → firebase/auth browser bundle has browserLocalPersistence
// We use require() so each platform only loads the bundle it needs at runtime.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// initializeAuth must be called only ONCE per app instance across the entire
// JS lifetime (including dev-mode hot-reloads where module scope re-executes
// but the native Firebase app stays alive).  If auth is already initialized
// (i.e. this module was hot-reloaded), getAuth() returns the existing instance
// so Firestore continues to see a valid authenticated user.
function getOrInitAuth(firebaseApp) {
  try {
    const _persistence = Platform.OS === 'web'
      ? browserLocalPersistence
      : require('@firebase/auth').getReactNativePersistence(AsyncStorage);
    return initializeAuth(firebaseApp, { persistence: _persistence });
  } catch (e) {
    // auth/already-initialized — return the already-created instance
    return getAuth(firebaseApp);
  }
}

const auth = getOrInitAuth(app);
const db = getFirestore(app);


class AuthService {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.rnAuth = null;              // React Native Firebase auth (lazy loaded on native)
    this._pendingConfirmation = null; // Stored here so it never passes through nav state
  }

  /**
   * Get the React Native Firebase Auth instance (native only)
   */
  async getRNAuth() {
    if (Platform.OS === 'web') return null;
    if (!this.rnAuth) {
      const rnFirebase = require('@react-native-firebase/auth').default;
      this.rnAuth = rnFirebase();
    }
    return this.rnAuth;
  }

  /**
   * Send OTP to phone number using native Firebase SDK on mobile,
   * Firebase JS SDK on web.
   * @param {string} phoneNumber - Phone number in E.164 format (e.g., +9647701234567)
   * @returns {Promise<object>} - { success, confirmation } or { success: false, error }
   */
  async sendOTP(phoneNumber) {
    try {
      if (Platform.OS === 'web') {
        // Phone auth via OTP is only supported on the mobile app (Android/iOS).
        // On web, Firebase requires reCAPTCHA which is unreliable in dev/DevTools.
        // Real users always go through the native app where Play Integrity is used instead.
        return {
          success: false,
          error: 'Phone verification is only available on the mobile app. Please use the Android or iOS app to sign in.',
          code:  'auth/web-unsupported',
        };
      } else {
        // Native Android/iOS: use @react-native-firebase/auth
        // This uses Google Play Services for app verification — no reCAPTCHA needed
        const rnAuth = await this.getRNAuth();
        const confirmation = await rnAuth.signInWithPhoneNumber(phoneNumber);
        // Store here so it never has to travel through React Navigation params
        // (non-serializable Firebase objects crash state persistence).
        this._pendingConfirmation = confirmation;
        return { success: true };
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, error: error.message, code: error.code ?? 'unknown' };
    }
  }

  /**
   * Verify OTP code.
   *
   * ── Strategy ────────────────────────────────────────────────────────────────
   * On native we use @react-native-firebase/auth ONLY to obtain the
   * verificationId (via signInWithPhoneNumber).  We do NOT call
   * confirmation.confirm(code) — that would consume the OTP in the native SDK,
   * leaving nothing for the JS SDK.
   *
   * Instead we pass (verificationId, code) straight to the JS SDK's
   * PhoneAuthProvider → signInWithCredential.  The JS SDK signs in, fires
   * onAuthStateChanged, and Firestore (JS SDK) immediately sees an
   * authenticated user.  One OTP, one use, correct SDK.
   *
   * On web the JS SDK already owns the full phone-auth flow, so we just call
   * confirmation.confirm(code) as usual.
   *
   * @param {string} code - 6-digit OTP code entered by the user
   * @returns {Promise<{success:boolean, user?:object, error?:string, code?:string}>}
   */
  async verifyOTP(code) {
    try {
      if (Platform.OS !== 'web') {
        const confirmation = this._pendingConfirmation;
        if (!confirmation) {
          return { success: false, error: 'No pending OTP session. Please request a new code.', code: 'auth/no-session' };
        }

        const { signInWithCredential, PhoneAuthProvider } = await import('firebase/auth');
        const credential = PhoneAuthProvider.credential(confirmation.verificationId, code);
        const userCredential = await signInWithCredential(this.auth, credential);

        // Session consumed — clear the pending confirmation
        this._pendingConfirmation = null;

        return { success: true, user: userCredential.user };
      } else {
        // Web: JS SDK owns the full phone-auth flow
        const confirmation = this._pendingConfirmation;
        if (!confirmation) {
          return { success: false, error: 'No pending OTP session. Please request a new code.', code: 'auth/no-session' };
        }
        const userCredential = await confirmation.confirm(code);
        this._pendingConfirmation = null;
        return { success: true, user: userCredential.user };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, error: error.message, code: error.code ?? 'unknown' };
    }
  }

  /**
   * Get user role from Firestore
   * @param {string} uid - User ID
   * @returns {Promise<string|null>} - User role
   */
  async getUserRole(uid) {
    // ── 1. Custom JWT claims (authoritative, set by Cloud Functions / Admin SDK) ──
    // Check these first — they cannot be spoofed by incorrect Firestore data.
    try {
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        const idTokenResult = await currentUser.getIdTokenResult();
        const claims = idTokenResult.claims;
        if (claims.admin)        return USER_ROLES.ADMIN;
        if (claims.doctor)       return USER_ROLES.DOCTOR;
        if (claims.receptionist) return USER_ROLES.RECEPTIONIST;
        if (claims.patient)      return USER_ROLES.PATIENT;
      }
    } catch { /* claims unavailable — fall through to Firestore */ }

    // ── 2. Firestore role collections (fallback) ──
    // Each wrapped in its own try-catch so a permission denial on one collection
    // does not prevent the fallthrough checks on the others.
    try {
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, uid));
      if (userDoc.exists() && userDoc.data().role) return userDoc.data().role;
    } catch { /* document absent or rules denied */ }

    try {
      const patientDoc = await getDoc(doc(this.db, COLLECTIONS.PATIENTS, uid));
      if (patientDoc.exists()) return USER_ROLES.PATIENT;
    } catch { /* not a patient */ }

    try {
      const doctorDoc = await getDoc(doc(this.db, COLLECTIONS.DOCTORS, uid));
      if (doctorDoc.exists()) return USER_ROLES.DOCTOR;
    } catch { /* not a doctor */ }

    try {
      const receptionistDoc = await getDoc(doc(this.db, COLLECTIONS.RECEPTIONISTS, uid));
      if (receptionistDoc.exists()) return USER_ROLES.RECEPTIONIST;
    } catch { /* not a receptionist */ }

    return null;
  }

  /**
   * Get user profile data
   * @param {string} uid - User ID
   * @param {string} role - User role
   * @returns {Promise<object|null>} - User profile data
   */
  async getUserProfile(uid, role) {
    try {
      let collectionName;

      switch (role) {
        case USER_ROLES.PATIENT:
          collectionName = COLLECTIONS.PATIENTS;
          break;
        case USER_ROLES.DOCTOR:
          collectionName = COLLECTIONS.DOCTORS;
          break;
        case USER_ROLES.RECEPTIONIST:
          collectionName = COLLECTIONS.RECEPTIONISTS;
          break;
        default:
          collectionName = COLLECTIONS.USERS;
      }

      const docRef = doc(this.db, collectionName, uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }

      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Create patient profile
   * @param {string} uid - User ID
   * @param {object} profileData - Profile data
   * @returns {Promise<boolean>}
   */
  async createPatientProfile(uid, profileData) {
    try {
      const patientDocRef = doc(this.db, COLLECTIONS.PATIENTS, uid);
      await setDoc(patientDocRef, {
        ...profileData,
        role: USER_ROLES.PATIENT,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Also create/update in users collection
      const userDocRef = doc(this.db, COLLECTIONS.USERS, uid);
      await setDoc(userDocRef, {
        role: USER_ROLES.PATIENT,
        phoneNumber: profileData.phoneNumber,
        updatedAt: serverTimestamp()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('Error creating patient profile:', error);
      return false;
    }
  }

  /**
   * Sign in with email and password (for doctors and receptionists)
   * @param {string} email - Email address
   * @param {string} password - Password
   * @returns {Promise<object>}
   */
  async signInWithEmail(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('Error signing in with email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<boolean>}
   */
  async signOut() {
    try {
      console.log('Calling Firebase signOut');
      await firebaseSignOut(this.auth);
      console.log('Firebase signOut successful');
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
      return false;
    }
  }

  /**
   * Get current user
   * @returns {object|null}
   */
  getCurrentUser() {
    return this.auth.currentUser;
  }

  /**
   * Listen to auth state changes
   * @param {function} callback - Callback function
   * @returns {function} - Unsubscribe function
   */
  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, callback);
  }
}

const authServiceInstance = new AuthService();

export default authServiceInstance;
export { authServiceInstance as authService };
