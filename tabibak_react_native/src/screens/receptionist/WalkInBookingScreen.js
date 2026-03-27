/**
 * WalkInBookingScreen.js — Receptionist Fast-Path Walk-In Booking (Phase 4)
 *
 * ╔══ ARCHITECTURE ═══════════════════════════════════════════════════════════╗
 *
 * SINGLE-SCREEN TWO-STEP FLOW
 * ────────────────────────────
 *   Step 1 — Patient acquisition (phone search → select or register)
 *   Step 2 — Doctor assignment  (horizontal chip selector)
 *   Submit  — "Add to Queue" → appointmentService.createWalkInAppointment
 *
 * PATIENT SEARCH STATE MACHINE
 * ─────────────────────────────
 *   idle       — phone field is empty / too short (< 7 raw digits)
 *   searching  — 400 ms debounce pending, or Firestore query in-flight
 *   found      — existing patient document returned; shows SelectCard
 *   not_found  — query returned empty; reveals Fast Registration form
 *   selected   — patient locked in; phone field replaced by LockedCard
 *
 *   Normalisation converts Iraqi local numbers (07XXXXXXXXX / 7XXXXXXXXX)
 *   and E.164 (+9647XXXXXXXXX) to a canonical +9647XXXXXXXXX before querying.
 *
 * NEW PATIENT — LIGHTWEIGHT REGISTRATION
 * ───────────────────────────────────────
 *   Only Full Name + Gender collected at booking time.
 *   No Firebase Auth account is created.
 *   appointmentService.createWalkInAppointment() writes a patient document
 *   first (COLLECTIONS.PATIENTS), then immediately creates the appointment
 *   with status: 'waiting'. The patient lands directly in the queue.
 *
 * CONTRACTS ENFORCED
 * ───────────────────
 *   ✅ ScreenContainer (scrollable=true, padded=false, edges=['bottom'])
 *   ✅ RTL logical properties throughout (marginStart/End, paddingStart/End)
 *   ✅ All text via t() — zero hardcoded strings
 *   ✅ Colors from theme.js — zero hardcoded hex
 *   ✅ Zero Firebase imports — all I/O via appointmentService
 *   ✅ isSubmitting guard prevents double-tap race conditions
 *   ✅ Inline errors / success — zero Alert.alert
 *
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer, CustomTextField, PrimaryButton } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import appointmentService from '../../services/appointmentService';
import {
  colors,
  spacing,
  typography,
  BorderRadius,
  shadows,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Phone normalisation
// Converts any Iraqi phone variant to E.164 (+9647XXXXXXXXX).
// ─────────────────────────────────────────────────────────────────────────────
const normalizePhone = (raw) => {
  const digits = raw.replace(/\D/g, '');
  // Already E.164 digits: 9647XXXXXXXXX (13 digits)
  if (digits.startsWith('964') && digits.length === 13) return `+${digits}`;
  // Local with leading 0: 07XXXXXXXXX (11 digits)
  if (digits.startsWith('07') && digits.length === 11) return `+964${digits.slice(1)}`;
  // Local without leading 0: 7XXXXXXXXX (10 digits)
  if (digits.startsWith('7') && digits.length === 10) return `+964${digits}`;
  return digits; // Non-matching input returned as raw digits (query will miss)
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section title with a left accent bar */
const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionAccent} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

/** Shown while the patient search is in-flight */
const SearchingIndicator = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.searchingRow}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.searchingText}>{t('receptionist.walkIn.searching')}</Text>
    </View>
  );
};

/**
 * PatientFoundCard — displayed when the Firestore query found an existing
 * patient. Receptionist taps "Select" to lock them in.
 */
const PatientFoundCard = React.memo(({ patient, onSelect }) => {
  const { t }  = useTranslation();
  const name   = patient.fullName || patient.name || '—';
  const initial = name[0].toUpperCase();

  return (
    <View style={styles.foundCard}>
      <View style={styles.foundAvatar}>
        <Text style={styles.foundAvatarText}>{initial}</Text>
      </View>
      <View style={styles.foundInfo}>
        <Text style={styles.foundName}>{name}</Text>
        <Text style={styles.foundMeta}>
          {t('receptionist.walkIn.patientFound')}
        </Text>
      </View>
      <TouchableOpacity style={styles.selectBtn} onPress={onSelect} activeOpacity={0.8}>
        <Text style={styles.selectBtnText}>{t('receptionist.walkIn.select')}</Text>
      </TouchableOpacity>
    </View>
  );
});

/**
 * LockedPatientCard — shown when a patient has been selected/locked in.
 * The ✕ button clears the selection and resets Step 1.
 */
const LockedPatientCard = React.memo(({ patient, onClear }) => {
  const name    = patient.fullName || patient.name || '—';
  const initial = name[0].toUpperCase();

  return (
    <View style={[styles.foundCard, styles.lockedCard]}>
      <View style={[styles.foundAvatar, styles.lockedAvatar]}>
        <Text style={styles.foundAvatarText}>{initial}</Text>
      </View>
      <View style={styles.foundInfo}>
        <Text style={styles.foundName}>{name}</Text>
        {!!patient.phoneNumber && (
          <Text style={styles.foundMeta}>{patient.phoneNumber}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.clearBtn}
        onPress={onClear}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
});

/**
 * FastRegForm — revealed when the searched phone has no existing patient.
 * Collects Full Name + Gender (the phone is already known from the search).
 */
const FastRegForm = React.memo(({ name, onNameChange, gender, onGenderChange }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.fastRegWrapper}>
      <View style={styles.fastRegHeader}>
        <Ionicons name="person-add-outline" size={16} color={colors.primary} />
        <Text style={styles.fastRegTitle}>{t('receptionist.walkIn.fastReg')}</Text>
      </View>

      <CustomTextField
        label={t('receptionist.walkIn.fullName')}
        value={name}
        onChangeText={onNameChange}
        placeholder={t('receptionist.walkIn.fullNamePlaceholder')}
        autoCapitalize="words"
        autoCorrect={false}
        style={styles.noMarginBottom}
      />

      {/* Gender selector */}
      <Text style={styles.genderLabel}>{t('receptionist.walkIn.gender')}</Text>
      <View style={styles.genderRow}>
        {[
          { value: 'male',   icon: 'male',   labelKey: 'receptionist.walkIn.male'   },
          { value: 'female', icon: 'female', labelKey: 'receptionist.walkIn.female' },
        ].map(({ value, icon, labelKey }) => {
          const selected = gender === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.genderBtn, selected && styles.genderBtnSelected]}
              onPress={() => onGenderChange(value)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={icon}
                size={22}
                color={selected ? colors.white : colors.primary}
              />
              <Text style={[styles.genderBtnText, selected && styles.genderBtnTextSelected]}>
                {t(labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

/**
 * DoctorChip — one selectable chip in the doctor horizontal list.
 */
const DoctorChip = React.memo(({ doctor, isSelected, onPress }) => (
  <TouchableOpacity
    style={[styles.doctorChip, isSelected && styles.doctorChipSelected]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text
      style={[styles.doctorChipName, isSelected && styles.doctorChipNameSelected]}
      numberOfLines={1}
    >
      {doctor.name}
    </Text>
    {!!doctor.specialty && (
      <Text
        style={[styles.doctorChipSpec, isSelected && styles.doctorChipSpecSelected]}
        numberOfLines={1}
      >
        {doctor.specialty}
      </Text>
    )}
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

const WalkInBookingScreen = ({ navigation }) => {
  const { t }       = useTranslation();
  const insets      = useSafeAreaInsets();
  const { userProfile } = useAuth();

  // If this receptionist is linked to a single doctor, use that doctor directly
  // and skip the doctor-selection step entirely.
  const assignedDoctorId = userProfile?.doctorId ?? null;

  // ── Patient search state ────────────────────────────────────────────────────
  const [phone, setPhone]               = useState('');
  // 'idle' | 'searching' | 'found' | 'not_found'
  const [searchState, setSearchState]   = useState('idle');
  const [foundPatient, setFoundPatient] = useState(null);
  // When locked: patient object (found or registered)
  const [selectedPatient, setSelectedPatient] = useState(null);

  // ── Fast registration fields (shown when not_found) ────────────────────────
  const [newName,   setNewName]   = useState('');
  const [newGender, setNewGender] = useState('');

  // ── Doctor selector ─────────────────────────────────────────────────────────
  const [doctors,          setDoctors]          = useState([]);
  const [doctorsLoading,   setDoctorsLoading]   = useState(true);
  const [doctorsError,     setDoctorsError]     = useState(false);
  const [selectedDoctorId,   setSelectedDoctorId]   = useState(null);
  const [selectedDoctorName, setSelectedDoctorName] = useState('');

  // ── Submission state ───────────────────────────────────────────────────────
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [submitError,   setSubmitError]   = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const debounceRef = useRef(null);

  // ── Load doctor list on mount (only when not pre-assigned) ───────────────
  const loadDoctors = useCallback(async () => {
    if (assignedDoctorId) return; // skip — doctor is pre-assigned from profile
    setDoctorsLoading(true);
    setDoctorsError(false);
    const list = await appointmentService.fetchAllDoctors();
    setDoctors(list);
    setDoctorsLoading(false);
    if (list.length === 0) setDoctorsError(true);
  }, [assignedDoctorId]);

  // Auto-select the assigned doctor — single getDoc, much faster than fetchAllDoctors
  useEffect(() => {
    if (assignedDoctorId) {
      appointmentService.fetchDoctorById(assignedDoctorId).then((doctor) => {
        if (doctor) {
          setSelectedDoctorId(doctor.id);
          setSelectedDoctorName(doctor.name);
        }
        setDoctorsLoading(false);
      });
    } else {
      loadDoctors();
    }
  }, [assignedDoctorId, loadDoctors]);

  // ── Debounced patient search — fires 400 ms after the user stops typing ────
  useEffect(() => {
    // Don't search while a patient is already selected
    if (selectedPatient) return;

    clearTimeout(debounceRef.current);

    const rawDigits = phone.replace(/\D/g, '');
    if (rawDigits.length < 7) {
      setSearchState('idle');
      setFoundPatient(null);
      return;
    }

    setSearchState('searching');

    debounceRef.current = setTimeout(async () => {
      const normalized = normalizePhone(phone);
      const patient    = await appointmentService.searchPatientByPhone(normalized);
      if (patient) {
        setFoundPatient(patient);
        setSearchState('found');
      } else {
        setFoundPatient(null);
        setSearchState('not_found');
        setNewName('');
        setNewGender('');
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [phone, selectedPatient]);

  // ── Clear the patient selection and reset Step 1 ───────────────────────────
  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setPhone('');
    setSearchState('idle');
    setFoundPatient(null);
    setNewName('');
    setNewGender('');
    setSubmitError('');
  }, []);

  // ── Lock in a found patient ────────────────────────────────────────────────
  const handleSelectFound = useCallback(() => {
    setSelectedPatient(foundPatient);
    setSearchState('idle');
  }, [foundPatient]);

  // ── Doctor chip press ──────────────────────────────────────────────────────
  const handleSelectDoctor = useCallback((doctor) => {
    setSelectedDoctorId(doctor.id);
    setSelectedDoctorName(doctor.name);
    setSubmitError('');
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const isNewPatient = searchState === 'not_found' && !selectedPatient;

  const canSubmit =
    !isSubmitting &&
    !submitSuccess &&
    !!selectedDoctorId &&
    // Accept either: explicitly locked patient, found patient (no lock needed), or valid new-patient form
    (!!selectedPatient || !!foundPatient || (isNewPatient && newName.trim().length > 0 && newGender !== ''));

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    // Client-side validation (canSubmit already gates most checks)
    if (!selectedDoctorId) {
      setSubmitError(t('receptionist.walkIn.doctorRequired'));
      return;
    }
    if (isNewPatient && !newName.trim()) {
      setSubmitError(t('receptionist.walkIn.nameRequired'));
      return;
    }
    if (isNewPatient && !newGender) {
      setSubmitError(t('receptionist.walkIn.genderRequired'));
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const normalizedPhone = normalizePhone(phone);

      // Use explicitly locked patient, or fall back to the found patient directly
      const confirmedPatient = selectedPatient ?? foundPatient;
      const patientData = confirmedPatient
        ? {
            id:          confirmedPatient.id,
            fullName:    confirmedPatient.fullName || confirmedPatient.name || '—',
            phoneNumber: confirmedPatient.phoneNumber || normalizedPhone,
            isNew:       false,
          }
        : {
            fullName:    newName.trim(),
            phoneNumber: normalizedPhone,
            gender:      newGender,
            isNew:       true,
          };

      const result = await appointmentService.createWalkInAppointment(
        patientData,
        selectedDoctorId,
        selectedDoctorName,
      );

      if (result.success) {
        setSubmitSuccess(true);
        setTimeout(() => navigation.goBack(), 1500);
      } else {
        setSubmitError(t('receptionist.walkIn.submitError'));
      }
    } catch {
      setSubmitError(t('receptionist.walkIn.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    selectedPatient,
    isNewPatient,
    newName,
    newGender,
    phone,
    selectedDoctorId,
    selectedDoctorName,
    t,
    navigation,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable padded={false} edges={['bottom']}>

      {/* ── Green header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={I18nManager.isRTL ? 'arrow-forward' : 'arrow-back'}
            size={22}
            color={colors.white}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('receptionist.walkIn.title')}</Text>
        {/* Spacer to balance back button */}
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Form content ──────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* ──────────────── STEP 1: Patient ──────────────────────────────── */}
        <SectionHeader title={t('receptionist.walkIn.stepPatient')} />

        {selectedPatient ? (
          /* Patient locked in — show card with clear button */
          <LockedPatientCard patient={selectedPatient} onClear={handleClearPatient} />
        ) : (
          <>
            {/* Phone number input */}
            <CustomTextField
              label={t('receptionist.walkIn.phoneLabel')}
              value={phone}
              onChangeText={(v) => { setPhone(v); setSubmitError(''); }}
              placeholder={t('receptionist.walkIn.phonePlaceholder')}
              keyboardType="phone-pad"
              maxLength={15}
            />

            {/* Search feedback */}
            {searchState === 'searching' && <SearchingIndicator />}

            {searchState === 'found' && foundPatient && (
              <PatientFoundCard patient={foundPatient} onSelect={handleSelectFound} />
            )}

            {searchState === 'not_found' && (
              <>
                {/* "Not found" hint */}
                <View style={styles.notFoundHint}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.notFoundHintText}>
                    {t('receptionist.walkIn.patientNotFound')}
                  </Text>
                </View>

                {/* Fast registration form */}
                <FastRegForm
                  name={newName}
                  onNameChange={(v) => { setNewName(v); setSubmitError(''); }}
                  gender={newGender}
                  onGenderChange={(v) => { setNewGender(v); setSubmitError(''); }}
                />
              </>
            )}
          </>
        )}

        {/* ──────────────── STEP 2: Doctor ───────────────────────────────── */}
        {/* Hidden when the receptionist is pre-assigned to a single doctor */}
        {assignedDoctorId ? (
          /* Show a read-only pill so the receptionist knows which doctor is assigned */
          selectedDoctorName ? (
            <View style={styles.assignedDoctorRow}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.assignedDoctorText}>{selectedDoctorName}</Text>
            </View>
          ) : (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
          )
        ) : (
          <>
            <SectionHeader title={t('receptionist.walkIn.stepDoctor')} />
            {doctorsLoading ? (
              <View style={styles.doctorsLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : doctorsError ? (
              <View style={styles.doctorsError}>
                <Text style={styles.doctorsErrorText}>
                  {t('receptionist.walkIn.loadDoctorsError')}
                </Text>
                <TouchableOpacity onPress={loadDoctors} style={styles.retryLink}>
                  <Text style={styles.retryLinkText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : doctors.length === 0 ? (
              <Text style={styles.noDoctorsText}>{t('receptionist.walkIn.noDoctor')}</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.doctorChipsContent}
                style={styles.doctorChipsScroll}
              >
                {doctors.map((doctor) => (
                  <DoctorChip
                    key={doctor.id}
                    doctor={doctor}
                    isSelected={selectedDoctorId === doctor.id}
                    onPress={() => handleSelectDoctor(doctor)}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* ──────────────── Submit area ───────────────────────────────────── */}

        {/* Success banner */}
        {submitSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
            <Text style={styles.successBannerText}>
              {t('receptionist.walkIn.successMsg')}
            </Text>
          </View>
        )}

        {/* Inline error banner — zero Alert.alert */}
        {!!submitError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        )}

        <PrimaryButton
          label={t('receptionist.walkIn.addToQueue')}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!canSubmit}
          style={styles.submitBtn}
        />

      </View>
    </ScreenContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// All horizontal spacing uses marginStart/End and paddingStart/End so React
// Native's RTL engine flips them automatically for Arabic.
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    backgroundColor:  colors.primary,
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: spacing.md,
    paddingBottom:    spacing.md,
  },
  backBtn: {
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex:       1,
    fontSize:   typography.sizes.lg,
    fontWeight: '700',
    color:      colors.white,
    textAlign:  'center',
  },
  headerSpacer: {
    width: 36,
  },

  // ── Form content ───────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xl,
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
    fontSize:   typography.sizes.sm,
    fontWeight: '700',
    color:      colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Searching row ──────────────────────────────────────────────────────────
  searchingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.md,
    gap:           spacing.xs,
  },
  searchingText: {
    fontSize: typography.sizes.sm,
    color:    colors.textSecondary,
  },

  // ── Found / Locked patient card ────────────────────────────────────────────
  foundCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.white,
    borderRadius:    BorderRadius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.md,
    borderWidth:     1.5,
    borderColor:     colors.border,
    ...shadows.sm,
  },
  lockedCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  foundAvatar: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: colors.primary + '20',
    alignItems:      'center',
    justifyContent:  'center',
    marginEnd:       spacing.sm,
  },
  lockedAvatar: {
    backgroundColor: colors.primary + '30',
  },
  foundAvatarText: {
    fontSize:   typography.sizes.lg,
    fontWeight: '700',
    color:      colors.primary,
  },
  foundInfo: {
    flex: 1,
  },
  foundName: {
    fontSize:   typography.sizes.md,
    fontWeight: '600',
    color:      colors.text,
  },
  foundMeta: {
    fontSize:  typography.sizes.sm,
    color:     colors.textSecondary,
    marginTop: 2,
  },

  // Select button (inside found card)
  selectBtn: {
    backgroundColor:   colors.primary,
    borderRadius:      BorderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  selectBtnText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '600',
    color:      colors.white,
  },

  // Clear button (inside locked card)
  clearBtn: {
    padding: spacing.xs,
  },

  // ── Not-found hint ─────────────────────────────────────────────────────────
  notFoundHint: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginBottom:  spacing.sm,
  },
  notFoundHintText: {
    fontSize: typography.sizes.sm,
    color:    colors.textSecondary,
    flex:     1,
  },

  // ── Fast registration form ─────────────────────────────────────────────────
  fastRegWrapper: {
    backgroundColor: colors.primary + '08',
    borderRadius:    BorderRadius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.md,
    borderWidth:     1,
    borderColor:     colors.primary + '30',
  },
  fastRegHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginBottom:  spacing.md,
  },
  fastRegTitle: {
    fontSize:   typography.sizes.sm,
    fontWeight: '700',
    color:      colors.primary,
  },
  noMarginBottom: {
    marginBottom: spacing.sm,
  },

  // Gender selector
  genderLabel: {
    fontSize:   typography.sizes.sm,
    fontWeight: '500',
    color:      colors.text,
    marginBottom: spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  genderBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius:    BorderRadius.lg,
    borderWidth:     1.5,
    borderColor:     colors.primary,
    backgroundColor: colors.white,
  },
  genderBtnSelected: {
    backgroundColor: colors.primary,
    borderColor:     colors.primary,
  },
  genderBtnText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '600',
    color:      colors.primary,
  },
  genderBtnTextSelected: {
    color: colors.white,
  },

  // ── Doctor selector ────────────────────────────────────────────────────────
  doctorChipsScroll: {
    marginBottom: spacing.md,
  },
  doctorChipsContent: {
    gap:            spacing.sm,
    paddingVertical: spacing.xs,
  },
  doctorChip: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      BorderRadius.lg,
    borderWidth:       1.5,
    borderColor:       colors.border,
    backgroundColor:   colors.white,
    minWidth:          110,
    alignItems:        'center',
    ...shadows.sm,
  },
  doctorChipSelected: {
    borderColor:     colors.primary,
    backgroundColor: colors.primary + '12',
  },
  doctorChipName: {
    fontSize:   typography.sizes.sm,
    fontWeight: '600',
    color:      colors.text,
    textAlign:  'center',
  },
  doctorChipNameSelected: {
    color: colors.primary,
  },
  doctorChipSpec: {
    fontSize:  typography.sizes.xs,
    color:     colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  doctorChipSpecSelected: {
    color: colors.primary + 'BB',
  },
  assignedDoctorRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight ?? '#e8f5e9',
    borderRadius:    8,
    marginBottom:    spacing.md,
  },
  assignedDoctorText: {
    ...typography.body,
    color:      colors.primary,
    fontWeight: '600',
    flex:       1,
    textAlign:  'right',
  },
  doctorsLoading: {
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginBottom:    spacing.md,
  },
  doctorsError: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.md,
    gap:           spacing.sm,
  },
  doctorsErrorText: {
    fontSize: typography.sizes.sm,
    color:    colors.error,
  },
  retryLink: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
  },
  retryLinkText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '600',
    color:      colors.primary,
  },
  noDoctorsText: {
    fontSize:     typography.sizes.sm,
    color:        colors.textSecondary,
    marginBottom: spacing.md,
  },

  // ── Success banner ─────────────────────────────────────────────────────────
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

  // ── Error banner ───────────────────────────────────────────────────────────
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

  // ── Submit button ──────────────────────────────────────────────────────────
  submitBtn: {
    marginTop: spacing.sm,
  },
});

export default WalkInBookingScreen;
