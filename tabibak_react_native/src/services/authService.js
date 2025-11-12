import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPhoneNumber, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  RecaptchaVerifier
} from 'firebase/auth';
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class AuthService {
  constructor() {
    this.auth = auth;
    this.db = db;
    this.recaptchaVerifier = null;
  }

  /**
   * Initialize reCAPTCHA verifier (required for web)
   * @param {string} containerId - Container element ID
   */
  initRecaptcha(containerId = 'recaptcha-container') {
    // Only initialize on web platform
    if (Platform.OS === 'web' && !this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA verified');
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
          }
        });
      } catch (error) {
        console.error('Error initializing reCAPTCHA:', error);
      }
    }
    return this.recaptchaVerifier;
  }

  /**
   * Send OTP to phone number
   * @param {string} phoneNumber - Phone number in E.164 format (e.g., +1234567890)
   * @returns {Promise<object>} - Confirmation object
   */
  async sendOTP(phoneNumber) {
    try {
      // For web platform, we need RecaptchaVerifier
      if (Platform.OS === 'web') {
        const appVerifier = this.recaptchaVerifier || this.initRecaptcha();
        if (!appVerifier) {
          return { 
            success: false, 
            error: 'reCAPTCHA initialization failed. Phone authentication requires reCAPTCHA on web.' 
          };
        }
        const confirmation = await signInWithPhoneNumber(this.auth, phoneNumber, appVerifier);
        return { success: true, confirmation };
      } else {
        // For native platforms (iOS/Android)
        // NOTE: Firebase JS SDK phone auth requires reCAPTCHA even on native
        // For production, migrate to @react-native-firebase/auth
        // See FIXES_STATUS.md for implementation guide
        
        // Attempt with warning
        console.warn(
          'Phone auth on native requires @react-native-firebase/auth. ' +
          'Current implementation may fail. See FIXES_STATUS.md for migration guide.'
        );
        
        try {
          // This will likely fail without proper app verification
          const confirmation = await signInWithPhoneNumber(this.auth, phoneNumber);
          return { success: true, confirmation };
        } catch (nativeError) {
          // Provide helpful error message
          return {
            success: false,
            error: 'Phone authentication on mobile requires native Firebase setup. ' +
                   'Please use email login or contact support. ' +
                   'Error: ' + nativeError.message
          };
        }
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify OTP code
   * @param {object} confirmation - Confirmation object from sendOTP
   * @param {string} code - OTP code
   * @returns {Promise<object>} - User credential
   */
  async verifyOTP(confirmation, code) {
    try {
      const userCredential = await confirmation.confirm(code);
      return { success: true, user: userCredential.user };
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
