import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { USER_ROLES } from '../config/firebase';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Colors } from '../config/theme';

// Auth Screens
import PhoneAuthScreen from '../screens/auth/PhoneAuthScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import EmailLoginScreen from '../screens/auth/EmailLoginScreen';

// Navigation Stacks
import PatientStack from './PatientStack';
import DoctorStack from './DoctorStack';
import ReceptionistStack from './ReceptionistStack';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, userRole, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Not authenticated - show auth screens
          <>
            <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
            <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
          </>
        ) : (
          // Authenticated - show appropriate stack based on role
          <>
            {userRole === USER_ROLES.PATIENT && (
              <Stack.Screen name="PatientStack" component={PatientStack} />
            )}
            {userRole === USER_ROLES.DOCTOR && (
              <Stack.Screen name="DoctorStack" component={DoctorStack} />
            )}
            {userRole === USER_ROLES.RECEPTIONIST && (
              <Stack.Screen name="ReceptionistStack" component={ReceptionistStack} />
            )}
            {(!userRole || (userRole !== USER_ROLES.PATIENT && userRole !== USER_ROLES.DOCTOR && userRole !== USER_ROLES.RECEPTIONIST)) && (
              <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white
  }
});

export default AppNavigator;
