/**
 * PatientDetailsScreen — Phase 3: Doctor Core (Mobile EMR)
 * Clinical patient profile + encounter management view.
 *
 * ── Architecture Notes ──────────────────────────────────────────────────────
 *
 * DATA HYDRATION
 * ──────────────
 * Two data sources, both accessed via getDocs (one-time — not onSnapshot,
 * because EMR data is read rarely and doesn't need live updates):
 *
 *   SOURCE 1  —  route.params (zero network cost)
 *     `appointment`  : full appointment object passed from DoctorAppointmentsScreen.
 *     `patientId`    : used as the key for all subsequent queries.
 *     The appointment already contains patientName, appointmentDate, reason,
 *     and medicalHistory (allergies / medications / conditions). These hydrate
 *     the Overview tab instantly — no loading spinner for primary data.
 *
 *   SOURCE 2  —  Firestore getDocs (two parallel queries)
 *     a) users/{patientId}          → extended patient profile (DOB, contact).
 *     b) appointments collection    → past encounters ordered by date DESC,
 *          where('patientId', '==', patientId), limit(30).
 *          The current appointment is excluded client-side so History only
 *          shows prior visits. Both queries fire in parallel via Promise.all.
 *
 * SEGMENTED CONTROL — THREE TABS
 * ────────────────────────────────
 * A pill-trough segmented control (same pattern as MyAppointmentsScreen)
 * switches between three distinct content areas:
 *
 *   OVERVIEW  — Static ScrollView. Reads exclusively from appointment params
 *               and profile (already fetched). Zero additional queries.
 *               Sections: Patient Info · Allergies · Current Medications ·
 *               Chronic Conditions · Appointment Details.
 *
 *   HISTORY   — Vertical FlatList of past EncounterCards. Reads from the
 *               `history` state populated by the parallel getDocs query.
 *               Each card shows date, chief complaint, status badge, and
 *               any saved clinical notes (collapsed with "Show more").
 *
 *   CURRENT VISIT — KAV + ScrollView. Form for documenting the encounter:
 *               Chief Complaint (read-only), Clinical Notes (multiline,
 *               Android-fixed), Assessment/Diagnosis, and a dynamic
 *               Prescription list.
 *
 * FORM STATE HOISTING (Critical for Tab Switching)
 * ─────────────────────────────────────────────────
 * All CurrentVisit form state (clinicalNotes, diagnosis, medications) lives
 * in the PatientDetailsScreen parent — NOT inside the CurrentVisitTab
 * component. This means tabs can be fully unmounted/remounted on switch
 * WITHOUT losing the doctor's in-progress encounter notes, because the data
 * is preserved one level up regardless of which tab is rendered.
 *
 * DYNAMIC PRESCRIPTION LIST
 * ─────────────────────────
 * `medications` state is an array of { id, drug, dosage, frequency }.
 * Each row is a MedicationCard with labeled inputs for drug name, dosage,
 * and frequency, plus a ✕ remove button. "Add Medication" appends a new
 * blank row. Updates are field-level via updateMedication(id, field, value)
 * which uses Array.map — O(n) but n is always small (< 20 medications).
 *
 * "Save Encounter" validates clinical notes, then executes a single
 * updateDoc on the appointment document:
 *   status: 'completed', clinicalNotes, diagnosis,
 *   prescriptions: medications.filter(m => m.drug.trim()),
 *   encounterCompletedAt: serverTimestamp()
 *
 * ANDROID CLINICAL NOTES FIX
 * ──────────────────────────
 * Android vertically centres text in multiline TextInputs by default.
 * Without `textAlignVertical="top"` the cursor starts in the middle of a
 * 120dp text box — a well-known Android bug. All multiline inputs in this
 * file explicitly set textAlignVertical="top" + minHeight to prevent this.
 *
 * RTL COMPLIANCE
 * ──────────────
 * ⚠️  This app is in Arabic. Zero marginLeft/Right, paddingLeft/Right,
 * borderLeftWidth/Right, or positional left/right values. All directional
 * spacing uses logical properties exclusively:
 *   marginStart / marginEnd / paddingStart / paddingEnd /
 *   borderStartWidth / borderEndWidth / start / end
 * The segmented control flex-row reverses automatically in Arabic so
 * "Overview" appears on the right, "Current Visit" on the left — the
 * natural RTL reading order.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';
import LabResultModal from '../patient/LabResultModal';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'person-outline'  },
  { key: 'history',  label: 'History',  icon: 'time-outline'    },
  { key: 'visit',    label: 'Visit',    icon: 'create-outline'  },
  { key: 'labs',     label: 'Labs',     icon: 'flask-outline'   },
];

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', bg: '#22C55E', color: '#FFF', icon: 'checkmark-circle' },
  pending:   { label: 'Pending',   bg: '#F59E0B', color: '#FFF', icon: 'time'             },
  cancelled: { label: 'Cancelled', bg: '#EF4444', color: '#FFF', icon: 'close-circle'     },
  completed: { label: 'Completed', bg: '#6B7280', color: '#FFF', icon: 'checkmark-done-circle' },
};

/** Common lab tests offered as quick-select chips. */
const COMMON_LAB_TESTS = [
  'CBC', 'RBS', 'FBS', 'HbA1c', 'LFT', 'KFT', 'Lipid Profile',
  'TSH', 'T3/T4', 'CRP', 'ESR', 'Urine Analysis', 'Urine Culture',
  'Blood Culture', 'ECG', 'Chest X-Ray', 'Abdominal Ultrasound',
  'COVID-19 PCR', 'PT/INR', 'Serum Electrolytes', 'Ferritin',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'Mon, Jan 15, 2026' */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** '14:30' → '2:30 PM' */
function formatTime12(timeStr) {
  if (!timeStr) return '—';
  if (/[AP]M/i.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Returns first two uppercase initials. */
function getInitials(name) {
  return (name ?? '').split(' ').map(w => w[0]).filter(Boolean)
    .join('').toUpperCase().slice(0, 2) || '?';
}

/** Normalises medicalHistory field — handles 'None', empty, or real content. */
function normalise(value) {
  if (!value || value === 'None' || value.trim() === '') return null;
  return value.trim();
}

/** Generates a stable unique id for new medication rows. */
let _medId = 0;
const newMedId = () => ++_medId;

// ─────────────────────────────────────────────────────────────────────────────
// Custom Hook — usePatientData
// ─────────────────────────────────────────────────────────────────────────────

/**
 * usePatientData
 *
 * Fires two parallel getDocs calls on mount:
 *   1. getDoc(users/{patientId})      — extended patient profile
 *   2. getDocs(appointments, …, limit 30) — past encounter history
 *
 * The current appointment is filtered out client-side from history results.
 * Gracefully degrades if the users document doesn't exist (falls back to
 * appointment params data throughout the UI).
 */
function usePatientData(patientId, currentAppointmentId) {
  const [profile,        setProfile]        = useState(null);
  const [history,        setHistory]        = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!patientId) {
      setProfileLoading(false);
      setHistoryLoading(false);
      return;
    }

    let mounted = true;

    // ── Profile fetch ──────────────────────────────────────────────────────
    getDoc(doc(db, 'patients', patientId))
      .then(snap => {
        if (mounted && snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() });
        }
      })
      .catch(err => console.error('[usePatientData] profile:', err))
      .finally(() => { if (mounted) setProfileLoading(false); });

    // ── History fetch ──────────────────────────────────────────────────────
    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', patientId),
      orderBy('appointmentDate', 'desc'),
      limit(30),
    );

    getDocs(q)
      .then(snap => {
        if (!mounted) return;
        const docs = snap.docs
          .filter(d => d.id !== currentAppointmentId) // exclude current visit
          .map(d => ({ id: d.id, ...d.data() }));
        setHistory(docs);
      })
      .catch(err => console.error('[usePatientData] history:', err))
      .finally(() => { if (mounted) setHistoryLoading(false); });

    return () => { mounted = false; };
  }, [patientId, currentAppointmentId]);

  return { profile, history, profileLoading, historyLoading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Primitives  (module-scope for stable identity)
// ─────────────────────────────────────────────────────────────────────────────

/** Pill-shaped status badge. */
const StatusBadge = React.memo(({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <View style={[S.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <Text style={[S.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
});

/** Patient initials circle. */
const Avatar = React.memo(({ name, size = 48 }) => (
  <View style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[S.avatarText, { fontSize: size * 0.35 }]}>{getInitials(name)}</Text>
  </View>
));

/** Section card wrapper with title and coloured start-border accent. */
const SectionCard = React.memo(({ title, icon, accent = Colors.primary, children }) => (
  <View style={[S.sectionCard, { borderStartColor: accent }]}>
    <View style={S.sectionCardHeader}>
      <Ionicons name={icon} size={16} color={accent} />
      <Text style={[S.sectionCardTitle, { color: accent }]}>{title}</Text>
    </View>
    {children}
  </View>
));

/** Labelled data row inside a SectionCard. */
const DataRow = React.memo(({ label, value }) => (
  <View style={S.dataRow}>
    <Text style={S.dataLabel}>{label}</Text>
    <Text style={S.dataValue}>{value || '—'}</Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1 — Overview
// ─────────────────────────────────────────────────────────────────────────────

const OverviewTab = React.memo(({ appointment, profile, insets }) => {
  const med  = appointment?.medicalHistory ?? {};
  const allergies   = normalise(med.allergies);
  const medications = normalise(med.currentMedications);
  const conditions  = normalise(med.chronicConditions);

  return (
    <ScrollView
      style={S.tabScroll}
      contentContainerStyle={[S.tabScrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Patient Info ────────────────────────────────────────── */}
      <SectionCard title="Client Information" icon="person-circle-outline" accent={Colors.primary}>
        <DataRow label="Full Name"   value={appointment?.patientName ?? profile?.fullName} />
        <DataRow label="Phone"       value={appointment?.patientPhone ?? profile?.phoneNumber} />
        {!!profile?.dateOfBirth && (
          <DataRow label="Date of Birth" value={profile.dateOfBirth} />
        )}
        {!!profile?.dateOfBirth && (
          <DataRow label="Date of Birth" value={profile.dateOfBirth} />
        )}
        {appointment?.bookingFor === 'family' && !!appointment?.familyMemberName && (
          <DataRow label="For (Family)" value={appointment.familyMemberName} />
        )}
      </SectionCard>

      {/* ── Allergies ───────────────────────────────────────────── */}
      <SectionCard title="Health Notes" icon="information-circle-outline" accent="#EF4444">
        {allergies ? (
          <Text style={S.medHistoryText}>{allergies}</Text>
        ) : (
          <Text style={S.medHistoryNone}>No health notes provided</Text>
        )}
      </SectionCard>

      {/* ── Current Medications ─────────────────────────────────── */}
      <SectionCard title="Current Treatments" icon="bandage-outline" accent="#8B5CF6">
        {medications ? (
          <Text style={S.medHistoryText}>{medications}</Text>
        ) : (
          <Text style={S.medHistoryNone}>None reported</Text>
        )}
      </SectionCard>

      {/* ── Chronic Conditions ──────────────────────────────────── */}
      <SectionCard title="Health Conditions" icon="clipboard-outline" accent="#F59E0B">
        {conditions ? (
          <Text style={S.medHistoryText}>{conditions}</Text>
        ) : (
          <Text style={S.medHistoryNone}>None reported</Text>
        )}
      </SectionCard>

      {/* ── Current Appointment ─────────────────────────────────── */}
      <SectionCard title="This Appointment" icon="calendar-outline" accent="#22C55E">
        <DataRow label="Date"   value={formatDate(appointment?.appointmentDate)} />
        <DataRow label="Time"   value={formatTime12(appointment?.appointmentTime)} />
        <DataRow label="Reason" value={appointment?.reason} />
        <View style={S.dataRow}>
          <Text style={S.dataLabel}>Status</Text>
          <StatusBadge status={appointment?.status} />
        </View>
      </SectionCard>
    </ScrollView>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2 — History
// ─────────────────────────────────────────────────────────────────────────────

/** Single past-encounter card (expandable clinical notes). */
const EncounterCard = React.memo(({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const hasNotes = !!item.clinicalNotes;

  return (
    <View style={S.encounterCard}>
      {/* Header row */}
      <View style={S.encounterHeader}>
        <View style={S.encounterDateBlock}>
          <Text style={S.encounterDate}>{formatDate(item.appointmentDate)}</Text>
          <Text style={S.encounterTime}>{formatTime12(item.appointmentTime)}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {/* Chief complaint */}
      {!!item.reason && (
        <View style={S.encounterReasonRow}>
          <Ionicons name="clipboard-outline" size={13} color={Colors.textSecondary} />
          <Text style={S.encounterReason} numberOfLines={2}>{item.reason}</Text>
        </View>
      )}

      {/* Diagnosis */}
      {!!item.diagnosis && (
        <View style={S.encounterReasonRow}>
          <Ionicons name="checkmark-circle-outline" size={13} color={Colors.primary} />
          <Text style={S.encounterDiagnosis} numberOfLines={1}>{item.diagnosis}</Text>
        </View>
      )}

      {/* Clinical notes (expandable) */}
      {hasNotes && (
        <>
          <Text
            style={S.encounterNotes}
            numberOfLines={expanded ? undefined : 2}
          >
            {item.clinicalNotes}
          </Text>
          <TouchableOpacity
            onPress={() => setExpanded(e => !e)}
            style={S.expandBtn}
            activeOpacity={0.7}
          >
            <Text style={S.expandBtnText}>
              {expanded ? 'Show less' : 'Show more'}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={Colors.primary}
            />
          </TouchableOpacity>
        </>
      )}

      {/* Prescriptions summary */}
      {Array.isArray(item.prescriptions) && item.prescriptions.length > 0 && (
        <View style={S.rxSummaryWrap}>
          <Ionicons name="receipt-outline" size={13} color={Colors.textSecondary} />
          <Text style={S.rxSummaryText}>
            {item.prescriptions.length} treatment{item.prescriptions.length > 1 ? 's' : ''} recorded
          </Text>
        </View>
      )}
    </View>
  );
});

const HistoryEmpty = React.memo(() => (
  <View style={S.historyEmpty}>
    <Ionicons name="time-outline" size={56} color={Colors.border} />
    <Text style={S.historyEmptyTitle}>No previous visits</Text>
    <Text style={S.historyEmptySub}>
      No prior appointment records found for this client.
    </Text>
  </View>
));

const HistoryTab = React.memo(({ history, historyLoading, insets }) => {
  const historyKeyExtractor = useCallback((item) => item.id, []);
  const renderEncounter     = useCallback(({ item }) => <EncounterCard item={item} />, []);

  if (historyLoading) {
    return (
      <View style={S.centreWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={S.loadingText}>Loading patient history…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={history}
      keyExtractor={historyKeyExtractor}
      renderItem={renderEncounter}
      ListEmptyComponent={HistoryEmpty}
      contentContainerStyle={[
        S.historyContent,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      windowSize={5}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3 — Current Visit (KAV + form)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MedicationCard
 *
 * One row in the dynamic prescription list.
 * Layout:
 *   Header: "Medication N"  [✕ remove]
 *   Row 1:  Drug Name (full width)
 *   Row 2:  [Dosage (flex:1)]  [Frequency (flex:1)]
 *
 * All inputs: textAlignVertical="top" on Android (multiline safety).
 * marginStart / gap for RTL compliance.
 */
const MedicationCard = React.memo(({ item, index, onRemove, onUpdate }) => (
  <View style={S.medCard}>
    <View style={S.medCardHeader}>
      <Text style={S.medCardTitle}>Medication {index + 1}</Text>
      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        hitSlop={10}
        activeOpacity={0.7}
      >
        <Ionicons name="close-circle" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>

    <TextInput
      style={S.medInput}
      value={item.drug}
      onChangeText={v => onUpdate(item.id, 'drug', v)}
      placeholder="Drug name  (e.g. Amoxicillin 500mg)"
      placeholderTextColor={Colors.gray}
      returnKeyType="next"
    />

    <View style={S.medRow}>
      <TextInput
        style={[S.medInput, S.medInputHalf]}
        value={item.dosage}
        onChangeText={v => onUpdate(item.id, 'dosage', v)}
        placeholder="Dosage  (e.g. 1 tablet)"
        placeholderTextColor={Colors.gray}
        returnKeyType="next"
      />
      <TextInput
        style={[S.medInput, S.medInputHalf]}
        value={item.frequency}
        onChangeText={v => onUpdate(item.id, 'frequency', v)}
        placeholder="Frequency  (e.g. 3× daily)"
        placeholderTextColor={Colors.gray}
        returnKeyType="done"
      />
    </View>
  </View>
));

/**
 * CurrentVisitTab
 *
 * ⚠️  Android fix applied to ALL multiline TextInputs:
 *   textAlignVertical="top"  +  minHeight  (prevents vertical centring bug).
 *
 * KAV + ScrollView pattern:
 *   KAV (behavior="padding" iOS / "height" Android) is the root.
 *   ScrollView with keyboardShouldPersistTaps="handled" allows tapping
 *   medication inputs while another input has keyboard focus.
 *   A bottom spacer ensures the Save button is always reachable above
 *   the keyboard.
 */
const CurrentVisitTab = React.memo(({
  appointment,
  clinicalNotes,
  onClinicalNotesChange,
  diagnosis,
  onDiagnosisChange,
  medications,
  onAddMedication,
  onRemoveMedication,
  onUpdateMedication,
  labTests,
  customLabTest,
  onCustomLabTestChange,
  onToggleLabTest,
  onAddCustomLabTest,
  onRemoveLabTest,
  onSave,
  saving,
  insets,
}) => (
  <KeyboardAvoidingView
    style={S.kavRoot}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
  >
    <ScrollView
      style={S.tabScroll}
      contentContainerStyle={[
        S.tabScrollContent,
        { paddingBottom: insets.bottom + 120 }, // extra space above keyboard
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Chief Complaint (read-only) ─────────────────────────── */}
      <SectionCard title="Chief Complaint" icon="clipboard-outline" accent="#8B5CF6">
        <Text style={S.chiefComplaint}>{appointment?.reason || 'Not specified'}</Text>
      </SectionCard>

      {/* ── Visit Notes ──────────────────────────────────────────── */}
      {/* ⚠️  Android Fix: textAlignVertical="top" + minHeight      */}
      <View style={S.formSection}>
        <Text style={S.formLabel}>
          Visit Notes <Text style={S.required}>*</Text>
        </Text>
        <Text style={S.formHint}>
          Observations and notes from this appointment.
        </Text>
        <TextInput
          style={S.clinicalNotesInput}
          value={clinicalNotes}
          onChangeText={onClinicalNotesChange}
          multiline
          textAlignVertical="top"        // Android: prevents vertical centring
          placeholder="Enter clinical observations and examination findings…"
          placeholderTextColor={Colors.gray}
        />
      </View>

      {/* ── Assessment / Diagnosis ──────────────────────────────── */}
      <View style={S.formSection}>
        <Text style={S.formLabel}>Assessment / Diagnosis</Text>
        <TextInput
          style={S.singleLineInput}
          value={diagnosis}
          onChangeText={onDiagnosisChange}
          placeholder="Primary diagnosis or assessment (e.g. Upper respiratory infection)"
          placeholderTextColor={Colors.gray}
          returnKeyType="done"
        />
      </View>

      {/* ── Treatment Plan ──────────────────────────────────────── */}
      <View style={S.formSection}>
        <View style={S.prescriptionHeader}>
          <Text style={S.formLabel}>Treatment Plan</Text>
          {medications.length > 0 && (
            <Text style={S.medCountBadge}>{medications.length} medication{medications.length > 1 ? 's' : ''}</Text>
          )}
        </View>

        {/* Dynamic medication list */}
        {medications.map((med, index) => (
          <MedicationCard
            key={med.id}
            item={med}
            index={index}
            onRemove={onRemoveMedication}
            onUpdate={onUpdateMedication}
          />
        ))}

        {/* Add Medication button */}
        <TouchableOpacity
          style={S.addMedBtn}
          onPress={onAddMedication}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={S.addMedBtnText}>Add Medication</Text>
        </TouchableOpacity>
      </View>

      {/* ── Lab Tests ──────────────────────────────────────────── */}
      <View style={S.formSection}>
        <View style={S.prescriptionHeader}>
          <Text style={S.formLabel}>Lab Tests</Text>
          {labTests.length > 0 && (
            <Text style={S.medCountBadge}>{labTests.length} test{labTests.length > 1 ? 's' : ''}</Text>
          )}
        </View>
        <Text style={S.formHint}>Tap to request. Custom tests can be added manually.</Text>

        {/* Quick-select chips */}
        <View style={S.labChipsWrap}>
          {COMMON_LAB_TESTS.map(test => {
            const selected = labTests.includes(test);
            return (
              <TouchableOpacity
                key={test}
                style={[S.labChip, selected && S.labChipSelected]}
                onPress={() => onToggleLabTest(test)}
                activeOpacity={0.75}
              >
                {selected && <Ionicons name="checkmark" size={11} color={Colors.white} style={{ marginEnd: 3 }} />}
                <Text style={[S.labChipText, selected && S.labChipTextSelected]}>{test}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom test input */}
        <View style={S.customLabRow}>
          <TextInput
            style={S.customLabInput}
            value={customLabTest}
            onChangeText={onCustomLabTestChange}
            placeholder="Add custom test…"
            placeholderTextColor={Colors.gray}
            returnKeyType="done"
            onSubmitEditing={onAddCustomLabTest}
          />
          <TouchableOpacity style={S.customLabAddBtn} onPress={onAddCustomLabTest} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Selected tests (including custom) */}
        {labTests.length > 0 && (
          <View style={S.selectedLabsWrap}>
            {labTests.map(test => (
              <View key={test} style={S.selectedLabTag}>
                <Ionicons name="flask-outline" size={12} color={Colors.primary} />
                <Text style={S.selectedLabTagText}>{test}</Text>
                <TouchableOpacity onPress={() => onRemoveLabTest(test)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close-circle" size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Save Encounter ──────────────────────────────────────── */}
      <TouchableOpacity
        style={[S.saveBtn, saving && S.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
            <Text style={S.saveBtnText}>Save Encounter</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView>
));

// ─────────────────────────────────────────────────────────────────────────────
// Tab 4 — Lab Results (doctor read-only view)
// ─────────────────────────────────────────────────────────────────────────────

function formatLabDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const LAB_STATUS_CONFIG = {
  pending:           { label: 'Pending',       bg: '#F59E0B', color: '#FFF' },
  results_submitted: { label: 'Results Sent',  bg: '#3B82F6', color: '#FFF' },
  completed:         { label: 'Completed',     bg: '#22C55E', color: '#FFF' },
  cancelled:         { label: 'Cancelled',     bg: '#EF4444', color: '#FFF' },
};

const LabResultsTab = React.memo(function LabResultsTab({ labOrders, onOpenOrder, insets }) {
  if (labOrders.length === 0) {
    return (
      <View style={S.labEmpty}>
        <Ionicons name="flask-outline" size={48} color={Colors.border} />
        <Text style={S.labEmptyTitle}>No Lab Orders</Text>
        <Text style={S.labEmptySub}>Lab tests ordered from Current Visit will appear here.</Text>
      </View>
    );
  }
  return (
    <ScrollView
      style={S.tabScroll}
      contentContainerStyle={[S.tabScrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      {labOrders.map((order) => {
        const cfg = LAB_STATUS_CONFIG[order.status] ?? LAB_STATUS_CONFIG.pending;
        const hasResults = !!order.patientNote || !!order.resultImageURL;
        return (
          <TouchableOpacity
            key={order.id}
            style={S.labCard}
            onPress={() => onOpenOrder(order)}
            activeOpacity={0.75}
          >
            <View style={S.labCardHeader}>
              <View style={S.labIconWrap}>
                <Ionicons name="flask-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={S.labCardDate}>{formatLabDate(order.createdAt)}</Text>
                {order.diagnosis ? (
                  <Text style={S.labCardDiag} numberOfLines={1}>{order.diagnosis}</Text>
                ) : null}
              </View>
              <View style={[S.labStatusBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[S.labStatusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>

            <View style={S.labChipsRow}>
              {(order.tests ?? []).map((t, i) => (
                <View key={i} style={S.labChip}>
                  <Text style={S.labChipText}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={S.labCardFooter}>
              {hasResults ? (
                <>
                  <Ionicons name="checkmark-done" size={14} color="#3B82F6" />
                  <Text style={[S.labCardFooterText, { color: '#3B82F6' }]}>
                    Results received — tap to view
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={S.labCardFooterText}>Awaiting patient results</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PatientDetailsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { appointment, patientId } = route.params ?? {};

  // Set nav header title to patient name once params are available
  useEffect(() => {
    if (appointment?.patientName) {
      navigation.setOptions({ title: appointment.patientName });
    }
  }, [appointment, navigation]);

  // ── Remote data ──────────────────────────────────────────────────────────
  const { profile, history, profileLoading, historyLoading } =
    usePatientData(patientId, appointment?.id);

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview');

  // ── Lab orders (real-time) ────────────────────────────────────────────────
  const [labOrders,       setLabOrders]       = useState([]);
  const [selectedLabOrder, setSelectedLabOrder] = useState(null);
  const [labModalVisible,  setLabModalVisible]  = useState(false);

  useEffect(() => {
    if (!patientId) return;
    const q = query(
      collection(db, 'labOrders'),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLabOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('[PatientDetails] labOrders:', err));
    return unsub;
  }, [patientId]);

  // ── CurrentVisit form state (lifted to parent — survives tab switches) ───
  const [clinicalNotes,  setClinicalNotes]  = useState('');
  const [diagnosis,      setDiagnosis]      = useState('');
  const [medications,    setMedications]    = useState([]);
  const [labTests,       setLabTests]       = useState([]); // array of strings
  const [customLabTest,  setCustomLabTest]  = useState('');
  const [saving,         setSaving]         = useState(false);

  // Seed clinical notes from existing appointment data (if re-entering)
  useEffect(() => {
    if (appointment?.clinicalNotes && !clinicalNotes) {
      setClinicalNotes(appointment.clinicalNotes);
    }
    if (appointment?.diagnosis && !diagnosis) {
      setDiagnosis(appointment.diagnosis);
    }
    if (Array.isArray(appointment?.prescriptions) && medications.length === 0) {
      setMedications(
        appointment.prescriptions.map(rx => ({ id: newMedId(), ...rx })),
      );
    }
  }, [appointment]); // intentionally only on mount

  // ── Medication handlers ──────────────────────────────────────────────────
  const handleAddMedication = useCallback(() => {
    setMedications(prev => [
      ...prev,
      { id: newMedId(), drug: '', dosage: '', frequency: '' },
    ]);
  }, []);

  const handleRemoveMedication = useCallback((id) => {
    setMedications(prev => prev.filter(m => m.id !== id));
  }, []);

  const handleUpdateMedication = useCallback((id, field, value) => {
    setMedications(prev =>
      prev.map(m => m.id === id ? { ...m, [field]: value } : m),
    );
  }, []);

  // ── Lab test handlers ─────────────────────────────────────────────────────
  const handleToggleLabTest = useCallback((testName) => {
    setLabTests(prev =>
      prev.includes(testName)
        ? prev.filter(t => t !== testName)
        : [...prev, testName],
    );
  }, []);

  const handleAddCustomLabTest = useCallback(() => {
    const name = customLabTest.trim();
    if (!name) return;
    setLabTests(prev => prev.includes(name) ? prev : [...prev, name]);
    setCustomLabTest('');
  }, [customLabTest]);

  const handleRemoveLabTest = useCallback((testName) => {
    setLabTests(prev => prev.filter(t => t !== testName));
  }, []);

  // ── Save encounter ────────────────────────────────────────────────────────
  const handleSaveEncounter = useCallback(async () => {
    if (!clinicalNotes.trim()) {
      Alert.alert(
        'Visit Notes Required',
        'Please enter your visit notes before saving.',
      );
      return;
    }
    if (!appointment?.id) {
      Alert.alert('Error', 'Appointment data is missing. Cannot save encounter.');
      return;
    }

    setSaving(true);
    try {
      // Filter out incomplete medication rows (must have a drug name)
      const validMeds = medications
        .filter(m => m.drug.trim())
        .map(({ id: _id, ...rest }) => rest); // strip local id before Firestore write

      const writes = [
        updateDoc(doc(db, 'appointments', appointment.id), {
          status: 'completed',
          clinicalNotes: clinicalNotes.trim(),
          diagnosis: diagnosis.trim() || null,
          prescriptions: validMeds,
          encounterCompletedAt: serverTimestamp(),
        }),
      ];

      // Write lab orders if any were requested
      if (labTests.length > 0) {
        writes.push(
          addDoc(collection(db, 'labOrders'), {
            patientId:     appointment.patientId,
            doctorId:      appointment.doctorId,
            appointmentId: appointment.id,
            tests:         labTests,
            diagnosis:     diagnosis.trim() || null,
            status:        'pending',
            createdAt:     serverTimestamp(),
          }),
        );
      }

      // Write prescription to patient inbox if medications exist
      if (validMeds.length > 0) {
        writes.push(
          addDoc(collection(db, 'prescriptions'), {
            patientId:     appointment.patientId,
            doctorId:      appointment.doctorId,
            doctorName:    appointment.doctorName ?? null,
            appointmentId: appointment.id,
            medications:   validMeds,
            diagnosis:     diagnosis.trim() || null,
            status:        'unread',
            createdAt:     serverTimestamp(),
          }),
        );
      }

      await Promise.all(writes);

      Alert.alert(
        'Visit Saved ✓',
        `Notes${labTests.length > 0 ? ', tests,' : ''} and treatment plan for ${appointment.patientName ?? 'the patient'} have been saved.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      console.error('[PatientDetails] save encounter:', err);
      Alert.alert('Error', 'Could not save the encounter. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [clinicalNotes, diagnosis, medications, labTests, appointment, navigation]);

  // ── Quick info bar data ───────────────────────────────────────────────────
  const patientName = appointment?.patientName ?? profile?.fullName ?? 'Patient';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── PATIENT QUICK INFO BAR ───────────────────────────────────────
          Compact banner below the native navigation header. Shows avatar,
          appointment context, and status badge at a glance.
      ─────────────────────────────────────────────────────────────────── */}
      <View style={S.quickInfoBar}>
        <Avatar name={patientName} size={44} />
        <View style={S.quickInfoText}>
          <Text style={S.quickInfoName}>{patientName}</Text>
          <Text style={S.quickInfoSub}>
            {formatDate(appointment?.appointmentDate)}
            {'  ·  '}
            {formatTime12(appointment?.appointmentTime)}
          </Text>
        </View>
        {profileLoading
          ? <ActivityIndicator size="small" color={Colors.primary} />
          : <StatusBadge status={appointment?.status} />
        }
      </View>

      {/* ── LAB RESULT MODAL (doctor read-only) ─────────────────────────── */}
      <LabResultModal
        visible={labModalVisible}
        order={selectedLabOrder}
        onClose={() => { setLabModalVisible(false); setSelectedLabOrder(null); }}
        doctorView
      />

      {/* ── SEGMENTED CONTROL ────────────────────────────────────────────
          Pill-trough pattern. In RTL, flex-row reversal puts "Overview"
          on the right and "Current Visit" on the left — correct Arabic order.
      ─────────────────────────────────────────────────────────────────── */}
      <View style={S.tabBar}>
        <View style={S.tabs}>
          {TABS.map(({ key, label, icon }) => {
            const active = key === activeTab;
            return (
              <TouchableOpacity
                key={key}
                style={[S.tab, active && S.tabActive]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={icon}
                  size={14}
                  color={active ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[S.tabLabel, active && S.tabLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── CONTENT AREA (flex:1) ─────────────────────────────────────────
          Conditional rendering — form state lives in parent so switching
          from "Current Visit" → "History" → "Current Visit" preserves
          all typed content without needing display:'none' tricks.
      ─────────────────────────────────────────────────────────────────── */}
      <View style={S.contentArea}>

        {activeTab === 'overview' && (
          <OverviewTab
            appointment={appointment}
            profile={profile}
            insets={insets}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            history={history}
            historyLoading={historyLoading}
            insets={insets}
          />
        )}

        {activeTab === 'labs' && (
          <LabResultsTab
            labOrders={labOrders}
            onOpenOrder={(order) => { setSelectedLabOrder(order); setLabModalVisible(true); }}
            insets={insets}
          />
        )}

        {activeTab === 'visit' && (
          <CurrentVisitTab
            appointment={appointment}
            clinicalNotes={clinicalNotes}
            onClinicalNotesChange={setClinicalNotes}
            diagnosis={diagnosis}
            onDiagnosisChange={setDiagnosis}
            medications={medications}
            onAddMedication={handleAddMedication}
            onRemoveMedication={handleRemoveMedication}
            onUpdateMedication={handleUpdateMedication}
            labTests={labTests}
            customLabTest={customLabTest}
            onCustomLabTestChange={setCustomLabTest}
            onToggleLabTest={handleToggleLabTest}
            onAddCustomLabTest={handleAddCustomLabTest}
            onRemoveLabTest={handleRemoveLabTest}
            onSave={handleSaveEncounter}
            saving={saving}
            insets={insets}
          />
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// RTL RULE: Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right,
// or positional left/right. Logical properties exclusively.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root ──────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentArea: {
    flex: 1,
  },

  // ── Patient Quick Info Bar ────────────────────────────────────────────────
  quickInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  quickInfoText: {
    flex: 1,
    gap: 2,
  },
  quickInfoName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  quickInfoSub: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },

  // ── Status Badge ──────────────────────────────────────────────────────────
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 100,
    gap: 3,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Patient Avatar ─────────────────────────────────────────────────────────
  avatar: {
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Segmented Tabs ────────────────────────────────────────────────────────
  tabBar: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm - 2,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  tabActive: {
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.primary,
  },

  // ── Shared Tab Layout ─────────────────────────────────────────────────────
  tabScroll: {
    flex: 1,
  },
  tabScrollContent: {
    flexGrow: 1,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  kavRoot: {
    flex: 1,
  },

  // ── Section Card ──────────────────────────────────────────────────────────
  // borderStartWidth + borderStartColor = logical equivalent of left-border accent
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderStartWidth: 4,
    borderStartColor: Colors.primary,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionCardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Data Row (label + value) ───────────────────────────────────────────────
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  dataLabel: {
    width: 110,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    flexShrink: 0,
  },
  dataValue: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '600',
  },

  // ── Medical History text ───────────────────────────────────────────────────
  medHistoryText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 22,
  },
  medHistoryNone: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // ── Chief complaint (read-only) ───────────────────────────────────────────
  chiefComplaint: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 24,
  },

  // ── History Tab ───────────────────────────────────────────────────────────
  historyContent: {
    flexGrow: 1,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  encounterCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  encounterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  encounterDateBlock: {
    flex: 1,
  },
  encounterDate: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  encounterTime: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  encounterReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  encounterReason: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  encounterDiagnosis: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  encounterNotes: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
    marginTop: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  expandBtnText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  rxSummaryWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  rxSummaryText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  historyEmpty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  historyEmptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  historyEmptySub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Loading / centre wrap ─────────────────────────────────────────────────
  centreWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // ── Current Visit — Form sections ─────────────────────────────────────────
  formSection: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  formLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  formHint: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  required: {
    color: Colors.error,
  },

  // ── Clinical notes input ──────────────────────────────────────────────────
  // textAlignVertical="top" is set on the component, not here, to be explicit.
  // minHeight ensures a usable tap target even when empty.
  clinicalNotesInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSizes.sm,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 140, // ← Android fix: prevents 0-height collapsed empty state
    // textAlignVertical="top" set on the JSX component (not in StyleSheet)
  },

  // ── Single-line input ─────────────────────────────────────────────────────
  singleLineInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSizes.sm,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },

  // ── Prescription section ──────────────────────────────────────────────────
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  medCountBadge: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 100,
  },

  // ── Medication Card ───────────────────────────────────────────────────────
  medCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  medCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  medCardTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  medInput: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    fontSize: FontSizes.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Dosage + Frequency side-by-side row
  medRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  medInputHalf: {
    flex: 1,
  },

  // ── Add Medication button ─────────────────────────────────────────────────
  addMedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary + '50',
    backgroundColor: Colors.primary + '0A',
    marginTop: Spacing.xs,
  },
  addMedBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Lab tests ─────────────────────────────────────────────────────────────
  labChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  labChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  labChipSelected: {
    backgroundColor: Colors.primary,
  },
  labChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  labChipTextSelected: {
    color: Colors.white,
  },
  customLabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  customLabInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  customLabAddBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedLabsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  selectedLabTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
  },
  selectedLabTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── Save Encounter button ─────────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: FontSizes.md,
    fontWeight: '800',
    color: Colors.white,
  },

  // ── Labs tab ──────────────────────────────────────────────────────────────
  labEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  labEmptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  labEmptySub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  labCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  labCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  labIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labCardDate: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  labCardDiag: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  labStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 20,
  },
  labStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  labChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: Spacing.sm,
  },
  labChip: {
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  labChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  labCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  labCardFooterText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
