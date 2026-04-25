import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ui';
import { colors, spacing, typography, BorderRadius, shadows } from '../../config/theme';
import { USER_ROLES } from '../../config/firebase';

// ─── Staff access code ────────────────────────────────────────────────────────
// Change this value in your environment config for production.
const STAFF_ACCESS_CODE = 'VB2024';

// ─── Role card data ────────────────────────────────────────────────────────────
// Icons and accent colours are static; labels/descriptions come from i18n.
const ROLE_CARDS = [
  {
    role:        USER_ROLES.PATIENT,
    icon:        'person-outline',
    accentColor: colors.primary,
    titleKey:    'roles.patient',
    descKey:     'roles.patientDesc',
    protected:   false,
  },
  {
    role:        USER_ROLES.DOCTOR,
    icon:        'briefcase-outline',
    accentColor: colors.secondary,
    titleKey:    'roles.doctor',
    descKey:     'roles.doctorDesc',
    protected:   false,
  },
  {
    role:        USER_ROLES.RECEPTIONIST,
    icon:        'desktop-outline',
    accentColor: colors.info,
    titleKey:    'roles.receptionist',
    descKey:     'roles.receptionistDesc',
    protected:   true,
  },
];

const RoleSelectionScreen = ({ navigation }) => {
  const { t } = useTranslation();

  // ── Staff invite-code modal state ─────────────────────────────────────────
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [accessCode, setAccessCode]             = useState('');
  const [codeError, setCodeError]               = useState('');

  const openCodeModal = () => {
    setAccessCode('');
    setCodeError('');
    setCodeModalVisible(true);
  };

  const handleCodeSubmit = () => {
    if (accessCode.trim() === STAFF_ACCESS_CODE) {
      setCodeModalVisible(false);
      navigation.navigate('EmailLogin', { role: USER_ROLES.RECEPTIONIST });
    } else {
      setCodeError('Invalid access code. Please try again.');
    }
  };

  // ── Role selection ────────────────────────────────────────────────────────
  const handleRoleSelect = (role, isProtected) => {
    if (isProtected) {
      openCodeModal();
      return;
    }
    if (role === USER_ROLES.PATIENT) {
      navigation.navigate('PhoneAuth');
    } else {
      navigation.navigate('EmailLogin', { role });
    }
  };

  return (
    <ScreenContainer scrollable={false} padded={false} edges={['top', 'bottom']}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="calendar" size={44} color={colors.white} />
        </View>
        <Text style={styles.appName}>Vanbook</Text>
        <Text style={styles.selectRoleLabel}>{t('auth.selectRole')}</Text>
      </View>

      {/* ── Role cards ──────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {ROLE_CARDS.map(({ role, icon, accentColor, titleKey, descKey, protected: isProtected }) => (
          <TouchableOpacity
            key={role}
            testID={`role-card-${role}`}
            accessibilityLabel={t(titleKey)}
            style={[styles.roleCard, { borderColor: accentColor + '30' }]}
            onPress={() => handleRoleSelect(role, isProtected)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconCircle, { backgroundColor: accentColor + '18' }]}>
              <Ionicons name={icon} size={36} color={accentColor} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.roleTitle}>{t(titleKey)}</Text>
              <Text style={styles.roleDesc}>{t(descKey)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Staff access code modal ──────────────────────────────────────────── */}
      <Modal
        visible={codeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCodeModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
              <Text style={styles.modalTitle}>Staff Access</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter your access code to continue.
            </Text>

            <TextInput
              style={[styles.codeInput, !!codeError && styles.codeInputError]}
              value={accessCode}
              onChangeText={(v) => { setAccessCode(v); setCodeError(''); }}
              placeholder="Access code"
              placeholderTextColor={colors.gray}
              autoCapitalize="characters"
              secureTextEntry={false}
              returnKeyType="done"
              onSubmitEditing={handleCodeSubmit}
              autoFocus
            />

            {!!codeError && (
              <Text style={styles.codeErrorText}>{codeError}</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCodeModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleCodeSubmit}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  appName: {
    fontSize: typography.sizes.xxl,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  selectRoleLabel: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: spacing.md,
  },
  cardText: {
    flex: 1,
  },
  roleTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  roleDesc: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: BorderRadius.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.sizes.md,
    color: colors.text,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  codeInputError: {
    borderColor: colors.error,
  },
  codeErrorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.white,
  },
});

export default RoleSelectionScreen;
