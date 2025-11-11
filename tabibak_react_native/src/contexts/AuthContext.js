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
  const [initializing, setInitializing] = useState(true);

  // Handle authentication state changes
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Get user role and profile
        const role = await authService.getUserRole(firebaseUser.uid);
        setUserRole(role);
        
        if (role) {
          const profile = await authService.getUserProfile(firebaseUser.uid, role);
          setUserProfile(profile);
          
          // Save to AsyncStorage for persistence
          await AsyncStorage.setItem('userRole', role);
          await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          
          // Register device token for push notifications
          await notificationService.registerDeviceToken(firebaseUser.uid, role);
        }
      } else {
        setUser(null);
        setUserRole(null);
        setUserProfile(null);
        
        // Clear AsyncStorage
        await AsyncStorage.removeItem('userRole');
        await AsyncStorage.removeItem('userProfile');
      }
      
      setLoading(false);
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // Send OTP to phone number
  const sendOTP = async (phoneNumber) => {
    return await authService.sendOTP(phoneNumber);
  };

  // Verify OTP
  const verifyOTP = async (confirmation, code) => {
    const result = await authService.verifyOTP(confirmation, code);
    
    if (result.success) {
      // Check if user has a profile
      const role = await authService.getUserRole(result.user.uid);
      
      if (!role) {
        // New user - needs to complete profile
        return { success: true, needsProfile: true, user: result.user };
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
  const signOut = async () => {
    // Unregister device token before signing out
    if (user) {
      await notificationService.unregisterDeviceToken(user.uid);
    }
    
    const success = await authService.signOut();
    
    if (success) {
      setUser(null);
      setUserRole(null);
      setUserProfile(null);
    }
    
    return success;
  };

  const value = {
    user,
    userRole,
    userProfile,
    loading,
    initializing,
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
