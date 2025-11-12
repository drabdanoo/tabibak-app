import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Alert } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress non-critical warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'AsyncStorage has not been initialized',
]);

export default function App() {
  useEffect(() => {
    // Global error handler for unhandled promise rejections (web only)
    const handleUnhandledRejection = (event) => {
      console.error('Unhandled Promise Rejection:', event.reason);
    };

    // Only attach listener in web environments where window is defined
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        if (typeof window !== 'undefined' && window.removeEventListener) {
          window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        }
      };
    }
  }, []);

  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
