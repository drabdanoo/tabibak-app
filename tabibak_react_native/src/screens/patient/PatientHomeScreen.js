/**
 * PatientHomeScreen — Phase 2: Patient Core
 *
 * ── Architecture Notes ─────────────────────────────────────────────────────
 *
 * Data Fetching:
 *   Three local custom hooks — no Firestore listeners dumped into Context.
 *
 *   • useDoctors({ specialty, searchText })
 *     SWR-style hook with cursor-based pagination (Firestore startAfter).
 *     Search is debounced 400 ms at the screen level before reaching the hook,
 *     so Firestore is never hit on every keystroke. Changing a filter resets
 *     the cursor and re-fetches page 1. loadMore() is guarded against races.
 *
 *   • useSpecialties()
 *     Single getDoc call against the metadata/specialties document (with
 *     in-service TTL cache). Falls back to full-collection scan if the
 *     metadata doc doesn't exist yet.
 *
 *   • useUpcomingAppointments(userId)
 *     onSnapshot listener — real-time because appointment status (confirmed /
 *     pending) can change while the patient is on this screen. Unsubscribes
 *     in the useEffect cleanup, keeping the listener strictly screen-scoped.
 *
 * List Performance:
 *   A single root <FlatList> owns the doctor cards. All non-list content
 *   (header, search bar, specialty pills, appointment chips, section label)
 *   lives in a stable React.memo ListHeaderComponent fed via a useMemo'd
 *   props object — no remounting on re-renders.
 *
 *   Specialty pills and appointment chips use *horizontal* FlatLists, which
 *   is safe (they scroll on a different axis, avoiding the VirtualizedList
 *   nesting violation that <ScrollView> would cause).
 *
 *   FlatList optimisation props used:
 *     keyExtractor (useCallback), renderItem (useCallback),
 *     initialNumToRender=8, windowSize=5, maxToRenderPerBatch=4,
 *     removeClippedSubviews (Android only), onEndReachedThreshold=0.5.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';
import { FEATURES } from '../../config/features';
import firestoreService from '../../services/firestoreService';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const PAGE_SIZE = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Custom Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SWR-style paginated doctor list.
 * fetchPage() is stable per {specialty, searchText} pair — changing either
 * produces a new reference that triggers the useEffect to restart from page 1.
 */
function useDoctors({ specialty, searchText }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(
    async (cursor, isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else if (!cursor) setLoading(true);
      else setLoadingMore(true);

      setError(null);

      const result = await firestoreService.getDoctors(
        { specialty, searchText },
        PAGE_SIZE,
        cursor,
      );

      if (result.success) {
        setDoctors(prev => (cursor ? [...prev, ...result.doctors] : result.doctors));
        setLastDoc(result.lastVisible ?? null);
        setHasMore(result.hasMore ?? false);
      } else {
        setError(result.error ?? 'Failed to load doctors.');
      }

      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    },
    // fetchPage re-creates when filters change → useEffect below detects the
    // new reference and re-fetches from page 1 automatically.
    [specialty, searchText],
  );

  useEffect(() => {
    setLastDoc(null);
    setHasMore(true);
    fetchPage(null, false);
  }, [fetchPage]);

  const refresh = useCallback(() => {
    setLastDoc(null);
    setHasMore(true);
    fetchPage(null, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !lastDoc) return;
    fetchPage(lastDoc, false);
  }, [fetchPage, lastDoc, hasMore, loadingMore]);

  return { doctors, loading, refreshing, loadingMore, error, refresh, loadMore };
}

/** Fetches specialty list once; relies on firestoreService's in-memory TTL cache. */
function useSpecialties() {
  const [specialties, setSpecialties] = useState(['All']);

  useEffect(() => {
    firestoreService.getSpecialties().then(result => {
      if (result.success && result.specialties?.length) {
        setSpecialties(result.specialties);
      }
    });
  }, []);

  return specialties;
}

/**
 * Reads config/appFlags from Firestore once on mount.
 * Flip showDoctors: true in Firebase Console to reveal doctors
 * for all users instantly — no app update required.
 *
 * Defaults to { showDoctors: false } if the document doesn't exist.
 */
function useRemoteFlags() {
  const [flags, setFlags] = useState({ showDoctors: false });

  useEffect(() => {
    const db = getFirestore();
    getDoc(doc(db, 'config', 'appFlags'))
      .then(snap => {
        if (snap.exists()) setFlags(snap.data());
      })
      .catch(() => {/* keep defaults on error */});
  }, []);

  return flags;
}

/**
 * Real-time listener for the patient's upcoming appointments.
 * Filters client-side for confirmed/pending appointments in the future,
 * caps at 3 items for the home-screen preview strip.
 * Listener is unsubscribed when the screen unmounts.
 */
function useUpcomingAppointments(userId) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const nowMs = Date.now();

    const unsubscribe = firestoreService.listenToAppointments(
      userId,
      'patient',
      allApts => {
        const upcoming = allApts
          .filter(apt => {
            const d = apt.appointmentDate?.toDate
              ? apt.appointmentDate.toDate()
              : new Date(apt.appointmentDate);
            return (
              d.getTime() >= nowMs &&
              (apt.status === 'confirmed' || apt.status === 'pending')
            );
          })
          .slice(0, 3);
        setAppointments(upcoming);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [userId]);

  return { appointments, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure presentational sub-components
// (defined at module scope so their identity is stable across re-renders)
// ─────────────────────────────────────────────────────────────────────────────

const StarRating = React.memo(({ rating = 0 }) => {
  const rounded = Math.round(rating);
  return (
    <View style={S.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rounded ? 'star' : 'star-outline'}
          size={11}
          color={i <= rounded ? Colors.warning : Colors.gray}
        />
      ))}
      <Text style={S.ratingText}>({rating.toFixed(1)})</Text>
    </View>
  );
});

const DoctorCard = React.memo(({ doctor, onPress, onBook }) => {
  const initials = (doctor.name || 'D')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const available = doctor.isAvailable !== false;

  return (
    <TouchableOpacity style={S.card} onPress={onPress} activeOpacity={0.97}>
      <View style={S.cardBody}>
        {/* ── Avatar ── */}
        {doctor.photoURL ? (
          <Image source={{ uri: doctor.photoURL }} style={S.avatar} />
        ) : (
          <View style={[S.avatar, S.avatarFallback]}>
            <Text style={S.avatarInitials}>{initials}</Text>
          </View>
        )}

        {/* ── Details ── */}
        <View style={S.cardDetails}>
          <View style={S.nameRow}>
            <Text style={S.doctorName} numberOfLines={1}>
              {doctor.name || 'Doctor'}
            </Text>
            <View style={[S.badge, available ? S.badgeGreen : S.badgeGray]}>
              <Text style={[S.badgeText, available ? S.badgeTextGreen : S.badgeTextGray]}>
                {available ? 'Available' : 'Busy'}
              </Text>
            </View>
          </View>

          <Text style={S.specialty} numberOfLines={1}>
            {doctor.specialty || 'General Practice'}
          </Text>

          <StarRating rating={doctor.averageRating ?? doctor.rating ?? 0} />

          <View style={S.metaRow}>
            {!!doctor.experience && (
              <View style={S.metaChip}>
                <Ionicons name="briefcase-outline" size={11} color={Colors.textSecondary} />
                <Text style={S.metaChipText}>{doctor.experience} yr exp</Text>
              </View>
            )}
            {!!doctor.city && (
              <View style={S.metaChip}>
                <Ionicons name="location-outline" size={11} color={Colors.textSecondary} />
                <Text style={S.metaChipText}>{doctor.city}</Text>
              </View>
            )}
            {!!doctor.consultationFee && (
              <View style={S.metaChip}>
                <Ionicons name="cash-outline" size={11} color={Colors.textSecondary} />
                <Text style={S.metaChipText}>${doctor.consultationFee}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── CTA ── */}
      <TouchableOpacity style={S.bookBtn} onPress={onBook} activeOpacity={0.85}>
        <Text style={S.bookBtnText}>Book Appointment</Text>
        <Ionicons name="arrow-forward-outline" size={14} color={Colors.white} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const AppointmentChip = React.memo(({ appointment }) => {
  const d = appointment.appointmentDate?.toDate
    ? appointment.appointmentDate.toDate()
    : new Date(appointment.appointmentDate);

  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const accent = appointment.status === 'confirmed' ? Colors.success : Colors.warning;

  return (
    <View style={[S.aptChip, { borderLeftColor: accent }]}>
      <Text style={S.aptDoctor} numberOfLines={1}>
        {appointment.doctorName || 'Doctor'}
      </Text>
      <Text style={S.aptDateTime}>{dateStr} · {timeStr}</Text>
      <View style={[S.aptStatusPill, { backgroundColor: accent + '22' }]}>
        <Text style={[S.aptStatusText, { color: accent }]}>
          {appointment.status}
        </Text>
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ListHeaderComponent
// Defined outside PatientHomeScreen so its type is stable across re-renders —
// React.memo ensures the DOM is only updated when prop values actually change.
// ─────────────────────────────────────────────────────────────────────────────

const PatientHomeHeader = React.memo(({
  userProfile,
  searchText,
  onSearchChange,
  onClearSearch,
  onSignOut,
  specialties,
  selectedSpecialty,
  onSelectSpecialty,
  appointments,
  aptLoading,
  onNavigateAppointments,
  onNavigateLabOrders,
  onNavigatePrescriptions,
  onNavigateMap,
  debouncedSearch,
  doctorCount,
  doctorsLoading,
  showDoctors,
}) => (
  <>
    {/* ── Hero Header ─────────────────────────────────────────────── */}
    <View style={S.header}>
      <View style={S.headerTop}>
        <View>
          <Text style={S.greeting}>Good day 👋</Text>
          <Text style={S.userName}>{userProfile?.fullName || 'Patient'}</Text>
        </View>
        <TouchableOpacity
          style={S.logoutBtn}
          onPress={onSignOut}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          activeOpacity={0.75}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search bar — only shown when doctors are visible */}
      {showDoctors && (
        <View style={S.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
          <TextInput
            style={S.searchInput}
            placeholder="Search doctors or specialties…"
            placeholderTextColor={Colors.gray}
            value={searchText}
            onChangeText={onSearchChange}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={onClearSearch}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={Colors.gray} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>

    {/* ── Specialty Filter Pills — only when doctors are visible ──── */}
    {showDoctors && (
      <FlatList
        horizontal
        data={specialties}
        keyExtractor={item => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.pillList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[S.pill, item === selectedSpecialty && S.pillActive]}
            onPress={() => onSelectSpecialty(item)}
            activeOpacity={0.75}
          >
            <Text style={[S.pillText, item === selectedSpecialty && S.pillTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    )}

    {/* ── Upcoming Appointments ────────────────────────────────────── */}
    {!aptLoading && appointments.length > 0 && (
      <View style={S.section}>
        <View style={S.sectionHeader}>
          <Text style={S.sectionTitle}>Upcoming</Text>
          <TouchableOpacity onPress={onNavigateAppointments}>
            <Text style={S.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          data={appointments}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingEnd: Spacing.lg }}
          renderItem={({ item }) => <AppointmentChip appointment={item} />}
        />
      </View>
    )}

    {/* ── Quick Access ─────────────────────────────────────────────── */}
    <View style={S.quickAccessGrid}>
      {/* ── FEATURE FLAG: Lab Orders card ── */}
      {FEATURES.LAB_ORDERS && (
        <TouchableOpacity style={S.quickCard} onPress={onNavigateLabOrders} activeOpacity={0.85}>
          <View style={[S.quickIcon, { backgroundColor: Colors.warning + '1A' }]}>
            <Ionicons name="flask-outline" size={22} color={Colors.warning} />
          </View>
          <Text style={S.quickLabel}>Lab Orders</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* ── FEATURE FLAG: Prescription Inbox card ── */}
      {FEATURES.PRESCRIPTION_INBOX && (
        <TouchableOpacity style={S.quickCard} onPress={onNavigatePrescriptions} activeOpacity={0.85}>
          <View style={[S.quickIcon, { backgroundColor: Colors.primary + '1A' }]}>
            <Ionicons name="document-text-outline" size={22} color={Colors.primary} />
          </View>
          <Text style={S.quickLabel}>Prescriptions</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Find Nearby map — only shown when doctors are visible */}
      {showDoctors && (
        <TouchableOpacity style={[S.quickCard, S.quickCardWide]} onPress={onNavigateMap} activeOpacity={0.85}>
          <View style={[S.quickIcon, { backgroundColor: Colors.secondary + '1A' }]}>
            <Ionicons name="map-outline" size={22} color={Colors.secondary} />
          </View>
          <Text style={S.quickLabel}>Find Nearby</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>

    {/* ── Doctors Section Label — only when doctors are visible ───── */}
    {showDoctors && (
      <View style={[S.sectionHeader, S.doctorsSectionLabel]}>
        <Text style={S.sectionTitle}>
          {debouncedSearch
            ? `Results for "${debouncedSearch}"`
            : selectedSpecialty === 'All'
              ? 'All Providers'
              : selectedSpecialty}
        </Text>
        {!doctorsLoading && (
          <Text style={S.countLabel}>{doctorCount} found</Text>
        )}
      </View>
    )}
  </>
));

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

const PatientHomeScreen = ({ navigation }) => {
  const { userProfile, signOut } = useAuth();
  const userId = userProfile?.id ?? userProfile?.uid;

  // ── Search with debounce ──────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback(text => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(text.trim()),
      400,
    );
  }, []);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchText('');
    setDebouncedSearch('');
  }, []);

  const [selectedSpecialty, setSelectedSpecialty] = useState('All');

  // ── Remote flags (Firestore — flip in Firebase Console, no build needed) ──
  const { showDoctors } = useRemoteFlags();

  // ── Data ─────────────────────────────────────────────────────────
  const specialties = useSpecialties();

  const { doctors, loading, refreshing, loadingMore, error, refresh, loadMore } =
    useDoctors({ specialty: selectedSpecialty, searchText: debouncedSearch });

  const { appointments, loading: aptLoading } = useUpcomingAppointments(userId);

  // ── Stable header props (only rebuild when values change) ─────────
  const headerProps = useMemo(
    () => ({
      userProfile,
      searchText,
      onSearchChange: handleSearchChange,
      onClearSearch: clearSearch,
      onSignOut: signOut,
      specialties,
      selectedSpecialty,
      onSelectSpecialty: setSelectedSpecialty,
      appointments,
      aptLoading,
      onNavigateAppointments: () => navigation.navigate('Appointments'),
      onNavigateLabOrders:    () => navigation.navigate('LabOrders'),
      onNavigatePrescriptions:() => navigation.navigate('PrescriptionInbox'),
      onNavigateMap:          () => navigation.navigate('DoctorMap'),
      debouncedSearch,
      doctorCount: doctors.length,
      doctorsLoading: loading,
      showDoctors,
    }),
    [
      userProfile, searchText, handleSearchChange, clearSearch, signOut,
      specialties, selectedSpecialty, appointments, aptLoading,
      debouncedSearch, doctors.length, loading, navigation, showDoctors,
    ],
  );

  // ── FlatList callbacks ────────────────────────────────────────────
  const keyExtractor = useCallback(item => item.id, []);

  const renderDoctor = useCallback(
    ({ item }) => (
      <DoctorCard
        doctor={item}
        onPress={() => navigation.navigate('DoctorDetails', { doctor: item, doctorId: item.id })}
        onBook={() => navigation.navigate('BookAppointment', { doctor: item })}
      />
    ),
    [navigation],
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    if (error) {
      return (
        <View style={S.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={S.emptyTitle}>Something went wrong</Text>
          <Text style={S.emptySub}>{error}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={refresh}>
            <Text style={S.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={S.emptyState}>
        <Ionicons name="people-outline" size={72} color={Colors.border} />
        <Text style={S.emptyTitle}>No doctors found</Text>
        <Text style={S.emptySub}>
          {debouncedSearch
            ? `No results for "${debouncedSearch}". Try a different search.`
            : 'No doctors are available for this specialty yet.'}
        </Text>
      </View>
    );
  }, [loading, error, debouncedSearch, refresh]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: Spacing.xxl }} />;
    return (
      <View style={S.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={S.footerText}>Loading more…</Text>
      </View>
    );
  }, [loadingMore]);

  // ── Initial loading splash ────────────────────────────────────────
  if (loading && doctors.length === 0 && !error) {
    return (
      <SafeAreaView style={S.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={S.header}>
          <View style={S.headerTop}>
            <View>
              <Text style={S.greeting}>Good day 👋</Text>
              <Text style={S.userName}>{userProfile?.fullName || 'Patient'}</Text>
            </View>
          </View>
        </View>
        <View style={S.loadingScreen}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={S.loadingText}>Finding doctors near you…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={S.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <FlatList
        data={showDoctors ? doctors : []}
        keyExtractor={keyExtractor}
        renderItem={renderDoctor}
        // Stable header element — React.memo on PatientHomeHeader prevents
        // unnecessary re-renders when unrelated state changes.
        ListHeaderComponent={<PatientHomeHeader {...headerProps} />}
        ListEmptyComponent={showDoctors ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        // ── Performance ──────────────────────────────────────────────
        initialNumToRender={8}
        windowSize={5}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={30}
        // removeClippedSubviews on Android only — causes visual glitches on iOS
        removeClippedSubviews={Platform.OS === 'android'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.listContainer}
      />
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContainer: {
    flexGrow: 1,
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSizes.sm,
    color: Colors.white,
    opacity: 0.85,
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    padding: 0,
  },

  // ── Specialty Pills ──────────────────────────────────────────────
  pillList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  pillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  // ── Section ──────────────────────────────────────────────────────
  section: {
    marginBottom: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  doctorsSectionLabel: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAll: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  countLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  // ── Quick Access Grid ─────────────────────────────────────────────
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  quickCard: {
    // takes ~48% of row width → 2 per row
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  quickCardWide: {
    // Map card spans full width on the second row
    flexBasis: '100%',
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },

  // ── Appointment Chip ─────────────────────────────────────────────
  aptChip: {
    width: 176,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginStart: Spacing.lg,
    borderStartWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  aptDoctor: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  aptDateTime: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  aptStatusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  aptStatusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // ── Doctor Card ──────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  cardBody: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    marginEnd: Spacing.md,
    backgroundColor: Colors.border,
  },
  avatarFallback: {
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'nowrap',
  },
  doctorName: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
  },
  badgeGreen: { backgroundColor: Colors.success + '1A' },
  badgeGray: { backgroundColor: Colors.border },
  badgeText: { fontSize: FontSizes.xs, fontWeight: '600' },
  badgeTextGreen: { color: Colors.success },
  badgeTextGray: { color: Colors.textSecondary },
  specialty: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginStart: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaChipText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  bookBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.white,
  },

  // ── Empty / Error ────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptySub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  retryBtnText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },

  // ── Loading ──────────────────────────────────────────────────────
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});

export default PatientHomeScreen;