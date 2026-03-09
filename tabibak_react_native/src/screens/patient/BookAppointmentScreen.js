/**
 * BookAppointmentScreen — Phase 2: Patient Core
 *
 * ── Architecture Notes ─────────────────────────────────────────────────────
 *
 * Keyboard Management:
 *   Root: <KeyboardAvoidingView behavior="padding" (iOS) | "height" (Android)>
 *   The KAV is the outermost flex container. When the software keyboard
 *   appears, iOS "padding" mode adds bottom padding equal to keyboard height,
 *   shrinking the visible area and pushing the sticky footer up into view.
 *   Android "height" mode reduces the KAV's total height, achieving the same
 *   result. Both strategies ensure the "Confirm Booking" CTA stays visible
 *   and tappable without the keyboard covering it.
 *
 *   Inner <ScrollView keyboardShouldPersistTaps="handled"> lets taps on
 *   time-slot chips and date pills dismiss the keyboard AND register as taps
 *   in a single gesture — critical for a form with many interactive elements.
 *
 * Slot-Based Scheduling (no native DateTimePicker):
 *   • Dates: A 14-day window is generated with useMemo. Rendered as a
 *     horizontal <FlatList> of two-line pills (weekday abbrev + day number).
 *     Changing the selected date resets the slot selection and re-fetches.
 *   • Time Slots: Fetched from appointmentService.getAvailableTimeSlots()
 *     on each date change. Rendered as a flexWrap flex-row grid of chips.
 *     Available slots are tappable; booked slots are visually struck-through
 *     and disabled. Gap-based spacing — no directional margins in the grid.
 *
 * Family Member Selection:
 *   Implemented as an inline two-option segmented control ("For Myself" /
 *   "For Family Member") using two adjacent TouchableOpacity pills. No Modal
 *   or Picker required — the full family member name input appears beneath
 *   the control when "For Family Member" is active. This avoids the
 *   complexity of a bottom sheet while keeping the UX fully native and RTL-
 *   safe (the control is built from flex-row LogicalView children).
 *
 * State Management:
 *   All booking fields (date, slot, reason, medical history, etc.) are kept
 *   in local component state. Nothing is written to Firestore until the user
 *   presses "Confirm Booking". At that point:
 *     1. Client-side field validation runs first (fast, no network).
 *     2. appointmentService.bookAppointment() is called — it internally
 *        checks clinic closure, duplicate bookings, and slot conflicts before
 *        invoking the Cloud Function. Errors are surfaced as Alert dialogs.
 *     3. On success, navigate to the 'Appointments' tab.
 *
 * RTL Compliance:
 *   ⚠️ This app is in Arabic. Zero marginLeft/Right, paddingLeft/Right,
 *   borderLeftWidth/borderRightWidth, or positional left/right values.
 *   All directional spacing uses logical properties exclusively.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import appointmentService from '../../services/appointmentService';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// Height of sticky footer content — used to compute the scroll spacer.
const FOOTER_CONTENT_HEIGHT = 72;

// Number of days shown in the date picker strip.
const DATE_WINDOW = 14;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate an array of Date objects starting from today for DATE_WINDOW days. */
function generateDateWindow() {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < DATE_WINDOW; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/** Format a Date as 'YYYY-MM-DD' for Firestore / service calls. */
function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (module-scope for stable identity)
// ─────────────────────────────────────────────────────────────────────────────

/** Section wrapper with a title row. */
const Section = React.memo(({ icon, title, subtitle, children }) => (
  <View style={S.section}>
    <View style={S.sectionHeader}>
      {icon && (
        <Ionicons name={icon} size={20} color={Colors.primary} style={S.sectionIcon} />
      )}
      <Text style={S.sectionTitle}>{title}</Text>
    </View>
    {subtitle ? <Text style={S.sectionSubtitle}>{subtitle}</Text> : null}
    {children}
  </View>
));

/** Labelled multiline TextInput. */
const FormField = React.memo(({ label, required, placeholder, value, onChangeText, lines = 3 }) => (
  <View style={S.fieldWrap}>
    <Text style={S.fieldLabel}>
      {label}
      {required && <Text style={S.required}> *</Text>}
    </Text>
    <TextInput
      style={[S.textInput, { minHeight: lines * 24 + 24 }]}
      placeholder={placeholder}
      placeholderTextColor={Colors.gray}
      value={value}
      onChangeText={onChangeText}
      multiline
      numberOfLines={lines}
      textAlignVertical="top"
    />
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function BookAppointmentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();

  // Doctor from params (pre-hydrated from DoctorDetails / PatientHome)
  const { doctor } = route.params ?? {};

  // ── Date strip ───────────────────────────────────────────────────
  // Stable across re-renders — only computed once.
  const dates = useMemo(generateDateWindow, []);
  const [selectedDate, setSelectedDate] = useState(dates[0]);

  // ── Time slots ───────────────────────────────────────────────────
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // ── Booking fields ───────────────────────────────────────────────
  const [bookingFor, setBookingFor] = useState('self'); // 'self' | 'family'
  const [familyMemberName, setFamilyMemberName] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');

  // ── Submission ───────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Load slots on date change ─────────────────────────────────────
  const loadSlots = useCallback(async (date) => {
    if (!doctor?.id) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const result = await appointmentService.getAvailableTimeSlots(doctor.id, date);
      const list = Array.isArray(result) ? result : (result?.slots ?? []);
      setSlots(list);
      // Auto-select the first available slot.
      const first = list.find(s => s.available);
      if (first) setSelectedSlot(first);
    } catch (err) {
      console.error('Error loading time slots:', err);
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [doctor?.id]);

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  // ── Date selection ────────────────────────────────────────────────
  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    // loadSlots fires automatically via useEffect dep on selectedDate
  }, []);

  // ── Slot selection ────────────────────────────────────────────────
  const handleSlotSelect = useCallback((slot) => {
    if (!slot.available) {
      Alert.alert('Slot Unavailable', 'This time slot is already booked. Please choose another.');
      return;
    }
    setSelectedSlot(slot);
  }, []);

  // ── Submission ────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    // Client-side validation (fast, no network)
    if (!selectedSlot) {
      Alert.alert('Time Required', 'Please select an available time slot.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please describe the reason for your visit.');
      return;
    }
    if (bookingFor === 'family' && !familyMemberName.trim()) {
      Alert.alert('Name Required', 'Please enter the family member\'s full name.');
      return;
    }

    setSubmitting(true);

    try {
      const dateStr = toDateStr(selectedDate);
      const patientName = bookingFor === 'self'
        ? (userProfile?.fullName ?? user?.displayName ?? user?.phoneNumber ?? 'Patient')
        : familyMemberName.trim();

      const payload = {
        patientId: user.uid,
        patientName,
        patientPhone: user.phoneNumber ?? '',
        doctorId: doctor.id,
        doctorName: doctor.name,
        appointmentDate: dateStr,
        appointmentTime: selectedSlot.display,
        reason: reason.trim(),
        notes: notes.trim(),
        status: 'pending',
        medicalHistory: {
          allergies: allergies.trim() || 'None',
          currentMedications: currentMedications.trim() || 'None',
          chronicConditions: chronicConditions.trim() || 'None',
        },
        bookingFor,
        ...(bookingFor === 'family' ? { familyMemberName: familyMemberName.trim() } : {}),
      };

      const result = await appointmentService.bookAppointment(payload);

      if (result.success) {
        const dateLabel = selectedDate.toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        });
        Alert.alert(
          'Appointment Submitted ✓',
          `Your appointment with ${doctor.name} on ${dateLabel} at ${selectedSlot.display} has been submitted. You will be notified once the doctor confirms.`,
          [{ text: 'View Appointments', onPress: () => navigation.navigate('Appointments') }],
        );
      } else {
        const isDuplicate =
          result.error?.toLowerCase().includes('already have') ||
          result.error?.toLowerCase().includes('duplicate');

        Alert.alert(
          isDuplicate ? 'Already Booked' : 'Could Not Book',
          result.error ?? 'Something went wrong. Please try again.',
          isDuplicate
            ? [
                { text: 'View My Appointments', onPress: () => navigation.navigate('Appointments') },
                { text: 'OK', style: 'cancel' },
              ]
            : [{ text: 'OK' }],
        );
      }
    } catch (err) {
      console.error('Booking error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedSlot, reason, bookingFor, familyMemberName, selectedDate,
    user, userProfile, doctor, notes, allergies, currentMedications, chronicConditions,
    navigation,
  ]);

  // ── Date pill renderer ────────────────────────────────────────────
  const renderDatePill = useCallback(({ item: date }) => {
    const isSelected = date.toDateString() === selectedDate.toDateString();
    const isToday = date.toDateString() === new Date().toDateString();
    return (
      <TouchableOpacity
        style={[S.datePill, isSelected && S.datePillActive]}
        onPress={() => handleDateSelect(date)}
        activeOpacity={0.75}
      >
        <Text style={[S.datePillDay, isSelected && S.datePillTextActive]}>
          {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
        </Text>
        <Text style={[S.datePillNum, isSelected && S.datePillTextActive]}>
          {date.getDate()}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedDate, handleDateSelect]);

  const datePillKeyExtractor = useCallback((d) => d.toISOString(), []);

  // ── Footer clearance in scroll content ───────────────────────────
  const footerClearance = FOOTER_CONTENT_HEIGHT + Math.max(insets.bottom, Spacing.md);

  // ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={S.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ── SCROLLABLE CONTENT ─────────────────────────────────── */}
      <ScrollView
        style={S.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={S.scrollContent}
      >
        {/* ── Doctor Summary Card ───────────────────────────────── */}
        <View style={S.doctorCard}>
          <View style={S.doctorAvatar}>
            <Text style={S.doctorAvatarText}>
              {(doctor?.name ?? 'D').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <View style={S.doctorInfo}>
            <Text style={S.doctorName}>{doctor?.name ?? 'Doctor'}</Text>
            <Text style={S.doctorSpecialty}>{doctor?.specialty ?? 'General Practice'}</Text>
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

        {/* ── Date Selection ────────────────────────────────────── */}
        <Section icon="calendar-outline" title="Select Date">
          <FlatList
            horizontal
            data={dates}
            keyExtractor={datePillKeyExtractor}
            renderItem={renderDatePill}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.datePillList}
          />
        </Section>

        {/* ── Time Slots ────────────────────────────────────────── */}
        <Section icon="time-outline" title="Select Time">
          {slotsLoading ? (
            <View style={S.slotsLoadingWrap}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={S.slotsLoadingText}>Loading available slots…</Text>
            </View>
          ) : slots.length === 0 ? (
            <View style={S.noSlotsWrap}>
              <Ionicons name="calendar-outline" size={48} color={Colors.border} />
              <Text style={S.noSlotsTitle}>No slots available</Text>
              <Text style={S.noSlotsSub}>This date is closed or fully booked. Try another day.</Text>
            </View>
          ) : (
            <View style={S.slotsGrid}>
              {slots.map((slot, i) => {
                const isSelected = selectedSlot?.display === slot.display;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      S.slotChip,
                      !slot.available && S.slotChipBooked,
                      isSelected && S.slotChipSelected,
                    ]}
                    onPress={() => handleSlotSelect(slot)}
                    disabled={!slot.available}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        S.slotChipText,
                        !slot.available && S.slotChipTextBooked,
                        isSelected && S.slotChipTextSelected,
                      ]}
                    >
                      {slot.display}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Section>

        {/* ── Booking For ───────────────────────────────────────── */}
        <Section icon="people-outline" title="Booking For">
          {/* Inline segmented control — RTL-safe flex-row pills */}
          <View style={S.segmentedControl}>
            <TouchableOpacity
              style={[S.segment, bookingFor === 'self' && S.segmentActive]}
              onPress={() => setBookingFor('self')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={bookingFor === 'self' ? Colors.white : Colors.textSecondary}
              />
              <Text style={[S.segmentText, bookingFor === 'self' && S.segmentTextActive]}>
                For Myself
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
                color={bookingFor === 'family' ? Colors.white : Colors.textSecondary}
              />
              <Text style={[S.segmentText, bookingFor === 'family' && S.segmentTextActive]}>
                Family Member
              </Text>
            </TouchableOpacity>
          </View>

          {/* Family member name input — visible only when 'family' selected */}
          {bookingFor === 'family' && (
            <View style={S.familyInputWrap}>
              <Text style={S.fieldLabel}>
                Family Member's Full Name <Text style={S.required}>*</Text>
              </Text>
              <TextInput
                style={S.textInputSingle}
                placeholder="Enter their full name"
                placeholderTextColor={Colors.gray}
                value={familyMemberName}
                onChangeText={setFamilyMemberName}
                autoFocus
              />
            </View>
          )}
        </Section>

        {/* ── Reason for Visit ──────────────────────────────────── */}
        <Section icon="clipboard-outline" title="Reason for Visit">
          <FormField
            label="Describe your symptoms or concern"
            required
            placeholder="E.g. routine check-up, persistent headache, follow-up on lab results…"
            value={reason}
            onChangeText={setReason}
            lines={3}
          />
        </Section>

        {/* ── Medical History ───────────────────────────────────── */}
        <Section
          icon="medical-outline"
          title="Medical History"
          subtitle="Help the doctor prepare for your visit. All information is confidential."
        >
          <FormField
            label="Allergies"
            placeholder="E.g. Penicillin, peanuts, latex — or 'None'"
            value={allergies}
            onChangeText={setAllergies}
            lines={2}
          />
          <FormField
            label="Current Medications"
            placeholder="List all medications you are taking — or 'None'"
            value={currentMedications}
            onChangeText={setCurrentMedications}
            lines={2}
          />
          <FormField
            label="Chronic Conditions"
            placeholder="E.g. Diabetes, hypertension, asthma — or 'None'"
            value={chronicConditions}
            onChangeText={setChronicConditions}
            lines={2}
          />

          {/* Privacy note */}
          <View style={S.infoBox}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.primary} />
            <Text style={S.infoBoxText}>
              Your medical information is encrypted and will only be visible to your treating doctor.
            </Text>
          </View>
        </Section>

        {/* ── Additional Notes ──────────────────────────────────── */}
        <Section icon="create-outline" title="Additional Notes (Optional)">
          <FormField
            label="Anything else the doctor should know?"
            placeholder="Any further details, preferred language, accessibility needs, etc."
            value={notes}
            onChangeText={setNotes}
            lines={3}
          />
        </Section>

        {/* Footer clearance spacer */}
        <View style={{ height: footerClearance }} />
      </ScrollView>

      {/* ── STICKY FOOTER — sibling to ScrollView inside KAV ──── */}
      {/* KAV "padding"/"height" behaviour pushes this up with the keyboard */}
      <View style={[S.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        {/* Selected slot summary */}
        {selectedSlot && (
          <View style={S.footerSummary}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={S.footerSummaryText}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {'  ·  '}{selectedSlot.display}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[S.confirmBtn, submitting && S.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
              <Text style={S.confirmBtnText}>Confirm Booking</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// RTL RULE: Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth,
// borderRightWidth, or positional left/right. Logical properties only.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Doctor Card ──────────────────────────────────────────────────
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  doctorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  doctorAvatarText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  doctorSpecialty: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    marginBottom: 2,
  },
  doctorHospital: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  feeTag: {
    backgroundColor: Colors.primary + '1A',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    flexShrink: 0,
  },
  feeTagText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Section wrapper ──────────────────────────────────────────────
  section: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionIcon: {
    marginEnd: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },

  // ── Date Pills ───────────────────────────────────────────────────
  datePillList: {
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  datePill: {
    width: 56,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  datePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  datePillDay: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePillNum: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  datePillTextActive: {
    color: Colors.white,
  },

  // ── Time Slots Grid ──────────────────────────────────────────────
  slotsLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  slotsLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  noSlotsWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  noSlotsTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  noSlotsSub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Gap-based grid — no directional margins needed.
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  slotChip: {
    minWidth: 88,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  slotChipBooked: {
    backgroundColor: Colors.borderLight,
    borderColor: Colors.borderLight,
  },
  slotChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotChipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  slotChipTextBooked: {
    color: Colors.gray,
    textDecorationLine: 'line-through',
  },
  slotChipTextSelected: {
    color: Colors.white,
  },

  // ── Segmented Control (Booking For) ──────────────────────────────
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 3,
    marginBottom: Spacing.sm,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.white,
  },
  familyInputWrap: {
    marginTop: Spacing.sm,
  },

  // ── Form Fields ──────────────────────────────────────────────────
  fieldWrap: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  required: {
    color: Colors.error,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.sm,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  textInputSingle: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSizes.sm,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },

  // ── Privacy Info Box ─────────────────────────────────────────────
  // Uses borderStartWidth (logical) — renders on the correct edge in RTL.
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primary + '0D',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    borderStartWidth: 3,
    borderStartColor: Colors.primary,
    gap: Spacing.sm,
  },
  infoBoxText: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Sticky Footer ────────────────────────────────────────────────
  footer: {
    backgroundColor: Colors.white,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  footerSummaryText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
