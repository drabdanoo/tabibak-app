import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenContainer, PrimaryButton, CustomTextField } from '../../components/ui';
import { colors, spacing, typography } from '../../config/theme';

const RESEND_SECONDS = 60;

/** Map a Firebase error code → localized auth.errors.* string */
const mapVerifyError = (code, t) => {
  switch (code) {
    case 'auth/invalid-verification-code': return t('auth.errors.invalidCode');
    case 'auth/code-expired':              return t('auth.errors.codeExpired');
    case 'auth/too-many-requests':         return t('auth.errors.tooManyRequests');
    case 'auth/session-expired':           return t('auth.errors.sessionExpired');
    default:                               return t('auth.errors.generic');
  }
};

const OTPVerificationScreen = ({ navigation, route }) => {
  const { phoneNumber } = route.params;
<<<<<<< HEAD
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const { verifyOTP, verificationConfirmation } = useAuth();
  
  const inputRefs = useRef([]);
=======
  const { t } = useTranslation();
  const { sendOTP, verifyOTP } = useAuth();
>>>>>>> store/apple-safe

  const [code, setCode]               = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [countdown, setCountdown]     = useState(RESEND_SECONDS);

  const countdownRef = useRef(null);

  useEffect(() => {
    startCountdown();
    return () => clearTimeout(countdownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCountdown = () => {
    clearTimeout(countdownRef.current);
    setCountdown(RESEND_SECONDS);
    const tick = (remaining) => {
      if (remaining <= 0) return;
      countdownRef.current = setTimeout(() => {
        setCountdown(remaining - 1);
        tick(remaining - 1);
      }, 1000);
    };
    tick(RESEND_SECONDS);
  };

  // Mask phone: +964 7XX XXXX → +964 7** 4567
  const maskedPhone = phoneNumber.replace(/(\+\d{3}\s?\d)(\d+)(\d{4})$/, '$1***$3');

  const doVerify = async (value) => {
    if (value.length !== 6) return;
    setVerifyError('');
    setIsVerifying(true);

    const result = await verifyOTP(value);
    setIsVerifying(false);

    if (result.success) {
      // AuthContext already set userRole → AppNavigator switches to PatientStack automatically
    } else {
      setVerifyError(mapVerifyError(result.code, t));
      setCode('');
    }
  };

  const handleCodeChange = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      doVerify(digits);
    }
  };

<<<<<<< HEAD
  const handleVerify = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    if (!verificationConfirmation) {
      Alert.alert('Error', 'Verification session expired. Please request a new code.');
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      // verifyOTP now retrieves confirmation from context
      const result = await verifyOTP(otpCode);
      
      if (result.success) {
        if (result.needsProfile) {
          navigation.navigate('ProfileSetup', { 
            user: result.user,
            role: route.params.role
          });
        } else {
          // Navigate based on user role
          // The AppNavigator will handle routing based on user role
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to verify code');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
=======
  const handleResend = async () => {
    clearTimeout(countdownRef.current);
    setVerifyError('');
    setCode('');

    const result = await sendOTP(phoneNumber);
    if (result.success) {
      startCountdown();
    } else {
      setVerifyError(mapVerifyError(result.code, t));
>>>>>>> store/apple-safe
    }
  };

  return (
    <ScreenContainer scrollable={false} padded={true} edges={['top', 'bottom']}>

      {/* Back */}
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      {/* Hero */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>{t('auth.otpTitle')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.otpSubtitle', { phone: maskedPhone })}
        </Text>
      </View>

      {/* OTP input — single field, number-pad, maxLength 6 */}
      <CustomTextField
        label={t('auth.otpPlaceholder')}
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="••••••"
        autoFocus
      />

      {/* Inline error */}
      {!!verifyError && (
        <Text style={styles.errorText}>{verifyError}</Text>
      )}

      {/* Verify CTA */}
      <PrimaryButton
        label={t('auth.verifyOtp')}
        onPress={() => doVerify(code)}
        disabled={code.length !== 6 || isVerifying}
        loading={isVerifying}
        style={styles.button}
      />

      {/* Resend row */}
      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={styles.resendCountdown}>
            {t('auth.resendIn', { seconds: countdown })}
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
            <Text style={styles.resendLink}>{t('auth.resendOtp')}</Text>
          </TouchableOpacity>
        )}
      </View>

    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  back: {
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },

  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },

  button: {
    marginTop: spacing.sm,
  },

  resendRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendCountdown: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  resendLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default OTPVerificationScreen;
