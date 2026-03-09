/**
 * AppointmentManagementScreen.js — Receptionist Appointment Management (Phase 4)
 *
 * ╔══ ARCHITECTURE NOTES ═══════════════════════════════════════════════════════╗
 *
 * 1. DATE-SCOPED SNAPSHOT — resubscribes when selectedDate changes
 * ──────────────────────────────────────────────────────────────────
 *   A single onSnapshot listens to ALL clinic appointments for the selected
 *   date. When the receptionist navigates to a different day the previous
 *   listener is torn down (return unsubscribe) and a fresh one is established.
 *
 *   Query:  where('appointmentDate', '>=', startOfDay)
 *           where('appointmentDate', '<=', endOfDay)
 *           orderBy('appointmentDate', 'asc')
 *
 *   Single-field index on 'appointmentDate' — auto-created by Firestore.
 *   No compound index is needed (range and orderBy are on the same field).
 *
 * 2. CLIENT-SIDE FILTERS — zero additional Firestore reads
 * ─────────────────────────────────────────────────────────
 *   Status-filter tabs and the search bar are pure useMemo derivations from
 *   the master `appointments` array. Switching from "Confirmed" to "Pending"
 *   costs zero network ops; every filter UI change is O(n) JavaScript only.
 *
 * 3. ACTION MODEL — what a receptionist can do per status
 * ────────────────────────────────────────────────────────
 *   pending    → [تأكيد]          → confirmed   (writes confirmedAt)
 *   pending    → [رفض]            → cancelled   (writes cancelledAt + cancelReason)
 *   confirmed  → [تسجيل الوصول]  → waiting     (writes waitingAt)
 *   confirmed  → [إلغاء]          → cancelled
 *   waiting    → [إرسال للطبيب]  → in_progress (writes inProgressAt)
 *   waiting    → [إلغاء]          → cancelled
 *   in_progress → read-only badge  (patient is with the doctor — no cancel)
 *   completed   → read-only badge
 *   cancelled   → read-only badge
 *
 *   Each transition is an atomic updateDoc: status + auditField + updatedAt.
 *   The onSnapshot listener fires (< 200 ms) and re-renders the card.
 *   If the write fails the card reverts; no optimistic-update rollback needed.
 *
 * 4. CANCEL MODAL — cross-platform reason capture
 * ─────────────────────────────────────────────────
 *   Alert.prompt() is iOS-only. A custom Modal + TextInput captures an
 *   optional cancellation reason written to the 'cancelReason' field.
 *
 * 5. DATE PICKER — platform-aware
 * ─────────────────────────────────
 *   iOS:     DateTimePicker inside a bottom-sheet Modal (spinner display).
 *   Android: DateTimePicker rendered directly (native calendar dialog).
 *   Prev / Next arrows provide single-day navigation without opening the picker.
 *   A shortcut pill snaps back to the current date when not already on today.
 *
 * 6. RTL COMPLIANCE
 * ──────────────────
 *   All directional styles use logical properties (RTL mirrors automatically):
 *     marginStart, marginEnd             → never marginLeft / marginRight
 *     paddingStart, paddingEnd           → never paddingLeft / paddingRight
 *     borderTopStartRadius               → never borderTopLeftRadius
 *     borderTopEndRadius                 → never borderTopRightRadius
 *     borderStartWidth, borderStartColor → never borderLeftWidth
 *   hitSlop uses symmetric left/right values (no logical API alternative; values equal).
 *
 * ╚═════════════════════════════════════════════════════════════════════════════╝
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
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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

/** Per-status visual config */
const STATUS_CONFIG = {
  pending:     { color: '#f59e0b', bg: '#fef3c7', label: 'في الانتظار',  icon: 'time-outline'             },
  confirmed:   { color: '#3b82f6', bg: '#dbeafe', label: 'مؤكد',         icon: 'checkmark-circle-outline' },
  waiting:     { color: '#eab308', bg: '#fef9c3', label: 'في الاستقبال', icon: 'people-outline'            },
  in_progress: { color: '#8b5cf6', bg: '#ede9fe', label: 'مع الطبيب',    icon: 'medical-outline'           },
  completed:   { color: Colors.primary, bg: '#d1fae5', label: 'مكتمل',   icon: 'checkmark-done-outline'   },
  cancelled:   { color: Colors.error,   bg: '#fee2e2', label: 'ملغي',    icon: 'close-circle-outline'     },
};

/** Filter tab definitions — order matches the appointment lifecycle */
const FILTER_TABS = [
  { id: 'all',         label: 'الكل'         },
  { id: 'pending',     label: 'في الانتظار'  },
  { id: 'confirmed',   label: 'مؤكد'         },
  { id: 'waiting',     label: 'في الاستقبال' },
  { id: 'in_progress', label: 'مع الطبيب'    },
  { id: 'completed',   label: 'مكتمل'        },
  { id: 'cancelled',   label: 'ملغي'         },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Firestore Timestamp range bracketing a calendar day (00:00 – 23:59:59.999) */
function getDateRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

/** True when `date` falls on the same calendar day as today */
function isToday(date) {
  const today = new Date();
  return (
    date.getDate()     === today.getDate()     &&
    date.getMonth()    === today.getMonth()    &&
    date.getFullYear() === today.getFullYear()
  );
}

/** Long-form Arabic date string for the navigation header */
function formatHeaderDate(date) {
  return date.toLocaleDateString('ar-SA', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

/**
 * Display time for an appointment.
 * Prefers the pre-stored `appointmentTime` string ('9:00 AM'),
 * falls back to formatting the `appointmentDate` Firestore Timestamp.
 */
function formatApptTime(appt) {
  if (appt.appointmentTime) return appt.appointmentTime;
  if (appt.appointmentDate?.toDate) {
    return appt.appointmentDate.toDate().toLocaleTimeString('ar-SA', {
      hour: '2-digit', minute: '2-digit',
    });
  }
  return '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (React.memo — FlatList performance)
// ─────────────────────────────────────────────────────────────────────────────

/** Colored status pill */
const StatusBadge = memo(({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? {
    color: Colors.gray, bg: Colors.border, label: status, icon: 'ellipse-outline',
  };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
});

/** Single filter chip in the status rail */
const FilterTab = memo(({ tab, isActive, count, onPress }) => (
  <TouchableOpacity
    style={[styles.filterTab, isActive && styles.filterTabActive]}
    onPress={() => onPress(tab.id)}
    activeOpacity={0.75}
  >
    <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
      {tab.label}
    </Text>
    {count > 0 && (
      <View style={[styles.filterBubble, isActive && styles.filterBubbleActive]}>
        <Text style={[styles.filterBubbleText, isActive && styles.filterBubbleTextActive]}>
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
));

/**
 * ActionRow — state-driven action buttons.
 *
 * Lifecycle:
 *   isPending    → spinner (blocks double-tap during Firestore write)
 *   pending      → [تأكيد] [رفض]
 *   confirmed    → [تسجيل الوصول ×2] [إلغاء ×1]
 *   waiting      → [إرسال للطبيب ×2] [إلغاء ×1]
 *   anything else → null (read-only card)
 */
const ActionRow = memo(({ appt, isPending, onConfirm, onCheckIn, onSendToDoc, onCancel }) => {
  const { status, id } = appt;

  if (isPending) {
    return (
      <View style={[styles.actionRow, styles.actionRowCentered]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGreen]}
          onPress={() => onConfirm(id)}
          activeOpacity={0.75}
        >
          <Ionicons name="checkmark-outline" size={15} color={Colors.white} />
          <Text style={styles.actionBtnWhiteText}>تأكيد</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnRedOutline]}
          onPress={() => onCancel(id)}
          activeOpacity={0.75}
        >
          <Ionicons name="close-outline" size={15} color={Colors.error} />
          <Text style={styles.actionBtnRedText}>رفض</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'confirmed') {
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnBlue, { flex: 2 }]}
          onPress={() => onCheckIn(id)}
          activeOpacity={0.75}
        >
          <Ionicons name="log-in-outline" size={15} color={Colors.white} />
          <Text style={styles.actionBtnWhiteText}>تسجيل الوصول</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnRedOutline]}
          onPress={() => onCancel(id)}
          activeOpacity={0.75}
        >
          <Ionicons name="close-outline" size={15} color={Colors.error} />
          <Text style={styles.actionBtnRedText}>إلغاء</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'waiting') {
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPurple, { flex: 2 }]}
          onPress={() => onSendToDoc(id)}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-forward-outline" size={15} color={Colors.white} />
          <Text style={styles.actionBtnWhiteText}>إرسال للطبيب</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnRedOutline]}
          onPress={() => onCancel(id)}
          activeOpacity={0.75}
        >
          <Ionicons name="close-outline" size={15} color={Colors.error} />
          <Text style={styles.actionBtnRedText}>إلغاء</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null; // in_progress | completed | cancelled — read-only
});

/** Full appointment card */
const AppointmentCard = memo(({
  appt, isPending, onConfirm, onCheckIn, onSendToDoc, onCancel,
}) => {
  const { status, patientName, doctorName, type: apptType, reason, isWalkIn } = appt;
  const cfg         = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const time        = formatApptTime(appt);
  const isActionable = ['pending', 'confirmed', 'waiting'].includes(status);
  const isInProgress = status === 'in_progress';

  return (
    <View style={[styles.card, isInProgress && styles.cardAccent]}>
      {/* Body */}
      <View style={styles.cardBody}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.avatarLetter, { color: cfg.color }]}>
            {(patientName ?? '؟')[0]}
          </Text>
        </View>

        {/* Patient info */}
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.patientName} numberOfLines={1}>{patientName ?? '—'}</Text>
            {isWalkIn && (
              <View style={styles.walkInTag}>
                <Text style={styles.walkInTagText}>زيارة مباشرة</Text>
              </View>
            )}
          </View>
          <Text style={styles.doctorName} numberOfLines={1}>{doctorName ?? '—'}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{time}</Text>
            {apptType ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{apptType}</Text>
              </>
            ) : null}
          </View>
          {reason ? (
            <Text style={styles.reasonText} numberOfLines={1}>{reason}</Text>
          ) : null}
        </View>

        {/* Status badge */}
        <StatusBadge status={status} />
      </View>

      {/* Divider + action row (actionable statuses only) */}
      {isActionable && (
        <>
          <View style={styles.cardDivider} />
          <ActionRow
            appt={appt}
            isPending={isPending}
            onConfirm={onConfirm}
            onCheckIn={onCheckIn}
            onSendToDoc={onSendToDoc}
            onCancel={onCancel}
          />
        </>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// AppointmentManagementScreen
// ─────────────────────────────────────────────────────────────────────────────

const AppointmentManagementScreen = () => {

  // ── Core state ────────────────────────────────────────────────────────────
  const [appointments, setAppointments]             = useState([]);
  const [selectedDate, setSelectedDate]             = useState(() => new Date());
  const [activeFilter, setActiveFilter]             = useState('all');
  const [searchQuery, setSearchQuery]               = useState('');
  const [isLoading, setIsLoading]                   = useState(true);
  const [error, setError]                           = useState(null);
  const [pendingIds, setPendingIds]                 = useState({});
  const [showDatePicker, setShowDatePicker]         = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTargetId, setCancelTargetId]         = useState(null);
  const [cancelReason, setCancelReason]             = useState('');
  const [isCancelling, setIsCancelling]             = useState(false);

  const isMountedRef = useRef(true);
  const db           = useRef(getFirestore()).current;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Real-time listener — resubscribes on date change ─────────────────────
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const { start, end } = getDateRange(selectedDate);
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
        console.error('[AppointmentManagement] snapshot error:', err);
        if (!isMountedRef.current) return;
        setError('تعذّر تحميل المواعيد');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [selectedDate, db]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:      appointments.length,
    pending:    appointments.filter((a) => a.status === 'pending').length,
    confirmed:  appointments.filter((a) => a.status === 'confirmed').length,
    waiting:    appointments.filter((a) => a.status === 'waiting').length,
    inProgress: appointments.filter((a) => a.status === 'in_progress').length,
    completed:  appointments.filter((a) => a.status === 'completed').length,
    cancelled:  appointments.filter((a) => a.status === 'cancelled').length,
  }), [appointments]);

  const filteredAppointments = useMemo(() => {
    let data = appointments;
    if (activeFilter !== 'all') {
      data = data.filter((a) => a.status === activeFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      data = data.filter(
        (a) =>
          a.patientName?.toLowerCase().includes(q) ||
          a.doctorName?.toLowerCase().includes(q)  ||
          a.reason?.toLowerCase().includes(q),
      );
    }
    return data;
  }, [appointments, activeFilter, searchQuery]);

  /** Tab bubble counts (from full unfiltered array) */
  const tabCounts = useMemo(() => ({
    all:         appointments.length,
    pending:     stats.pending,
    confirmed:   stats.confirmed,
    waiting:     stats.waiting,
    in_progress: stats.inProgress,
    completed:   stats.completed,
    cancelled:   stats.cancelled,
  }), [appointments.length, stats]);

  // ── pendingIds helpers ────────────────────────────────────────────────────
  const markPending = useCallback((id, val) => {
    setPendingIds((prev) => {
      const next = { ...prev };
      if (val) next[id] = true;
      else     delete next[id];
      return next;
    });
  }, []);

  // ── Generic status transition ─────────────────────────────────────────────
  const handleStatusUpdate = useCallback(async (appointmentId, newStatus, auditField) => {
    if (pendingIds[appointmentId]) return;
    markPending(appointmentId, true);
    try {
      await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:       newStatus,
        [auditField]: serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
    } catch (err) {
      console.error('[AppointmentManagement] status update error:', err);
      Alert.alert('خطأ', 'تعذّر تحديث حالة الموعد. حاول مرة أخرى.');
    } finally {
      if (isMountedRef.current) markPending(appointmentId, false);
    }
  }, [db, pendingIds, markPending]);

  const handleConfirm   = useCallback((id) => handleStatusUpdate(id, 'confirmed',   'confirmedAt'),   [handleStatusUpdate]);
  const handleCheckIn   = useCallback((id) => handleStatusUpdate(id, 'waiting',     'waitingAt'),     [handleStatusUpdate]);
  const handleSendToDoc = useCallback((id) => handleStatusUpdate(id, 'in_progress', 'inProgressAt'), [handleStatusUpdate]);

  // ── Cancel flow ───────────────────────────────────────────────────────────
  const handleCancelPress = useCallback((id) => {
    setCancelTargetId(id);
    setCancelReason('');
    setCancelModalVisible(true);
  }, []);

  const handleCancelDismiss = useCallback(() => {
    setCancelModalVisible(false);
    setCancelTargetId(null);
    setCancelReason('');
  }, []);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTargetId) return;
    setIsCancelling(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, cancelTargetId), {
        status:       'cancelled',
        cancelledAt:  serverTimestamp(),
        cancelReason: cancelReason.trim() || 'ملغي بواسطة الاستقبال',
        updatedAt:    serverTimestamp(),
      });
      handleCancelDismiss();
    } catch (err) {
      console.error('[AppointmentManagement] cancel error:', err);
      Alert.alert('خطأ', 'تعذّر إلغاء الموعد. حاول مرة أخرى.');
    } finally {
      if (isMountedRef.current) setIsCancelling(false);
    }
  }, [db, cancelTargetId, cancelReason, handleCancelDismiss]);

  // ── Date navigation ───────────────────────────────────────────────────────
  const goToPrevDay = useCallback(() => {
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
  }, []);

  const goToToday = useCallback(() => setSelectedDate(new Date()), []);

  const handleDatePickerChange = useCallback((event, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }, []);

  // ── Stable callbacks ──────────────────────────────────────────────────────
  const handleFilterPress = useCallback((id) => setActiveFilter(id), []);
  const keyExtractor       = useCallback((item) => item.id, []);

  const renderItem = useCallback(({ item }) => (
    <AppointmentCard
      appt={item}
      isPending={!!pendingIds[item.id]}
      onConfirm={handleConfirm}
      onCheckIn={handleCheckIn}
      onSendToDoc={handleSendToDoc}
      onCancel={handleCancelPress}
    />
  ), [pendingIds, handleConfirm, handleCheckIn, handleSendToDoc, handleCancelPress]);

  const renderFilterTab = useCallback(({ item: tab }) => (
    <FilterTab
      tab={tab}
      isActive={activeFilter === tab.id}
      count={tabCounts[tab.id] ?? 0}
      onPress={handleFilterPress}
    />
  ), [activeFilter, tabCounts, handleFilterPress]);

  const ListEmpty = useMemo(() => {
    if (isLoading) return null;
    const statusLabel = STATUS_CONFIG[activeFilter]?.label;
    return (
      <View style={styles.centeredState}>
        <Ionicons name="calendar-outline" size={56} color={Colors.border} />
        <Text style={styles.emptyTitle}>لا توجد مواعيد</Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter !== 'all' && statusLabel
            ? `لا توجد مواعيد بحالة "${statusLabel}"`
            : 'لا توجد مواعيد مسجلة لهذا اليوم'}
        </Text>
      </View>
    );
  }, [isLoading, activeFilter]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ══ Header ══ */}
      <View style={styles.header}>

        {/* Date navigation */}
        <View style={styles.dateNavRow}>
          <TouchableOpacity
            onPress={goToPrevDay}
            style={styles.navArrow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back-outline" size={22} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.dateText}>{formatHeaderDate(selectedDate)}</Text>
            <View style={styles.dateSubRow}>
              {isToday(selectedDate) ? (
                <View style={styles.todayPill}>
                  <Text style={styles.todayPillText}>اليوم</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={goToToday} style={styles.goTodayPill}>
                  <Ionicons name="today-outline" size={12} color={Colors.white} />
                  <Text style={styles.goTodayText}>العودة لليوم</Text>
                </TouchableOpacity>
              )}
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goToNextDay}
            style={styles.navArrow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { count: stats.total,      label: 'إجمالي',    color: Colors.white  },
            { count: stats.pending,    label: 'انتظار',    color: '#fbbf24'     },
            { count: stats.confirmed,  label: 'مؤكد',      color: '#93c5fd'     },
            { count: stats.waiting,    label: 'استقبال',   color: '#fde047'     },
            { count: stats.inProgress, label: 'مع الطبيب', color: '#c4b5fd'     },
            { count: stats.completed,  label: 'مكتمل',     color: '#6ee7b7'     },
          ].map((s, idx, arr) => (
            <React.Fragment key={s.label}>
              <View style={styles.statCell}>
                <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
              {idx < arr.length - 1 && <View style={styles.statSep} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* ══ Filter rail ══ */}
      <View style={styles.filterRail}>
        <FlatList
          horizontal
          data={FILTER_TABS}
          keyExtractor={(t) => t.id}
          renderItem={renderFilterTab}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRailContent}
        />
      </View>

      {/* ══ Search bar ══ */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث بالمريض أو الطبيب أو السبب..."
          placeholderTextColor={Colors.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          textAlign="right"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close-circle" size={18} color={Colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* ══ Content ══ */}
      {error ? (
        <View style={styles.centeredState}>
          <Ionicons name="cloud-offline-outline" size={44} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => setSelectedDate((d) => new Date(d))}
          >
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل المواعيد...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={[
            styles.listContent,
            filteredAppointments.length === 0 && styles.listContentGrow,
          ]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={8}
          initialNumToRender={8}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ══ Date Picker ══
          iOS:    spinner inside a dismissible bottom-sheet Modal
          Android: native system calendar dialog                      */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.pickerOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => setShowDatePicker(false)}
                activeOpacity={1}
              />
              <View style={styles.pickerSheet}>
                {/* Header — "تم" at logical start (physical right in RTL) */}
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDone}>تم</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDatePickerChange}
                  locale="ar"
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDatePickerChange}
          />
        )
      )}

      {/* ══ Cancel Modal ══
          Custom cross-platform Modal; Alert.prompt() is iOS-only.     */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDismiss}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.cancelOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handleCancelDismiss}
            activeOpacity={1}
          />
          <View style={styles.cancelCard}>
            {/* Icon + title */}
            <View style={styles.cancelCardHead}>
              <View style={styles.cancelIconCircle}>
                <Ionicons name="close-circle-outline" size={26} color={Colors.error} />
              </View>
              <Text style={styles.cancelCardTitle}>تأكيد إلغاء الموعد</Text>
            </View>

            <Text style={styles.cancelCardSub}>سبب الإلغاء (اختياري)</Text>

            <TextInput
              style={styles.cancelInput}
              placeholder="أدخل سبب الإلغاء هنا..."
              placeholderTextColor={Colors.gray}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              textAlign="right"
              textAlignVertical="top"
            />

            {/* Action buttons */}
            <View style={styles.cancelBtns}>
              <TouchableOpacity
                style={[styles.cancelBtn, styles.cancelBtnBack]}
                onPress={handleCancelDismiss}
                disabled={isCancelling}
              >
                <Text style={styles.cancelBtnBackText}>تراجع</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn, styles.cancelBtnConfirm]}
                onPress={handleCancelConfirm}
                disabled={isCancelling}
              >
                {isCancelling
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.cancelBtnConfirmText}>إلغاء الموعد</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL compliance:
//   ✓ No marginLeft / marginRight  — uses marginStart / marginEnd
//   ✓ No paddingLeft / paddingRight — uses paddingHorizontal (neutral) or paddingStart/End
//   ✓ No borderLeftWidth            — uses borderStartWidth for accent
//   ✓ No borderTopLeftRadius        — uses borderTopStartRadius / borderTopEndRadius
//   ✓ No right: N in positioned elements
//   ✓ hitSlop uses symmetric left/right (no logical alternative in the API)
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
    paddingTop:        Spacing.xs,
    paddingBottom:     Spacing.md,
    gap:               Spacing.sm,
  },

  dateNavRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  navArrow: {
    padding: Spacing.xs,
  },
  dateCenter: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  dateText: {
    color:      Colors.white,
    fontSize:   FontSizes.md,
    fontWeight: '700',
    textAlign:  'center',
  },
  dateSubRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  todayPill: {
    backgroundColor:  'rgba(255,255,255,0.25)',
    borderRadius:     BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  2,
  },
  todayPillText: {
    color:      Colors.white,
    fontSize:   FontSizes.xs,
    fontWeight: '600',
  },
  goTodayPill: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  'rgba(255,255,255,0.2)',
    borderRadius:     BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  2,
    gap:              3,
  },
  goTodayText: {
    color:      Colors.white,
    fontSize:   FontSizes.xs,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection:    'row',
    backgroundColor:  'rgba(255,255,255,0.15)',
    borderRadius:     BorderRadius.lg,
    paddingVertical:  Spacing.sm,
  },
  statCell: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  statCount: {
    fontSize:   FontSizes.lg,
    fontWeight: '800',
    color:      Colors.white,
  },
  statLabel: {
    fontSize: 10,
    color:    'rgba(255,255,255,0.75)',
  },
  statSep: {
    width:           1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical:  4,
  },

  // ── Filter rail ──────────────────────────────────────────────────────────

  filterRail: {
    backgroundColor:  Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterRailContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    gap:               Spacing.xs,
  },
  filterTab: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical:  6,
    borderRadius:     BorderRadius.full,
    borderWidth:      1,
    borderColor:      Colors.border,
    gap:              4,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  filterTabText: {
    fontSize:   FontSizes.xs,
    color:      Colors.textSecondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color:      Colors.white,
    fontWeight: '700',
  },
  filterBubble: {
    backgroundColor:  Colors.border,
    borderRadius:     BorderRadius.full,
    minWidth:         18,
    height:           18,
    alignItems:       'center',
    justifyContent:   'center',
    paddingHorizontal: 4,
  },
  filterBubbleActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBubbleText: {
    fontSize:   10,
    color:      Colors.textSecondary,
    fontWeight: '700',
  },
  filterBubbleTextActive: {
    color: Colors.white,
  },

  // ── Search bar ───────────────────────────────────────────────────────────

  searchBar: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.white,
    marginHorizontal: Spacing.md,
    marginVertical:   Spacing.sm,
    borderRadius:     BorderRadius.lg,
    borderWidth:      1,
    borderColor:      Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Platform.OS === 'ios' ? 10 : 4,
    gap:              Spacing.xs,
  },
  searchInput: {
    flex:     1,
    fontSize: FontSizes.sm,
    color:    Colors.text,
  },

  // ── List ─────────────────────────────────────────────────────────────────

  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom:     Spacing.xxl,
    gap:               Spacing.sm,
  },
  listContentGrow: {
    flexGrow: 1,
  },

  // ── Appointment card ──────────────────────────────────────────────────────

  card: {
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.lg,
    overflow:        'hidden',
    elevation:       2,
    shadowColor:     Colors.black,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    3,
  },
  // Logical borderStartWidth = physical left in LTR, physical right in RTL
  cardAccent: {
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
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.full,
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize:   FontSizes.lg,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
    gap:  3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    flexWrap:      'wrap',
  },
  patientName: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.text,
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
  doctorName: {
    fontSize: FontSizes.sm,
    color:    Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     2,
  },
  metaText: {
    fontSize: FontSizes.xs,
    color:    Colors.textSecondary,
  },
  metaDot: {
    fontSize: FontSizes.xs,
    color:    Colors.gray,
  },
  reasonText: {
    fontSize:  FontSizes.xs,
    color:     Colors.textLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  badge: {
    flexDirection:    'row',
    alignItems:       'center',
    borderRadius:     BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:  4,
    gap:              4,
    alignSelf:        'flex-start',
  },
  badgeText: {
    fontSize:   11,
    fontWeight: '600',
  },
  cardDivider: {
    height:           1,
    backgroundColor:  Colors.border,
    marginHorizontal: Spacing.md,
  },

  // ── Action row ───────────────────────────────────────────────────────────

  actionRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       Spacing.sm,
    gap:           Spacing.xs,
    minHeight:     48,
  },
  actionRowCentered: {
    justifyContent: 'center',
  },
  actionBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   BorderRadius.md,
    paddingVertical: 8,
    gap:            4,
  },
  actionBtnGreen: {
    backgroundColor: Colors.primary,
  },
  actionBtnBlue: {
    backgroundColor: '#3b82f6',
  },
  actionBtnPurple: {
    backgroundColor: '#8b5cf6',
  },
  actionBtnRedOutline: {
    backgroundColor: '#fee2e2',
    borderWidth:     1,
    borderColor:     '#fca5a5',
  },
  actionBtnWhiteText: {
    color:      Colors.white,
    fontSize:   FontSizes.xs,
    fontWeight: '700',
  },
  actionBtnRedText: {
    color:      Colors.error,
    fontSize:   FontSizes.xs,
    fontWeight: '700',
  },

  // ── Date picker (iOS bottom sheet) ───────────────────────────────────────

  pickerOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  pickerSheet: {
    backgroundColor:      Colors.white,
    // Logical border-radius — mirrors automatically in RTL
    borderTopStartRadius: BorderRadius.xl,
    borderTopEndRadius:   BorderRadius.xl,
    overflow:             'hidden',
  },
  pickerHeader: {
    flexDirection:    'row',
    // flex-start → physical right in RTL (logical start = "Done" at start edge)
    justifyContent:   'flex-start',
    padding:          Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerDone: {
    color:      Colors.primary,
    fontSize:   FontSizes.md,
    fontWeight: '700',
  },

  // ── Cancel modal ─────────────────────────────────────────────────────────

  cancelOverlay: {
    flex:             1,
    backgroundColor:  'rgba(0,0,0,0.5)',
    justifyContent:   'center',
    paddingHorizontal: Spacing.lg,
  },
  cancelCard: {
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing.lg,
    gap:             Spacing.md,
  },
  cancelCardHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  cancelIconCircle: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.full,
    backgroundColor: '#fee2e2',
    alignItems:     'center',
    justifyContent: 'center',
  },
  cancelCardTitle: {
    fontSize:   FontSizes.lg,
    fontWeight: '700',
    color:      Colors.text,
    flex:       1,
  },
  cancelCardSub: {
    fontSize: FontSizes.sm,
    color:    Colors.textSecondary,
  },
  cancelInput: {
    borderWidth:       1,
    borderColor:       Colors.border,
    borderRadius:      BorderRadius.md,
    padding:           Spacing.sm,
    fontSize:          FontSizes.sm,
    color:             Colors.text,
    minHeight:         80,
    textAlign:         'right',
    textAlignVertical: 'top',
  },
  cancelBtns: {
    flexDirection: 'row',
    gap:           Spacing.sm,
  },
  cancelBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   BorderRadius.md,
    paddingVertical: Spacing.sm,
    minHeight:      44,
  },
  cancelBtnBack: {
    backgroundColor: Colors.border,
  },
  cancelBtnBackText: {
    color:      Colors.text,
    fontWeight: '700',
    fontSize:   FontSizes.sm,
  },
  cancelBtnConfirm: {
    backgroundColor: Colors.error,
  },
  cancelBtnConfirmText: {
    color:      Colors.white,
    fontWeight: '700',
    fontSize:   FontSizes.sm,
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
  retryBtn: {
    backgroundColor:  Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical:  Spacing.sm,
    borderRadius:     BorderRadius.md,
  },
  retryBtnText: {
    color:      Colors.white,
    fontWeight: '700',
    fontSize:   FontSizes.sm,
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

export default AppointmentManagementScreen;
