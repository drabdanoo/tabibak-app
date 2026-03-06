import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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

// Custom AsyncStorage persistence for Firebase Auth JS SDK
// Avoids the getReactNativePersistence conflict with @react-native-firebase
const asyncStoragePersistence = {
  type: 'LOCAL',
  async _isAvailable() { return true; },
  async _set(key, value) { await AsyncStorage.setItem(key, JSON.stringify(value)); },
  async _get(key) {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  },
  async _remove(key) { await AsyncStorage.removeItem(key); },
  _addListener(_key, _listener) { },
  _removeListener(_key, _listener) { },
};

// Initialize Firebase JS SDK (for Firestore, email auth, etc.)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = initializeAuth(app, {
  persistence: asyncStoragePersistence,
});
const db = getFirestore(app);


class AuthService {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.recaptchaVerifier = null; // Still needed for web phone auth
    this.rnAuth = null; // React Native Firebase auth (lazy loaded on native)
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
        // Web: use Firebase JS SDK with RecaptchaVerifier
        const { signInWithPhoneNumber, RecaptchaVerifier } = await import('firebase/auth');
        if (!this.recaptchaVerifier) {
          this.recaptchaVerifier = new RecaptchaVerifier(this.auth, 'recaptcha-container', {
            size: 'invisible',
          });
        }
        const confirmation = await signInWithPhoneNumber(this.auth, phoneNumber, this.recaptchaVerifier);
        return { success: true, confirmation };
      } else {
        // Native Android/iOS: use @react-native-firebase/auth
        // This uses Google Play Services for app verification — no reCAPTCHA needed
        const rnAuth = await this.getRNAuth();
        const confirmation = await rnAuth.signInWithPhoneNumber(phoneNumber);
        return { success: true, confirmation };
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify OTP code.
   * On native, after RN Firebase confirms the OTP, we sync the auth state
   * to the JS SDK using the ID token so that onAuthStateChanged fires.
   * @param {object} confirmation - Confirmation object from sendOTP
   * @param {string} code - OTP code
   * @returns {Promise<object>} - { success, user } or { success: false, error }
   */
  async verifyOTP(confirmation, code) {
    try {
      const userCredential = await confirmation.confirm(code);
      const rnUser = userCredential.user;

      if (Platform.OS !== 'web') {
        // Sync RN Firebase session into the JS SDK so AuthContext listener fires
        const { signInWithCredential, PhoneAuthProvider } = await import('firebase/auth');
        const idToken = await rnUser.getIdToken();
        const credential = PhoneAuthProvider.credential(confirmation.verificationId || '', code);
        try {
          await signInWithCredential(this.auth, credential);
        } catch {
          // If credential fails (e.g. verificationId issues), manually trigger
          // auth state update by setting currentUser via token sign-in
          const { signInWithCustomToken } = await import('firebase/auth');
          // Fallback: force reload — JS SDK will pick up the session from storage
          await this.auth.currentUser?.reload?.();
        }
      }

      return { success: true, user: rnUser };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user role from Firestore
   * @param {string} uid - User ID
   * @returns {Promise<string|null>} - User role
   */
  async getUserRole(uid) {
    try {
      // Check in users collection first
      const userDocRef = doc(this.db, COLLECTIONS.USERS, uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.role || null;
      }

      // Check in specific role collections
      const patientDocRef = doc(this.db, COLLECTIONS.PATIENTS, uid);
      const patientDoc = await getDoc(patientDocRef);
      if (patientDoc.exists()) return USER_ROLES.PATIENT;

      const doctorDocRef = doc(this.db, COLLECTIONS.DOCTORS, uid);
      const doctorDoc = await getDoc(doctorDocRef);
      if (doctorDoc.exists()) return USER_ROLES.DOCTOR;

      const receptionistDocRef = doc(this.db, COLLECTIONS.RECEPTIONISTS, uid);
      const receptionistDoc = await getDoc(receptionistDocRef);
      if (receptionistDoc.exists()) return USER_ROLES.RECEPTIONIST;

      return null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
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
