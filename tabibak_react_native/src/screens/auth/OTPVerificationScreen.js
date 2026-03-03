import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';
import { firebaseConfig } from '../../config/firebase';

const RESEND_COUNTDOWN_SEC = 60;

const OTPVerificationScreen = ({ navigation, route }) => {
  const { phoneNumber, confirmation: initialConfirmation } = route.params;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN_SEC);
  // Keep confirmation in state so resend can update it with the new object
  const [confirmationObj, setConfirmationObj] = useState(initialConfirmation);

  const inputRefs = useRef([]);
  // Separate verifier for resend — independent of PhoneAuthScreen's verifier
  const resendRecaptchaVerifier = useRef(null);
  const countdownTimerRef = useRef(null);

  const { verifyOTP, sendOTP } = useAuth();

  // ─── Countdown timer ──────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COUNTDOWN_SEC);
    clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCountdown();
    return () => clearInterval(countdownTimerRef.current);
  }, [startCountdown]);

  // ─── OTP verification ─────────────────────────────────────────────────────
  /**
   * @param {string} [codeParam] - Accepts the code directly to avoid stale-state
   *   issues when called from handleOtpChange before React commits the new state.
   */
  const handleVerify = useCallback(
    async (codeParam) => {
      const otpCode = codeParam ?? otp.join('');
      if (otpCode.length !== 6 || loading) return;

      setLoading(true);
      try {
        const result = await verifyOTP(confirmationObj, otpCode);

        if (result.success) {
          if (result.needsProfile) {
            navigation.replace('ProfileSetup');
          }
          // else: AuthContext onAuthStateChanged redirects to the correct stack
        } else {
          Alert.alert('رمز غير صحيح', 'الرمز الذي أدخلته غير صحيح. يرجى المحاولة مجدداً.');
          setOtp(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ غير متوقع. يرجى المحاولة مجدداً.');
        console.error('OTP verification error:', error);
      } finally {
        setLoading(false);
      }
    },
    [otp, confirmationObj, loading, verifyOTP, navigation],
  );

  // ─── Input handling ───────────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on last digit — pass code directly to avoid stale otp state
    if (value && index === 5) {
      const code = newOtp.join('');
      if (code.length === 6) handleVerify(code);
    }
  };

  const handleKeyPress = (index, key) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ─── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    try {
      const result = await sendOTP(phoneNumber, resendRecaptchaVerifier.current);
      if (result.success) {
        setConfirmationObj(result.confirmation);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        startCountdown();
        Alert.alert('تم الإرسال', 'تم إرسال رمز تحقق جديد إلى هاتفك.');
      } else {
        Alert.alert('خطأ', result.error || 'فشل إعادة إرسال الرمز. يرجى المحاولة مجدداً.');
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ غير متوقع. يرجى المحاولة مجدداً.');
      console.error('Resend OTP error:', error);
    } finally {
      setResending(false);
    }
  };

  // Mask phone: +964 770-123-4567
  const maskedPhone = phoneNumber.replace(
    /^(\+\d{3})(\d{3})(\d{3})(\d{4})$/,
    '$1 $2-$3-$4',
  );

  const otpComplete = otp.join('').length === 6;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/*
        Dedicated FirebaseRecaptchaVerifierModal for the resend flow.
        Keeping it separate from PhoneAuthScreen's verifier ensures each
        OTP challenge lifecycle is independent.
      */}
      <FirebaseRecaptchaVerifierModal
        ref={resendRecaptchaVerifier}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
        title="تحقق من هويتك"
        cancelLabel="إلغاء"
      />

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={80} color={Colors.primary} />
          <Text style={styles.title}>أدخل رمز التحقق</Text>
          <Text style={styles.subtitle}>
            أرسلنا رمزاً إلى{'\n'}
            <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
          </Text>
        </View>

        {/* 6-digit OTP boxes */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
              value={digit}
              onChangeText={(value) => handleOtpChange(index, value)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(index, key)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify button — greyed out until all 6 digits are entered */}
        <TouchableOpacity
          style={[styles.button, (!otpComplete || loading) && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={!otpComplete || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>تحقق</Text>
          )}
        </TouchableOpacity>

        {/* Resend with countdown */}
        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={countdown > 0 || resending}
          activeOpacity={0.7}
        >
          {resending ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : countdown > 0 ? (
            <Text style={styles.resendText}>
              إعادة الإرسال بعد{' '}
              <Text style={styles.countdownText}>{countdown}</Text>{' '}
              ثانية
            </Text>
          ) : (
            <Text style={styles.resendText}>
              لم تستلم الرمز؟{' '}
              <Text style={styles.resendLink}>إعادة إرسال</Text>
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
    lineHeight: 24,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: Colors.text,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  otpInput: {
    width: 50,
    height: 60,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    color: Colors.text,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  resendText: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
    textAlign: 'center',
  },
  countdownText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  resendLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default OTPVerificationScreen;
