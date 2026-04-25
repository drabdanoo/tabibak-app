import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/authService';
import notificationService from '../services/notificationService';
import { USER_ROLES } from '../config/firebase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [verificationConfirmation, setVerificationConfirmation] = useState(null);

  // Handle authentication state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      setLoading(true);
      console.log('Auth state changed. Firebase user:', firebaseUser);

      if (firebaseUser) {
        setUser(firebaseUser);
<<<<<<< HEAD
        
        // Set roleLoading to true while fetching role
        setRoleLoading(true);
        
=======

>>>>>>> store/apple-safe
        // Get user role and profile
        const role = await authService.getUserRole(firebaseUser.uid);
        console.log('User role:', role);
        setUserRole(role);

        if (role) {
          const profile = await authService.getUserProfile(firebaseUser.uid, role);
          console.log('User profile:', profile);
          setUserProfile(profile);

          // Save to AsyncStorage for persistence
          await AsyncStorage.setItem('userRole', role);
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));

          // Register device token for push notifications
          await notificationService.registerDeviceToken(firebaseUser.uid, role);
        }
        
        // Role loading complete
        setRoleLoading(false);
      } else {
        console.log('No user, clearing auth state');
        setUser(null);
        setUserRole(null);
        setUserProfile(null);
<<<<<<< HEAD
        setRoleLoading(false);
        
=======

>>>>>>> store/apple-safe
        // Clear AsyncStorage
        await AsyncStorage.removeItem('userRole');
        await AsyncStorage.removeItem('userProfile');
      }

      setLoading(false);
      if (initializing) {
        console.log('Finished initializing auth context');
        setInitializing(false);
      }
    });

    return unsubscribe;
  }, []);

  // Send OTP to phone number
  const sendOTP = async (phoneNumber) => {
    const result = await authService.sendOTP(phoneNumber);
    
    if (result.success && result.confirmation) {
      // Store confirmation in context state instead of passing via navigation
      setVerificationConfirmation(result.confirmation);
      console.log('Verification confirmation stored in context');
    }
    
    return result;
  };

  // Verify OTP
  const verifyOTP = async (code) => {
<<<<<<< HEAD
    if (!verificationConfirmation) {
      console.error('No verification confirmation found');
      return { 
        success: false, 
        error: 'Verification session expired. Please request a new code.' 
      };
    }
    
    const result = await authService.verifyOTP(verificationConfirmation, code);
    
    if (result.success) {
      // Clear confirmation after successful verification
      setVerificationConfirmation(null);
      
      // Check if user has a profile
      const role = await authService.getUserRole(result.user.uid);
      
      if (!role) {
        // New user - needs to complete profile
        return { success: true, needsProfile: true, user: result.user };
=======
    const result = await authService.verifyOTP(code);

    if (result.success) {
      // Check if user has a profile.
      // Retry once with a short delay in case auth state propagation is slow.
      let role = await authService.getUserRole(result.user.uid);
      if (!role && role !== undefined) {
        await new Promise((r) => setTimeout(r, 1500));
        role = await authService.getUserRole(result.user.uid);
>>>>>>> store/apple-safe
      }

      if (!role) {
        // New patient — auto-register with phone number; no profile form needed.
        // The patient can update their name/DOB from the profile screen later.
        await authService.createPatientProfile(result.user.uid, {
          phoneNumber: result.user.phoneNumber ?? '',
          fullName:    '',
          dateOfBirth: '',
          gender:      '',
        });
        setUserRole(USER_ROLES.PATIENT);
        return { success: true, needsProfile: false, user: result.user, role: USER_ROLES.PATIENT };
      }

      // Existing user - fetch profile
      const profile = await authService.getUserProfile(result.user.uid, role);
      return { success: true, needsProfile: false, user: result.user, role, profile };
    }

    return result;
  };

  // Create patient profile
  const createProfile = async (profileData) => {
    if (!user) return false;

    const success = await authService.createPatientProfile(user.uid, {
      ...profileData,
      phoneNumber: user.phoneNumber
    });

    if (success) {
      setUserRole(USER_ROLES.PATIENT);
      const profile = await authService.getUserProfile(user.uid, USER_ROLES.PATIENT);
      setUserProfile(profile);
    }

    return success;
  };

  // Sign in with email and password
  const signInWithEmail = async (email, password) => {
    const result = await authService.signInWithEmail(email, password);

    if (result.success) {
      const role = await authService.getUserRole(result.user.uid);
      const profile = await authService.getUserProfile(result.user.uid, role);

      setUserRole(role);
      setUserProfile(profile);

      return { success: true, role, profile };
    }

    return result;
  };

  // Sign out
  // iOS fix: unregister device token AFTER successful sign-out to avoid
  // APNs token being cleared before Firebase auth session ends, which can
  // cause a race condition where the token is re-registered on the next
  // auth state change before it was properly cleaned up.
  const signOut = async () => {
    console.log('Starting sign out process');
    const signingOutUid = user?.uid ?? null;

    try {
      console.log('Calling authService.signOut()');
      const success = await authService.signOut();
      console.log('authService.signOut() result:', success);

      if (success) {
        console.log('Sign out successful, clearing user state');
        setUser(null);
        setUserRole(null);
        setUserProfile(null);

        // Unregister device token after successful sign-out
        if (signingOutUid) {
          try {
            console.log('Unregistering device token for user:', signingOutUid);
            await notificationService.unregisterDeviceToken(signingOutUid);
            console.log('Device token unregistered successfully');
          } catch (error) {
            console.error('Failed to unregister device token:', error);
            // Non-fatal — token will expire naturally
          }
        }

        return true;
      }

      console.log('Sign out failed, authService.signOut() returned false');
      return false;
    } catch (error) {
      console.error('Sign out failed with error:', error);
      return false;
    }
  };

  const value = {
    user,
    userRole,
    userProfile,
    loading,
    roleLoading,
    initializing,
    verificationConfirmation,
    sendOTP,
    verifyOTP,
    createProfile,
    signInWithEmail,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
