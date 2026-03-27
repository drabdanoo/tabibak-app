import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenContainer, PrimaryButton, CustomTextField } from '../../components/ui';
import { colors, spacing, typography, BorderRadius, shadows } from '../../config/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;   // DD/MM/YYYY — Iraqi convention
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const ProfileSetupScreen = () => {
  const { t }             = useTranslation();
  const { createProfile } = useAuth();

  const [fullName, setFullName]         = useState('');
  const [dateObject, setDateObject]     = useState(new Date(2000, 0, 1));
  const [dateOfBirth, setDateOfBirth]   = useState('');
  const [showPicker, setShowPicker]     = useState(false);
  const [gender, setGender]             = useState('');   // 'male' | 'female'
  const [isLoading, setIsLoading]       = useState(false);
  const [formError, setFormError]       = useState('');

  const canSubmit = fullName.trim().length > 0 && dateOfBirth.length > 0 && gender !== '';

  const handleDateChange = (_event, selected) => {
    // On Android the picker closes itself; on iOS we keep it open
    if (Platform.OS !== 'ios') setShowPicker(false);

    if (!selected) return;

    if (selected > new Date()) {
      setFormError(t('auth.dobFuture'));
      return;
    }
    setFormError('');
    setDateObject(selected);
    setDateOfBirth(formatDate(selected));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFormError(t('auth.profileRequired'));
      return;
    }

    setFormError('');
    setIsLoading(true);

    const success = await createProfile({
      fullName:    fullName.trim(),
      dateOfBirth,
      gender,
    });

    setIsLoading(false);

    if (!success) {
      setFormError(t('errors.generic'));
    }
    // On success AuthContext onAuthStateChanged fires → PatientStack mounts automatically
  };

  return (
    <ScreenContainer scrollable={true} padded={true} edges={['top', 'bottom']}>

      {/* Hero */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-add-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>{t('auth.profileSetup')}</Text>
        <Text style={styles.subtitle}>{t('auth.profileSubtitle')}</Text>
        <Text style={styles.requiredNote}>{t('auth.profileDoctorNote')}</Text>
      </View>

      {/* Full name */}
      <CustomTextField
        label={t('auth.fullName')}
        value={fullName}
        onChangeText={(v) => { setFullName(v); setFormError(''); }}
        placeholder={t('auth.fullNamePlaceholder')}
        autoCapitalize="words"
        autoCorrect={false}
      />

      {/* Date of birth — tappable field that opens DateTimePicker */}
      <View style={styles.dobWrapper}>
        <Text style={styles.dobLabel}>{t('auth.dateOfBirth')}</Text>
        <TouchableOpacity
          style={styles.dobField}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={dateOfBirth ? styles.dobValue : styles.dobPlaceholder}>
            {dateOfBirth || t('auth.dobHint')}
          </Text>
          <Ionicons name="calendar-outline" size={20} color={colors.gray} />
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          value={dateObject}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Gender */}
      <Text style={styles.genderLabel}>{t('auth.gender')}</Text>
      <View style={styles.genderRow}>
        {[
          { value: 'male',   icon: 'male',   labelKey: 'auth.male'   },
          { value: 'female', icon: 'female', labelKey: 'auth.female' },
        ].map(({ value, icon, labelKey }) => {
          const selected = gender === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.genderBtn, selected && styles.genderBtnSelected]}
              onPress={() => { setGender(value); setFormError(''); }}
              activeOpacity={0.75}
            >
              <Ionicons
                name={icon}
                size={26}
                color={selected ? colors.white : colors.primary}
              />
              <Text style={[styles.genderText, selected && styles.genderTextSelected]}>
                {t(labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Inline error */}
      {!!formError && (
        <Text style={styles.errorText}>{formError}</Text>
      )}

      {/* CTA */}
      <PrimaryButton
        label={t('auth.completeProfile')}
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={isLoading}
        style={styles.button}
      />

    </ScreenContainer>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  requiredNote: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.xs,
    backgroundColor: colors.primary + '12',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Date of birth
  dobWrapper: {
    marginBottom: spacing.md,
  },
  dobLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dobField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  dobValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
    flex: 1,
  },
  dobPlaceholder: {
    fontSize: typography.sizes.md,
    color: colors.gray,
    flex: 1,
  },

  // Gender
  genderLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  genderBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    gap: spacing.xs,
    ...shadows.sm,
  },
  genderBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  genderTextSelected: {
    color: colors.white,
  },

  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginBottom: spacing.md,
  },

  button: {
    marginTop: spacing.sm,
  },
});

export default ProfileSetupScreen;
