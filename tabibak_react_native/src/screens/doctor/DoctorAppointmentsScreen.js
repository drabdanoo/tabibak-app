/**
 * DoctorAppointmentsScreen — Phase 3: Doctor Core
 * (The "Appointments" bottom-tab calendar / schedule view)
 *
 * ── Architecture Notes ──────────────────────────────────────────────────────
 *
 * HORIZONTAL DATE STRIP
 * ─────────────────────
 * A 7-day week window is shown as a horizontal <FlatList> of selectable
 * day pills at the top of the screen. The strip is a sibling to the
 * appointment <FlatList> below it — NOT nested inside a ScrollView —
 * so it stays permanently pinned while the appointment list scrolls.
 *
 * Each pill shows the weekday abbreviation and the day number. A small
 * circular dot below the number indicates that appointments exist on that
 * day, giving the doctor an at-a-glance overview of the week.
 *
 * Week navigation is handled by two chevron buttons flanking a "Mar 3–9"
 * range label. In RTL (Arabic) mode:
 *   • The flex row reverses, so the "previous week" button appears on the
 *     RIGHT and "next week" on the LEFT — correct for Arabic calendars.
 *   • The chevron icons use I18nManager.isRTL to flip direction so the
 *     arrows remain semantically meaningful (→ means "go to earlier dates"
 *     when you are reading right-to-left).
 *
 * Auto-scroll: `scrollToIndex` is called whenever selectedDate changes so
 * the selected pill is always centred in the visible strip area. The
 * `getItemLayout` callback makes scrollToIndex synchronous (no layout pass
 * needed because all pills have the same fixed width).
 *
 * WINDOWED DATA FETCHING (scoped onSnapshot)
 * ──────────────────────────────────────────
 * The screen does NOT attach a listener to the doctor's entire appointment
 * history. Instead it attaches a single onSnapshot scoped to the current
 * 7-day window:
 *
 *   where('doctorId', '==', uid)
 *   where('appointmentDate', '>=', weekStartStr)   ← 'YYYY-MM-DD'
 *   where('appointmentDate', '<=', weekEndStr)
 *   orderBy('appointmentDate', 'asc')
 *   orderBy('appointmentTime', 'asc')
 *
 * The snapshot result is normalised into a Map<'YYYY-MM-DD', Appointment[]>
 * (appointmentsByDate). Switching between days in the same week is instant:
 * the view just reads a different key from this Map — zero extra network
 * requests. The listener also provides free real-time updates within the
 * current week (e.g., a patient cancelling while the doctor is looking at
 * the screen).
 *
 * WEEK CHANGE = NEW LISTENER
 * When the doctor navigates to the previous or next week, the `weekStart`
 * state changes, which triggers the useEffect dependency and:
 *   1. Unsubscribes the old listener (cleanup function).
 *   2. Subscribes a new listener for the new week.
 * Past weeks that the doctor has already visited are NOT re-cached: this is
 * intentional. The doctor is unlikely to paginate through many weeks during
 * one session, so the simplicity of a single active listener outweighs the
 * marginal cost of re-fetching a previously seen week.
 *
 * PULL-TO-REFRESH
 * A `refreshKey` counter is bumped on pull-to-refresh. Because `refreshKey`
 * is listed as a useEffect dependency, incrementing it forces the listener
 * to be torn down and re-created, guaranteeing a fresh read from the server
 * (bypassing the Firestore client-side cache).
 *
 * APPOINTMENT CARD INTERACTIONS
 * ─────────────────────────────
 * Each card has two interaction zones:
 *   • Top section (TouchableOpacity): navigates to 'PatientDetails',
 *     passing the full appointment object + patientId.
 *   • Bottom action row (per-status): inline quick actions using the same
 *     processingId pattern as the dashboard — the specific card's action
 *     row is replaced by <ActivityIndicator> while the Firestore write
 *     is in flight. Other cards remain fully interactive.
 *
 * RTL COMPLIANCE
 * ──────────────
 * ⚠️  This app is in Arabic. Zero marginLeft/Right, paddingLeft/Right,
 * borderLeftWidth/Right, or positional left/right values. All directional
 * spacing uses logical properties:
 *   marginStart / marginEnd / paddingStart / paddingEnd /
 *   borderStartWidth / borderEndWidth / start / end
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
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Width of each day pill in the date strip. */
const DAY_PILL_W  = 56;
/** Horizontal margin applied to each pill on both sides. */
const PILL_MX     = Spacing.xs; // 4px each side
/** Total slot width per pill item (for getItemLayout + scrollToIndex). */
const PILL_SLOT   = DAY_PILL_W + PILL_MX * 2;

/**
 * In RTL (Arabic), the chevron icons are swapped so they remain directionally
 * correct after the flex row auto-reverses:
 *   • The "prev week" button lands on the RIGHT in RTL. It should show a →
 *     icon (chevron-forward), meaning "go to earlier dates on the right".
 *   • The "next week" button lands on the LEFT in RTL. It should show a ←
 *     icon (chevron-back), meaning "go to later dates on the left".
 */
const PREV_ICON = I18nManager.isRTL ? 'chevron-forward' : 'chevron-back';
const NEXT_ICON = I18nManager.isRTL ? 'chevron-back'    : 'chevron-forward';

const STATUS_CONFIG = {
  confirmed: {
    label: 'Confirmed',
    bg: '#22C55E',
    color: '#FFFFFF',
    icon: 'checkmark-circle',
  },
  pending: {
    label: 'Pending',
    bg: '#F59E0B',
    color: '#FFFFFF',
    icon: 'time',
  },
  cancelled: {
    label: 'Cancelled',
    bg: '#EF4444',
    color: '#FFFFFF',
    icon: 'close-circle',
  },
  completed: {
    label: 'Completed',
    bg: '#6B7280',
    color: '#FFFFFF',
    icon: 'checkmark-done-circle',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Firestore Timestamp | Date | 'YYYY-MM-DD' string → 'YYYY-MM-DD' */
const toDateStr = (date) => {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : (typeof date === 'string' ? new Date(date) : date);
  return d.toISOString().split('T')[0];
};

/**
 * Returns the Monday of the week containing `date`.
 * ISO weeks start on Monday.
 */
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * "Mar 3 – 9, 2026" or "Feb 24 – Mar 2, 2026" when the week spans months.
 */
function formatWeekRange(weekStart) {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);

  const sMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const eMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const year   = end.getFullYear();

  if (sMonth === eMonth) {
    return `${sMonth} ${weekStart.getDate()} – ${end.getDate()}, ${year}`;
  }
  return `${sMonth} ${weekStart.getDate()} – ${eMonth} ${end.getDate()}, ${year}`;
}

/**
 * 'HH:MM' → '2:30 PM'. Passes through strings that already contain AM/PM.
 */
function formatTime12(timeStr) {
  if (!timeStr) return '—';
  if (/[AP]M/i.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

/** First two uppercase initials from a name. */
function getInitials(name) {
  return (name ?? '')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

/** Returns the weekday abbreviation in a locale-independent safe way. */
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─────────────────────────────────────────────────────────────────────────────
// Custom Hook — useWeekAppointments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useWeekAppointments
 *
 * Attaches a scoped onSnapshot listener covering [weekStart, weekStart+6].
 * Returns a Map<'YYYY-MM-DD', Appointment[]> populated from the snapshot so
 * that switching between days in the same week requires zero extra network
 * calls — it's just a Map.get() on already-live data.
 *
 * When weekStart changes (week navigation), the useEffect cleanup tears down
 * the old listener and a new one is attached for the new 7-day window.
 *
 * refreshKey: incrementing this integer forces a listener re-subscription,
 * bypassing the Firestore client cache — used by pull-to-refresh.
 */
function useWeekAppointments(uid, weekStart) {
  const [appointmentsByDate, setAppointmentsByDate] = useState(new Map());
  const [loading, setLoading]         = useState(true);
  const [refreshKey, setRefreshKey]   = useState(0);

  useEffect(() => {
    if (!uid || !weekStart) return;

    setLoading(true);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startStr = toDateStr(weekStart);
    const endStr   = toDateStr(weekEnd);

    const q = query(
      collection(db, 'appointments'),
      where('doctorId', '==', uid),
      where('appointmentDate', '>=', startStr),
      where('appointmentDate', '<=', endStr),
      orderBy('appointmentDate', 'asc'),
      orderBy('appointmentTime', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        // Build a Map with ALL 7 days pre-seeded to [] so empty days are
        // distinguishable from "not yet fetched" days.
        const byDate = new Map();
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          byDate.set(toDateStr(d), []);
        }
        snap.docs.forEach(docSnap => {
          const apt = { id: docSnap.id, ...docSnap.data() };
          const key = toDateStr(apt.appointmentDate);
          if (byDate.has(key)) byDate.get(key).push(apt);
        });
        setAppointmentsByDate(new Map(byDate)); // new Map ref → triggers re-render
        setLoading(false);
      },
      (err) => {
        console.error('[useWeekAppointments]', err);
        setLoading(false);
      },
    );

    return unsub; // cleanup: unsubscribe old listener when weekStart changes
  }, [uid, weekStart, refreshKey]);

  /** Pull-to-refresh: re-subscribe to get a server-fresh read. */
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  return { appointmentsByDate, loading, refresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components  (module-scope for stable identity)
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

/** Patient initials avatar. */
const PatientAvatar = React.memo(({ name, size = 40 }) => (
  <View style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={S.avatarText}>{getInitials(name)}</Text>
  </View>
));

/**
 * DayPill
 *
 * A selectable pill in the horizontal date strip.
 *   • `isSelected`  → primary background, white text
 *   • `isToday`     → shows "Today" instead of the weekday abbreviation
 *   • `dotVisible`  → small indicator dot if appointments exist on this day
 */
const DayPill = React.memo(({ date, isSelected, isToday, dotVisible, onPress }) => (
  <TouchableOpacity
    style={[S.dayPill, isSelected && S.dayPillActive]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={[S.dayPillWeekday, isSelected && S.dayPillTextActive]}>
      {isToday ? 'Today' : WEEKDAY_ABBR[date.getDay()]}
    </Text>
    <Text style={[S.dayPillNum, isSelected && S.dayPillTextActive]}>
      {date.getDate()}
    </Text>
    {/* Appointment indicator dot */}
    <View
      style={[
        S.dayPillDot,
        dotVisible && !isSelected && S.dayPillDotVisible,
        isSelected && S.dayPillDotActive,
      ]}
    />
  </TouchableOpacity>
));

/**
 * AppointmentCard
 *
 * Two-zone layout:
 *   ZONE A (TouchableOpacity) — tapping navigates to PatientDetails.
 *     Shows: time column | avatar + patient name + reason | status badge + chevron
 *   ZONE B (View) — inline quick-action buttons per status.
 *     Pending  : Accept (green) + Decline (red, with confirmation Alert)
 *     Confirmed: Mark Done
 *     Completed/Cancelled: no actions
 *   LOADING: when processingId === item.id, Zone B shows ActivityIndicator.
 *
 * The two zones are siblings — NOT nested — so there are no TouchableOpacity
 * nesting conflicts.
 */
const AppointmentCard = React.memo(({
  item,
  processingId,
  onViewChart,
  onAccept,
  onDecline,
  onMarkDone,
}) => {
  const isProcessing = processingId === item.id;
  const isPending    = item.status === 'pending';
  const isConfirmed  = item.status === 'confirmed';
  const isCancelled  = item.status === 'cancelled';
  const hasActions   = isPending || isConfirmed;

  return (
    <View style={[S.card, isCancelled && S.cardMuted]}>

      {/* ── ZONE A: navigation tap ────────────────────────────── */}
      <TouchableOpacity
        style={S.cardTapArea}
        onPress={() => onViewChart(item)}
        activeOpacity={0.7}
      >
        {/* Time column */}
        <View style={S.cardTimeCol}>
          <Text style={S.cardTime}>{formatTime12(item.appointmentTime)}</Text>
        </View>

        {/* Patient info */}
        <View style={S.cardBody}>
          <PatientAvatar name={item.patientName} size={40} />
          <View style={S.cardInfo}>
            <Text style={S.cardPatientName} numberOfLines={1}>
              {item.patientName || 'Patient'}
            </Text>
            {!!item.reason && (
              <Text style={S.cardReason} numberOfLines={1}>{item.reason}</Text>
            )}
            {item.bookingFor === 'family' && !!item.familyMemberName && (
              <Text style={S.cardFamily} numberOfLines={1}>
                For: {item.familyMemberName}
              </Text>
            )}
          </View>
        </View>

        {/* Status + disclosure */}
        <View style={S.cardEnd}>
          <StatusBadge status={item.status} />
          <Ionicons
            name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={Colors.textSecondary}
            style={S.cardChevron}
          />
        </View>
      </TouchableOpacity>

      {/* ── ZONE B: quick actions ─────────────────────────────── */}
      {hasActions && (
        <>
          <View style={S.actionDivider} />
          {isProcessing ? (
            <View style={S.processingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={S.processingText}>Updating…</Text>
            </View>
          ) : (
            <View style={S.actionRow}>
              {isPending && (
                <>
                  <TouchableOpacity
                    style={S.acceptBtn}
                    onPress={() => onAccept(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={14} color={Colors.white} />
                    <Text style={S.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={S.declineBtn}
                    onPress={() => onDecline(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={14} color={Colors.error} />
                    <Text style={S.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
              {isConfirmed && (
                <TouchableOpacity
                  style={S.markDoneBtn}
                  onPress={() => onMarkDone(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle-outline" size={14} color={Colors.primary} />
                  <Text style={S.markDoneBtnText}>Mark as Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
});

/**
 * EmptyDayState
 *
 * Shown when the selected date has no appointments.
 * Includes the date name so the doctor knows which day they're looking at.
 */
const EmptyDayState = React.memo(({ date }) => {
  const label = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const isToday = toDateStr(date) === toDateStr(new Date());
  return (
    <View style={S.emptyWrap}>
      <Ionicons name="calendar-outline" size={64} color={Colors.border} />
      <Text style={S.emptyTitle}>
        {isToday ? 'Nothing scheduled today' : 'No appointments'}
      </Text>
      <Text style={S.emptySub}>{label}</Text>
      <Text style={S.emptyHint}>
        Pending requests that have not yet been accepted will not appear here.
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DoctorAppointmentsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const uid = user?.uid;

  // Support being launched with a specific initial date (e.g., from Dashboard)
  const { initialDate } = route.params ?? {};

  // ── Date + week state ─────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() =>
    initialDate ? new Date(initialDate) : new Date(),
  );
  const [weekStart, setWeekStart] = useState(() =>
    getWeekStart(initialDate ? new Date(initialDate) : new Date()),
  );

  // ── Data hook ─────────────────────────────────────────────────────────────
  const { appointmentsByDate, loading, refresh } =
    useWeekAppointments(uid, weekStart);

  // ── Per-card processing state ─────────────────────────────────────────────
  const [processingId, setProcessingId] = useState(null);
  const [refreshing, setRefreshing]     = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedDateStr = useMemo(() => toDateStr(selectedDate), [selectedDate]);

  /** All 7 days in the current week window. */
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  /** Appointments for the currently selected day — O(1) Map lookup. */
  const dayAppointments = useMemo(
    () => appointmentsByDate.get(selectedDateStr) ?? [],
    [appointmentsByDate, selectedDateStr],
  );

  const todayStr = useMemo(() => toDateStr(new Date()), []);

  // ── Date strip ref + auto-scroll ──────────────────────────────────────────
  const stripRef = useRef(null);

  useEffect(() => {
    const idx = weekDays.findIndex(d => toDateStr(d) === selectedDateStr);
    if (idx < 0) return;
    // scrollToIndex requires getItemLayout to be provided (see below).
    stripRef.current?.scrollToIndex({
      index: idx,
      animated: true,
      viewPosition: 0.5, // centre the selected pill
    });
  }, [selectedDateStr, weekDays]);

  /**
   * getItemLayout for the date strip FlatList.
   * All pills have the same slot width → synchronous scrollToIndex.
   * The leading paddingStart (Spacing.md) is added to the offset so the
   * first pill lands at the correct position.
   */
  const getDatePillLayout = useCallback((_data, index) => ({
    length: PILL_SLOT,
    offset: Spacing.md + PILL_SLOT * index,
    index,
  }), []);

  // ── Week navigation ───────────────────────────────────────────────────────
  const navigateWeek = useCallback((direction) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + direction * 7);
    setWeekStart(next);

    // Select Monday of the new week, unless today falls within it.
    const today     = new Date();
    const nextEnd   = new Date(next);
    nextEnd.setDate(next.getDate() + 6);
    const newSel = (today >= next && today <= nextEnd) ? today : next;
    setSelectedDate(newSel);
  }, [weekStart]);

  const goToPrevWeek = useCallback(() => navigateWeek(-1), [navigateWeek]);
  const goToNextWeek = useCallback(() => navigateWeek(+1), [navigateWeek]);

  // ── Date selection ────────────────────────────────────────────────────────
  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    // If this day is in a different week, also shift the week window.
    const newWeekStart = getWeekStart(date);
    if (toDateStr(newWeekStart) !== toDateStr(weekStart)) {
      setWeekStart(newWeekStart);
    }
  }, [weekStart]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    // Refreshing is cleared by the onSnapshot callback (setLoading(false)),
    // but we need to clear it locally too after a brief delay.
    setTimeout(() => setRefreshing(false), 1200);
  }, [refresh]);

  // ── Emergency Override — cancel all pending/confirmed for the selected day ─
  const [clearingDay, setClearingDay] = useState(false);

  const handleClearDay = useCallback(() => {
    const dayLabel = selectedDate.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' });
    Alert.alert(
      '🚨 إلغاء يوم كامل',
      `سيتم إلغاء جميع المواعيد المعلقة والمؤكدة ليوم ${dayLabel}.\n\nهل أنت متأكد؟`,
      [
        { text: 'رجوع', style: 'cancel' },
        {
          text: 'إلغاء الجميع',
          style: 'destructive',
          onPress: async () => {
            setClearingDay(true);
            try {
              const { getDocs, query, collection, where, Timestamp, updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
              const { db: firestoreDb } = await import('../../config/firebase');

              const [year, month, day] = selectedDateStr.split('-').map(Number);
              const start = new Date(year, month - 1, day, 0, 0, 0, 0);
              const end   = new Date(year, month - 1, day, 23, 59, 59, 999);

              const snap = await getDocs(query(
                collection(firestoreDb, 'appointments'),
                where('doctorId',        '==', uid),
                where('appointmentDate', '>=', Timestamp.fromDate(start)),
                where('appointmentDate', '<=', Timestamp.fromDate(end)),
                where('status',          'in', ['pending', 'confirmed']),
              ));

              await Promise.all(snap.docs.map(d =>
                updateDoc(doc(firestoreDb, 'appointments', d.id), {
                  status:      'cancelled',
                  cancelledBy: 'doctor_emergency',
                  cancelledAt: serverTimestamp(),
                  updatedAt:   serverTimestamp(),
                }),
              ));

              Alert.alert('تم', `تم إلغاء ${snap.docs.length} موعد بنجاح.`);
              refresh();
            } catch (err) {
              Alert.alert('خطأ', 'تعذّر إلغاء المواعيد. حاول مجدداً.');
            } finally {
              setClearingDay(false);
            }
          },
        },
      ],
    );
  }, [uid, selectedDateStr, selectedDate, refresh]);

  // ── Action: navigate to patient record ───────────────────────────────────
  const handleViewChart = useCallback((appointment) => {
    navigation.navigate('PatientDetails', {
      appointment,
      patientId: appointment.patientId,
    });
  }, [navigation]);

  // ── Action: Accept pending appointment ───────────────────────────────────
  const handleAccept = useCallback(async (appointment) => {
    if (processingId) return;
    setProcessingId(appointment.id);
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        confirmedBy: 'doctor',
      });
      // onSnapshot auto-updates the card's status badge
    } catch (err) {
      console.error('[DoctorAppointments] accept error:', err);
      Alert.alert('Error', 'Could not accept the appointment. Please try again.');
    } finally {
      setProcessingId(null);
    }
  }, [processingId]);

  // ── Action: Decline pending appointment (with confirmation) ──────────────
  const handleDecline = useCallback((appointment) => {
    Alert.alert(
      'Decline Request',
      `Decline ${appointment.patientName || 'this patient'}'s appointment ` +
      `request on ${toDateStr(appointment.appointmentDate)} at ${formatTime12(appointment.appointmentTime)}?\n\n` +
      'The patient will be notified.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Yes, Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(appointment.id);
            try {
              await updateDoc(doc(db, 'appointments', appointment.id), {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                cancelledBy: 'doctor',
              });
            } catch (err) {
              console.error('[DoctorAppointments] decline error:', err);
              Alert.alert('Error', 'Could not decline the appointment. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  }, []);

  // ── Action: Mark appointment as completed ────────────────────────────────
  const handleMarkDone = useCallback(async (appointment) => {
    if (processingId) return;
    setProcessingId(appointment.id);
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[DoctorAppointments] markDone error:', err);
      Alert.alert('Error', 'Could not update the appointment.');
    } finally {
      setProcessingId(null);
    }
  }, [processingId]);

  // ── FlatList (date strip) callbacks ──────────────────────────────────────
  const pillKeyExtractor = useCallback((item) => toDateStr(item), []);

  const renderDayPill = useCallback(
    ({ item: date }) => {
      const dateStr  = toDateStr(date);
      const count    = appointmentsByDate.get(dateStr)?.length ?? 0;
      return (
        <DayPill
          date={date}
          isSelected={dateStr === selectedDateStr}
          isToday={dateStr === todayStr}
          dotVisible={count > 0}
          onPress={() => handleDateSelect(date)}
        />
      );
    },
    [selectedDateStr, todayStr, appointmentsByDate, handleDateSelect],
  );

  // ── FlatList (appointments) callbacks ────────────────────────────────────
  const apptKeyExtractor = useCallback((item) => item.id, []);

  const renderAppointment = useCallback(
    ({ item }) => (
      <AppointmentCard
        item={item}
        processingId={processingId}
        onViewChart={handleViewChart}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onMarkDone={handleMarkDone}
      />
    ),
    [processingId, handleViewChart, handleAccept, handleDecline, handleMarkDone],
  );

  const renderEmpty = useCallback(
    () => (loading ? null : <EmptyDayState date={selectedDate} />),
    [loading, selectedDate],
  );

  const renderFooter = useCallback(
    () => <View style={{ height: insets.bottom + Spacing.lg }} />,
    [insets.bottom],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ── PAGE HEADER ────────────────────────────────────────────────────
          Static — stays pinned above both the date strip and the list.
      ─────────────────────────────────────────────────────────────────── */}
      <View style={S.pageHeader}>
        <View style={S.pageTitleRow}>
          <Text style={S.pageTitle}>Appointments</Text>
          {/* Emergency override — cancels all pending/confirmed for selected day */}
          <TouchableOpacity
            style={S.clearDayBtn}
            onPress={handleClearDay}
            disabled={clearingDay}
            activeOpacity={0.8}
            hitSlop={8}
          >
            {clearingDay
              ? <ActivityIndicator size="small" color={Colors.error} />
              : <><Ionicons name="warning-outline" size={14} color={Colors.error} />
                 <Text style={S.clearDayBtnText}> إلغاء اليوم</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* Week navigation row */}
        <View style={S.weekNav}>
          {/* Prev week — appears on LEFT in LTR, RIGHT in RTL */}
          <TouchableOpacity
            style={S.weekNavBtn}
            onPress={goToPrevWeek}
            activeOpacity={0.7}
            hitSlop={12}
          >
            <Ionicons name={PREV_ICON} size={20} color={Colors.text} />
          </TouchableOpacity>

          <Text style={S.weekRange}>{formatWeekRange(weekStart)}</Text>

          {/* Next week — appears on RIGHT in LTR, LEFT in RTL */}
          <TouchableOpacity
            style={S.weekNavBtn}
            onPress={goToNextWeek}
            activeOpacity={0.7}
            hitSlop={12}
          >
            <Ionicons name={NEXT_ICON} size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── DATE STRIP ─────────────────────────────────────────────────────
          Horizontal FlatList — different axis from the appointment FlatList
          below, so no VirtualizedList nesting warning. Stays fixed above
          the appointment list.
      ─────────────────────────────────────────────────────────────────── */}
      <View style={S.stripWrap}>
        <FlatList
          ref={stripRef}
          data={weekDays}
          keyExtractor={pillKeyExtractor}
          renderItem={renderDayPill}
          horizontal
          showsHorizontalScrollIndicator={false}
          getItemLayout={getDatePillLayout}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            stripRef.current?.scrollToOffset({
              offset: Spacing.md + averageItemLength * index,
              animated: true,
            });
          }}
          contentContainerStyle={S.stripContent}
        />
      </View>

      {/* ── APPOINTMENT COUNT SUBTITLE ─────────────────────────────────── */}
      <View style={S.countRow}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Text style={S.countText}>
            {dayAppointments.length === 0
              ? 'No appointments'
              : `${dayAppointments.length} appointment${dayAppointments.length > 1 ? 's' : ''}`}
          </Text>
        )}
      </View>

      {/* ── APPOINTMENT LIST ───────────────────────────────────────────────
          Vertical FlatList — fills the remaining flex space. RefreshControl
          forces a new onSnapshot subscription to get server-fresh data.
      ─────────────────────────────────────────────────────────────────── */}
      <FlatList
        data={loading ? [] : dayAppointments}
        keyExtractor={apptKeyExtractor}
        renderItem={renderAppointment}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={S.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={false} // avoid blank-card glitch on iOS
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// RTL RULE: Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right,
// or positional left/right. Logical properties exclusively.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root ─────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Page Header ───────────────────────────────────────────────────────────
  pageHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  pageTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  clearDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  clearDayBtnText: {
    fontSize: FontSizes.xs,
    color: Colors.error,
    fontWeight: '600',
  },

  // Week navigation: [← prev] [Mar 3–9, 2026] [next →]
  // In RTL flex-row reversal this correctly becomes: [next →] [range] [← prev]
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRange: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },

  // ── Date Strip ────────────────────────────────────────────────────────────
  stripWrap: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  stripContent: {
    paddingStart: Spacing.md, // logical — matches paddingEnd below
    paddingEnd: Spacing.md,
  },

  // Day pill — fixed slot so getItemLayout is exact
  dayPill: {
    width: DAY_PILL_W,
    marginHorizontal: PILL_MX, // symmetric — RTL-safe
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  dayPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayPillWeekday: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayPillNum: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  dayPillTextActive: {
    color: Colors.white,
  },
  // Small dot indicator
  dayPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'transparent',
  },
  dayPillDotVisible: {
    backgroundColor: Colors.primary,
  },
  dayPillDotActive: {
    backgroundColor: Colors.white + 'AA',
  },

  // ── Count subtitle ────────────────────────────────────────────────────────
  countRow: {
    height: 32,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  countText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // ── Appointment List ──────────────────────────────────────────────────────
  listContent: {
    flexGrow: 1,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },

  // ── Appointment Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    // Shadow
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  cardMuted: {
    opacity: 0.55,
  },

  // Zone A — tappable navigation area
  cardTapArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardTimeCol: {
    width: 60,
    flexShrink: 0,
  },
  cardTime: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardPatientName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  cardReason: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  cardFamily: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  cardEnd: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  cardChevron: {
    marginTop: 2,
  },

  // Zone A/B separator
  actionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },

  // Zone B — action buttons
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingTop: Spacing.sm,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  acceptBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.error + '10',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
  },
  declineBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.error,
  },
  markDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '0F',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
  },
  markDoneBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Zone B loading row
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  processingText: {
    fontSize: FontSizes.sm,
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
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Patient Avatar ────────────────────────────────────────────────────────
  avatar: {
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Empty Day State ───────────────────────────────────────────────────────
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary + 'AA',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
