import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';
import { authService } from '../../services/authService';

const PhoneAuthScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+964');
  const [loading, setLoading] = useState(false);
  const { sendOTP } = useAuth();

  // Initialize reCAPTCHA on component mount for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Give the DOM time to render the container
      const timer = setTimeout(() => {
        try {
          authService.initRecaptcha('recaptcha-container');
          console.log('reCAPTCHA initialized successfully');
        } catch (error) {
          console.error('Failed to initialize reCAPTCHA:', error);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format Iraqi phone number: XXX XXX XXXX (10 digits)
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    } else {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  const handleSendOTP = async () => {
    // Clean phone number (remove formatting)
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    if (cleanedPhone.length !== 10) {
      if (Platform.OS === 'web') {
        window.alert('رقم هاتف غير صالح\nInvalid Phone Number\n\nPlease enter a valid 10-digit Iraqi phone number');
      } else {
        Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit Iraqi phone number');
      }
      return;
    }

    const fullPhoneNumber = `${countryCode}${cleanedPhone}`;

    setLoading(true);

    try {
      const result = await sendOTP(fullPhoneNumber);
      
      if (result.success) {
        navigation.navigate('OTPVerification', {
          phoneNumber: fullPhoneNumber,
          confirmation: result.confirmation
        });
      } else {
        if (Platform.OS === 'web') {
          window.alert(`Error: ${result.error || 'Failed to send OTP. Please try again.'}`);
        } else {
          Alert.alert('Error', result.error || 'Failed to send OTP. Please try again.');
        }
      }
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Error: An unexpected error occurred. Please try again.');
      } else {
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      }
      console.error('Phone auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name="phone-portrait" size={80} color={Colors.primary} />
          <Text style={styles.title}>Enter Your Phone Number</Text>
          <Text style={styles.subtitle}>
            We'll send you a verification code{'\n'}
            أدخل رقم هاتفك العراقي
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Phone Number (رقم الهاتف)</Text>
          
          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCodeContainer}>
              <Text style={styles.countryCode}>{countryCode}</Text>
              <Text style={styles.countryFlag}>🇮🇶</Text>
            </View>
            
            <TextInput
              style={styles.phoneInput}
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder="770 123 4567"
              placeholderTextColor={Colors.gray}
              keyboardType="phone-pad"
              maxLength={12}
              autoFocus
            />
          </View>

          <Text style={styles.helperText}>
            Iraqi phone number (10 digits){'\n'}
            رقم عراقي (10 أرقام)
          </Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Send Verification Code</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Hidden reCAPTCHA container for web */}
        <View id="recaptcha-container" style={{ height: 0 }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg
  },
  backButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.md
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textLight,
    marginTop: Spacing.sm,
    textAlign: 'center'
  },
  form: {
    flex: 1
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm
  },
  phoneInputContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg
  },
  countryCodeContainer: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    gap: 4
  },
  countryCode: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text
  },
  countryFlag: {
    fontSize: 20
  },
  phoneInput: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border
  },
  helperText: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 20
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600'
  }
});

export default PhoneAuthScreen;
