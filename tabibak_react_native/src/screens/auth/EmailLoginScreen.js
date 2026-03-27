import React, { useState } from 'react';
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
import { colors, spacing, typography, BorderRadius } from '../../config/theme';
import { USER_ROLES } from '../../config/firebase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve icon name from role */
const roleIcon = (role) =>
  role === USER_ROLES.DOCTOR ? 'medkit-outline' : 'desktop-outline';

/** Resolve role title key from role */
const roleTitleKey = (role) =>
  role === USER_ROLES.DOCTOR ? 'roles.doctor' : 'roles.receptionist';

/** Map a Firebase error code → localized auth error string */
const mapLoginError = (code, t) => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return t('auth.loginFailed');
    case 'auth/too-many-requests':  return t('auth.errors.tooManyRequests');
    default:                        return t('auth.loginError');
  }
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const EmailLoginScreen = ({ navigation, route }) => {
  const { role } = route.params;
  const { t } = useTranslation();
  const { signInWithEmail, signOut } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthError(t('auth.requiredFields'));
      return;
    }

    setAuthError('');
    setIsLoading(true);

    const result = await signInWithEmail(email.trim(), password);
    setIsLoading(false);

    if (result.success) {
      // If the account's role does not match the selected entry point, deny access
      if (result.role && result.role !== role) {
        setAuthError(t('auth.accessDenied', { role: t(roleTitleKey(role)) }));
        await signOut();
        return;
      }
      // Correct role — AuthContext onAuthStateChanged handles stack navigation
    } else {
      setAuthError(mapLoginError(result.code, t));
    }
  };

  return (
    <ScreenContainer scrollable={false} padded={true} edges={['top', 'bottom']}>

      {/* Back */}
      <TouchableOpacity
        style={styles.back}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      {/* Hero */}
      <View style={styles.header}>
        <View style={[
          styles.iconCircle,
          { backgroundColor: role === USER_ROLES.DOCTOR
              ? colors.secondary + '18'
              : colors.info    + '18' },
        ]}>
          <Ionicons
            name={roleIcon(role)}
            size={44}
            color={role === USER_ROLES.DOCTOR ? colors.secondary : colors.info}
          />
        </View>
        <Text style={styles.title}>{t(roleTitleKey(role))}</Text>
        <Text style={styles.subtitle}>{t('auth.staffLoginSubtitle')}</Text>
      </View>

      {/* Email */}
      <CustomTextField
        label={t('auth.email')}
        value={email}
        onChangeText={(v) => { setEmail(v); setAuthError(''); }}
        placeholder={t('auth.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Password */}
      <CustomTextField
        label={t('auth.password')}
        value={password}
        onChangeText={(v) => { setPassword(v); setAuthError(''); }}
        placeholder={t('auth.passwordPlaceholder')}
        secureText
      />

      {/* Inline error */}
      {!!authError && (
        <Text style={styles.errorText}>{authError}</Text>
      )}

      {/* Sign-in CTA */}
      <PrimaryButton
        label={t('auth.signIn')}
        onPress={handleSignIn}
        disabled={!canSubmit}
        loading={isLoading}
        style={styles.button}
      />

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
  },

  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },

  button: {
    marginTop: spacing.sm,
  },
});

export default EmailLoginScreen;
