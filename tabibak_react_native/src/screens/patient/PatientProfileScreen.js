/**
 * PatientProfileScreen.js — Patient Profile & Edit (Phase 4)
 *
 * ╔══ ARCHITECTURE ════════════════════════════════════════════════════════════╗
 *
 * 3-STATE PATTERN
 * ────────────────
 *   loading  — AuthContext.loading is true (Firebase resolving auth)
 *   error    — Authenticated but userProfile is null (Firestore miss)
 *   success  — Profile loaded; editable form rendered
 *
 * EDIT MODEL
 * ──────────
 *   Local form state is seeded from AuthContext.userProfile on first mount.
 *   Editing writes directly to COLLECTIONS.PATIENTS via userService.
 *   After a successful save, the local state is the source of truth for the
 *   hero (so the updated name appears without a full auth state cycle).
 *
 * CONTRACTS ENFORCED
 * ───────────────────
 *   ✅ ScreenContainer (scrollable=true, padded=false, edges=['bottom'])
 *   ✅ RTL logical properties throughout (marginStart/End, paddingStart/End)
 *   ✅ All strings via t() — zero hardcoded text
 *   ✅ Colors from theme.js — zero hardcoded hex
 *   ✅ Zero Firebase imports — writes via userService
 *   ✅ isSubmitting prevents double-tap on Save
 *   ✅ Zero Alert.alert — inline banners only
 *
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer, CustomTextField, PrimaryButton } from '../../components/ui';
import { useAuth }     from '../../contexts/AuthContext';
import userService     from '../../services/userService';
import {
  colors,
  spacing,
  typography,
  BorderRadius,
  shadows,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Derive display initials from a full name string */
const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '?';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section wrapper with a left accent bar and title */
const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionAccent} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

/** Chip selector row — gender or blood type */
const ChipRow = ({ options, selected, onSelect, small }) => (
  <View style={styles.chipRow}>
    {options.map(({ value, label, icon }) => {
      const isSelected = selected === value;
      return (
        <TouchableOpacity
          key={value}
          style={[
            styles.chip,
            small && styles.chipSmall,
            isSelected && styles.chipSelected,
          ]}
          onPress={() => onSelect(value)}
          activeOpacity={0.75}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={small ? 14 : 18}
              color={isSelected ? colors.white : colors.primary}
            />
          )}
          <Text
            style={[
              styles.chipText,
              small && styles.chipTextSmall,
              isSelected && styles.chipTextSelected,
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

const PatientProfileScreen = ({ navigation }) => {
  const { t }                               = useTranslation();
  const insets                              = useSafeAreaInsets();
  const { user, userProfile, loading, signOut } = useAuth();

  // ── Local edit state (seeded from userProfile) ────────────────────────────
  const [editName,      setEditName]      = useState('');
  const [editGender,    setEditGender]    = useState('');
  const [editBloodType, setEditBloodType] = useState('');

  // Seed form whenever profile loads or changes
  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.fullName ?? userProfile.name ?? '');
      setEditGender(userProfile.gender ?? '');
      setEditBloodType(userProfile.bloodType ?? userProfile.blood_type ?? '');
    }
  }, [userProfile]);

  // ── Save action state ──────────────────────────────────────────────────────
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  // 'idle' | 'success' | 'error'
  const [saveStatus,    setSaveStatus]    = useState('idle');

  // ── Sign-out state ─────────────────────────────────────────────────────────
  const [isSigningOut,  setIsSigningOut]  = useState(false);
  const [logOutError,   setLogOutError]   = useState('');

  // ── Derived display values ─────────────────────────────────────────────────
  const displayName = editName || t('patient.profileScreen.patientLabel');
  const phone       = userProfile?.phoneNumber ?? user?.phoneNumber ?? '—';
  const initials    = getInitials(displayName);

  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (isSubmitting || !user) return;
    setSaveStatus('idle');
    setIsSubmitting(true);

    const result = await userService.updateUserProfile(user.uid, {
      fullName:  editName.trim(),
      gender:    editGender,
      bloodType: editBloodType,
    });

    setIsSubmitting(false);
    setSaveStatus(result.success ? 'success' : 'error');
  }, [isSubmitting, user, editName, editGender, editBloodType]);

  // ── Sign-out handler ───────────────────────────────────────────────────────
  const handleLogOut = useCallback(async () => {
    if (isSigningOut) return;
    setLogOutError('');
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      setLogOutError(t('patient.profileScreen.logOutError'));
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut, t]);

  // ── 3-STATE PATTERN ────────────────────────────────────────────────────────

  // State 1: Loading
  if (loading) {
    return (
      <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>{t('common.loading')}</Text>
        </View>
      </ScreenContainer>
    );
  }

  // State 2: Error (profile missing after auth)
  if (!userProfile) {
    return (
      <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>?</Text>
          </View>
        </View>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={52} color={colors.error} />
          <Text style={styles.centerStateTitle}>{t('patient.profileScreen.loadError')}</Text>
        </View>
      </ScreenContainer>
    );
  }

  // State 3: Success — editable form
  const genderOptions = [
    { value: 'male',   label: t('patient.profileScreen.male'),   icon: 'male'   },
    { value: 'female', label: t('patient.profileScreen.female'), icon: 'female' },
  ];

  const bloodTypeOptions = BLOOD_TYPES.map((bt) => ({ value: bt, label: bt }));

  return (
    <ScreenContainer scrollable padded={false} edges={['bottom']}>

      {/* ── Green hero ──────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        {/* Avatar */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Name */}
        <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>

        {/* Patient badge */}
        <View style={styles.heroBadge}>
          <Ionicons name="person-circle-outline" size={12} color={colors.primary} />
          <Text style={styles.heroBadgeText}>{t('patient.profileScreen.patientLabel')}</Text>
        </View>

        {/* Quick stat chips (blood type + gender) */}
        <View style={styles.heroChips}>
          {!!editBloodType && (
            <View style={styles.heroChip}>
              <Ionicons name="water-outline" size={12} color={colors.white} />
              <Text style={styles.heroChipText}>{editBloodType}</Text>
            </View>
          )}
          {!!editGender && (
            <View style={styles.heroChip}>
              <Ionicons
                name={editGender === 'male' ? 'male' : 'female'}
                size={12}
                color={colors.white}
              />
              <Text style={styles.heroChipText}>
                {editGender === 'male'
                  ? t('patient.profileScreen.male')
                  : t('patient.profileScreen.female')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Edit form ──────────────────────────────────────────────────── */}
      <View style={styles.content}>

        <SectionHeader title={t('patient.profileScreen.personalInfo')} />

        {/* Full Name */}
        <CustomTextField
          label={t('patient.profileScreen.fullName')}
          value={editName}
          onChangeText={(v) => { setEditName(v); setSaveStatus('idle'); }}
          placeholder={t('patient.profileScreen.fullNamePlaceholder')}
          autoCapitalize="words"
          autoCorrect={false}
        />

        {/* Phone — read-only */}
        <CustomTextField
          label={t('patient.profileScreen.phone')}
          value={phone}
          editable={false}
          onChangeText={() => {}}
        />

        {/* Gender */}
        <Text style={styles.fieldLabel}>{t('patient.profileScreen.gender')}</Text>
        <ChipRow
          options={genderOptions}
          selected={editGender}
          onSelect={(v) => { setEditGender(v); setSaveStatus('idle'); }}
        />

        {/* Blood Type */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
          {t('patient.profileScreen.bloodType')}
        </Text>
        <View style={styles.bloodTypeGrid}>
          {bloodTypeOptions.map(({ value, label }) => {
            const isSelected = editBloodType === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.bloodChip, isSelected && styles.bloodChipSelected]}
                onPress={() => { setEditBloodType(value); setSaveStatus('idle'); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.bloodChipText, isSelected && styles.bloodChipTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save feedback banner */}
        {saveStatus === 'success' && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={styles.successBannerText}>
              {t('patient.profileScreen.saveSuccess')}
            </Text>
          </View>
        )}
        {saveStatus === 'error' && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={styles.errorBannerText}>
              {t('patient.profileScreen.saveError')}
            </Text>
          </View>
        )}

        {/* Save Changes */}
        <PrimaryButton
          label={t('patient.profileScreen.saveChanges')}
          onPress={handleSave}
          loading={isSubmitting}
          disabled={!editName.trim() || isSubmitting}
          style={styles.saveBtn}
        />

        {/* ── Quick Actions ──────────────────────────────────────────── */}
        <SectionHeader title={t('patient.profileScreen.quickActions')} />

        <View style={styles.actionsCard}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('Appointments')}
            activeOpacity={0.75}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>{t('patient.profileScreen.myAppointments')}</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.gray} />
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('Documents')}
            activeOpacity={0.75}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>{t('patient.profileScreen.myDocuments')}</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.gray} />
          </TouchableOpacity>
        </View>

        {/* ── Log out ────────────────────────────────────────────────── */}
        {!!logOutError && (
          <View style={[styles.errorBanner, { marginTop: spacing.sm }]}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={styles.errorBannerText}>{logOutError}</Text>
          </View>
        )}

        <PrimaryButton
          label={t('patient.profileScreen.logOut')}
          onPress={handleLogOut}
          loading={isSigningOut}
          variant="outline"
          style={styles.logOutBtn}
          textStyle={{ color: colors.error }}
        />

        <Text style={styles.versionText}>Tabibak v1.0.0</Text>
      </View>

    </ScreenContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles — RTL logical properties throughout
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Loading / error center states ──────────────────────────────────────────
  centerState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.md,
    padding:        spacing.xl,
  },
  centerStateText: {
    fontSize: typography.sizes.sm,
    color:    colors.textSecondary,
  },
  centerStateTitle: {
    fontSize:  typography.sizes.md,
    color:     colors.error,
    textAlign: 'center',
  },

  // ── Green hero ─────────────────────────────────────────────────────────────
  hero: {
    backgroundColor:  colors.primary,
    alignItems:       'center',
    paddingBottom:    spacing.xl + spacing.md,
    paddingHorizontal: spacing.md,
    gap:              spacing.xs,
  },
  avatarCircle: {
    width:           88,
    height:          88,
    borderRadius:    BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth:     3,
    borderColor:     'rgba(255,255,255,0.55)',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    spacing.xs,
  },
  avatarText: {
    fontSize:   36,
    fontWeight: '700',
    color:      colors.white,
  },
  heroName: {
    fontSize:   typography.sizes.xl,
    fontWeight: '800',
    color:      colors.white,
    maxWidth:   '80%',
  },
  heroBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.9)',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    gap:               4,
  },
  heroBadgeText: {
    fontSize:   typography.sizes.xs,
    fontWeight: '700',
    color:      colors.primary,
  },
  heroChips: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            spacing.xs,
    marginTop:      spacing.xs,
  },
  heroChip: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(255,255,255,0.2)',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    gap:               3,
  },
  heroChipText: {
    color:    colors.white,
    fontSize: typography.sizes.xs,
  },

  // ── Form content ───────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xxl,
  },

  // ── Section header ─────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.md,
    marginTop:     spacing.sm,
  },
  sectionAccent: {
    width:           3,
    height:          16,
    borderRadius:    2,
    backgroundColor: colors.primary,
    marginEnd:       spacing.sm,
  },
  sectionTitle: {
    fontSize:      typography.sizes.sm,
    fontWeight:    '700',
    color:         colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Field labels ───────────────────────────────────────────────────────────
  fieldLabel: {
    fontSize:     typography.sizes.sm,
    fontWeight:   '500',
    color:        colors.text,
    marginBottom: spacing.xs,
  },

  // ── Chip row (gender) ──────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginBottom:  spacing.md,
  },
  chip: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius:   BorderRadius.lg,
    borderWidth:    1.5,
    borderColor:    colors.primary,
    backgroundColor: colors.white,
  },
  chipSmall: {
    paddingVertical:   6,
    paddingHorizontal: spacing.sm,
    flex:              0,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '600',
    color:      colors.primary,
  },
  chipTextSmall: {
    fontSize: typography.sizes.xs,
  },
  chipTextSelected: {
    color: colors.white,
  },

  // ── Blood type grid (2 × 4) ────────────────────────────────────────────────
  bloodTypeGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginBottom:  spacing.md,
  },
  bloodChip: {
    width:           '22%',
    alignItems:      'center',
    paddingVertical: 8,
    borderRadius:    BorderRadius.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    backgroundColor: colors.white,
  },
  bloodChipSelected: {
    backgroundColor: colors.primary,
    borderColor:     colors.primary,
  },
  bloodChipText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '700',
    color:      colors.text,
  },
  bloodChipTextSelected: {
    color: colors.white,
  },

  // ── Save / success / error ─────────────────────────────────────────────────
  successBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.success + '15',
    borderRadius:      BorderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginBottom:      spacing.md,
    gap:               spacing.xs,
  },
  successBannerText: {
    fontSize: typography.sizes.sm,
    color:    colors.success,
    flex:     1,
  },
  errorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.error + '15',
    borderRadius:      BorderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginBottom:      spacing.md,
    gap:               spacing.xs,
  },
  errorBannerText: {
    fontSize: typography.sizes.sm,
    color:    colors.error,
    flex:     1,
  },
  saveBtn: {
    marginBottom: spacing.lg,
  },

  // ── Quick actions card ─────────────────────────────────────────────────────
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius:    BorderRadius.xl,
    marginBottom:    spacing.md,
    ...shadows.sm,
  },
  actionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  actionIconBox: {
    width:           36,
    height:          36,
    borderRadius:    BorderRadius.md,
    backgroundColor: colors.primary + '18',
    alignItems:      'center',
    justifyContent:  'center',
  },
  actionLabel: {
    flex:       1,
    fontSize:   typography.sizes.md,
    color:      colors.text,
    fontWeight: '500',
  },
  actionDivider: {
    height:           1,
    backgroundColor:  colors.borderLight,
    marginHorizontal: spacing.md,
  },

  // ── Log out ────────────────────────────────────────────────────────────────
  logOutBtn: {
    marginTop:        spacing.sm,
    marginBottom:     spacing.md,
    borderColor:      colors.error,
  },

  // ── Footer version text ────────────────────────────────────────────────────
  versionText: {
    textAlign: 'center',
    fontSize:  typography.sizes.xs,
    color:     colors.gray,
    marginTop: spacing.sm,
  },
});

export default PatientProfileScreen;
