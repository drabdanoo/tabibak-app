/**
 * DoctorDashboardScreen — Phase 3: Doctor Core
 * (The Doctor's main dashboard / home tab)
 *
 * ── Architecture Notes ──────────────────────────────────────────────────────
 *
 * COMPOUND FIRESTORE QUERIES (two real-time listeners)
 * ─────────────────────────────────────────────────────
 *
 * LISTENER 1 — useTodaySchedule  →  "Today's Schedule" section
 *   Compound query:
 *     where('doctorId', '==', uid)
 *     where('appointmentDate', '==', todayStr)   ← 'YYYY-MM-DD'
 *     where('status', 'in', ['confirmed', 'completed'])
 *     orderBy('appointmentTime', 'asc')
 *
 *   Rationale: Shows the doctor their confirmed appointments for today in
 *   chronological order. Completed appointments stay visible (greyed out)
 *   so the doctor has a full picture of the day. Using onSnapshot means
 *   any status change (e.g., a nurse marking an appointment complete from
 *   another device) propagates instantly without a manual refresh.
 *
 * LISTENER 2 — usePendingRequests  →  "Pending Requests" horizontal carousel
 *   Compound query:
 *     where('doctorId', '==', uid)
 *     where('status', '==', 'pending')
 *     orderBy('appointmentDate', 'asc')
 *     orderBy('appointmentTime', 'asc')
 *
 *   Rationale: Surfaces ALL pending appointment requests across all future
 *   dates, ordered earliest-first (most urgent = first card). onSnapshot
 *   ensures that when the doctor accepts a request the card vanishes from
 *   the carousel immediately — no stale UI. Pending requests are kept
 *   separate from the schedule because an unconfirmed appointment is not
 *   yet "on the schedule"; it only enters the schedule view once accepted.
 *
 * UI LAYOUT STRATEGY
 * ──────────────────
 * Root container: <ScrollView> (vertical)
 *
 * 1. HEADER (static)
 *    Greeting + doctor name + today's date.
 *
 * 2. STATS ROW (horizontal ScrollView, 4 StatCards)
 *    Derived from live listener data — no extra Firestore reads.
 *    Cards: Today's Patients | Pending | Completed | Remaining.
 *
 * 3. PENDING REQUESTS (horizontal FlatList of action cards)
 *    A horizontal FlatList inside a vertical ScrollView is safe — they
 *    scroll on different axes, so there is no VirtualizedList nesting
 *    violation. Each card is fixed-width (PENDING_CARD_WIDTH = 280) with
 *    a visible peek of the next card to hint scrollability.
 *    Cards expose "Accept" (green) and "Decline" (red) actions.
 *
 * 4. TODAY'S SCHEDULE (vertical timeline rendered with .map())
 *    Rendered via Array.map() — NOT a nested FlatList — to avoid the
 *    VirtualizedList-inside-ScrollView warning. Each ScheduleItem is a
 *    three-column flex row: [time | dot+connector | content card].
 *    The dot+connector column uses only gap and flex — no directional
 *    positioning — so the timeline line correctly flips to the Arabic
 *    (RTL) side automatically.
 *
 * ACTION HANDLERS + PER-CARD LOADING
 * ─────────────────────────────────────
 * `processingId` state holds the Firestore ID of the appointment currently
 * being updated. PendingRequestCard reads this prop and replaces the
 * Accept/Decline button row with <ActivityIndicator> while the write is
 * in flight. Decline triggers Alert.alert() for confirmation before
 * executing the destructive write. MarkDone on schedule items uses the
 * same processingId channel.
 *
 * RTL COMPLIANCE
 * ──────────────
 * ⚠️  This app is in Arabic. Zero marginLeft/Right, paddingLeft/Right,
 * borderLeftWidth/Right, or positional left/right values. Logical
 * properties exclusively: marginStart/End, paddingStart/End,
 * borderStartWidth/EndWidth, start/end positioning.
 * The timeline renders correctly in both LTR and RTL via flex row reversal.
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
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Fixed width for each pending request card.
 * The visible peek of the next card tells the doctor the list is scrollable.
 */
const PENDING_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 300);

/** Accent colours for the four stat tiles. */
const STAT_ACCENTS = {
  today:     Colors.primary,
  pending:   Colors.warning,
  completed: '#22C55E',
  remaining: '#8B5CF6',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns time-appropriate greeting string. */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Returns today's date as 'YYYY-MM-DD' for Firestore equality queries. */
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

/** 'YYYY-MM-DD' → 'Mon, Jan 15, 2026' */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * '14:30' → '2:30 PM'
 * Handles strings already containing AM/PM gracefully.
 */
function formatTime12(timeStr) {
  if (!timeStr) return '—';
  if (/[AP]M/i.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

/** Returns first two uppercase initials from a name. */
function getInitials(name) {
  return (name ?? '')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

/** Friendly long date for the dashboard header. */
function formatTodayLong() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useTodaySchedule
 *
 * Real-time listener for the doctor's confirmed + completed appointments
 * today, ordered by appointmentTime ASC.
 */
function useTodaySchedule(uid) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const today = getTodayStr();
    const q = query(
      collection(db, 'appointments'),
      where('doctorId', '==', uid),
      where('appointmentDate', '==', today),
      where('status', 'in', ['confirmed', 'completed']),
      orderBy('appointmentTime', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSchedule(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useTodaySchedule]', err);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  return { schedule, loading };
}

/**
 * usePendingRequests
 *
 * Real-time listener for ALL pending appointment requests assigned to this
 * doctor, ordered by date and time (earliest first = most urgent).
 */
function usePendingRequests(uid) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'appointments'),
      where('doctorId', '==', uid),
      where('status', '==', 'pending'),
      orderBy('appointmentDate', 'asc'),
      orderBy('appointmentTime', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[usePendingRequests]', err);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  return { requests, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components  (module-scope for stable identity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StatCard
 *
 * Individual dashboard stat tile. `accent` colours the top border stripe,
 * icon, and value text so each tile is visually distinct at a glance.
 */
const StatCard = React.memo(({ icon, label, value, accent }) => (
  <View style={[S.statCard, { borderTopColor: accent }]}>
    <Ionicons name={icon} size={22} color={accent} />
    <Text style={[S.statValue, { color: accent }]}>{value}</Text>
    <Text style={S.statLabel}>{label}</Text>
  </View>
));

/**
 * SectionHeader
 *
 * Reusable section title row with an optional "See All" action on the end.
 */
const SectionHeader = React.memo(({ title, onSeeAll }) => (
  <View style={S.sectionHeader}>
    <Text style={S.sectionTitle}>{title}</Text>
    {!!onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7} hitSlop={12}>
        <Text style={S.seeAll}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
));

/**
 * PatientAvatar
 *
 * Initials fallback circle.
 */
const PatientAvatar = React.memo(({ name, size = 44 }) => (
  <View style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={S.avatarText}>{getInitials(name)}</Text>
  </View>
));

/**
 * PendingRequestCard
 *
 * Fixed-width card shown in the horizontal pending requests carousel.
 *
 * Loading state: when `processingId === item.id`, the Accept/Decline row
 * is replaced by an ActivityIndicator so the doctor gets clear visual
 * feedback that the specific card is being updated.
 */
const PendingRequestCard = React.memo(({ item, processingId, onAccept, onDecline }) => {
  const isProcessing = processingId === item.id;

  return (
    <View style={S.pendingCard}>
      {/* Patient row */}
      <View style={S.pendingCardHeader}>
        <PatientAvatar name={item.patientName} />
        <View style={S.pendingCardInfo}>
          <Text style={S.pendingPatientName} numberOfLines={1}>
            {item.patientName ?? 'Patient'}
          </Text>
          <View style={S.pendingMeta}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
            <Text style={S.pendingMetaText}>{formatDate(item.appointmentDate)}</Text>
            <View style={S.metaDot} />
            <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
            <Text style={S.pendingMetaText}>{formatTime12(item.appointmentTime)}</Text>
          </View>
        </View>
      </View>

      {/* Reason */}
      {!!item.reason && (
        <Text style={S.pendingReason} numberOfLines={2}>{item.reason}</Text>
      )}

      {/* Family member */}
      {item.bookingFor === 'family' && !!item.familyMemberName && (
        <View style={S.familyRow}>
          <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
          <Text style={S.familyText}>For: {item.familyMemberName}</Text>
        </View>
      )}

      <View style={S.pendingDivider} />

      {/* Action row / loading state */}
      {isProcessing ? (
        <View style={S.processingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={S.processingText}>Updating…</Text>
        </View>
      ) : (
        <View style={S.actionRow}>
          <TouchableOpacity
            style={S.acceptBtn}
            onPress={() => onAccept(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={15} color={Colors.white} />
            <Text style={S.acceptBtnText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={S.declineBtn}
            onPress={() => onDecline(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={15} color={Colors.error} />
            <Text style={S.declineBtnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

/**
 * ScheduleItem
 *
 * Single row in the today's schedule timeline.
 *
 * Three-column layout:
 *   [Time (68px)] [Dot + Connector (24px)] [Content Card (flex:1)]
 *
 * RTL behaviour: flexDirection:'row' auto-reverses in Arabic —
 *   LTR visual: Time | Dot | Content
 *   RTL visual: Content | Dot | Time
 * The dot and connecting line stay centred in their column on both sides.
 * No absolute left/right positioning needed.
 *
 * The connector (vertical line) uses flex:1 inside its column, so it
 * naturally extends to match the content card height regardless of the
 * number of lines of text. The last item hides its connector.
 */
const ScheduleItem = React.memo(({ item, isLast, processingId, onMarkDone }) => {
  const isCompleted  = item.status === 'completed';
  const isProcessing = processingId === item.id;
  const dotColor     = isCompleted ? '#6B7280' : Colors.primary;

  return (
    <View style={S.scheduleRow}>

      {/* ── Time column ─────────────────────────────────────────── */}
      <View style={S.timeCol}>
        <Text style={[S.timeStr, isCompleted && S.timeMuted]}>
          {formatTime12(item.appointmentTime)}
        </Text>
      </View>

      {/* ── Dot + connector column ──────────────────────────────── */}
      {/* flex column — dot at top, connector line fills remainder */}
      <View style={S.timelineCol}>
        <View style={[S.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={S.connector} />}
      </View>

      {/* ── Content card ────────────────────────────────────────── */}
      <View style={[S.scheduleCard, isCompleted && S.scheduleCardMuted, !isLast && S.scheduleCardGap]}>
        <View style={S.scheduleCardRow}>
          <PatientAvatar name={item.patientName} size={36} />
          <View style={S.scheduleCardInfo}>
            <Text style={S.schedulePatientName} numberOfLines={1}>
              {item.patientName ?? 'Patient'}
            </Text>
            {!!item.reason && (
              <Text style={S.scheduleReason} numberOfLines={1}>{item.reason}</Text>
            )}
          </View>

          {/* Completed badge or Mark Done button */}
          {isCompleted ? (
            <View style={S.doneBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <Text style={S.doneBadgeText}>Done</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[S.markDoneBtn, isProcessing && S.markDoneBtnDisabled]}
              onPress={() => onMarkDone(item)}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              {isProcessing
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={S.markDoneBtnText}>Mark Done</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Family member sub-line */}
        {item.bookingFor === 'family' && !!item.familyMemberName && (
          <View style={S.scheduleFamilyRow}>
            <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
            <Text style={S.familyText}>For: {item.familyMemberName}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

/** Shown inside the pending carousel when there are no pending requests. */
const PendingEmptyCard = React.memo(() => (
  <View style={S.emptyCard}>
    <Ionicons name="checkmark-circle-outline" size={40} color={Colors.primary} />
    <Text style={S.emptyCardTitle}>All caught up!</Text>
    <Text style={S.emptyCardSub}>No pending appointment requests.</Text>
  </View>
));

/** Shown in the schedule section when there are no appointments today. */
const ScheduleEmpty = React.memo(() => (
  <View style={S.scheduleEmpty}>
    <Ionicons name="calendar-outline" size={48} color={Colors.border} />
    <Text style={S.scheduleEmptyTitle}>No appointments today</Text>
    <Text style={S.scheduleEmptySub}>
      Enjoy the day or check pending requests above.
    </Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DoctorDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, userProfile } = useAuth();
  const uid = user?.uid;

  // ── Data ──────────────────────────────────────────────────────────────────
  const { schedule, loading: scheduleLoading } = useTodaySchedule(uid);
  const { requests, loading: requestsLoading } = usePendingRequests(uid);

  // ── Per-card action loading state ─────────────────────────────────────────
  // Holds the Firestore ID of the appointment currently being written.
  // PendingRequestCard and ScheduleItem both read this to show their
  // individual ActivityIndicator without affecting other cards.
  const [processingId, setProcessingId] = useState(null);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    today:     schedule.length,
    pending:   requests.length,
    completed: schedule.filter(a => a.status === 'completed').length,
    remaining: schedule.filter(a => a.status === 'confirmed').length,
  }), [schedule, requests]);

  // ── Greeting ──────────────────────────────────────────────────────────────
  const greeting  = getGreeting();
  const firstName = (userProfile?.fullName ?? user?.displayName ?? '').split(' ')[0] || 'Doctor';

  // ── Action: Accept pending request ────────────────────────────────────────
  // Executes updateDoc immediately — no confirmation needed for acceptance.
  // The onSnapshot listener removes the card from the pending carousel
  // and (if today) the newly confirmed appointment appears in the schedule.
  const handleAccept = useCallback(async (appointment) => {
    if (processingId) return; // block concurrent writes
    setProcessingId(appointment.id);
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        confirmedBy: 'doctor',
      });
    } catch (err) {
      console.error('[DoctorDashboard] accept error:', err);
      Alert.alert('Error', 'Could not accept the appointment. Please try again.');
    } finally {
      setProcessingId(null);
    }
  }, [processingId]);

  // ── Action: Decline pending request ───────────────────────────────────────
  // Shows a confirmation Alert before executing the destructive write.
  // processingId is only set AFTER the user confirms — no loading flicker
  // if the doctor taps "Keep" in the alert.
  const handleDecline = useCallback((appointment) => {
    Alert.alert(
      'Decline Request',
      `Decline ${appointment.patientName ?? 'this patient'}'s appointment ` +
      `request on ${formatDate(appointment.appointmentDate)}?\n\n` +
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
              console.error('[DoctorDashboard] decline error:', err);
              Alert.alert('Error', 'Could not decline the appointment. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  }, []);

  // ── Action: Mark appointment as done ──────────────────────────────────────
  const handleMarkDone = useCallback(async (appointment) => {
    if (processingId) return;
    setProcessingId(appointment.id);
    try {
      await updateDoc(doc(db, 'appointments', appointment.id), {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
      // onSnapshot updates the schedule item status instantly
    } catch (err) {
      console.error('[DoctorDashboard] markDone error:', err);
      Alert.alert('Error', 'Could not update the appointment.');
    } finally {
      setProcessingId(null);
    }
  }, [processingId]);

  // ── Pending FlatList callbacks ─────────────────────────────────────────────
  const pendingKeyExtractor = useCallback((item) => item.id, []);

  const renderPendingItem = useCallback(
    ({ item }) => (
      <PendingRequestCard
        item={item}
        processingId={processingId}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    ),
    [processingId, handleAccept, handleDecline],
  );

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const handleSeeAllAppointments = useCallback(() => {
    navigation.navigate('DoctorAppointments');
  }, [navigation]);

  // ── Full-screen initial loading ────────────────────────────────────────────
  if (scheduleLoading && requestsLoading) {
    return (
      <View style={[S.loadingScreen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <ActivityIndicator size="large" color={Colors.white} />
        <Text style={S.loadingScreenText}>Loading dashboard…</Text>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          S.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <View style={[S.header, { paddingTop: insets.top + Spacing.md }]}>
          <View style={S.headerText}>
            <Text style={S.greeting}>{greeting},</Text>
            <Text style={S.doctorFirstName}>Dr. {firstName}</Text>
            <Text style={S.headerDate}>{formatTodayLong()}</Text>
          </View>
          {/* Doctor avatar */}
          <View style={S.headerAvatar}>
            <Text style={S.headerAvatarText}>
              {getInitials(userProfile?.fullName ?? user?.displayName)}
            </Text>
          </View>
        </View>

        {/* ── STATS ROW ────────────────────────────────────────────────────── */}
        {/* Horizontal ScrollView — simple, no pagination needed for 4 tiles */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={S.statsRow}
        >
          <StatCard
            icon="people-outline"
            label="Today's Patients"
            value={stats.today}
            accent={STAT_ACCENTS.today}
          />
          <StatCard
            icon="time-outline"
            label="Pending Requests"
            value={stats.pending}
            accent={STAT_ACCENTS.pending}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="Completed"
            value={stats.completed}
            accent={STAT_ACCENTS.completed}
          />
          <StatCard
            icon="calendar-outline"
            label="Remaining"
            value={stats.remaining}
            accent={STAT_ACCENTS.remaining}
          />
        </ScrollView>

        {/* ── PENDING REQUESTS ─────────────────────────────────────────────── */}
        <SectionHeader
          title="Pending Requests"
          onSeeAll={requests.length > 0 ? handleSeeAllAppointments : undefined}
        />

        {requestsLoading ? (
          <View style={S.sectionLoadingWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : requests.length === 0 ? (
          <PendingEmptyCard />
        ) : (
          /*
           * Horizontal FlatList inside vertical ScrollView — safe because
           * they scroll on different axes (no VirtualizedList nesting warning).
           */
          <FlatList
            horizontal
            data={requests}
            keyExtractor={pendingKeyExtractor}
            renderItem={renderPendingItem}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={S.pendingList}
            snapToInterval={PENDING_CARD_WIDTH + Spacing.md}
            decelerationRate="fast"
            // FlatList performance props
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
          />
        )}

        {/* ── TODAY'S SCHEDULE ─────────────────────────────────────────────── */}
        <SectionHeader
          title="Today's Schedule"
          onSeeAll={handleSeeAllAppointments}
        />

        <View style={S.scheduleWrap}>
          {scheduleLoading ? (
            <View style={S.sectionLoadingWrap}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : schedule.length === 0 ? (
            <ScheduleEmpty />
          ) : (
            /*
             * .map() instead of a nested FlatList to avoid VirtualizedList-
             * inside-ScrollView warning. The list is bounded (max ~20 items
             * per day), so the performance trade-off is acceptable.
             */
            schedule.map((item, index) => (
              <ScheduleItem
                key={item.id}
                item={item}
                isLast={index === schedule.length - 1}
                processingId={processingId}
                onMarkDone={handleMarkDone}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// RTL RULE: Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right,
// or positional left/right. Logical properties exclusively.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root ────────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Initial loading screen ──────────────────────────────────────────────────
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingScreenText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  // Green band that contains the greeting and doctor avatar.
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: FontSizes.sm,
    color: Colors.white + 'CC',
    fontWeight: '500',
  },
  doctorFirstName: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.white,
  },
  headerDate: {
    fontSize: FontSizes.xs,
    color: Colors.white + 'AA',
    marginTop: 2,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.white + '30',
    borderWidth: 2,
    borderColor: Colors.white + '60',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerAvatarText: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.white,
  },

  // ── Stats Row ────────────────────────────────────────────────────────────────
  statsRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    // Pull cards up into the green header band for a layered look
    marginTop: -Spacing.lg,
  },
  statCard: {
    width: 110,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderTopWidth: 4,
    padding: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'flex-start',
    // Elevation
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // ── Section Header ───────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAll: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── Section loading placeholder ──────────────────────────────────────────────
  sectionLoadingWrap: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Pending Request Cards ────────────────────────────────────────────────────
  pendingList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  pendingCard: {
    width: PENDING_CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    // Elevation
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pendingCardInfo: {
    flex: 1,
    gap: 4,
  },
  pendingPatientName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  pendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  pendingMetaText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.border,
  },
  pendingReason: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  familyText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  pendingDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },

  // Processing row — replaces action buttons while write is in flight
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  processingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // Accept / Decline action row
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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

  // Pending empty card (when no requests)
  emptyCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  emptyCardTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyCardSub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Patient Avatar ───────────────────────────────────────────────────────────
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

  // ── Today's Schedule Timeline ────────────────────────────────────────────────
  scheduleWrap: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // Each timeline row: [Time] [Dot+Line] [Card]
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 64,
  },

  // Time column — fixed width so all dots align on the same axis
  timeCol: {
    width: 64,
    paddingTop: 10,          // vertically aligns the time with the dot
    alignItems: 'flex-end', // text flush to the connector column
    paddingEnd: Spacing.sm,
  },
  timeStr: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  timeMuted: {
    color: Colors.textSecondary,
  },

  // Dot + connector column — centred between time and content
  timelineCol: {
    width: 20,
    alignItems: 'center',
    // Stretch to full height of the row so the connector fills it
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 10, // aligns with the time text baseline
    zIndex: 1,
    // White ring to separate dot from connector line
    borderWidth: 2,
    borderColor: Colors.white,
  },
  // Vertical connecting line from this dot to the next — flex:1 makes it
  // grow to exactly the content card height, connecting dots cleanly.
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: 2,
  },

  // Content card — fills remaining width; bottom gap aligns with connector
  scheduleCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginStart: Spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  // Bottom gap so the connector line has visible space between cards
  scheduleCardGap: {
    marginBottom: Spacing.sm,
  },
  scheduleCardMuted: {
    opacity: 0.6,
  },
  scheduleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scheduleCardInfo: {
    flex: 1,
    gap: 2,
  },
  schedulePatientName: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  scheduleReason: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  scheduleFamilyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingStart: 44, // aligns under patient name (avatar width + gap)
  },

  // "Done" badge — shown on completed schedule items
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  doneBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
  },

  // "Mark Done" button — shown on confirmed schedule items
  markDoneBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary + '50',
    backgroundColor: Colors.primary + '0C',
    minWidth: 80,
    alignItems: 'center',
    flexShrink: 0,
  },
  markDoneBtnDisabled: {
    opacity: 0.5,
  },
  markDoneBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Schedule empty state
  scheduleEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  scheduleEmptyTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  scheduleEmptySub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
});
