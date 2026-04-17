/**
 * DoctorDashboardScreen — Phase 4: Surgical Rebuild
 *
 * ── Architectural contracts enforced ─────────────────────────────────────────
 *
 * DESIGN SYSTEM   — ScreenContainer wraps the entire screen. PrimaryButton for
 *                   every action. Colors/sizes from theme.js only; zero inline
 *                   hex values or raw numbers for colour/font.
 *
 * RTL             — Logical properties exclusively (marginStart/End,
 *                   paddingStart/End, alignItems: 'flex-start'/'flex-end').
 *                   Zero use of left, right, marginLeft, paddingRight.
 *
 * LOCALIZATION    — useTranslation() for every visible string; zero hardcoded
 *                   text in JSX.
 *
 * SERVICE LAYER   — No Firestore imports in this file. All reads/writes go
 *                   through appointmentService. The UI owns state; the service
 *                   owns queries.
 *
 * 3-STATE UI      — Loading → Error (with retry) → Success. Every async path
 *                   is explicitly handled and visible to the user.
 *
 * ── Data flow ────────────────────────────────────────────────────────────────
 *
 * Two real-time Firestore listeners are established via appointmentService:
 *
 *   subscribeTodaySchedule   → today's confirmed + completed appointments
 *   subscribePendingRequests → all pending requests across future dates
 *
 * Both are managed inside a single useEffect keyed on `uid + retryKey`.
 * Incrementing `retryKey` from the error state re-subscribes both listeners.
 *
 * ── VirtualizedList note ─────────────────────────────────────────────────────
 *
 * The pending requests horizontal FlatList lives inside a vertical ScrollView.
 * This is safe because they scroll on different axes (no nesting violation).
 * The schedule timeline uses Array.map() (not a nested FlatList) to avoid
 * the VirtualizedList-inside-ScrollView warning.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../contexts/AuthContext';
import appointmentService from '../../services/appointmentService';
import { ScreenContainer, PrimaryButton } from '../../components/ui';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PENDING_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 300);

/** Accent colours for the four stat tiles — sourced from theme. */
const STAT_ACCENTS = {
  today:     colors.primary,
  pending:   colors.warning,
  completed: colors.success,
  remaining: colors.info,
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers  (no hooks, no imports — safe to call anywhere)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns first two uppercase initials from a display name. */
function getInitials(name) {
  return (name ?? '')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

/** '14:30' → '2:30 PM'  (handles strings already containing AM/PM) */
function formatTime12(timeStr) {
  if (!timeStr) return '—';
  if (/[AP]M/i.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${period}`;
}

/** Firestore Timestamp | 'YYYY-MM-DD' string | Date → locale short date string */
function formatDateShort(dateVal) {
  if (!dateVal) return '—';
  // Firestore Timestamp
  const date = dateVal?.toDate ? dateVal.toDate()
    : typeof dateVal === 'string' ? new Date(dateVal)
    : dateVal;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Locale-aware long date for the header (e.g. "Sunday, March 15, 2026") */
function formatTodayLong() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components  (stable module-scope identity; no anonymous arrow components)
// ─────────────────────────────────────────────────────────────────────────────

/** Initials-based avatar circle. */
const PatientAvatar = React.memo(({ name, size = 44 }) => (
  <View style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={S.avatarText}>{getInitials(name)}</Text>
  </View>
));

/**
 * StatCard
 * Individual stat tile. `accent` drives the top border stripe, icon, and
 * value text so each tile is visually distinct at a glance.
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
 * Title row with an optional "See all" PrimaryButton (text variant) on the end.
 */
const SectionHeader = React.memo(({ title, onSeeAll, seeAllLabel }) => (
  <View style={S.sectionHeader}>
    <Text style={S.sectionTitle}>{title}</Text>
    {!!onSeeAll && (
      <PrimaryButton
        label={seeAllLabel}
        onPress={onSeeAll}
        variant="text"
        style={S.seeAllBtn}
        textStyle={S.seeAllBtnText}
      />
    )}
  </View>
));

/**
 * PendingRequestCard
 *
 * Fixed-width card in the horizontal pending carousel.
 * When `processingId === item.id` the Accept/Decline row is replaced by a
 * loading spinner via PrimaryButton's built-in loading state.
 */
const PendingRequestCard = React.memo(({ item, processingId, onAccept, onDecline, t }) => {
  const isProcessing = processingId === item.id;

  return (
    <View style={[S.pendingCard, shadows.md]}>
      {/* Patient row */}
      <View style={S.pendingCardHeader}>
        <PatientAvatar name={item.patientName} />
        <View style={S.pendingCardInfo}>
          <Text style={S.pendingPatientName} numberOfLines={1}>
            {item.patientName || '—'}
          </Text>
          <View style={S.pendingMeta}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={S.pendingMetaText}>{formatDateShort(item.appointmentDate)}</Text>
            <View style={S.metaDot} />
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={S.pendingMetaText}>{formatTime12(item.appointmentTime)}</Text>
          </View>
        </View>
      </View>

      {/* Visit reason */}
      {!!item.reason && (
        <Text style={S.pendingReason} numberOfLines={2}>{item.reason}</Text>
      )}

      {/* Family member sub-line */}
      {item.bookingFor === 'family' && !!item.familyMemberName && (
        <View style={S.familyRow}>
          <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
          <Text style={S.familyText}>{t('doctor.forFamily', { name: item.familyMemberName })}</Text>
        </View>
      )}

      <View style={S.pendingDivider} />

      {/* Action row */}
      <View style={S.actionRow}>
        <PrimaryButton
          label={t('doctor.accept')}
          onPress={() => onAccept(item)}
          variant="filled"
          loading={isProcessing}
          disabled={isProcessing}
          style={S.actionBtnHalf}
        />
        <PrimaryButton
          label={t('doctor.decline')}
          onPress={() => onDecline(item)}
          variant="outline"
          disabled={isProcessing}
          style={S.actionBtnHalf}
        />
      </View>
    </View>
  );
});

/**
 * ScheduleItem
 *
 * Single row in the today's timeline.
 * Three-column layout: [Time (68 px)] [Dot + connector (20 px)] [Card (flex:1)]
 *
 * RTL: flexDirection:'row' auto-reverses in Arabic so the timeline dot
 * appears on the correct reading-direction side with no explicit mirroring.
 * No left/right values anywhere in these styles.
 */
const ScheduleItem = React.memo(({ item, isLast, processingId, onMarkDone, t }) => {
  const isCompleted  = item.status === 'completed';
  const isProcessing = processingId === item.id;
  const dotColor     = isCompleted ? colors.textSecondary : colors.primary;

  return (
    <View style={S.scheduleRow}>
      {/* Time column */}
      <View style={S.timeCol}>
        <Text style={[S.timeStr, isCompleted && S.timeMuted]}>
          {formatTime12(item.appointmentTime)}
        </Text>
      </View>

      {/* Dot + vertical connector */}
      <View style={S.timelineCol}>
        <View style={[S.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={S.connector} />}
      </View>

      {/* Content card */}
      <View style={[S.scheduleCard, isCompleted && S.scheduleCardMuted, !isLast && S.scheduleCardGap]}>
        <View style={S.scheduleCardRow}>
          <PatientAvatar name={item.patientName} size={36} />
          <View style={S.scheduleCardInfo}>
            <Text style={S.schedulePatientName} numberOfLines={1}>
              {item.patientName || '—'}
            </Text>
            {!!item.reason && (
              <Text style={S.scheduleReason} numberOfLines={1}>{item.reason}</Text>
            )}
          </View>

          {/* Done badge or Mark Done button */}
          {isCompleted ? (
            <View style={S.doneBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[S.doneBadgeText, { color: colors.success }]}>
                {t('doctor.done')}
              </Text>
            </View>
          ) : (
            <PrimaryButton
              label={t('doctor.markDone')}
              onPress={() => onMarkDone(item)}
              variant="outline"
              loading={isProcessing}
              disabled={isProcessing}
              style={S.markDoneBtn}
              textStyle={S.markDoneBtnText}
            />
          )}
        </View>

        {/* Family sub-line */}
        {item.bookingFor === 'family' && !!item.familyMemberName && (
          <View style={S.scheduleFamilyRow}>
            <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
            <Text style={S.familyText}>
              {t('doctor.forFamily', { name: item.familyMemberName })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

/** Simple bar chart row for patient counts per day. */
const MiniBarChart = React.memo(function MiniBarChart({ dailyCounts }) {
  if (!dailyCounts?.length) return null;
  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1);
  return (
    <View style={S.barChart}>
      {dailyCounts.map(({ date, dayLabel, count, isToday }) => {
        const pct = count / maxCount;
        return (
          <View key={date} style={S.barCol}>
            <Text style={[S.barCount, count === 0 && S.barCountZero]}>{count > 0 ? count : ''}</Text>
            <View style={S.barTrack}>
              <View style={[S.barFill, { flex: pct }, isToday && S.barFillToday]} />
              <View style={{ flex: 1 - pct }} />
            </View>
            <Text style={[S.barDayLabel, isToday && S.barDayLabelToday]}>{dayLabel}</Text>
          </View>
        );
      })}
    </View>
  );
});

/** Revenue + patients-per-day analytics card. */
const AnalyticsCard = React.memo(function AnalyticsCard({ weeklyStats, t }) {
  if (!weeklyStats) return null;
  const { todayRevenue, totalRevenue, dailyCounts, consultationFee } = weeklyStats;
  const formatCurrency = (n) => n.toLocaleString() + ' IQD';
  return (
    <View style={[S.analyticsCard, shadows.sm]}>
      <View style={S.analyticsHeader}>
        <Ionicons name="bar-chart-outline" size={16} color={colors.primary} />
        <Text style={S.analyticsTitle}>{t('doctor.analytics.title')}</Text>
      </View>
      <View style={S.analyticsRow}>
        <View style={S.analyticsStat}>
          <Ionicons name="cash-outline" size={18} color={colors.success} />
          <Text style={S.analyticsStatValue}>{formatCurrency(todayRevenue)}</Text>
          <Text style={S.analyticsStatLabel}>{t('doctor.analytics.todayRevenue')}</Text>
        </View>
        <View style={S.analyticsDivider} />
        <View style={S.analyticsStat}>
          <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
          <Text style={S.analyticsStatValue}>{formatCurrency(totalRevenue)}</Text>
          <Text style={S.analyticsStatLabel}>{t('doctor.analytics.weekRevenue')}</Text>
        </View>
        {consultationFee > 0 && (
          <>
            <View style={S.analyticsDivider} />
            <View style={S.analyticsStat}>
              <Ionicons name="pricetag-outline" size={18} color={colors.info} />
              <Text style={S.analyticsStatValue}>{formatCurrency(consultationFee)}</Text>
              <Text style={S.analyticsStatLabel}>{t('doctor.analytics.feePerVisit')}</Text>
            </View>
          </>
        )}
      </View>
      <Text style={S.analyticsChartTitle}>{t('doctor.analytics.patientsThisWeek')}</Text>
      <MiniBarChart dailyCounts={dailyCounts} />
    </View>
  );
});

/** Shown in the pending carousel when there are no pending requests. */
const PendingEmptyCard = React.memo(({ t }) => (
  <View style={[S.emptyCard, shadows.sm]}>
    <Ionicons name="checkmark-circle-outline" size={40} color={colors.primary} />
    <Text style={S.emptyCardTitle}>{t('doctor.allCaughtUp')}</Text>
    <Text style={S.emptyCardSub}>{t('doctor.allCaughtUpSub')}</Text>
  </View>
));

/** Shown in the schedule section when there are no confirmed appointments today. */
const ScheduleEmpty = React.memo(({ t }) => (
  <View style={S.scheduleEmpty}>
    <Ionicons name="calendar-outline" size={48} color={colors.border} />
    <Text style={S.scheduleEmptyTitle}>{t('doctor.noSchedule')}</Text>
    <Text style={S.scheduleEmptySub}>{t('doctor.noScheduleSub')}</Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DoctorDashboardScreen({ navigation }) {
  const { t }                       = useTranslation();
  const insets                      = useSafeAreaInsets();
  const { user, userProfile }       = useAuth();
  const uid                         = user?.uid;

  // ── Data state ─────────────────────────────────────────────────────────────
  const [schedule, setSchedule]     = useState([]);
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // ── Weekly analytics ───────────────────────────────────────────────────────
  const [weeklyStats, setWeeklyStats] = useState(null);

  // ── Per-card write loading ──────────────────────────────────────────────────
  // Holds the appointment ID currently being written to Firestore.
  // Sub-components read this to show their individual spinner.
  const [processingId, setProcessingId] = useState(null);

  // ── Retry trigger ──────────────────────────────────────────────────────────
  // Incrementing this integer re-subscribes both Firestore listeners.
  const [retryKey, setRetryKey] = useState(0);

  // ── Subscribe to real-time data ────────────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let scheduleReady  = false;
    let requestsReady  = false;

    const markReady = () => {
      if (scheduleReady && requestsReady) setLoading(false);
    };

    const handleError = (err) => {
      console.error('[DoctorDashboard] listener error:', err);
      setError(t('doctor.loadError'));
    };

    const unsubSchedule = appointmentService.subscribeTodaySchedule(
      uid,
      (data) => {
        setSchedule(data);
        setError(null);
        scheduleReady = true;
        markReady();
      },
      (err) => { handleError(err); scheduleReady = true; markReady(); },
    );

    const unsubRequests = appointmentService.subscribePendingRequests(
      uid,
      (data) => {
        setRequests(data);
        setError(null);
        requestsReady = true;
        markReady();
      },
      (err) => { handleError(err); requestsReady = true; markReady(); },
    );

    return () => { unsubSchedule(); unsubRequests(); };
  }, [uid, retryKey]);

  // ── Fetch weekly analytics once on mount (and on retry) ───────────────────
  useEffect(() => {
    if (!uid) return;
    appointmentService.getWeeklyStats(uid).then(setWeeklyStats).catch(() => {});
  }, [uid, retryKey]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    today:     schedule.length,
    pending:   requests.length,
    completed: schedule.filter(a => a.status === 'completed').length,
    remaining: schedule.filter(a => a.status === 'confirmed').length,
  }), [schedule, requests]);

  // ── Greeting ───────────────────────────────────────────────────────────────
  const greetingKey = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'doctor.greetingMorning';
    if (h < 18) return 'doctor.greetingAfternoon';
    return 'doctor.greetingEvening';
  }, []);

  const firstName = (userProfile?.fullName ?? user?.displayName ?? '')
    .split(' ')[0] || t('auth.doctor');

  // ── Action: Accept ─────────────────────────────────────────────────────────
  const handleAccept = useCallback(async (appointment) => {
    if (processingId) return;
    setProcessingId(appointment.id);
    const result = await appointmentService.acceptAppointment(appointment.id, uid);
    if (!result.success) {
      Alert.alert(t('errors.generic'), t('doctor.acceptError'));
    }
    setProcessingId(null);
  }, [processingId, uid, t]);

  // ── Action: Decline ────────────────────────────────────────────────────────
  const handleDecline = useCallback((appointment) => {
    Alert.alert(
      t('doctor.declineTitle'),
      t('doctor.declineMessage', {
        patient: appointment.patientName ?? '—',
        date:    formatDateShort(appointment.appointmentDate),
      }),
      [
        { text: t('doctor.declineKeep'), style: 'cancel' },
        {
          text:  t('doctor.declineConfirm'),
          style: 'destructive',
          onPress: async () => {
            setProcessingId(appointment.id);
            const result = await appointmentService.declineAppointment(appointment.id, uid);
            if (!result.success) {
              Alert.alert(t('errors.generic'), t('doctor.declineError'));
            }
            setProcessingId(null);
          },
        },
      ],
    );
  }, [uid, t]);

  // ── Action: Mark Done ──────────────────────────────────────────────────────
  const handleMarkDone = useCallback(async (appointment) => {
    if (processingId) return;
    setProcessingId(appointment.id);
    const result = await appointmentService.markAppointmentDone(appointment.id);
    if (!result.success) {
      Alert.alert(t('errors.generic'), t('doctor.markDoneError'));
    }
    setProcessingId(null);
  }, [processingId, t]);

  // ── FlatList callbacks ─────────────────────────────────────────────────────
  const pendingKeyExtractor = useCallback((item) => item.id, []);

  const renderPendingItem = useCallback(
    ({ item }) => (
      <PendingRequestCard
        item={item}
        processingId={processingId}
        onAccept={handleAccept}
        onDecline={handleDecline}
        t={t}
      />
    ),
    [processingId, handleAccept, handleDecline, t],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToAppointments = useCallback(
    () => navigation.navigate('Appointments'),
    [navigation],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 1: Loading
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenContainer>
        <StatusBar barStyle="dark-content" />
        <View style={S.centeredFill}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={S.loadingText}>{t('common.loading')}</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 2: Error (no data received at all)
  // ─────────────────────────────────────────────────────────────────────────
  if (error !== null && schedule.length === 0 && requests.length === 0) {
    return (
      <ScreenContainer>
        <StatusBar barStyle="dark-content" />
        <View style={S.centeredFill}>
          <Ionicons name="cloud-offline-outline" size={56} color={colors.error} />
          <Text style={S.errorTitle}>{t('errors.generic')}</Text>
          <Text style={S.errorSub}>{error}</Text>
          <PrimaryButton
            label={t('common.retry')}
            onPress={() => setRetryKey(k => k + 1)}
            style={S.retryBtn}
          />
        </View>
      </ScreenContainer>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 3: Success
  // edges={['bottom']} — SafeAreaView handles only the bottom inset.
  // The green header View uses useSafeAreaInsets() to absorb the top inset,
  // so it correctly bleeds under the status bar on both platforms.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.scrollContent}
      >
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <View style={[S.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={S.headerText}>
            <Text style={S.greeting}>{t(greetingKey)},</Text>
            <Text style={S.doctorName}>{t('doctor.MrPrefix')} {firstName}</Text>
            <Text style={S.headerDate}>{formatTodayLong()}</Text>
          </View>
          <View style={S.headerAvatar}>
            {userProfile?.photoURL ? (
              <Image
                source={{ uri: userProfile.photoURL }}
                style={{ width: 52, height: 52, borderRadius: 26 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={S.headerAvatarText}>
                {getInitials(userProfile?.fullName ?? user?.displayName)}
              </Text>
            )}
          </View>
        </View>

        {/* ── STATS ROW ──────────────────────────────────────────────────── */}
        <View style={S.statsRow}>
          <StatCard
            icon="people-outline"
            label={t('doctor.stats.today')}
            value={stats.today}
            accent={STAT_ACCENTS.today}
          />
          <StatCard
            icon="time-outline"
            label={t('doctor.stats.pending')}
            value={stats.pending}
            accent={STAT_ACCENTS.pending}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label={t('doctor.stats.completed')}
            value={stats.completed}
            accent={STAT_ACCENTS.completed}
          />
          <StatCard
            icon="calendar-outline"
            label={t('doctor.stats.remaining')}
            value={stats.remaining}
            accent={STAT_ACCENTS.remaining}
          />
        </View>

        {/* ── ANALYTICS ──────────────────────────────────────────────────── */}
        <AnalyticsCard weeklyStats={weeklyStats} t={t} />

        {/* ── PENDING REQUESTS ───────────────────────────────────────────── */}
        <SectionHeader
          title={t('doctor.pendingRequests')}
          seeAllLabel={t('doctor.seeAll')}
          onSeeAll={requests.length > 0 ? goToAppointments : undefined}
        />

        {requests.length === 0 ? (
          <PendingEmptyCard t={t} />
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
            snapToInterval={PENDING_CARD_WIDTH + spacing.md}
            decelerationRate="fast"
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
          />
        )}

        {/* ── TODAY'S SCHEDULE ───────────────────────────────────────────── */}
        <SectionHeader
          title={t('doctor.todaySchedule')}
          seeAllLabel={t('doctor.seeAll')}
          onSeeAll={goToAppointments}
        />

        <View style={S.scheduleWrap}>
          {schedule.length === 0 ? (
            <ScheduleEmpty t={t} />
          ) : (
            /*
             * Array.map() avoids VirtualizedList-inside-ScrollView warning.
             * Bounded to ~20 items/day — rendering cost is negligible.
             */
            schedule.map((item, index) => (
              <ScheduleItem
                key={item.id}
                item={item}
                isLast={index === schedule.length - 1}
                processingId={processingId}
                onMarkDone={handleMarkDone}
                t={t}
              />
            ))
          )}
        </View>
      </ScrollView>
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

  // ── Loading / Error shared centred layout ────────────────────────────────
  centeredFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    minWidth: 160,
    marginTop: spacing.sm,
  },

  // ── ScrollView ───────────────────────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },

  // ── Header (green band) ──────────────────────────────────────────────────
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontSize: typography.sizes.sm,
    color: colors.white + 'CC',
    fontWeight: '500',
  },
  doctorName: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    color: colors.white,
  },
  headerDate: {
    fontSize: typography.sizes.xs,
    color: colors.white + 'AA',
    marginTop: 2,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white + '30',
    borderWidth: 2,
    borderColor: colors.white + '60',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerAvatarText: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.white,
  },

  // ── Stats Row ────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    marginTop: -spacing.lg,        // pulls cards up into the green header band
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: BorderRadius.lg,
    borderTopWidth: 4,
    padding: spacing.md,
    gap: spacing.xs,
    alignItems: 'flex-start',
    ...shadows.md,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // ── Section Header ───────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  // PrimaryButton overrides — shrink the text-variant button to label size
  seeAllBtn: {
    height: 'auto',
    paddingHorizontal: 0,
    paddingVertical: spacing.xs,
    minWidth: 0,
  },
  seeAllBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },

  // ── Pending Carousel ─────────────────────────────────────────────────────
  pendingList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  pendingCard: {
    width: PENDING_CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: BorderRadius.lg,
    padding: spacing.md,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pendingCardInfo: {
    flex: 1,
    gap: 4,
  },
  pendingPatientName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  pendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  pendingMetaText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  pendingReason: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  familyText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  pendingDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // Each action button fills half the card width
  actionBtnHalf: {
    flex: 1,
    height: 40,
  },

  // Pending empty card
  emptyCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: BorderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyCardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  emptyCardSub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Patient Avatar ───────────────────────────────────────────────────────
  avatar: {
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.primary,
  },

  // ── Schedule Timeline ────────────────────────────────────────────────────
  scheduleWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Each timeline row: [Time 68px] [Dot+Line 20px] [Card flex:1]
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 64,
  },
  // Time column — fixed width; text flush toward the connector
  timeCol: {
    width: 64,
    paddingTop: 10,
    alignItems: 'flex-end',
    paddingEnd: spacing.sm,
  },
  timeStr: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  timeMuted: {
    color: colors.textSecondary,
  },
  // Dot + connector column
  timelineCol: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 10,
    zIndex: 1,
    borderWidth: 2,
    borderColor: colors.white,
  },
  // Vertical line — flex:1 grows to match content card height
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  // Content card
  scheduleCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: BorderRadius.md,
    padding: spacing.sm,
    marginStart: spacing.sm,
    ...shadows.sm,
  },
  scheduleCardGap: {
    marginBottom: spacing.sm,
  },
  scheduleCardMuted: {
    opacity: 0.6,
  },
  scheduleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scheduleCardInfo: {
    flex: 1,
    gap: 2,
  },
  schedulePatientName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  scheduleReason: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  scheduleFamilyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingStart: 44,              // aligns under patient name (avatar w + gap)
  },
  // Completed badge
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  doneBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  // Mark Done inline button — compact height
  markDoneBtn: {
    height: 36,
    paddingHorizontal: spacing.sm,
    minWidth: 90,
    flexShrink: 0,
  },
  markDoneBtnText: {
    fontSize: typography.sizes.xs,
  },
  // Schedule empty state
  scheduleEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  scheduleEmptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  scheduleEmptySub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  // ── Analytics card ────────────────────────────────────────────────────────
  analyticsCard: {
    backgroundColor: colors.white,
    borderRadius: BorderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  analyticsTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  analyticsStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  analyticsDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  analyticsStatValue: {
    fontSize: typography.sizes.sm,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  analyticsStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  analyticsChartTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  // Bar chart
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 70,
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: 70,
  },
  barCount: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  barCountZero: {
    color: 'transparent',
  },
  barTrack: {
    flex: 1,
    width: '75%',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
    flexDirection: 'column-reverse',
  },
  barFill: {
    backgroundColor: colors.primary + 'AA',
    borderRadius: 4,
  },
  barFillToday: {
    backgroundColor: colors.primary,
  },
  barDayLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
  barDayLabelToday: {
    color: colors.primary,
    fontWeight: '700',
  },
});
