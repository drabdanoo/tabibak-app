/**
 * NotificationsScreen.js — Receptionist Activity Feed (Phase 4)
 *
 * ╔══ ARCHITECTURE NOTES ═══════════════════════════════════════════════════════╗
 *
 * 1. DATA SOURCE — derived from the appointments collection
 * ──────────────────────────────────────────────────────────
 *   There is no separate 'notifications' collection in the data model.
 *   Instead, the activity feed is derived from recent appointment documents:
 *
 *   Query: appointments where createdAt >= 7 days ago, ordered by createdAt desc.
 *
 *   Each appointment = one notification entry. The current `status` field tells
 *   the story: a 'pending' appointment = "new booking received", 'cancelled' =
 *   "booking was cancelled", etc.
 *
 *   An onSnapshot listener keeps the feed live — if a booking is confirmed by
 *   the doctor, its card transitions from "في الانتظار" to "مؤكد" in real time.
 *
 * 2. GROUPING — SectionList by calendar day
 * ──────────────────────────────────────────
 *   useMemo groups the flat appointments array into SectionList sections:
 *     { title: 'اليوم', data: [...] }
 *     { title: 'البارحة', data: [...] }
 *     { title: 'الأربعاء، ٥ مارس', data: [...] }
 *
 * 3. PENDING BADGE — header count for appointments needing action
 * ───────────────────────────────────────────────────────────────
 *   A red badge in the screen header shows the count of 'pending' appointments
 *   from the fetched data (i.e., new bookings not yet confirmed/rejected).
 *
 * 4. RTL COMPLIANCE
 * ──────────────────
 *   marginStart / marginEnd    → never marginLeft / marginRight
 *   paddingStart / paddingEnd  → never paddingLeft / paddingRight
 *   borderStartWidth           → never borderLeftWidth
 *
 * ╚═════════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '../../config/firebase';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Notification display config keyed by appointment status */
const NOTIF_CONFIG = {
  pending: {
    icon:    'calendar-outline',
    color:   '#f59e0b',
    bg:      '#fef3c7',
    title:   'حجز جديد يحتاج تأكيد',
    urgent:  true,
  },
  confirmed: {
    icon:    'checkmark-circle-outline',
    color:   '#3b82f6',
    bg:      '#dbeafe',
    title:   'تم تأكيد الموعد',
    urgent:  false,
  },
  waiting: {
    icon:    'people-outline',
    color:   '#eab308',
    bg:      '#fef9c3',
    title:   'المريض في الاستقبال',
    urgent:  false,
  },
  in_progress: {
    icon:    'medical-outline',
    color:   '#8b5cf6',
    bg:      '#ede9fe',
    title:   'المريض مع الطبيب',
    urgent:  false,
  },
  completed: {
    icon:    'checkmark-done-outline',
    color:   Colors.primary,
    bg:      '#d1fae5',
    title:   'اكتمل الموعد',
    urgent:  false,
  },
  cancelled: {
    icon:    'close-circle-outline',
    color:   Colors.error,
    bg:      '#fee2e2',
    title:   'تم إلغاء الموعد',
    urgent:  false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** "اليوم" / "البارحة" / long date */
function dayLabel(date) {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString())     return 'اليوم';
  if (date.toDateString() === yesterday.toDateString()) return 'البارحة';
  return date.toLocaleDateString('ar-SA', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** "منذ X دقيقة/ساعة/يوم" — concise Arabic relative time */
function timeAgo(date) {
  const diffMs  = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (minutes < 1)  return 'الآن';
  if (minutes < 60) return `منذ ${minutes} د`;
  if (hours < 24)   return `منذ ${hours} س`;
  return `منذ ${days} ي`;
}

/** Returns a Timestamp for midnight 7 days ago */
function sevenDaysAgoTimestamp() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Single notification card */
const NotifCard = memo(({ appt }) => {
  const cfg  = NOTIF_CONFIG[appt.status] ?? NOTIF_CONFIG.pending;
  const date = appt.createdAt?.toDate?.() ?? new Date();
  const ago  = timeAgo(date);

  return (
    <View style={[styles.card, appt.isWalkIn && styles.cardWalkIn]}>
      {/* Icon */}
      <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Title row */}
        <View style={styles.cardTitleRow}>
          <Text style={[styles.notifTitle, cfg.urgent && styles.notifTitleUrgent]}>
            {cfg.title}
          </Text>
          {cfg.urgent && <View style={styles.urgentDot} />}
        </View>

        {/* Patient → Doctor */}
        <Text style={styles.cardBody} numberOfLines={1}>
          {appt.patientName ?? '—'}
          {'  →  '}
          {appt.doctorName ?? '—'}
        </Text>

        {/* Time + isWalkIn tag */}
        <View style={styles.cardMeta}>
          <Text style={styles.cardTime}>{ago}</Text>
          {appt.isWalkIn && (
            <View style={styles.walkInTag}>
              <Text style={styles.walkInTagText}>زيارة مباشرة</Text>
            </View>
          )}
          {appt.appointmentTime ? (
            <View style={styles.timeTag}>
              <Ionicons name="time-outline" size={11} color={Colors.textSecondary} />
              <Text style={styles.timeTagText}>{appt.appointmentTime}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

/** Day section header */
const SectionHeader = memo(({ title, count }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
    <View style={styles.sectionHeaderBadge}>
      <Text style={styles.sectionHeaderBadgeText}>{count}</Text>
    </View>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsScreen
// ─────────────────────────────────────────────────────────────────────────────

const NotificationsScreen = () => {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState(null);

  const isMountedRef = useRef(true);
  const db           = useRef(getFirestore()).current;
  const since        = useRef(sevenDaysAgoTimestamp()).current;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Real-time listener — last 7 days of appointments ──────────────────────
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.APPOINTMENTS),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'desc'),
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
        console.error('[NotificationsScreen] snapshot error:', err);
        if (!isMountedRef.current) return;
        setError('تعذّر تحميل الإشعارات');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [db, since]);

  // ── Group into SectionList sections by calendar day ────────────────────────
  const sections = useMemo(() => {
    const grouped = new Map();

    for (const appt of appointments) {
      const date    = appt.createdAt?.toDate?.() ?? new Date();
      const dateKey = date.toDateString();

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { title: dayLabel(date), data: [] });
      }
      grouped.get(dateKey).data.push(appt);
    }

    return Array.from(grouped.values());
  }, [appointments]);

  /** Count of 'pending' appointments (need action) */
  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === 'pending').length,
    [appointments],
  );

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderItem = ({ item }) => <NotifCard appt={item} />;

  const renderSectionHeader = ({ section }) => (
    <SectionHeader title={section.title} count={section.data.length} />
  );

  const keyExtractor = (item) => item.id;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen} edges={Platform.OS === 'ios' ? ['top'] : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ══ Header ══ */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>الإشعارات</Text>
          {pendingCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{pendingCount} تحتاج تأكيد</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSub}>
          {appointments.length > 0
            ? `${appointments.length} نشاط في آخر ٧ أيام`
            : 'لا يوجد نشاط مؤخراً'}
        </Text>
      </View>

      {/* ══ Content ══ */}
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <Ionicons name="cloud-offline-outline" size={44} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centeredState}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
          <Text style={styles.emptySubtitle}>
            لم يتم تسجيل أي نشاط خلال الأيام السبعة الماضية
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.itemSep} />}
        />
      )}
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL compliance:
//   ✓ No marginLeft / marginRight  — uses marginStart / marginEnd
//   ✓ No paddingLeft / paddingRight
//   ✓ No borderLeftWidth           — uses borderStartWidth for walk-in accent
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────

  header: {
    backgroundColor:  Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.md,
    gap:              4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  headerTitle: {
    fontSize:   FontSizes.xl,
    fontWeight: '800',
    color:      Colors.white,
  },
  headerBadge: {
    backgroundColor:  '#ef4444',
    borderRadius:     BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  3,
  },
  headerBadgeText: {
    color:      Colors.white,
    fontSize:   FontSizes.xs,
    fontWeight: '700',
  },
  headerSub: {
    color:    'rgba(255,255,255,0.8)',
    fontSize: FontSizes.sm,
  },

  // ── Section headers ──────────────────────────────────────────────────────

  sectionHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.xs,
    marginTop:        Spacing.sm,
  },
  sectionHeaderText: {
    fontSize:   FontSizes.sm,
    fontWeight: '700',
    color:      Colors.textSecondary,
  },
  sectionHeaderBadge: {
    backgroundColor:  Colors.border,
    borderRadius:     BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:  2,
  },
  sectionHeaderBadgeText: {
    fontSize:   10,
    color:      Colors.textSecondary,
    fontWeight: '700',
  },

  // ── List ─────────────────────────────────────────────────────────────────

  listContent: {
    paddingBottom: Spacing.xxl,
  },
  itemSep: {
    height:           1,
    backgroundColor:  Colors.borderLight,
    marginHorizontal: Spacing.md,
  },

  // ── Notification card ─────────────────────────────────────────────────────

  card: {
    flexDirection:    'row',
    alignItems:       'flex-start',
    backgroundColor:  Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.sm,
    gap:              Spacing.sm,
  },
  // Logical borderStartWidth — walk-in accent line on physical left (LTR) / right (RTL)
  cardWalkIn: {
    borderStartWidth: 3,
    borderStartColor: '#f59e0b',
  },
  notifIcon: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.lg,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  cardContent: {
    flex: 1,
    gap:  4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  notifTitle: {
    fontSize:   FontSizes.sm,
    fontWeight: '600',
    color:      Colors.text,
  },
  notifTitleUrgent: {
    color: '#92400e',
  },
  urgentDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#ef4444',
  },
  cardBody: {
    fontSize: FontSizes.sm,
    color:    Colors.textSecondary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    flexWrap:      'wrap',
  },
  cardTime: {
    fontSize: FontSizes.xs,
    color:    Colors.gray,
  },
  walkInTag: {
    backgroundColor:  '#fef3c7',
    borderRadius:     BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical:  2,
  },
  walkInTagText: {
    fontSize:   10,
    color:      '#92400e',
    fontWeight: '600',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  timeTagText: {
    fontSize: FontSizes.xs,
    color:    Colors.textSecondary,
  },

  // ── Shared states ─────────────────────────────────────────────────────────

  centeredState: {
    flex:             1,
    alignItems:       'center',
    justifyContent:   'center',
    gap:              Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    color:    Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  errorText: {
    color:     Colors.error,
    fontSize:  FontSizes.md,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize:   FontSizes.lg,
    fontWeight: '700',
    color:      Colors.text,
  },
  emptySubtitle: {
    fontSize:  FontSizes.sm,
    color:     Colors.textSecondary,
    textAlign: 'center',
  },
});

export default NotificationsScreen;