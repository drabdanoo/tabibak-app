import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ui';
import { colors, spacing, typography, BorderRadius, shadows } from '../../config/theme';
import { USER_ROLES } from '../../config/firebase';

// ─── Role card data ────────────────────────────────────────────────────────────
// Icons and accent colours are static; labels/descriptions come from i18n.
const ROLE_CARDS = [
  {
    role:       USER_ROLES.PATIENT,
    icon:       'person-outline',
    accentColor: colors.primary,
    titleKey:   'roles.patient',
    descKey:    'roles.patientDesc',
  },
  {
    role:       USER_ROLES.DOCTOR,
    icon:       'medkit-outline',
    accentColor: colors.secondary,
    titleKey:   'roles.doctor',
    descKey:    'roles.doctorDesc',
  },
  {
    role:       USER_ROLES.RECEPTIONIST,
    icon:       'desktop-outline',
    accentColor: colors.info,
    titleKey:   'roles.receptionist',
    descKey:    'roles.receptionistDesc',
  },
];

const RoleSelectionScreen = ({ navigation }) => {
  const { t } = useTranslation();

  const handleRoleSelect = (role) => {
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
          <Ionicons name="medical" size={44} color={colors.white} />
        </View>
        <Text style={styles.appName}>Tabibok</Text>
        <Text style={styles.selectRoleLabel}>{t('auth.selectRole')}</Text>
      </View>

      {/* ── Role cards in a ScrollView so the third card is never clipped ──── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {ROLE_CARDS.map(({ role, icon, accentColor, titleKey, descKey }) => (
          <TouchableOpacity
            key={role}
            testID={`role-card-${role}`}
            accessibilityLabel={t(titleKey)}
            style={[styles.roleCard, { borderColor: accentColor + '30' }]}
            onPress={() => handleRoleSelect(role)}
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
});

export default RoleSelectionScreen;
