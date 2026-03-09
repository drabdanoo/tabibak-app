/**
 * MyAppointmentsScreen — Phase 2: Patient Core
 * (The "Appointments" bottom-tab screen)
 *
 * ── Architecture Notes ──────────────────────────────────────────────────────
 *
 * DUAL FETCHING STRATEGY
 * ──────────────────────
 * Two logically separate data streams are exposed through one segmented
 * control. Each tab has a deliberately different data strategy.
 *
 * UPCOMING TAB  –  onSnapshot (real-time listener)
 *   Query : patientId == uid  AND  status in ['pending', 'confirmed']
 *   Order : appointmentDate ASC, appointmentTime ASC
 *
 *   Rationale: Real-time updates are critical here. When a receptionist or
 *   doctor confirms a pending request (status: 'pending' → 'confirmed'), the
 *   change must appear on the patient's screen immediately — no manual refresh
 *   needed. The unsubscribe function returned by onSnapshot is invoked on
 *   component unmount, guaranteeing no subscription leak.
 *
 *   When the patient cancels a Pending appointment the Firestore write sets
 *   status → 'cancelled'. Because the onSnapshot query filters to only
 *   ['pending','confirmed'], the document disappears from the snapshot
 *   automatically — zero manual state surgery required.
 *
 * PAST TAB  –  getDocs (one-time, cursor-paginated)
 *   Query : patientId == uid  AND  status in ['cancelled', 'completed']
 *   Order : appointmentDate DESC  |  PAGE_SIZE = 10
 *
 *   Rationale: Past and cancelled appointments are immutable from the
 *   patient's perspective. Attaching a live listener would burn Firestore
 *   read quota on empty snapshots that produce zero visible UI changes.
 *   Standard getDocs + startAfter cursor pagination covers the only meaningful
 *   interaction: scrolling back through appointment history. A RefreshControl
 *   provides an explicit escape hatch if the user wants fresh data.
 *
 *   The first fetch is deferred until the user first taps the "Past" tab
 *   (lazy initialisation via an `enabled` flag). This prevents paying for a
 *   Firestore read that many users will never trigger.
 *
 * SINGLE FLATLIST
 * ───────────────
 * One <FlatList> instance owns the scroll container for both tabs. Switching
 * tabs swaps only the `data` prop — React reconciles in-place, reusing the
 * underlying VirtualizedList core, recycled view pool, and scroll position
 * logic. There is no mount/unmount of list trees on every tab switch.
 *
 * The static page header (title + segmented tabs) lives in a sibling View
 * ABOVE the FlatList so it stays permanently visible no matter how far the
 * user has scrolled. This avoids stickyHeaderIndices and the edge cases it
 * introduces with pull-to-refresh.
 *
 * CANCEL CONFIRMATION
 * ───────────────────
 * A "Cancel Appointment" button is surfaced only on Pending appointments in
 * the Upcoming tab. Tapping it calls Alert.alert() with two choices:
 *   • "Keep Appointment" — dismisses the alert, no side effect.
 *   • "Yes, Cancel It"  — destructive style; fires the Firestore updateDoc
 *                         (status → 'cancelled') only after the user confirms.
 * The onSnapshot listener removes the document from the list automatically
 * the moment the write lands on the server — no optimistic update needed.
 *
 * RTL COMPLIANCE
 * ──────────────
 * ⚠️  This app is in Arabic. Zero marginLeft/Right, paddingLeft/Right,
 * borderLeftWidth/Right, or positional left/right values anywhere in this
 * file. All directional spacing uses logical properties exclusively:
 *   marginStart / marginEnd / paddingStart / paddingEnd /
 *   borderStartWidth / borderEndWidth / start / end
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
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
  onSnapshot,
  getDocs,
  startAfter,
  limit,
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

const PAGE_SIZE = 10;

/**
 * Visual configuration for each appointment status.
 * Pill background colour, text colour, and Ionicon name.
 */
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

/** 'YYYY-MM-DD' → 'Mon, Jan 15, 2026' */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Returns the first two uppercase initials from a name string. */
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
// Custom Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useUpcomingAppointments
 *
 * Attaches a real-time onSnapshot listener filtered to
 * status ∈ {pending, confirmed}. Unsubscribes automatically on unmount.
 */
function useUpcomingAppointments(uid) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'appointments'),
      where('patientId', '==', uid),
      where('status', 'in', ['pending', 'confirmed']),
      orderBy('appointmentDate', 'asc'),
      orderBy('appointmentTime', 'asc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useUpcomingAppointments] listener error:', err);
        setLoading(false);
      },
    );

    return unsub; // auto-unsubscribes on unmount
  }, [uid]);

  return { appointments, loading };
}

/**
 * usePastAppointments
 *
 * Lazy, cursor-paginated getDocs for status ∈ {cancelled, completed}.
 * The initial fetch is deferred until `enabled` first becomes true.
 *
 * Returns:
 *   appointments   – accumulated list (all pages fetched so far)
 *   loading        – true only on the very first page fetch
 *   loadingMore    – true when fetching a subsequent page
 *   refreshing     – true during pull-to-refresh reset
 *   hasMore        – false when the last page returned < PAGE_SIZE docs
 *   loadMore()     – append next page to appointments
 *   refresh()      – reset cursor and re-fetch page 1
 */
function usePastAppointments(uid, enabled) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Refs — changes to these must not trigger re-renders.
  const lastDocRef = useRef(null);
  const initialLoadDoneRef = useRef(false);

  /**
   * Core fetch function.
   * `reset: true` discards the cursor and starts from the beginning.
   * Returns the newly fetched items; does NOT mutate `appointments` state.
   */
  const fetchPage = useCallback(
    async ({ reset = false } = {}) => {
      if (!uid) return [];
      if (reset) lastDocRef.current = null;

      // Build constraint array dynamically to avoid duplicate query objects.
      const constraints = [
        where('patientId', '==', uid),
        where('status', 'in', ['cancelled', 'completed']),
        orderBy('appointmentDate', 'desc'),
        ...(lastDocRef.current ? [startAfter(lastDocRef.current)] : []),
        limit(PAGE_SIZE),
      ];

      const snap = await getDocs(
        query(collection(db, 'appointments'), ...constraints),
      );

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE_SIZE);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    [uid],
  );

  // Lazy initial load — fires once when `enabled` flips to true.
  useEffect(() => {
    if (!enabled || !uid || initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    setLoading(true);
    fetchPage()
      .then(items => setAppointments(items))
      .catch(err => console.error('[usePastAppointments] initial load:', err))
      .finally(() => setLoading(false));
  }, [enabled, uid, fetchPage]);

  /** Fetch and append the next cursor page. */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const items = await fetchPage();
      setAppointments(prev => [...prev, ...items]);
    } catch (err) {
      console.error('[usePastAppointments] loadMore:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchPage]);

  /** Reset cursor and re-fetch from page 1. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const items = await fetchPage({ reset: true });
      setAppointments(items);
    } catch (err) {
      console.error('[usePastAppointments] refresh:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  return {
    appointments,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    loadMore,
    refresh,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components  (module-scope for stable identity — never inline lambdas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pill-shaped status badge.
 * Background colour and icon are driven by STATUS_CONFIG.
 */
const StatusBadge = React.memo(({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <View style={[S.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <Text style={[S.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
});

/** Doctor initials fallback avatar. */
const DoctorAvatar = React.memo(({ name }) => (
  <View style={S.avatar}>
    <Text style={S.avatarText}>{getInitials(name)}</Text>
  </View>
));

/**
 * AppointmentCard
 *
 * Renders a single appointment row.
 * `onCancel` is non-null only for Upcoming-tab Pending appointments.
 * Cancelled cards receive a muted opacity treatment.
 */
const AppointmentCard = React.memo(({ item, onCancel }) => {
  const isCancelled = item.status === 'cancelled';
  const isPending   = item.status === 'pending';

  return (
    <View style={[S.card, isCancelled && S.cardMuted]}>

      {/* ── Header: avatar | doctor info | badge ───────────────── */}
      <View style={S.cardHeader}>
        <DoctorAvatar name={item.doctorName} />
        <View style={S.cardMeta}>
          <Text style={S.doctorName} numberOfLines={1}>
            {item.doctorName ?? 'Doctor'}
          </Text>
          {!!item.doctorSpecialty && (
            <Text style={S.doctorSpecialty} numberOfLines={1}>
              {item.doctorSpecialty}
            </Text>
          )}
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={S.divider} />

      {/* ── Date & time ────────────────────────────────────────── */}
      <View style={S.infoRow}>
        <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
        <Text style={S.infoText}>{formatDate(item.appointmentDate)}</Text>
        <View style={S.dot} />
        <Ionicons name="time-outline" size={14} color={Colors.primary} />
        <Text style={S.infoText}>{item.appointmentTime ?? '—'}</Text>
      </View>

      {/* ── Reason for visit ───────────────────────────────────── */}
      {!!item.reason && (
        <View style={S.infoRow}>
          <Ionicons name="clipboard-outline" size={14} color={Colors.textSecondary} />
          <Text style={S.reasonText} numberOfLines={2}>{item.reason}</Text>
        </View>
      )}

      {/* ── Family member label ────────────────────────────────── */}
      {item.bookingFor === 'family' && !!item.familyMemberName && (
        <View style={S.infoRow}>
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={S.familyText}>For: {item.familyMemberName}</Text>
        </View>
      )}

      {/* ── Cancel CTA — Pending + Upcoming tab only ───────────── */}
      {isPending && !!onCancel && (
        <TouchableOpacity
          style={S.cancelBtn}
          onPress={() => onCancel(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
          <Text style={S.cancelBtnText}>Cancel Appointment</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

/**
 * EmptyState
 *
 * Doubles as the loading indicator (when `loading` is true) and the genuine
 * empty-state view. Only rendered by the FlatList when data.length === 0.
 */
const EmptyState = React.memo(({ tab, loading, onFindDoctor }) => {
  if (loading) {
    return (
      <View style={S.centerWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={S.loadingText}>Loading appointments…</Text>
      </View>
    );
  }

  const isUpcoming = tab === 'upcoming';
  return (
    <View style={S.emptyWrap}>
      <Ionicons
        name={isUpcoming ? 'calendar-outline' : 'time-outline'}
        size={64}
        color={Colors.border}
      />
      <Text style={S.emptyTitle}>
        {isUpcoming ? 'No upcoming appointments' : 'No past appointments'}
      </Text>
      <Text style={S.emptySub}>
        {isUpcoming
          ? 'You have no pending or confirmed appointments right now.'
          : 'Your completed and cancelled appointments will appear here.'}
      </Text>
      {/* CTA only on the Upcoming empty state */}
      {isUpcoming && !!onFindDoctor && (
        <TouchableOpacity
          style={S.findBtn}
          onPress={onFindDoctor}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={16} color={Colors.white} />
          <Text style={S.findBtnText}>Find a Doctor</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

/** Inline spinner shown at the bottom of the Past list during pagination. */
const FooterLoader = React.memo(({ visible }) =>
  visible ? (
    <View style={S.footerLoader}>
      <ActivityIndicator size="small" color={Colors.primary} />
    </View>
  ) : null,
);

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MyAppointmentsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const uid = user?.uid;

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('upcoming');
  // pastEnabled flips to true on first visit to the Past tab.
  const [pastEnabled, setPastEnabled] = useState(false);
  const pastEnabledRef = useRef(false); // shadow ref — avoids stale closure in handler
  const listRef = useRef(null);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    // Scroll to top so the user sees the first item on the new tab.
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    // Lazy-init: start Past data loading on first visit.
    if (tab === 'past' && !pastEnabledRef.current) {
      pastEnabledRef.current = true;
      setPastEnabled(true);
    }
  }, []);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { appointments: upcoming, loading: upcomingLoading } =
    useUpcomingAppointments(uid);

  const {
    appointments: past,
    loading: pastLoading,
    loadingMore: pastLoadingMore,
    refreshing: pastRefreshing,
    hasMore: pastHasMore,
    loadMore: loadMorePast,
    refresh: refreshPast,
  } = usePastAppointments(uid, pastEnabled);

  const isUpcoming  = activeTab === 'upcoming';
  const listData    = isUpcoming ? upcoming : past;
  const listLoading = isUpcoming ? upcomingLoading : pastLoading;

  // ── Cancel confirmation ───────────────────────────────────────────────────
  const handleCancelPress = useCallback((appointment) => {
    Alert.alert(
      'Cancel Appointment',
      `Cancel your appointment with ${appointment.doctorName ?? 'the doctor'} on ` +
      `${formatDate(appointment.appointmentDate)} at ${appointment.appointmentTime ?? '—'}?\n\n` +
      'This action cannot be undone.',
      [
        { text: 'Keep Appointment', style: 'cancel' },
        {
          text: 'Yes, Cancel It',
          style: 'destructive',
          onPress: async () => {
            try {
              // Direct Firestore write — simple status update.
              // The onSnapshot listener auto-removes the document from the
              // Upcoming list as soon as the write propagates.
              await updateDoc(doc(db, 'appointments', appointment.id), {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                cancelledBy: 'patient',
              });
            } catch (err) {
              console.error('[MyAppointmentsScreen] cancel error:', err);
              Alert.alert(
                'Could Not Cancel',
                'An unexpected error occurred. Please try again.',
              );
            }
          },
        },
      ],
    );
  }, []);

  // ── Navigate to doctor search (empty-state CTA) ───────────────────────────
  const handleFindDoctor = useCallback(() => {
    navigation.navigate('DoctorList');
  }, [navigation]);

  // ── FlatList render callbacks ─────────────────────────────────────────────
  const keyExtractor = useCallback((item) => item.id, []);

  const renderItem = useCallback(
    ({ item }) => (
      <AppointmentCard
        item={item}
        // Only Upcoming-tab cards expose a cancel action.
        onCancel={isUpcoming ? handleCancelPress : null}
      />
    ),
    [isUpcoming, handleCancelPress],
  );

  const renderEmpty = useCallback(
    () => (
      <EmptyState
        tab={activeTab}
        loading={listLoading}
        onFindDoctor={handleFindDoctor}
      />
    ),
    [activeTab, listLoading, handleFindDoctor],
  );

  const renderFooter = useCallback(
    () => <FooterLoader visible={!isUpcoming && pastLoadingMore} />,
    [isUpcoming, pastLoadingMore],
  );

  const handleEndReached = useCallback(() => {
    // Pagination only applies to the Past tab.
    // Upcoming is fully served by the real-time listener.
    if (!isUpcoming && pastHasMore) loadMorePast();
  }, [isUpcoming, pastHasMore, loadMorePast]);

  // RefreshControl is meaningful only on the Past tab.
  const refreshControl = !isUpcoming ? (
    <RefreshControl
      refreshing={pastRefreshing}
      onRefresh={refreshPast}
      tintColor={Colors.primary}
      colors={[Colors.primary]}
    />
  ) : undefined;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* ── Static page header (title + segmented tabs) ──────────────────
          Rendered as a sibling above the FlatList so it remains fixed on
          screen regardless of how far the user has scrolled. This avoids
          stickyHeaderIndices and the edge-cases it causes with RefreshControl.
      ─────────────────────────────────────────────────────────────────── */}
      <View style={S.pageHeader}>
        <Text style={S.pageTitle}>My Appointments</Text>

        {/* Segmented control — pill trough pattern */}
        <View style={S.tabs}>
          {[
            { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
            { key: 'past',     label: 'Past',     icon: 'time-outline'     },
          ].map(({ key, label, icon }) => {
            const active = key === activeTab;
            return (
              <TouchableOpacity
                key={key}
                style={[S.tab, active && S.tabActive]}
                onPress={() => handleTabChange(key)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={icon}
                  size={15}
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

      {/* ── Appointment list ──────────────────────────────────────────────
          Single FlatList — data prop swaps on tab change, everything else
          stays mounted. VirtualizedList internals are preserved in-place.
      ─────────────────────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={refreshControl}
        contentContainerStyle={[
          S.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        // ── Performance knobs ──────────────────────────────────────────
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        // removeClippedSubviews causes blank flicker on iOS; safe on Android.
        removeClippedSubviews={Platform.OS === 'android'}
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
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Page Header ─────────────────────────────────────────────────────────────
  pageHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },

  // ── Segmented Tabs ──────────────────────────────────────────────────────────
  // Outer trough uses the app's background colour.
  // Active pill is white with a subtle shadow to lift it visually.
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: 3,
    gap: 3,
    marginBottom: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  tabActive: {
    backgroundColor: Colors.white,
    // Elevation — raises the active pill above the trough.
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  tabLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.primary,
  },

  // ── FlatList Container ──────────────────────────────────────────────────────
  listContent: {
    flexGrow: 1,
    paddingTop: Spacing.sm,
  },

  // ── Appointment Card ────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    // Native shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    // Android elevation
    elevation: 2,
  },
  // Cancelled + completed cards receive a desaturated treatment.
  cardMuted: {
    opacity: 0.65,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardMeta: {
    flex: 1,
  },

  // ── Doctor Avatar ───────────────────────────────────────────────────────────
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Doctor name / specialty ─────────────────────────────────────────────────
  doctorName: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  doctorSpecialty: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // ── Status Badge ────────────────────────────────────────────────────────────
  // borderRadius: 100 produces a true pill shape regardless of text length.
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Card Divider ────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },

  // ── Info Row (date / reason / family) ──────────────────────────────────────
  // flexWrap lets long dates + times wrap gracefully on small screens.
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  infoText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  // Mid-dot separator between date and time elements.
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginTop: 6, // vertically align with text cap-height
  },
  reasonText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  familyText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // ── Cancel Button ───────────────────────────────────────────────────────────
  // Only rendered for Pending appointments in the Upcoming tab.
  // Tinted red border and near-transparent background signal a destructive action.
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.error + '50',
    backgroundColor: Colors.error + '08',
  },
  cancelBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.error,
  },

  // ── Loading / Empty States ──────────────────────────────────────────────────
  // centerWrap: used for the initial-load ActivityIndicator.
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  // emptyWrap: genuine "no data" state.
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
    lineHeight: 22,
  },
  // "Find a Doctor" CTA — shown only in the Upcoming empty state.
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  findBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.white,
  },

  // ── Pagination Footer ───────────────────────────────────────────────────────
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
