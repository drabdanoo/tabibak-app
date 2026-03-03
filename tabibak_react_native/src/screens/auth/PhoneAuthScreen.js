import React, { useState, useRef } from 'react';
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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';
import { firebaseConfig } from '../../config/firebase';

// Map Firebase error codes to Arabic messages
const mapFirebaseError = (error = '') => {
  if (error.includes('invalid-phone-number'))
    return 'رقم الهاتف غير صالح. تأكد من إدخاله بالتنسيق الصحيح.';
  if (error.includes('too-many-requests'))
    return 'طلبات كثيرة جداً. يرجى الانتظار قبل المحاولة مجدداً.';
  if (error.includes('captcha-check-failed') || error.includes('recaptcha'))
    return 'فشل التحقق. يرجى المحاولة مجدداً.';
  if (error.includes('quota-exceeded'))
    return 'تجاوزت الحد المسموح به. حاول لاحقاً.';
  if (error.includes('App verifier'))
    return 'تعذّر تهيئة التحقق. يرجى إعادة تشغيل التطبيق.';
  return 'فشل إرسال الرمز. يرجى المحاولة مجدداً.';
};

const PhoneAuthScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode] = useState('+964');
  const [loading, setLoading] = useState(false);

  // FirebaseRecaptchaVerifierModal ref — used as ApplicationVerifier by Firebase
  const recaptchaVerifier = useRef(null);

  const { sendOTP } = useAuth();

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (text) => {
    setPhoneNumber(formatPhoneNumber(text));
  };

  const handleSendOTP = async () => {
    const cleanedPhone = phoneNumber.replace(/\D/g, '');

    if (cleanedPhone.length !== 10) {
      Alert.alert('رقم غير صالح', 'أدخل رقم هاتف عراقي صحيح مكون من 10 أرقام');
      return;
    }

    const fullPhoneNumber = `${countryCode}${cleanedPhone}`;
    setLoading(true);

    try {
      // Pass the recaptcha verifier — works on iOS, Android, and web
      const result = await sendOTP(fullPhoneNumber, recaptchaVerifier.current);

      if (result.success) {
        navigation.navigate('OTPVerification', {
          phoneNumber: fullPhoneNumber,
          confirmation: result.confirmation,
        });
      } else {
        Alert.alert('خطأ', mapFirebaseError(result.error));
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ غير متوقع. يرجى المحاولة مجدداً.');
      console.error('Phone auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/*
        FirebaseRecaptchaVerifierModal renders as a modal overlay.
        It implements Firebase's ApplicationVerifier interface using a WebView.
        With attemptInvisibleVerification=true it tries the invisible challenge first;
        only shows a visible challenge if the invisible one fails.
      */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
        title="تحقق من هويتك"
        cancelLabel="إلغاء"
      />

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
          <Text style={styles.title}>أدخل رقم هاتفك</Text>
          <Text style={styles.subtitle}>
            سنرسل لك رمز التحقق على هذا الرقم
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>رقم الهاتف</Text>

          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCodeContainer}>
              <Text style={styles.countryFlag}>🇮🇶</Text>
              <Text style={styles.countryCode}>{countryCode}</Text>
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

          <Text style={styles.helperText}>رقم عراقي مكون من 10 أرقام</Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>إرسال رمز التحقق</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textLight,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'right',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
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
    gap: 4,
  },
  countryCode: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  countryFlag: {
    fontSize: 20,
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
    borderColor: Colors.border,
  },
  helperText: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
    marginBottom: Spacing.lg,
    textAlign: 'center',
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
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});

export default PhoneAuthScreen;
