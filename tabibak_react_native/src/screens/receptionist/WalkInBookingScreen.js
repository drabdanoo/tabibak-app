/**
 * WalkInBookingScreen.js — Receptionist Fast-Path Walk-In Booking (Phase 4)
 *
 * ╔══ ARCHITECTURE NOTES ═══════════════════════════════════════════════════════╗
 *
 * 1. PATIENT SEARCH / CREATE — two-path patient acquisition
 * ──────────────────────────────────────────────────────────
 *   The receptionist types a phone number or name into a debounced (300 ms)
 *   search field. After the idle window expires, one Firestore getDocs query
 *   fires against the PATIENTS collection:
 *
 *   Phone path  (input ≥ 6 digits, optional +/spaces/dashes):
 *     where('phoneNumber', '==', normalised_query)
 *     Exact index hit — O(1). Returns at most 1 document.
 *     Pre-normalisation strips spaces, dashes, and parentheses.
 *
 *   Name path (non-phone input, ≥ 2 chars):
 *     where('name', '>=', query) + where('name', '<=', query + '\uf8ff')
 *     Firestore prefix-range trick — matches names that START with the query.
 *     Case-sensitive on Arabic. A production improvement: store nameLower and
 *     query that instead. Limit(10) caps network cost.
 *
 *   RESULT PATHS:
 *   ┌── Results found → list them below the search box as tappable rows.
 *   │   Tapping a row locks the patient (shows PatientSelectedCard with ✕).
 *   └── No results → showCreateForm = true. An inline "New Patient" form
 *       (Name / Phone / Gender) slides in beneath the search box.
 *       • If the search query was a phone number, that string pre-fills the
 *         phone field — one less tap for the receptionist.
 *       • No modal, no navigation — the receptionist stays on screen to keep
 *         the booking flow in one place.
 *
 *   NEW PATIENT WRITE (at submit time, not at form-fill time):
 *   addDoc(PATIENTS, { name, phoneNumber, gender, createdByRole:'receptionist' })
 *   The returned doc ID becomes patientId in the appointment document.
 *   This gives the patient a real profile — if they later create a portal
 *   account with the same phone, their history is already populated.
 *   (A production hardening: wrap both writes in a Firestore batch so the
 *    orphaned patient doc cannot exist without its appointment.)
 *
 * 2. DOCTOR SELECTION — horizontal card rail (FlatList)
 * ───────────────────────────────────────────────────────
 *   getDocs(DOCTORS) fires once on mount. No onSnapshot — the roster doesn't
 *   change during a single booking session. Each doctor is rendered as a
 *   tappable card (~110 px wide) showing: avatar initials, name, specialty,
 *   and an availability dot. The selected card highlights in the primary colour.
 *   Selecting a doctor immediately triggers the slot computation (§4).
 *
 * 3. FORCE-FIT WALK-IN TOGGLE — bypasses time-slot picker
 * ─────────────────────────────────────────────────────────
 *   The React Native <Switch> encodes the core receptionist authority:
 *   physical presence overrides scheduling mechanics.
 *
 *   Toggle ON  (isWalkIn = true) ← default when launched from FAB:
 *     • status = 'waiting'  — patient joins the live doctor queue immediately.
 *     • appointmentTime = current wall-clock time  (no slot selection needed).
 *     • Audit: confirmedAt + waitingAt both set to serverTimestamp().
 *     • Time-slot grid hidden — saves clicks during a busy walk-in rush.
 *
 *   Toggle OFF (isWalkIn = false):
 *     • status = 'pending'  — standard booking; doctor must confirm first.
 *     • Time-slot grid appears below the toggle.
 *     • Slots derived from doctor's workingHours + booked appointments (§4).
 *
 *   Default: true when launched via navigation.navigate('WalkInBooking',
 *   { walkIn: true }) from the Dashboard FAB; false otherwise (e.g., manual
 *   booking button on the Appointments screen).
 *
 * 4. AVAILABLE SLOT COMPUTATION — zero-cost re-trigger on doctor/toggle change
 * ──────────────────────────────────────────────────────────────────────────────
 *   useEffect([selectedDoctor, isWalkIn]):
 *     a) isWalkIn = true  → bail out early; no slot query needed.
 *     b) No doctor selected → bail; show "select a doctor first" hint.
 *     c) getDocs: ALL of today's appointments for selectedDoctor.id
 *        (date range query, no status filter to avoid composite-index cost).
 *        Cancelled appointments are filtered client-side.
 *        Build a Set<appointmentTime> of booked time strings.
 *     d) Parse selectedDoctor.workingHours[todayDayName]:
 *        Supports "HH:MM - HH:MM", "H:MM AM - H:MM PM", { start, end },
 *        and Array<string> (first element used). Falls back to 08:00–20:00.
 *     e) Generate SLOT_INTERVAL (30-min) slots in that range. Skip past times
 *        (slot.date <= now). Mark slot.booked = true if in the booked Set.
 *   Network cost: one getDocs per (doctor, isWalkIn=false) combination.
 *   Re-triggered automatically on doctor change or toggle flip.
 *
 * 5. SUBMIT — two-step write when creating a new patient
 * ────────────────────────────────────────────────────────
 *   Existing patient → patientId from selectedPatient.id.
 *   New patient      → addDoc(PATIENTS) first, then addDoc(APPOINTMENTS).
 *   Both writes are sequential (not batched). If the second write fails,
 *   the orphaned PATIENTS doc remains — acceptable for MVP; use a batch in v2.
 *
 * 6. KEYBOARD MANAGEMENT
 * ────────────────────────
 *   KeyboardAvoidingView behavior="padding" on iOS; undefined on Android
 *   (windowSoftInputMode="adjustResize" handles it natively).
 *   ScrollView keyboardShouldPersistTaps="handled": tapping the slot grid or
 *   action buttons does NOT dismiss the keyboard unexpectedly.
 *
 * 7. RTL COMPLIANCE
 * ──────────────────
 *   All directional styles use logical CSS properties:
 *     marginStart / marginEnd          → never marginLeft / marginRight
 *     paddingStart / paddingEnd        → never paddingLeft / paddingRight
 *     borderStartWidth / Color         → never borderLeftWidth / Color
 *     borderTopStartRadius / EndRadius → never borderTopLeftRadius / Right
 *   hitSlop uses symmetric values (no logical alternative in the RN API).
 *
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Switch,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query as fsQuery,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useAuth }     from '../../contexts/AuthContext';
import { COLLECTIONS } from '../../config/firebase';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Module constants
// ─────────────────────────────────────────────────────────────────────────────

const SLOT_INTERVAL_MIN = 30; // slot granularity in minutes
const DEFAULT_START_H   = 8;  // fallback clinic open hour
const DEFAULT_END_H     = 20; // fallback clinic close hour

const DAY_INDEX = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns Firestore Timestamps bracketing today 00:00 – 23:59 */
function getTodayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

/** Format Date → "09:30 AM" (en-US 12-hour) — stored in Firestore */
function formatTime12h(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Format Date → Arabic time label for display in the slot grid */
function formatArabicTime(date) {
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

/** True if the string looks like a phone number (≥6 digits, optional +/spaces/dashes) */
function isPhoneLike(str) {
  return /^\+?[\d\s\-()\u0660-\u0669]{6,}$/.test(str.trim());
}

/** Strip formatting from a phone string to normalise for Firestore lookup */
function normalisePhone(str) {
  return str.replace(/[\s\-()+]/g, '');
}

/**
 * Parse a doctor's working-hours entry for one day into { startMin, endMin }.
 * Returns null if the doctor is off that day.
 *
 * Accepts:
 *   • String:  "09:00 - 17:00"  |  "9:00 AM - 5:00 PM"
 *   • Object:  { start: "09:00", end: "17:00" }
 *   • Array:   ["09:00 - 12:00", "14:00 - 17:00"]  (first range used)
 *   • Falsy:   → null (day off)
 */
function parseDayHours(dayEntry) {
  if (!dayEntry) return null;

  let str;
  if (typeof dayEntry === 'string')       str = dayEntry;
  else if (Array.isArray(dayEntry))       str = dayEntry[0] ?? null;
  else if (typeof dayEntry === 'object')  str = `${dayEntry.start ?? '09:00'} - ${dayEntry.end ?? '17:00'}`;

  if (!str) return { startMin: DEFAULT_START_H * 60, endMin: DEFAULT_END_H * 60 };

  const m = str.match(
    /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i,
  );
  if (!m) return { startMin: DEFAULT_START_H * 60, endMin: DEFAULT_END_H * 60 };

  let sh = +m[1], sm = +(m[2] || 0);
  let eh = +m[4], em = +(m[5] || 0);
  const ap1 = (m[3] || '').toLowerCase();
  const ap2 = (m[6] || '').toLowerCase();
  if (ap1 === 'pm' && sh < 12) sh += 12;
  if (ap1 === 'am' && sh === 12) sh = 0;
  if (ap2 === 'pm' && eh < 12) eh += 12;
  if (ap2 === 'am' && eh === 12) eh = 0;

  return { startMin: sh * 60 + sm, endMin: eh * 60 + em };
}

/**
 * Generate the 30-min time-slot array for a doctor on today.
 * Skips past slots; marks already-booked slots with .booked = true.
 *
 * @param {object}      workingHours  doctor.workingHours
 * @param {string}      dayName       e.g. 'Monday'
 * @param {Set<string>} bookedSet     set of booked appointmentTime strings
 * @returns {Array<{ id, timeStr, arabicLabel, date, booked }>}
 */
function generateSlots(workingHours, dayName, bookedSet) {
  const parsed = parseDayHours(workingHours?.[dayName]);

  // If no workingHours for today, use the full clinic day as fallback
  const startMin = parsed ? parsed.startMin : DEFAULT_START_H * 60;
  const endMin   = parsed ? parsed.endMin   : DEFAULT_END_H   * 60;
  if (parsed === null) return []; // explicit null → doctor is off today

  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slots  = [];

  for (let m = startMin; m < endMin; m += SLOT_INTERVAL_MIN) {
    if (m <= nowMin) continue; // skip past time slots

    const h   = Math.floor(m / 60);
    const min = m % 60;
    const d   = new Date(now);
    d.setHours(h, min, 0, 0);

    const timeStr = formatTime12h(d);
    slots.push({
      id:          timeStr,
      timeStr,
      arabicLabel: formatArabicTime(d),
      date:        d,
      booked:      bookedSet.has(timeStr),
    });
  }
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — all memo'd; defined at module scope for stable identity
// ─────────────────────────────────────────────────────────────────────────────

/** Label + input + inline error wrapper */
const Field = memo(({ label, required, error, children }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.fieldRequired}> *</Text>}
    </Text>
    {children}
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
));

/** Compact locked-patient card (shown after a patient is selected) */
const PatientSelectedCard = memo(({ patient, onDeselect }) => (
  <View style={styles.patientCard}>
    <View style={styles.patientCardAvatar}>
      <Text style={styles.patientCardAvatarText}>
        {(patient.name ?? 'م')[0].toUpperCase()}
      </Text>
    </View>
    <View style={styles.patientCardInfo}>
      <Text style={styles.patientCardName}>{patient.name}</Text>
      {patient.phoneNumber ? (
        <Text style={styles.patientCardPhone}>{patient.phoneNumber}</Text>
      ) : null}
      {patient.gender ? (
        <Text style={styles.patientCardGender}>
          {patient.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}
        </Text>
      ) : null}
    </View>
    <TouchableOpacity
      onPress={onDeselect}
      style={styles.deselectBtn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="إلغاء اختيار المريض"
    >
      <Ionicons name="close-circle" size={22} color={Colors.gray} />
    </TouchableOpacity>
  </View>
));

/** Single row in the patient search result list */
const PatientResultRow = memo(({ patient, onSelect }) => (
  <TouchableOpacity
    style={styles.resultRow}
    onPress={() => onSelect(patient)}
    activeOpacity={0.75}
    accessibilityRole="button"
  >
    <View style={styles.resultAvatar}>
      <Text style={styles.resultAvatarText}>
        {(patient.name ?? 'م')[0].toUpperCase()}
      </Text>
    </View>
    <View style={styles.resultInfo}>
      <Text style={styles.resultName}>{patient.name}</Text>
      {patient.phoneNumber ? (
        <Text style={styles.resultPhone}>{patient.phoneNumber}</Text>
      ) : null}
      {patient.gender ? (
        <Text style={styles.resultGender}>
          {patient.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}
        </Text>
      ) : null}
    </View>
    <View style={styles.resultSelectBtn}>
      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} />
      <Text style={styles.resultSelectText}>اختيار</Text>
    </View>
  </TouchableOpacity>
));

/**
 * Doctor card in the horizontal rail.
 * Width is fixed so 2–3 cards peek on narrow screens (discoverability).
 */
const DoctorCard = memo(({ doctor, selected, onPress }) => {
  const isAvail = doctor.isAvailable !== false;
  return (
    <TouchableOpacity
      style={[styles.doctorCard, selected && styles.doctorCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`الطبيب ${doctor.name}`}
    >
      {/* Avatar */}
      <View style={[styles.docAvatar, selected && styles.docAvatarSelected]}>
        <Text style={[styles.docAvatarText, selected && styles.docAvatarTextSelected]}>
          {(doctor.name ?? 'د')[0].toUpperCase()}
        </Text>
      </View>

      {/* Name */}
      <Text
        style={[styles.docName, selected && styles.docNameSelected]}
        numberOfLines={2}
      >
        {doctor.name}
      </Text>

      {/* Specialty */}
      {doctor.specialty ? (
        <Text style={styles.docSpec} numberOfLines={1}>{doctor.specialty}</Text>
      ) : null}

      {/* Availability dot */}
      <View style={styles.docAvailRow}>
        <View style={[styles.docDot, { backgroundColor: isAvail ? Colors.primary : Colors.gray }]} />
        <Text style={[styles.docAvailText, { color: isAvail ? Colors.primary : Colors.gray }]}>
          {isAvail ? 'متاح' : 'مشغول'}
        </Text>
      </View>

      {/* Selected tick overlay */}
      {selected && (
        <View style={styles.docSelectedTick}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
        </View>
      )}
    </TouchableOpacity>
  );
});

/**
 * Single slot pill in the time-slot grid.
 * Available → primary-outlined, tappable.
 * Selected  → primary-filled.
 * Booked    → grey, disabled.
 */
const SlotPill = memo(({ slot, selected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.slotPill,
      selected   && styles.slotPillSelected,
      slot.booked && styles.slotPillBooked,
    ]}
    onPress={slot.booked ? undefined : onPress}
    disabled={slot.booked}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityState={{ selected, disabled: slot.booked }}
    accessibilityLabel={slot.arabicLabel}
  >
    <Text style={[
      styles.slotPillText,
      selected    && styles.slotPillTextSelected,
      slot.booked && styles.slotPillTextBooked,
    ]}>
      {slot.arabicLabel}
    </Text>
    {slot.booked && (
      <Text style={styles.slotBookedSub}>محجوز</Text>
    )}
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// WalkInBookingScreen — main component
// ─────────────────────────────────────────────────────────────────────────────

const WalkInBookingScreen = ({ route, navigation }) => {
  // Walk-in default: true when launched from FAB, false for manual booking
  const defaultWalkIn = route?.params?.walkIn !== false;

  const { user } = useAuth();
  const db = getFirestore();

  // ── Patient state ──────────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState('');
  // null = not yet searched | [] = searched, no results | [...] = results
  const [searchResults,  setSearchResults]  = useState(null);
  const [isSearching,    setIsSearching]    = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Inline create form (revealed when search returns no results)
  const [showCreateForm,   setShowCreateForm]   = useState(false);
  const [newPatientName,   setNewPatientName]   = useState('');
  const [newPatientPhone,  setNewPatientPhone]  = useState('');
  const [newPatientGender, setNewPatientGender] = useState(''); // '' | 'male' | 'female'

  // ── Doctor state ───────────────────────────────────────────────────────────
  const [doctors,          setDoctors]          = useState([]);
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(true);
  const [selectedDoctor,   setSelectedDoctor]   = useState(null);

  // ── Walk-in toggle & time slots ────────────────────────────────────────────
  const [isWalkIn,       setIsWalkIn]       = useState(defaultWalkIn);
  const [slots,          setSlots]          = useState([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [selectedSlot,   setSelectedSlot]   = useState(null);

  // ── Form fields ────────────────────────────────────────────────────────────
  const [reason,       setReason]       = useState('');
  const [notes,        setNotes]        = useState('');
  const [errors,       setErrors]       = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const isMountedRef   = useRef(true);
  const searchTimerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => () => {
    isMountedRef.current = false;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  // ── Load all doctors on mount ──────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, COLLECTIONS.DOCTORS))
      .then((snap) => {
        if (!isMountedRef.current) return;
        setDoctors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch((err) => console.error('[WalkInBooking] doctors load:', err))
      .finally(() => { if (isMountedRef.current) setIsDoctorsLoading(false); });
  }, [db]);

  // ── Slot computation — triggers when doctor or walk-in toggle changes ──────
  //
  // APPROACH: one getDocs for today's doctor appointments (no composite index).
  // Cancelled appointments are filtered client-side so we don't need a
  // 'not-in' operator (which can't combine with a range query without a
  // composite index in Firestore).
  useEffect(() => {
    if (isWalkIn || !selectedDoctor) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    let cancelled = false;
    setIsSlotsLoading(true);

    const fetchSlots = async () => {
      try {
        const { start, end } = getTodayRange();

        // Fetch ALL of today's appointments for this doctor
        const snap = await getDocs(
          fsQuery(
            collection(db, COLLECTIONS.APPOINTMENTS),
            where('doctorId',        '==', selectedDoctor.id),
            where('appointmentDate', '>=', start),
            where('appointmentDate', '<=', end),
          ),
        );

        if (cancelled) return;

        // Build booked Set — exclude cancelled appointments client-side
        const bookedSet = new Set(
          snap.docs
            .filter((d) => d.data().status !== 'cancelled')
            .map((d)    => d.data().appointmentTime)
            .filter(Boolean),
        );

        const todayName = DAY_INDEX[new Date().getDay()];
        const computed  = generateSlots(selectedDoctor.workingHours, todayName, bookedSet);

        if (!cancelled) {
          setSlots(computed);
          setSelectedSlot(null);
        }
      } catch (err) {
        console.error('[WalkInBooking] slots fetch:', err);
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setIsSlotsLoading(false);
      }
    };

    fetchSlots();
    return () => { cancelled = true; };
  }, [selectedDoctor, isWalkIn, db]);

  // ── Patient search (debounced 300 ms) ─────────────────────────────────────
  const runSearch = useCallback(async (query) => {
    if (!isMountedRef.current) return;
    setIsSearching(true);

    try {
      let docs = [];
      if (isPhoneLike(query)) {
        // ── Phone path: exact match ──
        const snap = await getDocs(
          fsQuery(
            collection(db, COLLECTIONS.PATIENTS),
            where('phoneNumber', '==', normalisePhone(query)),
            limit(5),
          ),
        );
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } else {
        // ── Name path: prefix range match ──
        const snap = await getDocs(
          fsQuery(
            collection(db, COLLECTIONS.PATIENTS),
            where('name', '>=', query),
            where('name', '<=', query + '\uf8ff'),
            limit(10),
          ),
        );
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      if (!isMountedRef.current) return;

      setSearchResults(docs);

      if (docs.length === 0) {
        // No match → reveal the inline create form
        setShowCreateForm(true);
        // Pre-fill phone field if the search query was a phone number
        if (isPhoneLike(query)) {
          setNewPatientPhone(normalisePhone(query));
        }
      }
    } catch (err) {
      console.error('[WalkInBooking] search:', err);
      if (isMountedRef.current) {
        setSearchResults([]);
        setShowCreateForm(true);
      }
    } finally {
      if (isMountedRef.current) setIsSearching(false);
    }
  }, [db]);

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    setSearchResults(null);
    setShowCreateForm(false);
    setNewPatientName('');
    setNewPatientPhone('');
    setNewPatientGender('');

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const trimmed = text.trim();
    if (trimmed.length < 2) return; // require at least 2 chars before querying

    searchTimerRef.current = setTimeout(() => runSearch(trimmed), 300);
  }, [runSearch]);

  const handleSelectPatient = useCallback((patient) => {
    setSelectedPatient(patient);
    setSearchResults(null);
    setShowCreateForm(false);
    setSearchQuery('');
    setErrors((prev) => ({ ...prev, patient: undefined }));
  }, []);

  const handleDeselectPatient = useCallback(() => {
    setSelectedPatient(null);
    setSearchResults(null);
    setShowCreateForm(false);
    setSearchQuery('');
    setNewPatientName('');
    setNewPatientPhone('');
    setNewPatientGender('');
  }, []);

  // ── Walk-in toggle ────────────────────────────────────────────────────────
  const handleToggleWalkIn = useCallback((val) => {
    setIsWalkIn(val);
    setSelectedSlot(null);
    setErrors((prev) => ({ ...prev, slot: undefined }));
  }, []);

  // ── Doctor selection ──────────────────────────────────────────────────────
  const handleSelectDoctor = useCallback((doctor) => {
    setSelectedDoctor(doctor);
    setErrors((prev) => ({ ...prev, doctor: undefined }));
  }, []);

  // ── Clear a single field error helper ────────────────────────────────────
  const clearErr = useCallback((key) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};

    // Patient
    if (!selectedPatient && !showCreateForm) {
      errs.patient = 'ابحث عن المريض أو أنشئ ملفاً جديداً';
    }
    if (showCreateForm && !selectedPatient) {
      if (!newPatientName.trim())
        errs.newPatientName = 'الاسم الكامل مطلوب';
      if (!newPatientPhone.trim())
        errs.newPatientPhone = 'رقم الهاتف مطلوب';
      else if (!/^\d{7,15}$/.test(normalisePhone(newPatientPhone)))
        errs.newPatientPhone = 'رقم هاتف غير صالح';
    }

    // Doctor
    if (!selectedDoctor) errs.doctor = 'يرجى اختيار الطبيب';

    // Slot (only required when NOT walk-in)
    if (!isWalkIn && !selectedSlot) errs.slot = 'يرجى اختيار وقت الموعد';

    // Reason
    if (!reason.trim()) errs.reason = 'سبب الزيارة مطلوب';

    return errs;
  }, [
    selectedPatient, showCreateForm, newPatientName, newPatientPhone,
    selectedDoctor, isWalkIn, selectedSlot, reason,
  ]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      // ── STEP 1: Resolve patient ──────────────────────────────────────────
      let patientId    = selectedPatient?.id ?? null;
      let patientName  = selectedPatient?.name         ?? newPatientName.trim();
      let patientPhone = selectedPatient?.phoneNumber  ?? newPatientPhone.trim();
      let patientGender = selectedPatient?.gender      ?? (newPatientGender || null);

      if (!selectedPatient && showCreateForm) {
        // Create a lightweight patient profile — addDoc auto-generates the ID
        const newDocRef = await addDoc(collection(db, COLLECTIONS.PATIENTS), {
          name:          newPatientName.trim(),
          phoneNumber:   normalisePhone(newPatientPhone),
          gender:        newPatientGender || null,
          createdAt:     serverTimestamp(),
          createdBy:     user?.uid ?? null,
          createdByRole: 'receptionist',
          // Future portal login can link their account to this doc by phone
        });
        patientId    = newDocRef.id;
        patientName  = newPatientName.trim();
        patientPhone = normalisePhone(newPatientPhone);
      }

      // ── STEP 2: Resolve appointment time ─────────────────────────────────
      let apptDate, apptTimeStr;
      if (isWalkIn) {
        // Walk-in: use current wall-clock time
        apptDate    = new Date();
        apptTimeStr = formatTime12h(apptDate);
      } else {
        apptDate    = selectedSlot.date;
        apptTimeStr = selectedSlot.timeStr;
      }

      // ── STEP 3: Write appointment ────────────────────────────────────────
      const status      = isWalkIn ? 'waiting' : 'pending';
      const auditFields = isWalkIn
        ? { confirmedAt: serverTimestamp(), waitingAt: serverTimestamp() }
        : {};

      await addDoc(collection(db, COLLECTIONS.APPOINTMENTS), {
        patientId,
        patientName,
        patientPhone,
        gender:     patientGender,

        doctorId:   selectedDoctor.id,
        doctorName: selectedDoctor.name ?? '—',

        appointmentDate: Timestamp.fromDate(apptDate),
        appointmentTime: apptTimeStr,
        status,
        isWalkIn,
        type:    'walk-in',
        reason:  reason.trim(),
        notes:   notes.trim() || null,

        createdBy:     user?.uid ?? null,
        createdByRole: 'receptionist',
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
        ...auditFields,
      });

      navigation.goBack();
      Alert.alert(
        'تم التسجيل ✓',
        `تمّ ${isWalkIn ? 'إضافة' : 'حجز موعد'} ${patientName} مع ${selectedDoctor.name} بنجاح.`,
      );
    } catch (err) {
      console.error('[WalkInBooking] submit:', err);
      Alert.alert('خطأ', 'تعذّر تسجيل الموعد. تحقق من الاتصال وحاول مجدداً.');
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  }, [
    validate, selectedPatient, showCreateForm, newPatientName, newPatientPhone,
    newPatientGender, isWalkIn, selectedSlot, selectedDoctor,
    reason, notes, user, db, navigation,
  ]);

  // ── Derived values ────────────────────────────────────────────────────────
  const availSlotsCount = useMemo(
    () => slots.filter((s) => !s.booked).length,
    [slots],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ══ Walk-In Banner ══ */}
          {defaultWalkIn && (
            <View style={styles.walkInBanner}>
              <Ionicons name="walk-outline" size={20} color="#92400e" />
              <Text style={styles.walkInBannerText}>
                حضور مباشر — سيُضاف المريض فوراً لقائمة الانتظار
              </Text>
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SECTION 1 — PATIENT
              Search input → results list → create form  |  OR  selected card
              ════════════════════════════════════════════════════════════════ */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>المريض</Text>
            </View>

            {selectedPatient ? (
              /* Locked patient card — tap ✕ to deselect and search again */
              <PatientSelectedCard
                patient={selectedPatient}
                onDeselect={handleDeselectPatient}
              />
            ) : (
              <>
                {/* ── Search Box ── */}
                <View style={[styles.searchBox, errors.patient && styles.searchBoxError]}>
                  <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="ابحث باسم المريض أو رقم هاتفه..."
                    placeholderTextColor={Colors.gray}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    textAlign="right"
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                    accessibilityLabel="بحث عن مريض"
                  />
                  {isSearching ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : searchQuery.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => handleSearchChange('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.gray} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {errors.patient ? (
                  <Text style={styles.fieldError}>{errors.patient}</Text>
                ) : null}

                {/* ── Search Idle Hint ── */}
                {searchResults === null && !showCreateForm && searchQuery.length < 2 && (
                  <View style={styles.searchHint}>
                    <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
                    <Text style={styles.searchHintText}>
                      أدخل حرفين على الأقل للبحث بالاسم، أو ستة أرقام للبحث بالهاتف
                    </Text>
                  </View>
                )}

                {/* ── Search Results List ── */}
                {Array.isArray(searchResults) && searchResults.length > 0 && !showCreateForm && (
                  <View style={styles.resultsList}>
                    {searchResults.map((p) => (
                      <PatientResultRow
                        key={p.id}
                        patient={p}
                        onSelect={handleSelectPatient}
                      />
                    ))}
                  </View>
                )}

                {/* ── Inline New Patient Form ──
                    Revealed only when search returns zero results.
                    Phone field is pre-filled if the search was a phone number.   */}
                {showCreateForm && (
                  <View style={styles.createForm}>
                    {/* Create form header */}
                    <View style={styles.createFormBanner}>
                      <Ionicons name="person-add-outline" size={15} color='#92400e' />
                      <Text style={styles.createFormBannerText}>
                        لا يوجد ملف مطابق — أنشئ ملفاً جديداً
                      </Text>
                    </View>

                    <Field label="الاسم الكامل" required error={errors.newPatientName}>
                      <TextInput
                        style={[styles.input, errors.newPatientName && styles.inputError]}
                        placeholder="أدخل اسم المريض..."
                        placeholderTextColor={Colors.gray}
                        value={newPatientName}
                        onChangeText={(v) => { setNewPatientName(v); clearErr('newPatientName'); }}
                        textAlign="right"
                        returnKeyType="next"
                      />
                    </Field>

                    <Field label="رقم الهاتف" required error={errors.newPatientPhone}>
                      <TextInput
                        style={[styles.input, errors.newPatientPhone && styles.inputError]}
                        placeholder="05xxxxxxxx"
                        placeholderTextColor={Colors.gray}
                        value={newPatientPhone}
                        onChangeText={(v) => { setNewPatientPhone(v); clearErr('newPatientPhone'); }}
                        keyboardType="phone-pad"
                        textAlign="right"
                        returnKeyType="next"
                      />
                    </Field>

                    <Field label="الجنس">
                      <View style={styles.genderRow}>
                        {[
                          { id: 'male',   label: '♂ ذكر'  },
                          { id: 'female', label: '♀ أنثى' },
                        ].map((g) => (
                          <TouchableOpacity
                            key={g.id}
                            style={[
                              styles.genderBtn,
                              newPatientGender === g.id && styles.genderBtnActive,
                            ]}
                            onPress={() => setNewPatientGender((prev) => (prev === g.id ? '' : g.id))}
                            activeOpacity={0.75}
                          >
                            <Text style={[
                              styles.genderBtnText,
                              newPatientGender === g.id && styles.genderBtnTextActive,
                            ]}>
                              {g.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Field>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 2 — DOCTOR SELECTION
              Horizontal card rail — all doctors from getDocs on mount.
              Each card: avatar initials, name, specialty, availability dot.
              Selecting a card immediately triggers the slot computation (§4).
              ════════════════════════════════════════════════════════════════ */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medical-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>الطبيب</Text>
            </View>

            {errors.doctor ? (
              <Text style={styles.fieldError}>{errors.doctor}</Text>
            ) : null}

            {isDoctorsLoading ? (
              <View style={styles.doctorLoadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.doctorLoadingText}>جاري تحميل الأطباء...</Text>
              </View>
            ) : doctors.length === 0 ? (
              <Text style={styles.emptyHint}>لا يوجد أطباء مسجّلون في النظام</Text>
            ) : (
              <FlatList
                data={doctors}
                keyExtractor={(d) => d.id}
                renderItem={({ item }) => (
                  <DoctorCard
                    doctor={item}
                    selected={selectedDoctor?.id === item.id}
                    onPress={() => handleSelectDoctor(item)}
                  />
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.doctorRail}
                keyboardShouldPersistTaps="handled"
                // FlatList performance
                removeClippedSubviews={false}
                initialNumToRender={5}
              />
            )}
          </View>

          {/* ════════════════════════════════════════════════════════════════
              SECTION 3 — BOOKING DETAILS
              Force-Fit Toggle + Slot Grid (conditional) + Reason + Notes
              ════════════════════════════════════════════════════════════════ */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>تفاصيل الموعد</Text>
            </View>

            {/* ── Force-Fit Toggle ── */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextBlock}>
                <Text style={styles.toggleLabel}>إضافة للقائمة مباشرة (حضور مباشر)</Text>
                <Text style={styles.toggleDesc}>
                  {isWalkIn
                    ? 'يُضاف المريض فوراً لقائمة الانتظار — لا وقت محدد'
                    : 'اختر فترة زمنية من الجدول أدناه'}
                </Text>
              </View>
              <Switch
                value={isWalkIn}
                onValueChange={handleToggleWalkIn}
                trackColor={{ false: Colors.border, true: Colors.primary + '55' }}
                thumbColor={isWalkIn ? Colors.primary : Colors.gray}
                ios_backgroundColor={Colors.border}
                accessibilityRole="switch"
                accessibilityLabel="تفعيل الحضور المباشر"
              />
            </View>

            {/* ── Walk-in time note ── */}
            {isWalkIn && (
              <View style={styles.walkInTimeRow}>
                <Ionicons name="time-outline" size={15} color={Colors.primary} />
                <Text style={styles.walkInTimeText}>
                  سيُسجَّل بوقت الحضور الفعلي عند التسجيل
                </Text>
              </View>
            )}

            {/* ── Time Slot Grid ── (shown when walk-in toggle is OFF) */}
            {!isWalkIn && (
              <View style={styles.slotSection}>
                {/* Slot section header */}
                <View style={styles.slotSectionHeader}>
                  <Text style={styles.slotSectionTitle}>الفترات المتاحة اليوم</Text>
                  {!isSlotsLoading && availSlotsCount > 0 && (
                    <View style={styles.slotCountBadge}>
                      <Text style={styles.slotCountText}>{availSlotsCount} متاحة</Text>
                    </View>
                  )}
                </View>

                {errors.slot ? (
                  <Text style={styles.fieldError}>{errors.slot}</Text>
                ) : null}

                {/* Loading slots */}
                {isSlotsLoading ? (
                  <View style={styles.slotLoadingRow}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.slotLoadingText}>جاري تحميل الفترات...</Text>
                  </View>
                ) : !selectedDoctor ? (
                  /* No doctor selected yet */
                  <View style={styles.slotNoDoctorHint}>
                    <Ionicons name="arrow-up-circle-outline" size={18} color={Colors.textSecondary} />
                    <Text style={styles.slotNoDoctorText}>
                      اختر الطبيب أولاً لعرض الأوقات المتاحة
                    </Text>
                  </View>
                ) : slots.length === 0 ? (
                  /* Doctor has no slots today */
                  <View style={styles.slotEmpty}>
                    <Ionicons name="calendar-outline" size={36} color={Colors.border} />
                    <Text style={styles.slotEmptyTitle}>لا توجد فترات متاحة اليوم</Text>
                    <Text style={styles.slotEmptyHint}>
                      فعّل "حضور مباشر" للإضافة بدون وقت محدد
                    </Text>
                  </View>
                ) : (
                  /* Slot grid — flex-wrap so it adapts to any screen width */
                  <View style={styles.slotGrid}>
                    {slots.map((slot) => (
                      <SlotPill
                        key={slot.id}
                        slot={slot}
                        selected={selectedSlot?.id === slot.id}
                        onPress={() => {
                          setSelectedSlot(slot);
                          clearErr('slot');
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── Reason ── */}
            <Field label="سبب الزيارة" required error={errors.reason}>
              <TextInput
                style={[styles.input, styles.inputMulti, errors.reason && styles.inputError]}
                placeholder="صف سبب الزيارة بإيجاز..."
                placeholderTextColor={Colors.gray}
                value={reason}
                onChangeText={(v) => { setReason(v); clearErr('reason'); }}
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
            </Field>

            {/* ── Notes (optional) ── */}
            <Field label="ملاحظات إضافية">
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="أي معلومات إضافية (اختياري)..."
                placeholderTextColor={Colors.gray}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                textAlign="right"
                textAlignVertical="top"
              />
            </Field>
          </View>

          {/* ══ Submit button ══ */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isWalkIn ? 'تسجيل الحضور المباشر' : 'حجز الموعد'}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons
                  name={isWalkIn ? 'log-in-outline' : 'calendar-outline'}
                  size={20}
                  color={Colors.white}
                />
                <Text style={styles.submitBtnText}>
                  {isWalkIn ? 'تسجيل الحضور المباشر' : 'حجز الموعد'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL compliance:
//   ✓ marginStart / marginEnd         → never marginLeft / marginRight
//   ✓ paddingStart / paddingEnd       → never paddingLeft / paddingRight
//   ✓ borderStartWidth/Color          → never borderLeftWidth
//   ✓ borderTopStartRadius / EndRadius → never borderTopLeftRadius/Right
//   ✓ hitSlop uses symmetric values   (no logical alternative in the RN API)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  screen:        { flex: 1, backgroundColor: Colors.background },
  flex:          { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  // ── Walk-in banner ─────────────────────────────────────────────────────────
  walkInBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  '#fef3c7',
    borderRadius:     BorderRadius.lg,
    padding:          Spacing.md,
    gap:              Spacing.sm,
    borderStartWidth: 4,
    borderStartColor: '#f59e0b',
  },
  walkInBannerText: {
    flex:       1,
    color:      '#92400e',
    fontSize:   FontSizes.sm,
    fontWeight: '600',
    textAlign:  'right',
  },

  // ── Section card ───────────────────────────────────────────────────────────
  section: {
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing.md,
    gap:             Spacing.md,
    elevation:       1,
    shadowColor:     Colors.black,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    2,
  },
  sectionHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              Spacing.xs,
    paddingBottom:    Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.text,
  },

  // ── Patient search ─────────────────────────────────────────────────────────
  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    borderWidth:       1,
    borderColor:       Colors.border,
    borderRadius:      BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Platform.OS === 'ios' ? 10 : 6,
    backgroundColor:   Colors.background,
    gap:               Spacing.xs,
  },
  searchBoxError: { borderColor: Colors.error },
  searchInput: {
    flex:     1,
    fontSize: FontSizes.sm,
    color:    Colors.text,
  },
  searchHint: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           6,
    paddingVertical: 4,
  },
  searchHintText: {
    flex:      1,
    fontSize:  FontSizes.xs,
    color:     Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 18,
  },

  // ── Patient search result list ──────────────────────────────────────────────
  resultsList: {
    borderRadius:  BorderRadius.md,
    borderWidth:   1,
    borderColor:   Colors.border,
    overflow:      'hidden',
  },
  resultRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Spacing.sm,
    backgroundColor:  Colors.white,
    gap:              Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultAvatar: {
    width:          40,
    height:         40,
    borderRadius:   BorderRadius.full,
    backgroundColor: Colors.primary + '20',
    alignItems:     'center',
    justifyContent: 'center',
  },
  resultAvatarText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.primary },
  resultInfo:       { flex: 1, gap: 2 },
  resultName:       { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  resultPhone:      { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  resultGender:     { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  resultSelectBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    backgroundColor: Colors.primary + '12',
    borderRadius:  BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  resultSelectText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },

  // ── Selected patient card ──────────────────────────────────────────────────
  patientCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.primary + '0f',
    borderRadius:     BorderRadius.lg,
    padding:          Spacing.sm,
    gap:              Spacing.sm,
    borderWidth:      1,
    borderColor:      Colors.primary + '40',
  },
  patientCardAvatar: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems:     'center',
    justifyContent: 'center',
  },
  patientCardAvatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.white },
  patientCardInfo:       { flex: 1, gap: 2 },
  patientCardName:       { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  patientCardPhone:      { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  patientCardGender:     { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  deselectBtn:           { padding: 4 },

  // ── Inline create form ─────────────────────────────────────────────────────
  createForm: {
    gap:              Spacing.sm,
    borderWidth:      1,
    borderColor:      '#fcd34d',
    borderRadius:     BorderRadius.lg,
    padding:          Spacing.md,
    backgroundColor:  '#fffbeb',
  },
  createFormBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingBottom:    Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  createFormBannerText: {
    flex:       1,
    fontSize:   FontSizes.xs,
    color:      '#92400e',
    fontWeight: '600',
    textAlign:  'right',
  },

  // ── Form field ─────────────────────────────────────────────────────────────
  field:         { gap: 5 },
  fieldLabel:    { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text, textAlign: 'right' },
  fieldRequired: { color: Colors.error },
  fieldError:    { fontSize: FontSizes.xs, color: Colors.error, textAlign: 'right' },

  // ── Inputs ─────────────────────────────────────────────────────────────────
  input: {
    borderWidth:       1,
    borderColor:       Colors.border,
    borderRadius:      BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Platform.OS === 'ios' ? 12 : 8,
    fontSize:          FontSizes.md,
    color:             Colors.text,
    backgroundColor:   Colors.white,
  },
  inputMulti:  { minHeight: 80, textAlignVertical: 'top', paddingTop: Spacing.sm },
  inputError:  { borderColor: Colors.error },

  // ── Gender toggle buttons ──────────────────────────────────────────────────
  genderRow: { flexDirection: 'row', gap: Spacing.sm },
  genderBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: Spacing.sm,
    borderRadius:    BorderRadius.md,
    borderWidth:     1,
    borderColor:     Colors.border,
    backgroundColor: Colors.white,
  },
  genderBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genderBtnText:       { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '600' },
  genderBtnTextActive: { color: Colors.white },

  // ── Doctor card rail ───────────────────────────────────────────────────────
  doctorLoadingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.sm,
    paddingVertical: Spacing.md,
  },
  doctorLoadingText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  emptyHint:         { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },

  doctorRail: {
    paddingVertical:  Spacing.xs,
    paddingEnd:       Spacing.sm,
    gap:              Spacing.sm,
  },
  doctorCard: {
    width:            110,
    alignItems:       'center',
    backgroundColor:  Colors.background,
    borderRadius:     BorderRadius.xl,
    paddingVertical:  Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderWidth:      1.5,
    borderColor:      Colors.border,
    gap:              4,
  },
  doctorCardSelected: {
    backgroundColor:  Colors.primary + '12',
    borderColor:      Colors.primary,
  },

  // Avatar circle
  docAvatar: {
    width:          48,
    height:         48,
    borderRadius:   BorderRadius.full,
    backgroundColor: Colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  docAvatarSelected:   { backgroundColor: Colors.primary },
  docAvatarText:       { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.textSecondary },
  docAvatarTextSelected: { color: Colors.white },

  docName: {
    fontSize:   FontSizes.xs,
    fontWeight: '600',
    color:      Colors.text,
    textAlign:  'center',
  },
  docNameSelected: { color: Colors.primary },
  docSpec: {
    fontSize:  FontSizes.xs - 1,
    color:     Colors.textSecondary,
    textAlign: 'center',
  },
  docAvailRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  docDot:        { width: 6, height: 6, borderRadius: 3 },
  docAvailText:  { fontSize: FontSizes.xs - 1, fontWeight: '600' },

  // Selected tick in top-end corner
  docSelectedTick: {
    position: 'absolute',
    top:      4,
    end:      4, // ← logical end — RTL-safe; never right: 4
  },

  // ── Walk-in toggle row ─────────────────────────────────────────────────────
  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: Colors.background,
    borderRadius:   BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap:            Spacing.sm,
    borderWidth:    1,
    borderColor:    Colors.borderLight,
  },
  toggleTextBlock: { flex: 1 },
  toggleLabel: {
    fontSize:   FontSizes.sm,
    fontWeight: '700',
    color:      Colors.text,
    textAlign:  'right',
  },
  toggleDesc: {
    fontSize:  FontSizes.xs,
    color:     Colors.textSecondary,
    marginTop: 2,
    textAlign: 'right',
  },
  walkInTimeRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: Colors.primary + '0d',
    borderRadius:    BorderRadius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  walkInTimeText: {
    fontSize: FontSizes.xs,
    color:    Colors.primary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },

  // ── Slot section ───────────────────────────────────────────────────────────
  slotSection:       { gap: Spacing.sm },
  slotSectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'space-between',
  },
  slotSectionTitle:  { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  slotCountBadge: {
    backgroundColor:   Colors.primary + '20',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  slotCountText:  { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },

  slotLoadingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.sm,
    paddingVertical: Spacing.md,
  },
  slotLoadingText:   { fontSize: FontSizes.xs, color: Colors.textSecondary },
  slotNoDoctorHint: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    paddingVertical: Spacing.sm,
    justifyContent:  'center',
  },
  slotNoDoctorText: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  slotEmpty: {
    alignItems:     'center',
    paddingVertical: Spacing.lg,
    gap:            Spacing.xs,
  },
  slotEmptyTitle: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },
  slotEmptyHint:  { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'center' },

  // Slot pill grid — flex-wrap, 3 pills per row on narrow screens
  slotGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
  },
  slotPill: {
    minWidth:          70,
    alignItems:        'center',
    borderRadius:      BorderRadius.md,
    paddingVertical:   6,
    paddingHorizontal: 10,
    borderWidth:       1.5,
    borderColor:       Colors.primary,
    backgroundColor:   Colors.white,
    gap:               1,
  },
  slotPillSelected: { backgroundColor: Colors.primary },
  slotPillBooked:   { borderColor: Colors.border, backgroundColor: Colors.borderLight },
  slotPillText:     { fontSize: FontSizes.xs, color: Colors.primary,         fontWeight: '600' },
  slotPillTextSelected: { color: Colors.white },
  slotPillTextBooked:   { color: Colors.gray },
  slotBookedSub:    { fontSize: FontSizes.xs - 2, color: Colors.gray },

  // ── Submit button ──────────────────────────────────────────────────────────
  submitBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.primary,
    borderRadius:    BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap:             Spacing.sm,
    elevation:       4,
    shadowColor:     Colors.primaryDark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.30,
    shadowRadius:    5,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    color:      Colors.white,
    fontSize:   FontSizes.md,
    fontWeight: '700',
  },
});

export default WalkInBookingScreen;
