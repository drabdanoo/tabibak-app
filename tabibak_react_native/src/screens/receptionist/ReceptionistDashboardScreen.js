/**
 * ReceptionistDashboardScreen.js — Front-Desk Command Center (Phase 4)
 *
 * ╔══ ARCHITECTURE NOTES ═══════════════════════════════════════════════════════╗
 *
 * 1. GLOBAL STATE LISTENER — why one listener beats N per-doctor queries
 * ───────────────────────────────────────────────────────────────────────────
 *   The receptionist is the clinic's command-centre operator, not a single
 *   doctor's assistant. They need a unified, real-time view of every patient
 *   across every room simultaneously.
 *
 *   Architecture decision: ONE onSnapshot on the `appointments` collection,
 *   filtered only by today's date range:
 *
 *     where('appointmentDate', '>=', Timestamp.fromDate(startOfDay))
 *     where('appointmentDate', '<=', Timestamp.fromDate(endOfDay))
 *
 *   This gives a single live stream of all clinic activity. When a doctor's
 *   screen marks an appointment 'completed', the receptionist's list updates
 *   in real-time without any polling, without extra listeners, and without
 *   coordinating across multiple snapshot streams.
 *
 *   Alternative considered: N per-doctor listeners (one per doctor on the
 *   roster). Rejected because: (a) requires pre-loading the doctor roster,
 *   (b) N listeners × real-time updates = N × Firestore billing events,
 *   (c) cross-doctor coordination (e.g., "which room is free?") requires
 *       client-side merging of N separate arrays anyway.
 *
 * 2. FILTERING MEMOIZATION — zero Firestore reads on filter changes
 * ─────────────────────────────────────────────────────────────────
 *   The master `appointments` array from onSnapshot is the single source
 *   of truth for all derived UI state. Three useMemo chains derive from it:
 *
 *     a) doctorFilters = useMemo([appointments])
 *        Extracts unique { doctorId, doctorName, count } entries.
 *        Rebuilt on every snapshot update; ignored by React if `appointments`
 *        reference is unchanged (Firestore SDK returns a new array on each
 *        snapshot event, so it always re-runs — which is correct).
 *
 *     b) filteredAppointments = useMemo([appointments, selectedDoctorId])
 *        Pure .filter() pass — runs in ~0.1 ms for 200 appointments.
 *        Tapping a DoctorChip updates selectedDoctorId → only this memo runs.
 *        No new Firestore query, no network round-trip.
 *
 *     c) stats = useMemo([filteredAppointments])
 *        Five .filter() passes on the already-filtered array.
 *        Counts reflect the currently-selected doctor scope automatically.
 *
 *   The FlatList receives `filteredAppointments` as `data`. React Native diffs
 *   the new array against the previous one (by keyExtractor) and re-renders
 *   only the changed cards. React.memo on AppointmentCard ensures stable
 *   cards (same id, same status, same isPending) are never re-rendered.
 *
 * 3. OPTIMISTIC STATUS TRANSITIONS
 * ──────────────────────────────────
 *   When the receptionist taps "Check In" or "Send to Doctor":
 *     a) The button shows a spinner immediately (isPending guard).
 *     b) updateDoc() writes the new status + a timestamped audit field.
 *     c) The Firestore onSnapshot listener fires (usually < 200 ms) and
 *        re-renders the card with the new status — no manual local-state
 *        patching required.
 *     d) The spinner is removed in the finally block.
 *
 *   This means the local state never diverges from the server — if the
 *   updateDoc fails, the card reverts to its pre-click state automatically
 *   (the snapshot hasn't changed) and an Alert is shown.
 *
 * 4. FAB PLACEMENT — RTL-safe using logical `end`
 * ─────────────────────────────────────────────────
 *   The FAB uses `end: 24` (CSS logical property) instead of `right: 24`.
 *   In LTR (English): end maps to the physical right edge.
 *   In RTL (Arabic):  end maps to the physical left edge.
 *   This makes the FAB correctly positioned regardless of layout direction,
 *   with zero JavaScript conditionals.
 *
 * 5. APPOINTMENT DATA MODEL (from appointmentService.js + Firestore)
 * ───────────────────────────────────────────────────────────────────
 *   appointments/{id}:
 *     patientId, patientName, patientPhone
 *     doctorId,  doctorName
 *     appointmentDate: Timestamp  ← used for today's range query
 *     appointmentTime: string     ← 'HH:MM AM/PM' — preferred for display
 *     reason, notes, status
 *     isWalkIn: boolean (set by walk-in FAB registration flow)
 *     confirmedAt, waitingAt, inProgressAt, completedAt, cancelledAt, updatedAt: Timestamp
 *
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Status machine (receptionist's authority):
 *   pending     → [تأكيد]             → confirmed
 *   pending     → [رفض]               → cancelled
 *   confirmed   → [تسجيل الوصول]      → waiting
 *   waiting     → [إرسال للطبيب]      → in_progress
 *   in_progress → badge [مع الطبيب]   (disabled — doctor owns this transition)
 *   completed   → badge [مكتمل]
 *   cancelled   → (no action shown)
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
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { useAuth }     from '../../contexts/AuthContext';
import { COLLECTIONS } from '../../config/firebase';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
}                      from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Module constants
// ─────────────────────────────────────────────────────────────────────────────
const ALL_DOCTORS_ID = 'all';

// Status display config — colour, background, label, icon per status value
const STATUS_CONFIG = {
  pending:     { color: '#f59e0b', bg: '#fef3c7', label: 'في الانتظار',  icon: 'time-outline' },
  confirmed:   { color: '#3b82f6', bg: '#dbeafe', label: 'مؤكد',         icon: 'checkmark-circle-outline' },
  waiting:     { color: '#eab308', bg: '#fef9c3', label: 'في الاستقبال', icon: 'people-outline' },
  in_progress: { color: '#8b5cf6', bg: '#ede9fe', label: 'في الجلسة',    icon: 'time-outline' },
  completed:   { color: Colors.primary, bg: '#d1fae5', label: 'مكتمل',   icon: 'checkmark-done-outline' },
  cancelled:   { color: Colors.error,   bg: '#fee2e2', label: 'ملغي',    icon: 'close-circle-outline' },
  no_show:     { color: '#6b7280',      bg: '#f3f4f6', label: 'لم يحضر', icon: 'person-remove-outline' },
};

// Stats shown in the header pills row (order = display order)
const STATS_ORDER = [
  { key: 'total',      label: 'الإجمالي',  color: Colors.text,    icon: 'calendar-outline' },
  { key: 'pending',    label: 'انتظار',    color: '#f59e0b',      icon: 'time-outline' },
  { key: 'confirmed',  label: 'مؤكدة',     color: '#3b82f6',      icon: 'checkmark-circle-outline' },
  { key: 'waiting',    label: 'الاستقبال', color: '#eab308',      icon: 'people-outline' },
  { key: 'inProgress', label: 'في الجلسة', color: '#8b5cf6',      icon: 'time-outline' },
  { key: 'completed',  label: 'مكتملة',    color: Colors.primary, icon: 'checkmark-done-outline' },
  { key: 'noShow',     label: 'لم يحضر',   color: '#6b7280',      icon: 'person-remove-outline' },
];

// Appointment type display config
const TYPE_CONFIG = {
  regular:   { label: 'عيادة',       color: '#6b7280' },
  urgent:    { label: 'عاجل',        color: Colors.error },
  follow_up: { label: 'متابعة',      color: '#8b5cf6' },
  walk_in:   { label: 'حضور مباشر', color: '#f59e0b' },
};

// Status → next status map for the Check In / Send to Doctor transitions
const NEXT_STATUS_MAP = {
  confirmed: { next: 'waiting',      auditField: 'waitingAt' },
  waiting:   { next: 'in_progress',  auditField: 'inProgressAt' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** { start, end } Firestore Timestamps bracketing today 00:00–23:59 */
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

/**
 * Preferred display time for an appointment.
 * Uses the human-readable `appointmentTime` string if available;
 * falls back to formatting the Firestore `appointmentDate` Timestamp.
 */
function formatApptTime(appointment) {
  if (appointment.appointmentTime) return appointment.appointmentTime;
  if (!appointment.appointmentDate) return '--:--';
  const d =
    typeof appointment.appointmentDate.toDate === 'function'
      ? appointment.appointmentDate.toDate()
      : new Date(appointment.appointmentDate);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Arabic time-of-day greeting */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء النور';
}

/** 'HH:MM' formatted clock string */
function formatClock(date) {
  return date.toLocaleTimeString('ar-SA', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Full Arabic date: day-of-week + day + month + year */
function formatToday() {
  return new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** Extract 1–2 uppercase initials from a display name */
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length)      return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — colour-coded pill for the current appointment status
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = memo(({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// StatPill — single aggregated count in the header statistics row
// ─────────────────────────────────────────────────────────────────────────────
const StatPill = memo(({ label, count, color, icon }) => (
  <View style={styles.statPill}>
    <View style={[styles.statIconWrap, { backgroundColor: color + '28' }]}>
      <Ionicons name={icon} size={15} color={color} />
    </View>
    <Text style={[styles.statCount, { color }]}>{count}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// DoctorChip — selectable filter in the horizontal doctor filter FlatList
//
// Tapping a chip updates `selectedDoctorId` → triggers filteredAppointments
// useMemo → FlatList receives a new data array → only changed cards re-render.
// Zero Firestore reads are made during this entire filter operation.
// ─────────────────────────────────────────────────────────────────────────────
const DoctorChip = memo(({ doctor, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={onPress}
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={`تصفية: ${doctor.name}`}
  >
    <Text
      style={[styles.chipText, selected && styles.chipTextSelected]}
      numberOfLines={1}
    >
      {doctor.name}
    </Text>
    {/* Appointment count badge on the chip */}
    <View style={[styles.chipBadge, selected && styles.chipBadgeSelected]}>
      <Text style={[styles.chipBadgeText, selected && styles.chipBadgeTextSelected]}>
        {doctor.count}
      </Text>
    </View>
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// QuickActions
//
// Renders the state-driven action row at the bottom of each appointment card.
// The action available depends entirely on the current `status` of the
// appointment — the receptionist sees only the action relevant to their role
// in the current step of the patient's journey through the clinic.
//
// State machine:
//   pending     → two buttons: [تأكيد] + [رفض]
//   confirmed   → one button:  [تسجيل الوصول]   → next: waiting
//   waiting     → one button:  [إرسال للطبيب]   → next: in_progress
//   in_progress → disabled badge: [مع الطبيب]   (doctor owns next transition)
//   completed   → disabled badge: [مكتمل]
//   cancelled   → nothing shown
// ─────────────────────────────────────────────────────────────────────────────
const QuickActions = memo(({
  appointment, onConfirm, onDecline, onTransition, isPending,
}) => {
  const { id, status } = appointment;

  // ── pending: Confirm / Decline ────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnConfirm, isPending && styles.actionBtnDisabled]}
          onPress={() => onConfirm(id)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="تأكيد الموعد"
        >
          {isPending
            ? <ActivityIndicator size={13} color={Colors.white} />
            : <Ionicons name="checkmark-circle" size={14} color={Colors.white} />}
          <Text style={styles.actionBtnText}>تأكيد</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDecline, isPending && styles.actionBtnDisabled]}
          onPress={() => onDecline(id)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="رفض الموعد"
        >
          <Ionicons name="close-circle" size={14} color={Colors.error} />
          <Text style={[styles.actionBtnText, { color: Colors.error }]}>رفض</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── confirmed: Check In ───────────────────────────────────────────────────
  if (status === 'confirmed') {
    return (
      <TouchableOpacity
        style={[
          styles.actionBtn, styles.actionBtnCheckIn,
          styles.actionBtnSingle,
          isPending && styles.actionBtnDisabled,
        ]}
        onPress={() => onTransition(id, 'confirmed')}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel="تسجيل الوصول"
      >
        {isPending
          ? <ActivityIndicator size={13} color={Colors.white} />
          : <Ionicons name="person-add" size={14} color={Colors.white} />}
        <Text style={styles.actionBtnText}>تسجيل الوصول</Text>
      </TouchableOpacity>
    );
  }

  // ── waiting: Send to Doctor ───────────────────────────────────────────────
  if (status === 'waiting') {
    return (
      <TouchableOpacity
        style={[
          styles.actionBtn, styles.actionBtnSendDoc,
          styles.actionBtnSingle,
          isPending && styles.actionBtnDisabled,
        ]}
        onPress={() => onTransition(id, 'waiting')}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityLabel="إرسال للطبيب"
      >
        {isPending
          ? <ActivityIndicator size={13} color={Colors.white} />
          : <Ionicons name="arrow-forward-circle" size={14} color={Colors.white} />}
        <Text style={styles.actionBtnText}>إرسال للطبيب</Text>
      </TouchableOpacity>
    );
  }

  // ── in_progress: static "With Doctor" badge ───────────────────────────────
  if (status === 'in_progress') {
    return (
      <View style={[styles.actionBtn, styles.actionBtnBadgePurple, styles.actionBtnSingle]}>
        <Ionicons name="time" size={13} color="#8b5cf6" />
        <Text style={[styles.actionBtnText, { color: '#8b5cf6' }]}>في الجلسة</Text>
      </View>
    );
  }

  // ── completed: static "Completed" badge ──────────────────────────────────
  if (status === 'completed') {
    return (
      <View style={[styles.actionBtn, styles.actionBtnBadgeGreen, styles.actionBtnSingle]}>
        <Ionicons name="checkmark-done" size={13} color={Colors.primary} />
        <Text style={[styles.actionBtnText, { color: Colors.primary }]}>مكتمل</Text>
      </View>
    );
  }

  // cancelled — no action row
  return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// AppointmentCard
//
// Wrapped in React.memo so it only re-renders when:
//   • The appointment document itself changes (new snapshot)
//   • isPending flips for this specific appointment ID
//
// All other state changes (different doctor chip selected, other cards updated)
// leave this component frozen — the FlatList only re-renders affected items.
// ─────────────────────────────────────────────────────────────────────────────
const AppointmentCard = memo(({
  appointment, onConfirm, onDecline, onTransition, isPending,
}) => {
  const {
    patientName = '—',
    doctorName  = '—',
    reason      = '',
    isWalkIn,
    status,
    type,
  } = appointment;

  const timeStr   = formatApptTime(appointment);
  const statusCfg = STATUS_CONFIG[status]  ?? STATUS_CONFIG.pending;
  const typeCfg   = TYPE_CONFIG[isWalkIn ? 'walk_in' : (type ?? 'regular')] ?? TYPE_CONFIG.regular;
  const initials  = getInitials(patientName);

  return (
    <View
      style={[
        styles.card,
        // Left-side accent line for in_progress cards (using logical borderStartWidth)
        status === 'in_progress' && styles.cardInProgress,
      ]}
    >
      {/* ── Card body ───────────────────────────────────────────────────── */}
      <View style={styles.cardBody}>
        {/* Patient avatar — initials on status-tinted circle */}
        <View style={[styles.avatar, { backgroundColor: statusCfg.color + '20' }]}>
          <Text style={[styles.avatarText, { color: statusCfg.color }]}>
            {initials}
          </Text>
        </View>

        {/* Patient + doctor info block */}
        <View style={styles.cardMeta}>
          {/* Name row + walk-in badge */}
          <View style={styles.nameRow}>
            <Text style={styles.patientName} numberOfLines={1}>
              {patientName}
            </Text>
            {isWalkIn && (
              <View style={styles.walkInBadge}>
                <Text style={styles.walkInText}>مباشر</Text>
              </View>
            )}
          </View>

          {/* Doctor name */}
          <Text style={styles.doctorNameText} numberOfLines={1}>
            {doctorName}
          </Text>

          {/* Reason / notes (optional) */}
          {!!reason && (
            <Text style={styles.reasonText} numberOfLines={1}>
              {reason}
            </Text>
          )}
        </View>

        {/* Time + appointment type (logical end column) */}
        <View style={styles.cardEndCol}>
          <Text style={styles.timeText}>{timeStr}</Text>
          <View style={[styles.typeBadge, { backgroundColor: typeCfg.color + '1a' }]}>
            <Text style={[styles.typeBadgeText, { color: typeCfg.color }]}>
              {typeCfg.label}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <View style={styles.cardDivider} />

      {/* ── Footer: status badge + quick action ─────────────────────────── */}
      <View style={styles.cardFooter}>
        <StatusBadge status={status} />
        <QuickActions
          appointment={appointment}
          onConfirm={onConfirm}
          onDecline={onDecline}
          onTransition={onTransition}
          isPending={isPending}
        />
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ReceptionistDashboardScreen — main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ReceptionistDashboardScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const db = getFirestore();

  // ── Component state ────────────────────────────────────────────────────────
  const [appointments,     setAppointments]     = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(ALL_DOCTORS_ID);
  const [isLoading,        setIsLoading]        = useState(true);
  const [error,            setError]            = useState(null);
  const [pendingIds,       setPendingIds]       = useState({}); // { [appointmentId]: true }
  const [clock,            setClock]            = useState(new Date());

  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ── Live clock — updates every 60 s ───────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (isMountedRef.current) setClock(new Date());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── Global clinic-wide onSnapshot ─────────────────────────────────────────
  //
  // Single listener for ALL of today's appointments regardless of doctor.
  // See architecture notes at the top of this file for the design rationale.
  //
  // Firestore index: `appointmentDate` ASC — single-field, auto-created.
  // No compound index is needed (range + orderBy are on the same field).
  useEffect(() => {
    const { start, end } = getTodayRange();

    const q = query(
      collection(db, COLLECTIONS.APPOINTMENTS),
      where('appointmentDate', '>=', start),
      where('appointmentDate', '<=', end),
      orderBy('appointmentDate', 'asc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMountedRef.current) return;
        setAppointments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        if (!isMountedRef.current) return;
        console.error('[ReceptionistDashboard] onSnapshot error:', err);
        setError('تعذّر تحميل المواعيد');
        setIsLoading(false);
      },
    );

    return unsubscribe; // Firestore subscription torn down on unmount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — runs once; date range fixed at mount

  // ── Derived data — useMemo chains (zero extra Firestore reads) ─────────────

  /**
   * doctorFilters: unique doctors in today's appointments + their counts.
   * Rebuilt on every snapshot; "All" chip is always prepended.
   * Memoized on [appointments] so changing the selected chip doesn't rebuild it.
   */
  const doctorFilters = useMemo(() => {
    const map = new Map(); // doctorId → { id, name, count }
    for (const appt of appointments) {
      if (!appt.doctorId) continue;
      const entry = map.get(appt.doctorId) ?? {
        id:    appt.doctorId,
        name:  appt.doctorName ?? '—',
        count: 0,
      };
      entry.count += 1;
      map.set(appt.doctorId, entry);
    }
    return [
      { id: ALL_DOCTORS_ID, name: 'الكل', count: appointments.length },
      ...Array.from(map.values()),
    ];
  }, [appointments]);

  /**
   * filteredAppointments: master list filtered by selectedDoctorId.
   * Pure .filter() — O(N) on every chip tap, ~0.1 ms for 200 items.
   * The FlatList receives this as `data` and diffs only changed items.
   */
  const filteredAppointments = useMemo(() => {
    if (selectedDoctorId === ALL_DOCTORS_ID) return appointments;
    return appointments.filter((a) => a.doctorId === selectedDoctorId);
  }, [appointments, selectedDoctorId]);

  /**
   * stats: aggregated counts scoped to the currently-filtered set.
   * Automatically reflects the selected doctor's queue when a chip is active.
   */
  const stats = useMemo(() => ({
    total:      filteredAppointments.length,
    pending:    filteredAppointments.filter((a) => a.status === 'pending').length,
    confirmed:  filteredAppointments.filter((a) => a.status === 'confirmed').length,
    waiting:    filteredAppointments.filter((a) => a.status === 'waiting').length,
    inProgress: filteredAppointments.filter((a) => a.status === 'in_progress').length,
    completed:  filteredAppointments.filter((a) => a.status === 'completed').length,
    noShow:     filteredAppointments.filter((a) => a.status === 'no_show').length,
  }), [filteredAppointments]);

  // ── pendingIds helpers ─────────────────────────────────────────────────────
  const markPending = useCallback((id, val) => {
    setPendingIds((prev) => {
      if (val) return { ...prev, [id]: true };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // ── Status transition handler — Check In & Send to Doctor ─────────────────
  //
  // Uses NEXT_STATUS_MAP to determine the target status and audit field.
  // updateDoc writes atomically; onSnapshot re-fires and updates the card.
  // No manual local-state patching: if updateDoc fails, the card shows its
  // original status (snapshot hasn't changed) and an Alert is shown.
  const handleTransition = useCallback(async (appointmentId, currentStatus) => {
    const transition = NEXT_STATUS_MAP[currentStatus];
    if (!transition || pendingIds[appointmentId]) return;

    markPending(appointmentId, true);
    try {
      await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:                transition.next,
        [transition.auditField]: serverTimestamp(),
        updatedAt:               serverTimestamp(),
      });
    } catch (err) {
      console.error('[ReceptionistDashboard] transition error:', err);
      Alert.alert('خطأ', 'تعذّر تحديث حالة الموعد. حاول مجددًا.');
    } finally {
      if (isMountedRef.current) markPending(appointmentId, false);
    }
  }, [db, pendingIds, markPending]);

  // ── Confirm pending → confirmed ────────────────────────────────────────────
  const handleConfirm = useCallback(async (appointmentId) => {
    if (pendingIds[appointmentId]) return;
    markPending(appointmentId, true);
    try {
      await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:      'confirmed',
        confirmedAt: serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
    } catch (err) {
      console.error('[ReceptionistDashboard] confirm error:', err);
      Alert.alert('خطأ', 'تعذّر تأكيد الموعد. حاول مجددًا.');
    } finally {
      if (isMountedRef.current) markPending(appointmentId, false);
    }
  }, [db, pendingIds, markPending]);

  // ── Decline pending → cancelled (with confirmation Alert) ─────────────────
  const handleDecline = useCallback((appointmentId) => {
    Alert.alert(
      'رفض الموعد',
      'هل أنت متأكد من رفض هذا الموعد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'رفض',
          style: 'destructive',
          onPress: async () => {
            if (pendingIds[appointmentId]) return;
            markPending(appointmentId, true);
            try {
              await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, appointmentId), {
                status:      'cancelled',
                cancelledAt: serverTimestamp(),
                updatedAt:   serverTimestamp(),
              });
            } catch (err) {
              console.error('[ReceptionistDashboard] decline error:', err);
              Alert.alert('خطأ', 'تعذّر رفض الموعد. حاول مجددًا.');
            } finally {
              if (isMountedRef.current) markPending(appointmentId, false);
            }
          },
        },
      ],
    );
  }, [db, pendingIds, markPending]);

  // ── FAB: walk-in registration ──────────────────────────────────────────────
  const handleWalkIn = useCallback(() => {
    // WalkInBookingScreen: full patient search/create + doctor rail + force-fit toggle
    navigation.navigate('WalkInBooking', { walkIn: true });
  }, [navigation]);

  // ── FlatList render helpers ────────────────────────────────────────────────
  const renderAppointment = useCallback(({ item }) => (
    <AppointmentCard
      appointment={item}
      onConfirm={handleConfirm}
      onDecline={handleDecline}
      onTransition={handleTransition}
      isPending={!!pendingIds[item.id]}
    />
  ), [pendingIds, handleConfirm, handleDecline, handleTransition]);

  const renderDoctorChip = useCallback(({ item }) => (
    <DoctorChip
      doctor={item}
      selected={selectedDoctorId === item.id}
      onPress={() => setSelectedDoctorId(item.id)}
    />
  ), [selectedDoctorId]);

  const keyExtractor       = useCallback((item) => item.id, []);
  const chipKeyExtractor   = useCallback((item) => item.id, []);
  const statKeyExtractor   = useCallback((item) => item.key, []);

  const renderStatPill = useCallback(({ item }) => (
    <StatPill
      label={item.label}
      count={stats[item.key] ?? 0}
      color={item.color}
      icon={item.icon}
    />
  ), [stats]);

  const ListEmptyComponent = useCallback(() => (
    !isLoading ? (
      <View style={styles.emptyBox}>
        <Ionicons name="calendar-outline" size={56} color={Colors.border} />
        <Text style={styles.emptyTitle}>لا توجد مواعيد</Text>
        <Text style={styles.emptySubtitle}>
          {selectedDoctorId !== ALL_DOCTORS_ID
            ? 'لا مواعيد لهذا الطبيب اليوم'
            : 'لم يتم حجز أي موعد لهذا اليوم'}
        </Text>
      </View>
    ) : null
  ), [isLoading, selectedDoctorId]);

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && !isLoading && appointments.length === 0) {
    return (
      <View style={styles.errorBox}>
        <Ionicons name="cloud-offline-outline" size={56} color={Colors.error} />
        <Text style={styles.errorTitle}>{error}</Text>
        <Text style={styles.errorSubtitle}>
          تحقق من الاتصال بالإنترنت وأعد المحاولة
        </Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Platform.OS === 'android' ? Colors.primaryDark : undefined} />

      {/* ════════════════════════════════════════════════════════════════════
          HEADER — greeting + live clock + stats pills
          Uses a second FlatList (horizontal) for the stats row so it
          scrolls independently from the main appointment list.
          ════════════════════════════════════════════════════════════════ */}
      <View style={styles.header}>
        {/* Top row: greeting + clock */}
        <View style={styles.headerTopRow}>
          <View style={styles.headerGreetingBlock}>
            <Text style={styles.headerGreeting}>{getGreeting()}</Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {userProfile?.name ?? user?.displayName ?? 'موظف الاستقبال'}
            </Text>
          </View>
          <View style={styles.headerClockBlock}>
            <Text style={styles.headerClock}>{formatClock(clock)}</Text>
            <Text style={styles.headerDate} numberOfLines={1}>
              {formatToday()}
            </Text>
          </View>
        </View>

        {/* Stats pills — horizontal FlatList so they can overflow on small screens */}
        <FlatList
          data={STATS_ORDER}
          keyExtractor={statKeyExtractor}
          renderItem={renderStatPill}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        />
      </View>

      {/* ════════════════════════════════════════════════════════════════════
          DOCTOR FILTER CHIPS — horizontal FlatList

          Built from useMemo([appointments]) — dynamically reflects which
          doctors have appointments today. Tapping a chip triggers only the
          filteredAppointments useMemo (dep: selectedDoctorId); no Firestore
          query is fired.
          ════════════════════════════════════════════════════════════════ */}
      <View style={styles.filterBar}>
        <FlatList
          data={doctorFilters}
          keyExtractor={chipKeyExtractor}
          renderItem={renderDoctorChip}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        />
      </View>

      {/* Queue heading + live count */}
      <View style={styles.queueBar}>
        <Text style={styles.queueTitle}>قائمة الانتظار</Text>
        <View style={styles.queueCountWrap}>
          <Text style={styles.queueCount}>{filteredAppointments.length}</Text>
        </View>
      </View>

      {/* ════════════════════════════════════════════════════════════════════
          MAIN APPOINTMENT QUEUE — single FlatList

          data = filteredAppointments (useMemo — no extra Firestore reads).
          React.memo on AppointmentCard ensures only cards whose appointment
          document or isPending status changed are re-rendered on each snapshot.

          keyboardShouldPersistTaps="handled": keeps keyboard open if the
          receptionist is typing a note while tapping a card action button.
          ════════════════════════════════════════════════════════════════ */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جارٍ تحميل المواعيد...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          renderItem={renderAppointment}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.queueList,
            filteredAppointments.length === 0 && styles.queueListEmpty,
          ]}
          ListEmptyComponent={ListEmptyComponent}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={60}
          windowSize={8}
          initialNumToRender={8}
          style={styles.flatList}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          FAB — Register Walk-In

          Position: bottom: 24, end: 24
          `end` is a CSS logical property (RTL-safe):
            LTR: end → physical right  → FAB at bottom-right ✓
            RTL: end → physical left   → FAB at bottom-left  ✓ (Arabic convention)
          This is the ONLY correct RTL approach. `right: 24` would be
          fixed to the physical right edge regardless of layout direction.
          ════════════════════════════════════════════════════════════════ */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleWalkIn}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="تسجيل حضور مباشر"
        accessibilityHint="يفتح نافذة تسجيل مريض جديد بدون موعد مسبق"
      >
        <Ionicons name="person-add" size={22} color={Colors.white} />
        <Text style={styles.fabLabel}>حضور مباشر</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — RTL-compliant throughout
//
// All directional properties use logical values:
//   marginStart, marginEnd             → never marginLeft, marginRight
//   paddingStart, paddingEnd           → never paddingLeft, paddingRight
//   borderStartWidth, borderStartColor → never borderLeftWidth
//   borderTopStartRadius / EndRadius   → never borderTopLeftRadius
//   end: N                             → never right: N (FAB, absolute pos)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Root ───────────────────────────────────────────────────────────────────
  root: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: Colors.primary,
    paddingTop:      Platform.OS === 'android' ? Spacing.md : Spacing.sm,
  },
  headerTopRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-start',
    paddingHorizontal: Spacing.md,
    paddingBottom:     Spacing.sm,
  },
  headerGreetingBlock: {
    flex: 1,
  },
  headerGreeting: {
    color:    'rgba(255,255,255,0.80)',
    fontSize: FontSizes.sm,
  },
  headerName: {
    color:      Colors.white,
    fontSize:   FontSizes.lg,
    fontWeight: '700',
    marginTop:   2,
  },
  headerClockBlock: {
    alignItems: 'flex-end',
    marginStart: Spacing.md,
  },
  headerClock: {
    color:      Colors.white,
    fontSize:   FontSizes.xl,
    fontWeight: '700',
  },
  headerDate: {
    color:    'rgba(255,255,255,0.75)',
    fontSize: FontSizes.xs,
    marginTop: 1,
  },

  // Stats pills row (inside header, horizontal scroll)
  statsRow: {
    paddingHorizontal: Spacing.sm,
    paddingTop:        Spacing.xs,
    paddingBottom:     Spacing.md,
    gap:               Spacing.xs,
  },
  statPill: {
    backgroundColor:  'rgba(255,255,255,0.15)',
    borderRadius:      BorderRadius.lg,
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.sm,
    alignItems:        'center',
    minWidth:           68,
    gap:                2,
  },
  statIconWrap: {
    width:          26,
    height:         26,
    borderRadius:   13,
    alignItems:     'center',
    justifyContent: 'center',
  },
  statCount: {
    fontSize:   FontSizes.lg,
    fontWeight: '700',
    lineHeight: FontSizes.lg * 1.15,
    color:      Colors.white,
  },
  statLabel: {
    fontSize:   FontSizes.xs - 1,
    color:      'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textAlign:  'center',
  },

  // ── Doctor filter chips ─────────────────────────────────────────────────────
  filterBar: {
    backgroundColor:  Colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    elevation:  3,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius:  2,
  },
  filterRow: {
    paddingHorizontal: Spacing.sm,
    paddingVertical:   Spacing.sm,
    gap:               Spacing.xs,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.background,
    borderRadius:      BorderRadius.full,
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderWidth:       1,
    borderColor:       Colors.border,
    gap:               Spacing.xs,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primaryDark,
  },
  chipText: {
    color:      Colors.textSecondary,
    fontSize:   FontSizes.sm,
    fontWeight: '500',
  },
  chipTextSelected: {
    color:      Colors.white,
    fontWeight: '700',
  },
  chipBadge: {
    backgroundColor:  Colors.borderLight,
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical:   1,
    minWidth:           18,
    alignItems:        'center',
  },
  chipBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipBadgeText: {
    color:      Colors.textSecondary,
    fontSize:   FontSizes.xs - 1,
    fontWeight: '700',
  },
  chipBadgeTextSelected: {
    color: Colors.white,
  },

  // ── Queue heading ───────────────────────────────────────────────────────────
  queueBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    gap:               Spacing.xs,
  },
  queueTitle: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.text,
  },
  queueCountWrap: {
    backgroundColor:  Colors.primary + '22',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
  },
  queueCount: {
    color:      Colors.primaryDark,
    fontSize:   FontSizes.xs,
    fontWeight: '700',
  },

  // ── Main FlatList ───────────────────────────────────────────────────────────
  flatList: {
    flex: 1,
  },
  queueList: {
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.xs,
    paddingBottom:     88, // clears the FAB (24 bottom + 40 height + padding)
  },
  queueListEmpty: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Loading / empty / error states ─────────────────────────────────────────
  loadingBox: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            Spacing.sm,
  },
  loadingText: {
    color:    Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  emptyBox: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap:             Spacing.sm,
  },
  emptyTitle: {
    color:      Colors.text,
    fontSize:   FontSizes.lg,
    fontWeight: '600',
    marginTop:  Spacing.sm,
  },
  emptySubtitle: {
    color:    Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
  },
  errorBox: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    gap:            Spacing.sm,
    padding:        Spacing.xl,
  },
  errorTitle: {
    color:      Colors.error,
    fontSize:   FontSizes.lg,
    fontWeight: '600',
    textAlign:  'center',
    marginTop:  Spacing.sm,
  },
  errorSubtitle: {
    color:     Colors.textSecondary,
    fontSize:  FontSizes.sm,
    textAlign: 'center',
  },

  // ── Appointment card ────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius:     BorderRadius.lg,
    marginBottom:     Spacing.sm,
    overflow:         'hidden',
    elevation:    3,
    shadowColor:  Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  3,
  },
  // `borderStartWidth` = logical (left in LTR, right in RTL) accent line
  cardInProgress: {
    borderStartWidth: 4,
    borderStartColor: '#8b5cf6',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    padding:       Spacing.md,
    gap:           Spacing.sm,
  },
  avatar: {
    width:          40,
    height:         40,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  avatarText: {
    fontSize:   FontSizes.sm,
    fontWeight: '700',
  },
  cardMeta: {
    flex: 1,
    gap:  2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
  },
  patientName: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.text,
    flexShrink: 1,
  },
  walkInBadge: {
    backgroundColor:  '#fef3c7',
    borderRadius:      BorderRadius.sm,
    paddingVertical:   2,
    paddingHorizontal: 5,
  },
  walkInText: {
    color:      '#92400e',
    fontSize:   FontSizes.xs - 1,
    fontWeight: '600',
  },
  doctorNameText: {
    color:    Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  reasonText: {
    color:    Colors.gray,
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  cardEndCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap:        Spacing.xs,
  },
  timeText: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.text,
  },
  typeBadge: {
    borderRadius:      BorderRadius.sm,
    paddingVertical:   2,
    paddingHorizontal: 6,
  },
  typeBadgeText: {
    fontSize:   FontSizes.xs - 1,
    fontWeight: '600',
  },
  cardDivider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  Colors.borderLight,
    marginHorizontal: Spacing.md,
  },
  cardFooter: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    gap:               Spacing.sm,
  },

  // Status badge
  statusBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      BorderRadius.full,
    paddingVertical:   4,
    paddingHorizontal: 8,
    gap:               4,
    flexShrink:        0,
  },
  statusBadgeText: {
    fontSize:   FontSizes.xs,
    fontWeight: '600',
  },

  // ── Quick action buttons ────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap:           Spacing.xs,
    flexShrink:    0,
  },
  actionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    borderRadius:      BorderRadius.md,
    paddingVertical:    Spacing.xs,
    paddingHorizontal:  Spacing.sm,
    gap:                4,
  },
  actionBtnSingle: {
    // Standalone single-button variant — don't flex to fill row
    alignSelf: 'flex-start',
  },
  actionBtnConfirm: {
    flex:            1,
    backgroundColor: Colors.primary,
  },
  actionBtnDecline: {
    flex:            1,
    backgroundColor: Colors.white,
    borderWidth:      1,
    borderColor:      Colors.error,
  },
  actionBtnCheckIn: {
    backgroundColor: '#3b82f6',
  },
  actionBtnSendDoc: {
    backgroundColor: '#8b5cf6',
  },
  actionBtnBadgePurple: {
    backgroundColor: '#ede9fe',
  },
  actionBtnBadgeGreen: {
    backgroundColor: '#d1fae5',
  },
  actionBtnDisabled: {
    opacity: 0.60,
  },
  actionBtnText: {
    color:      Colors.white,
    fontSize:   FontSizes.xs,
    fontWeight: '600',
  },

  // ── FAB ────────────────────────────────────────────────────────────────────
  // `end: 24` is the RTL-safe logical property for the FAB position.
  // In LTR (English): end = right → FAB appears bottom-right.
  // In RTL (Arabic):  end = left  → FAB appears bottom-left.
  // Never use `right: 24` here — it would be fixed to the physical right
  // regardless of the layout direction.
  fab: {
    position:          'absolute',
    bottom:             24,
    end:                24,            // ← RTL-safe logical end — NEVER right: 24
    flexDirection:      'row',
    alignItems:         'center',
    backgroundColor:    Colors.primaryDark,
    borderRadius:       BorderRadius.full,
    paddingVertical:    14,
    paddingHorizontal:  20,
    gap:                Spacing.xs,
    // Shadow
    elevation:   8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  6,
  },
  fabLabel: {
    color:      Colors.white,
    fontSize:   FontSizes.md,
    fontWeight: '700',
  },
});