import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenContainer, PrimaryButton, CustomTextField } from '../../components/ui';
import { colors, spacing, typography, BorderRadius } from '../../config/theme';

const SAVED_PHONE_KEY = '@tabibak:savedPhone';

/** Map a Firebase error code → localized auth.errors.* string */
const mapSendError = (code, t) => {
  switch (code) {
    case 'auth/too-many-requests': return t('auth.errors.tooManyRequests');
    case 'auth/web-unsupported':   return t('auth.errors.webUnsupported');
    default:                       return t('auth.errors.generic');
  }
};

const PhoneAuthScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { sendOTP } = useAuth();

  const [phone,      setPhone]      = useState('');
  const [savedPhone, setSavedPhone] = useState(null); // digits only, e.g. '7701234567'
  const [isSending,  setIsSending]  = useState(false);
  const [sendError,  setSendError]  = useState('');

  // Load the last used phone on mount
  useEffect(() => {
    AsyncStorage.getItem(SAVED_PHONE_KEY)
      .then(val => { if (val) setSavedPhone(val); })
      .catch(() => {});
  }, []);

  // Strip non-digits for validation; Iraqi numbers are 10 digits (e.g. 7701234567)
  const cleanDigits = phone.replace(/\D/g, '');
  const canSend = cleanDigits.length === 10 && !isSending;

  const handleSend = async () => {
    setSendError('');
    setIsSending(true);

    const fullPhone = `+964${cleanDigits}`;
    const result = await sendOTP(fullPhone);

    setIsSending(false);

    if (result.success) {
      // Save phone digits for next time
      AsyncStorage.setItem(SAVED_PHONE_KEY, cleanDigits).catch(() => {});
      // confirmation is stored in authService._pendingConfirmation —
      // never pass Firebase objects through navigation params (non-serializable).
      navigation.navigate('OTPVerification', { phoneNumber: fullPhone });
    } else {
      setSendError(mapSendError(result.code, t));
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
          <Ionicons name="phone-portrait-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>{t('auth.phoneNumber')}</Text>
        <Text style={styles.subtitle}>{t('auth.phoneHint')}</Text>
      </View>

      {/* Web unsupported notice */}
      {Platform.OS === 'web' && (
        <View style={styles.webBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.webBannerText}>{t('auth.errors.webUnsupported')}</Text>
        </View>
      )}

      {/* Saved login banner */}
      {savedPhone && !phone && (
        <TouchableOpacity
          style={styles.savedBanner}
          onPress={() => setPhone(savedPhone)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
          <View style={styles.savedBannerText}>
            <Text style={styles.savedBannerLabel}>Continue as</Text>
            <Text style={styles.savedBannerPhone}>+964 {savedPhone}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Label above the row */}
      <Text style={styles.inputLabel}>{t('auth.phoneNumber')}</Text>

      {/* Country badge + phone input in a horizontal row */}
      <View style={styles.phoneRow}>
        <View style={styles.countryBadge}>
          <Text style={styles.countryFlag}>🇮🇶</Text>
          <Text style={styles.countryCode}>+964</Text>
        </View>

        <CustomTextField
          style={styles.phoneField}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={12}
          placeholder="770 123 4567"
          autoFocus
        />
      </View>

      <Text style={styles.helper}>{t('auth.phoneHelper')}</Text>

      {/* Inline error */}
      {!!sendError && (
        <Text style={styles.errorText}>{sendError}</Text>
      )}

      {/* CTA */}
      <PrimaryButton
        label={t('auth.sendOtp')}
        onPress={handleSend}
        disabled={!canSend}
        loading={isSending}
        style={styles.button}
      />

      {/* Email fallback — lets reviewers / testers log in without SMS */}
      <TouchableOpacity
        style={styles.emailFallback}
        onPress={() => navigation.navigate('EmailLogin', { role: 'patient' })}
        activeOpacity={0.75}
      >
        <Text style={styles.emailFallbackText}>Sign in with email instead</Text>
      </TouchableOpacity>

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
  },

  webBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '18',
    borderRadius: BorderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  webBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.primary,
  },

  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: 6,
    marginBottom: spacing.md,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCode: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  phoneField: {
    flex: 1,
  },

  helper: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginBottom: spacing.md,
  },

  button: {
    marginTop: spacing.sm,
  },
  emailFallback: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  emailFallbackText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },

  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '12',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  savedBannerText: {
    flex: 1,
  },
  savedBannerLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  savedBannerPhone: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default PhoneAuthScreen;
