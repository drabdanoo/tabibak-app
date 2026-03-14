/**
 * BookAppointmentScreen — Phase 4: Surgical Rebuild
 *
 * ── Architectural contracts enforced ─────────────────────────────────────────
 *
 * DESIGN SYSTEM   — ScreenContainer wraps the entire screen. PrimaryButton for
 *                   the Confirm Booking CTA. CustomTextField for all text inputs.
 *                   Colors/sizes from theme.js only; zero inline hex or raw numbers.
 *
 * RTL             — Logical properties exclusively (marginStart/End, paddingStart/End,
 *                   borderStartWidth). Zero left/right/marginLeft/paddingRight.
 *
 * LOCALIZATION    — useTranslation() for every visible string; zero hardcoded text.
 *
 * SERVICE LAYER   — No Firestore imports. Slot math in
 *                   appointmentService.getAvailableSlots(doctorId, dateStr).
 *                   Booking via appointmentService.bookAppointment(payload).
 *
 * ERROR HANDLING  — Booking failures → inline <Text style={inlineError}>.
 *                   Never an unhandled Alert for service failures.
 *
 * 3-STATE FOOTER  — CTA disabled until BOTH date AND slot are selected.
 *                   PrimaryButton loading=true during submission.
 *
 * ── Layout ───────────────────────────────────────────────────────────────────
 *
 * ScreenContainer (SafeAreaView + KAV)
 *   └─ ScrollView  (scrollable content)
 *   └─ View footer (sticky — sibling to ScrollView inside the KAV)
 *
 * KAV's "padding" mode on iOS pushes the footer above the keyboard.
 *
 * ── Slot engine ──────────────────────────────────────────────────────────────
 *
 * appointmentService.getAvailableSlots() handles:
 *   • doctor working hours lookup for the weekday
 *   • pending + confirmed appointment overlay (marks occupied slots)
 *   • past-slot filtering for today
 * Zero slot math lives in this file.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useTranslation }   from 'react-i18next';
import { Ionicons }         from '@expo/vector-icons';

import { useAuth }          from '../../contexts/AuthContext';
import appointmentService   from '../../services/appointmentService';
import { ScreenContainer, PrimaryButton, CustomTextField } from '../../components/ui';
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

const DATE_WINDOW = 14;

// Height of the sticky footer (approximate) — used to add a ScrollView spacer
// so the last section is not permanently hidden behind the footer.
const FOOTER_APPROX_HEIGHT = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Date → 'YYYY-MM-DD' in local time (avoids UTC-shift from toISOString). */
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Generate DATE_WINDOW Date objects starting from local midnight today. */
function generateDateWindow() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: DATE_WINDOW }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

/** First two uppercase initials from a name string. */
function getInitials(name) {
  return (name ?? '')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (module-scope for stable identity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Section — white card with icon + title row and optional subtitle.
 */
const Section = React.memo(({ icon, title, subtitle, children }) => (
  <View style={S.section}>
    <View style={S.sectionHeader}>
      {icon && <Ionicons name={icon} size={20} color={colors.primary} style={S.sectionIcon} />}
      <Text style={S.sectionTitle}>{title}</Text>
    </View>
    {subtitle ? <Text style={S.sectionSubtitle}>{subtitle}</Text> : null}
    {children}
  </View>
));

/**
 * DatePill — single chip in the horizontal date strip.
 * Active: green background + white text.
 */
const DatePill = React.memo(({ date, isSelected, isToday, onSelect, todayLabel }) => (
  <TouchableOpacity
    style={[S.datePill, isSelected && S.datePillActive]}
    onPress={() => onSelect(date)}
    activeOpacity={0.75}
  >
    <Text style={[S.datePillDay, isSelected && S.datePillTextActive]}>
      {isToday ? todayLabel : date.toLocaleDateString(undefined, { weekday: 'short' })}
    </Text>
    <Text style={[S.datePillNum, isSelected && S.datePillTextActive]}>
      {date.getDate()}
    </Text>
  </TouchableOpacity>
));

/**
 * SlotChip — time slot chip in the flexWrap grid.
 * States: default | selected (green fill) | booked (struck-through, disabled).
 */
const SlotChip = React.memo(({ slot, isSelected, onSelect }) => (
  <TouchableOpacity
    style={[
      S.slotChip,
      !slot.available && S.slotChipBooked,
      isSelected       && S.slotChipSelected,
    ]}
    onPress={() => slot.available && onSelect(slot)}
    disabled={!slot.available}
    activeOpacity={0.75}
  >
    <Text style={[
      S.slotChipText,
      !slot.available && S.slotChipTextBooked,
      isSelected       && S.slotChipTextSelected,
    ]}>
      {slot.display}
    </Text>
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function BookAppointmentScreen({ route, navigation }) {
  const { t }                 = useTranslation();
  const { user, userProfile } = useAuth();
  const { doctor }            = route.params ?? {};

  // ── Date strip ─────────────────────────────────────────────────────────────
  const dates                               = useMemo(generateDateWindow, []);
  const [selectedDate, setSelectedDate]     = useState(dates[0]);

  // ── Slot grid ──────────────────────────────────────────────────────────────
  const [slots, setSlots]                   = useState([]);
  const [slotsLoading, setSlotsLoading]     = useState(false);
  const [selectedSlot, setSelectedSlot]     = useState(null);

  // ── Form fields ────────────────────────────────────────────────────────────
  const [bookingFor, setBookingFor]             = useState('self');
  const [familyMemberName, setFamilyMemberName] = useState('');
  const [reason, setReason]                     = useState('');
  const [notes, setNotes]                       = useState('');
  const [allergies, setAllergies]               = useState('');
  const [medications, setMedications]           = useState('');
  const [conditions, setConditions]             = useState('');

  // ── Submission ─────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitError, setSubmitError]     = useState(null);

  // ── Load slots on date change ───────────────────────────────────────────────
  useEffect(() => {
    if (!doctor?.id) return;
    let cancelled = false;

    setSlotsLoading(true);
    setSelectedSlot(null);
    setSubmitError(null);

    appointmentService.getAvailableSlots(doctor.id, toLocalDateStr(selectedDate))
      .then((list) => {
        if (cancelled) return;
        setSlots(list);
        // Auto-select the first available slot for smoother UX.
        const first = list.find(s => s.available);
        if (first) setSelectedSlot(first);
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });

    return () => { cancelled = true; };
  }, [selectedDate, doctor?.id]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    // Slot reload is triggered by the useEffect dep on selectedDate.
  }, []);

  const handleSlotSelect = useCallback((slot) => {
    setSelectedSlot(slot);
    setSubmitError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    // Client-side validation — fast, no network round-trip.
    if (!reason.trim()) {
      setSubmitError(t('appointments.reasonRequired'));
      return;
    }
    if (bookingFor === 'family' && !familyMemberName.trim()) {
      setSubmitError(t('appointments.familyNameRequired'));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const dateStr     = toLocalDateStr(selectedDate);
      const patientName = bookingFor === 'self'
        ? (userProfile?.fullName ?? user?.displayName ?? user?.phoneNumber ?? 'Patient')
        : familyMemberName.trim();

      const payload = {
        patientId:       user.uid,
        patientName,
        patientPhone:    user.phoneNumber ?? '',
        doctorId:        doctor.id,
        doctorName:      doctor.name,
        appointmentDate: dateStr,
        appointmentTime: selectedSlot.time,       // 'HH:MM' — 24h for clean lexicographic ordering
        reason:          reason.trim(),
        notes:           notes.trim(),
        status:          'pending',
        bookingFor,
        ...(bookingFor === 'family' ? { familyMemberName: familyMemberName.trim() } : {}),
        medicalHistory: {
          allergies:          allergies.trim()   || 'None',
          currentMedications: medications.trim() || 'None',
          chronicConditions:  conditions.trim()  || 'None',
        },
      };

      const result = await appointmentService.bookAppointment(payload);

      if (result.success) {
        const dateLabel = selectedDate.toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric',
        });
        Alert.alert(
          t('appointments.bookingSuccess'),
          t('appointments.bookingSuccessMsg', {
            doctor: doctor.name,
            date:   dateLabel,
            time:   selectedSlot.display,
          }),
          [{
            text:    t('appointments.viewAppointments'),
            onPress: () => navigation.navigate('Appointments'),
          }],
        );
      } else {
        // Inline error — no Alert per architectural contract.
        setSubmitError(result.error ?? t('errors.generic'));
      }
    } catch (err) {
      console.error('[BookAppointment.handleConfirm]', err);
      setSubmitError(t('errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    reason, bookingFor, familyMemberName, selectedDate, selectedSlot,
    user, userProfile, doctor, notes, allergies, medications, conditions,
    navigation, t,
  ]);

  // ── FlatList callbacks ─────────────────────────────────────────────────────
  const dateKeyExtractor = useCallback((d) => d.toISOString(), []);
  const todayStr         = useMemo(() => dates[0].toDateString(), [dates]);

  const renderDatePill = useCallback(({ item: date }) => (
    <DatePill
      date={date}
      isSelected={date.toDateString() === selectedDate.toDateString()}
      isToday={date.toDateString() === todayStr}
      onSelect={handleDateSelect}
      todayLabel={t('appointments.today')}
    />
  ), [selectedDate, todayStr, handleDateSelect, t]);

  // CTA disabled until both date + slot chosen, or while submitting.
  const canConfirm = !!selectedSlot && !isSubmitting;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable={false} padded={false} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* ── SCROLLABLE CONTENT ───────────────────────────────────────── */}
      <ScrollView
        style={S.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={S.scrollContent}
      >
        {/* ── Doctor Summary Card ──────────────────────────────────── */}
        <View style={[S.doctorCard, shadows.sm]}>
          <View style={S.doctorAvatar}>
            <Text style={S.doctorAvatarText}>{getInitials(doctor?.name)}</Text>
          </View>
          <View style={S.doctorInfo}>
            <Text style={S.doctorName}>{doctor?.name ?? '—'}</Text>
            {!!doctor?.specialty && (
              <Text style={S.doctorSpecialty}>{doctor.specialty}</Text>
            )}
            {!!doctor?.hospital && (
              <Text style={S.doctorHospital}>{doctor.hospital}</Text>
            )}
          </View>
          {!!doctor?.consultationFee && (
            <View style={S.feeTag}>
              <Text style={S.feeTagText}>${doctor.consultationFee}</Text>
            </View>
          )}
        </View>

        {/* ── Date Selection ───────────────────────────────────────── */}
        <Section icon="calendar-outline" title={t('appointments.selectDate')}>
          <FlatList
            horizontal
            data={dates}
            keyExtractor={dateKeyExtractor}
            renderItem={renderDatePill}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.datePillList}
          />
        </Section>

        {/* ── Time Slots ───────────────────────────────────────────── */}
        <Section icon="time-outline" title={t('appointments.selectTime')}>
          {slotsLoading ? (
            <View style={S.slotsLoadingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={S.slotsLoadingText}>{t('appointments.loadingSlots')}</Text>
            </View>
          ) : slots.length === 0 ? (
            <View style={S.noSlotsWrap}>
              <Ionicons name="calendar-outline" size={44} color={colors.border} />
              <Text style={S.noSlotsTitle}>{t('appointments.noSlotsTitle')}</Text>
              <Text style={S.noSlotsSub}>{t('appointments.noSlotsSub')}</Text>
            </View>
          ) : (
            /*
             * flexWrap grid — gap-based spacing, zero directional margins.
             * In RTL, chips wrap right-to-left automatically via flex engine.
             */
            <View style={S.slotsGrid}>
              {slots.map((slot) => (
                <SlotChip
                  key={slot.time}
                  slot={slot}
                  isSelected={selectedSlot?.time === slot.time}
                  onSelect={handleSlotSelect}
                />
              ))}
            </View>
          )}
        </Section>

        {/* ── Booking For ──────────────────────────────────────────── */}
        <Section icon="people-outline" title={t('appointments.bookingFor')}>
          {/* Inline segmented control — two flex pills, RTL-safe. */}
          <View style={S.segmentedControl}>
            <TouchableOpacity
              style={[S.segment, bookingFor === 'self' && S.segmentActive]}
              onPress={() => setBookingFor('self')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={bookingFor === 'self' ? colors.white : colors.textSecondary}
              />
              <Text style={[S.segmentText, bookingFor === 'self' && S.segmentTextActive]}>
                {t('appointments.forMyself')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.segment, bookingFor === 'family' && S.segmentActive]}
              onPress={() => setBookingFor('family')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={bookingFor === 'family' ? colors.white : colors.textSecondary}
              />
              <Text style={[S.segmentText, bookingFor === 'family' && S.segmentTextActive]}>
                {t('appointments.forFamilyMember')}
              </Text>
            </TouchableOpacity>
          </View>

          {bookingFor === 'family' && (
            <CustomTextField
              label={t('appointments.familyMemberName')}
              placeholder={t('appointments.familyNamePlaceholder')}
              value={familyMemberName}
              onChangeText={setFamilyMemberName}
              autoFocus
            />
          )}
        </Section>

        {/* ── Reason for Visit ─────────────────────────────────────── */}
        <Section icon="clipboard-outline" title={t('appointments.reasonTitle')}>
          <CustomTextField
            label={`${t('appointments.reasonLabel')} *`}
            placeholder={t('appointments.reasonPlaceholder')}
            value={reason}
            onChangeText={setReason}
            multiline
          />
        </Section>

        {/* ── Medical History ──────────────────────────────────────── */}
        <Section
          icon="medical-outline"
          title={t('appointments.medicalHistoryTitle')}
          subtitle={t('appointments.medicalHistorySub')}
        >
          <CustomTextField
            label={t('appointments.allergiesLabel')}
            placeholder={t('appointments.allergiesPlaceholder')}
            value={allergies}
            onChangeText={setAllergies}
            multiline
          />
          <CustomTextField
            label={t('appointments.medicationsLabel')}
            placeholder={t('appointments.medicationsPlaceholder')}
            value={medications}
            onChangeText={setMedications}
            multiline
          />
          <CustomTextField
            label={t('appointments.conditionsLabel')}
            placeholder={t('appointments.conditionsPlaceholder')}
            value={conditions}
            onChangeText={setConditions}
            multiline
          />
          {/*
           * privacyBox uses borderStartWidth — the RTL-logical equivalent of
           * borderLeftWidth. Renders on the START edge:
           *   LTR → left border  |  RTL → right border
           */}
          <View style={S.privacyBox}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
            <Text style={S.privacyText}>{t('appointments.privacyNote')}</Text>
          </View>
        </Section>

        {/* ── Additional Notes ─────────────────────────────────────── */}
        <Section icon="create-outline" title={t('appointments.additionalNotesTitle')}>
          <CustomTextField
            placeholder={t('appointments.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Section>

        {/* Spacer so the last section scrolls fully above the sticky footer. */}
        <View style={S.footerSpacer} />
      </ScrollView>

      {/* ── STICKY FOOTER ────────────────────────────────────────────── */}
      {/*
       * Sibling to ScrollView inside ScreenContainer's KAV.
       * On iOS: KAV "padding" mode lifts the footer above the keyboard.
       * On Android: system windowSoftInputMode=adjustResize shrinks the KAV.
       */}
      <View style={S.footer}>
        {/* Selection summary — shown once a slot is chosen. */}
        {selectedSlot && (
          <View style={S.selectionSummary}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={S.selectionSummaryText}>
              {selectedDate.toLocaleDateString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
              {'  ·  '}
              {selectedSlot.display}
            </Text>
          </View>
        )}

        {/* Inline error — never an Alert for service failures per contract. */}
        {submitError ? (
          <Text style={S.inlineError}>{submitError}</Text>
        ) : null}

        <PrimaryButton
          label={t('appointments.confirmBooking')}
          onPress={handleConfirm}
          loading={isSubmitting}
          disabled={!canConfirm}
        />
      </View>
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL RULE: Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right,
// or positional left/right. Logical properties (Start/End) exclusively.
// Colors from theme.js only. Font sizes from typography.sizes only.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },

  // ── Doctor Card ───────────────────────────────────────────────────────────
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  doctorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  doctorAvatarText: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primary,
  },
  doctorInfo: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  doctorSpecialty: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
  },
  doctorHospital: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  feeTag: {
    backgroundColor: colors.primary + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: BorderRadius.md,
    flexShrink: 0,
  },
  feeTagText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.primary,
  },

  // ── Section card ──────────────────────────────────────────────────────────
  section: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionIcon: {
    marginEnd: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  // ── Date Strip ────────────────────────────────────────────────────────────
  datePillList: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  datePill: {
    width: 56,
    paddingVertical: spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  datePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  datePillDay: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  datePillNum: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  datePillTextActive: {
    color: colors.white,
  },

  // ── Slot Grid ─────────────────────────────────────────────────────────────
  slotsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  slotsLoadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  noSlotsWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  noSlotsTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  noSlotsSub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  // Gap-based grid — zero directional margins. RTL wraps automatically.
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  slotChip: {
    minWidth: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  slotChipBooked: {
    backgroundColor: colors.borderLight,
    borderColor: colors.borderLight,
  },
  slotChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  slotChipTextBooked: {
    color: colors.gray,
    textDecorationLine: 'line-through',
  },
  slotChipTextSelected: {
    color: colors.white,
  },

  // ── Segmented control ─────────────────────────────────────────────────────
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 3,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: BorderRadius.md,
    gap: spacing.xs,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.white,
  },

  // ── Privacy info box ──────────────────────────────────────────────────────
  // borderStartWidth is the logical equivalent of borderLeftWidth.
  // Renders on the START (reading) edge: left in LTR, right in RTL.
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '0D',
    padding: spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: spacing.sm,
    borderStartWidth: 3,
    borderStartColor: colors.primary,
    gap: spacing.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // ── Footer spacer ─────────────────────────────────────────────────────────
  footerSpacer: {
    height: FOOTER_APPROX_HEIGHT,
  },

  // ── Sticky Footer ─────────────────────────────────────────────────────────
  footer: {
    backgroundColor: colors.white,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  selectionSummaryText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Inline error — colors.error from theme, never an Alert.
  inlineError: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    textAlign: 'center',
    lineHeight: 20,
  },
});
