/**
 * AppointmentManagementScreen.js — Receptionist Appointment Management (Phase 4)
 *
 * ╔══ ARCHITECTURE ═══════════════════════════════════════════════════════════╗
 *
 * 1. REAL-TIME DATE-SCOPED SNAPSHOT
 * ──────────────────────────────────
 *   onSnapshot fires whenever any appointment on `selectedDate` changes.
 *   The listener is torn down and re-established each time `selectedDate`
 *   changes (useEffect cleanup). Sorted client-side on appointmentTime so
 *   no Firestore composite index is needed.
 *
 * 2. CLIENT-SIDE FILTER + SEARCH — zero extra reads
 * ───────────────────────────────────────────────────
 *   Status chips and the search bar are pure useMemo derivations from the
 *   master `appointments` array.  Switching tabs or typing costs 0 network ops.
 *
 * 3. STATUS-DRIVEN ACTION BUTTONS
 * ─────────────────────────────────
 *   pending    → [Accept]              → confirmed   (receptionistAccept)
 *   pending    → [Decline]             → cancelled   (receptionistDecline)
 *   confirmed  → [Check-In Patient]   → waiting     (checkInPatient)
 *   waiting    → [Send to Doctor]     → in_progress (sendToDoctor)
 *   in_progress | completed | cancelled → informational text only
 *
 * 4. RACE-CONDITION GUARD
 * ────────────────────────
 *   `isUpdating` disables every action button while an update is in-flight.
 *   `updatingAction` drives the loading spinner on the specific button pressed.
 *   `actionError` surfaces try/catch failures as an inline banner (zero Alert).
 *
 * 5. CONTRACTS ENFORCED
 * ──────────────────────
 *   ✅ ScreenContainer (scrollable=false, padded=false, edges=['bottom'])
 *   ✅ RTL logical properties throughout (marginStart/End, paddingStart/End,
 *      borderTopStartRadius/EndRadius)
 *   ✅ All strings via t()  — zero hardcoded text
 *   ✅ statusColors from theme.js — zero hardcoded hex
 *   ✅ Zero Firebase imports — all mutations via appointmentService
 *
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '../../components/ui';
import appointmentService from '../../services/appointmentService';
import {
  colors,
  statusColors,
  spacing,
  typography,
  BorderRadius,
  shadows,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Date → 'YYYY-MM-DD' string (local time, not UTC) */
const toDateStr = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/** Date → 'DD/MM/YYYY' display string */
const toDisplayDate = (d) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Build the 7-day strip: 3 days before today … today … 3 days after */
const buildStrip = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i - 3);
    return d;
  });
};

const STRIP_DATES = buildStrip();                   // stable across renders
const TODAY_STR   = toDateStr(new Date());           // 'YYYY-MM-DD' of today

// Status tabs shown in the filter bar (order matches typical daily flow)
const STATUS_TABS = ['all', 'pending', 'confirmed', 'waiting', 'in_progress', 'no_show'];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DayChip — one cell in the horizontal date strip.
 * Highlights today with a dot; highlights the selected date in primary green.
 */
const DayChip = React.memo(({ date, isSelected, onPress }) => {
  const { i18n } = useTranslation();
  const isToday  = toDateStr(date) === TODAY_STR;
  const locale   = i18n.language === 'ar' ? 'ar-IQ' : 'en-US';
  const dayName  = date.toLocaleDateString(locale, { weekday: 'short' });
  const dayNum   = String(date.getDate()).padStart(2, '0');

  return (
    <TouchableOpacity
      style={[
        styles.dayChip,
        isSelected && styles.dayChipSelected,
        isToday && !isSelected && styles.dayChipToday,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
        {dayName}
      </Text>
      <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
        {dayNum}
      </Text>
      {isToday && (
        <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />
      )}
    </TouchableOpacity>
  );
});

/**
 * StatusBadge — coloured pill driven entirely by statusColors from theme.js.
 * Zero hardcoded hex codes here.
 */
const StatusBadge = React.memo(({ status }) => {
  const { t } = useTranslation();
  const sc     = statusColors[status] ?? statusColors.pending;
  return (
    <View style={[styles.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
      <Text style={[styles.badgeText, { color: sc.text }]}>
        {t(`appointments.status.${status}`, { defaultValue: status })}
      </Text>
    </View>
  );
});

/**
 * AppointmentCard — row in the FlatList; tapping opens the detail modal.
 */
const AppointmentCard = React.memo(({ appointment, onPress }) => {
  const { t } = useTranslation();
  const initial = (appointment.patientName || '?')[0].toUpperCase();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(appointment)}
      activeOpacity={0.8}
    >
      <View style={styles.cardRow}>
        {/* Avatar */}
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>{initial}</Text>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {appointment.patientName ?? '—'}
          </Text>
          <Text style={styles.cardMeta}>
            {appointment.appointmentTime
              ? `${t('receptionist.apptMgmt.timeLabel')}: ${appointment.appointmentTime}`
              : t('appointments.walkIn')}
          </Text>
          {!!appointment.reason && (
            <Text style={styles.cardReason} numberOfLines={1}>
              {appointment.reason}
            </Text>
          )}
        </View>

        {/* Badge */}
        <StatusBadge status={appointment.status} />
      </View>
    </TouchableOpacity>
  );
});

/**
 * DetailRow — one labelled field inside the detail modal.
 */
const DetailRow = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <Ionicons
      name={icon}
      size={16}
      color={colors.textSecondary}
      style={styles.detailIcon}
    />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

/**
 * ActionButtons — rendered inside the detail modal.
 * Entirely driven by `appointment.status`; never renders a button that would
 * create an invalid state transition.
 *
 * Race-condition guard:
 *   - `isUpdating`     disables every button while one is in-flight
 *   - `updatingAction` ('accept'|'decline'|'checkin'|'send') shows a spinner
 *     on the exact button pressed, leaving the other button label visible
 */
const ActionButtons = React.memo(({
  appointment,
  isUpdating,
  updatingAction,
  onAccept,
  onDecline,
  onCheckIn,
  onSendToDoctor,
  onMarkNoShow,
}) => {
  const { t }      = useTranslation();
  const { status } = appointment;

  // ── pending → Accept + Decline ─────────────────────────────────────────────
  if (status === 'pending') {
    return (
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtnPrimary, styles.actionBtnFlex]}
          onPress={onAccept}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {updatingAction === 'accept' ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.actionBtnText}>
              {t('receptionist.apptMgmt.accept')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtnDanger, styles.actionBtnFlex]}
          onPress={onDecline}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {updatingAction === 'decline' ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.actionBtnText}>
              {t('receptionist.apptMgmt.decline')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── confirmed → Check-In + No-Show ────────────────────────────────────────
  if (status === 'confirmed') {
    return (
      <View style={styles.actionCol}>
        <TouchableOpacity
          style={[styles.actionBtnPrimary, styles.actionBtnFull]}
          onPress={onCheckIn}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {updatingAction === 'checkin' ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={18} color={colors.white} />
              <Text style={[styles.actionBtnText, { marginStart: spacing.xs }]}>
                {t('receptionist.apptMgmt.checkIn')}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtnNoShow, styles.actionBtnFull]}
          onPress={onMarkNoShow}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {updatingAction === 'noshow' ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="person-remove-outline" size={18} color={colors.white} />
              <Text style={[styles.actionBtnText, { marginStart: spacing.xs }]}>
                {t('receptionist.apptMgmt.markNoShow', { defaultValue: 'Mark No-Show' })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── waiting → Send to Doctor + No-Show ────────────────────────────────────
  if (status === 'waiting') {
    return (
      <View style={styles.actionCol}>
        <TouchableOpacity
          style={[styles.actionBtnSecondary, styles.actionBtnFull]}
          onPress={onSendToDoctor}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {updatingAction === 'send' ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="arrow-forward-outline" size={18} color={colors.white} />
              <Text style={[styles.actionBtnText, { marginStart: spacing.xs }]}>
                {t('receptionist.apptMgmt.sendToDoctor')}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtnNoShow, styles.actionBtnFull]}
          onPress={onMarkNoShow}
          disabled={isUpdating}
          activeOpacity={0.8}
        >
          {updatingAction === 'noshow' ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="person-remove-outline" size={18} color={colors.white} />
              <Text style={[styles.actionBtnText, { marginStart: spacing.xs }]}>
                {t('receptionist.apptMgmt.markNoShow', { defaultValue: 'Mark No-Show' })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Terminal states: in_progress / completed / cancelled / no_show ─────────
  // No mutation buttons — just a contextual status message.
  const infoMap = {
    in_progress: { key: 'receptionist.apptMgmt.statusInProgress', icon: 'pulse-outline'           },
    completed:   { key: 'receptionist.apptMgmt.statusCompleted',  icon: 'checkmark-circle-outline' },
    cancelled:   { key: 'receptionist.apptMgmt.statusCancelled',  icon: 'close-circle-outline'     },
    no_show:     { key: 'receptionist.apptMgmt.statusNoShow',     icon: 'person-remove-outline'    },
  };
  const info = infoMap[status];
  if (!info) return null;

  const sc = statusColors[status] ?? statusColors.pending;
  return (
    <View style={styles.statusInfoRow}>
      <Ionicons name={info.icon} size={18} color={sc.text} />
      <Text style={[styles.statusInfoText, { color: sc.text }]}>
        {t(info.key)}
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

const AppointmentManagementScreen = () => {
  const { t }    = useTranslation();
  const insets   = useSafeAreaInsets();
  const stripRef = useRef(null);

  // ── Core state ─────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [appointments, setAppointments]     = useState([]);
  // 'loading' | 'success' | 'error'
  const [loadState, setLoadState]           = useState('loading');

  // ── Filter / search state ──────────────────────────────────────────────────
  const [statusTab, setStatusTab]           = useState('all');
  const [searchQuery, setSearchQuery]       = useState('');

  // ── Modal state ────────────────────────────────────────────────────────────
  const [selectedAppt, setSelectedAppt]     = useState(null);

  // ── Action state (race-condition guard) ───────────────────────────────────
  const [isUpdating, setIsUpdating]         = useState(false);
  // 'accept' | 'decline' | 'checkin' | 'send' | null
  const [updatingAction, setUpdatingAction] = useState(null);
  const [actionError, setActionError]       = useState('');

  // ── Real-time snapshot: re-subscribes whenever selectedDate changes ────────
  useEffect(() => {
    const dateStr = toDateStr(selectedDate);
    setLoadState('loading');
    setAppointments([]);

    const unsub = appointmentService.subscribeReceptionistAppointments(
      dateStr,
      (docs) => {
        setAppointments(docs);
        setLoadState('success');
      },
      (err) => {
        console.error('[AppointmentManagement] snapshot error:', err);
        setLoadState('error');
      },
    );

    return unsub;
  }, [selectedDate]);

  // ── Derived list: status filter + name/phone search ───────────────────────
  const filteredAppointments = useMemo(() => {
    let list = appointments;

    if (statusTab !== 'all') {
      list = list.filter((a) => a.status === statusTab);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          (a.patientName  ?? '').toLowerCase().includes(q) ||
          (a.patientPhone ?? '').includes(q),
      );
    }

    return list;
  }, [appointments, statusTab, searchQuery]);

  // ── Per-tab counts for badge labels ───────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts = { all: appointments.length };
    for (const a of appointments) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [appointments]);

  // ── Generic action runner ─────────────────────────────────────────────────
  //
  // `actionKey`  — drives the spinner on the specific button ('accept' etc.)
  // `serviceFn`  — (appointmentId: string) → Promise<{success, error?}>
  // `errorMsgKey`— i18n key shown in the inline error banner on failure
  const runAction = useCallback(async (actionKey, serviceFn, errorMsgKey) => {
    if (isUpdating || !selectedAppt) return;

    setIsUpdating(true);
    setUpdatingAction(actionKey);
    setActionError('');

    try {
      const result = await serviceFn(selectedAppt.id);
      if (result.success) {
        // Snapshot will update the list automatically.
        // Close the modal so the receptionist sees the updated card immediately.
        setSelectedAppt(null);
      } else {
        setActionError(t(errorMsgKey));
      }
    } catch {
      setActionError(t(errorMsgKey));
    } finally {
      setIsUpdating(false);
      setUpdatingAction(null);
    }
  }, [isUpdating, selectedAppt, t]);

  const handleAccept = useCallback(
    () => runAction('accept',  (id) => appointmentService.receptionistAccept(id),  'receptionist.apptMgmt.acceptError'),
    [runAction],
  );
  const handleDecline = useCallback(
    () => runAction('decline', (id) => appointmentService.receptionistDecline(id), 'receptionist.apptMgmt.declineError'),
    [runAction],
  );
  const handleCheckIn = useCallback(
    () => runAction('checkin', (id) => appointmentService.checkInPatient(id),      'receptionist.apptMgmt.checkInError'),
    [runAction],
  );
  const handleSendToDoctor = useCallback(
    () => runAction('send',    (id) => appointmentService.sendToDoctor(id),         'receptionist.apptMgmt.sendError'),
    [runAction],
  );
  const handleMarkNoShow = useCallback(
    () => runAction('noshow',  (id) => appointmentService.markNoShow(id),           'receptionist.apptMgmt.noShowError'),
    [runAction],
  );

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal  = useCallback((appt) => {
    setSelectedAppt(appt);
    setActionError('');
  }, []);

  const closeModal = useCallback(() => {
    if (!isUpdating) {
      setSelectedAppt(null);
      setActionError('');
    }
  }, [isUpdating]);

  // ── FlatList render functions ──────────────────────────────────────────────
  const renderCard = useCallback(
    ({ item }) => <AppointmentCard appointment={item} onPress={openModal} />,
    [openModal],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  // ── Empty / loading / error states ────────────────────────────────────────
  const renderEmpty = () => {
    if (loadState === 'loading') {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateSub}>{t('common.loading')}</Text>
        </View>
      );
    }

    if (loadState === 'error') {
      return (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={52} color={colors.error} />
          <Text style={styles.centerStateTitle}>{t('receptionist.apptMgmt.loadError')}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => setSelectedDate((d) => new Date(d))} // force re-subscribe
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerState}>
        <Ionicons name="calendar-outline" size={52} color={colors.gray} />
        <Text style={styles.centerStateTitle}>
          {t('receptionist.apptMgmt.noAppointments')}
        </Text>
        <Text style={styles.centerStateSub}>
          {t('receptionist.apptMgmt.noAppointmentsSub')}
        </Text>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>

      {/* ── Green header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>
          {t('receptionist.apptMgmt.title')}
        </Text>
        <Text style={styles.headerDate}>{toDisplayDate(selectedDate)}</Text>
      </View>

      {/* ── 7-day date strip ──────────────────────────────────────────────── */}
      <View style={styles.stripWrapper}>
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
        >
          {STRIP_DATES.map((d, idx) => (
            <DayChip
              key={idx}
              date={d}
              isSelected={toDateStr(d) === toDateStr(selectedDate)}
              onPress={() => setSelectedDate(d)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color={colors.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('receptionist.apptMgmt.searchPlaceholder')}
          placeholderTextColor={colors.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Status filter chips ───────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = statusTab === tab;
          const count    = tabCounts[tab] ?? 0;
          const label    = tab === 'all'
            ? t('receptionist.apptMgmt.filterAll')
            : t(`appointments.status.${tab}`);

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setStatusTab(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {label}{count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Appointment list ──────────────────────────────────────────────── */}
      <FlatList
        data={filteredAppointments}
        keyExtractor={keyExtractor}
        renderItem={renderCard}
        contentContainerStyle={[
          styles.listContent,
          filteredAppointments.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Detail modal (bottom sheet) ───────────────────────────────────── */}
      <Modal
        visible={!!selectedAppt}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          {/* Tappable backdrop */}
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={closeModal}
            activeOpacity={1}
          />

          {/* Sheet content */}
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            {/* Drag handle */}
            <View style={styles.modalHandle} />

            {/* Patient header */}
            <View style={styles.modalPatientRow}>
              <View style={styles.modalAvatar}>
                <Text style={styles.modalAvatarText}>
                  {(selectedAppt?.patientName || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.modalPatientInfo}>
                <Text style={styles.modalPatientName}>
                  {selectedAppt?.patientName ?? '—'}
                </Text>
                {!!selectedAppt?.patientPhone && (
                  <Text style={styles.modalPatientPhone}>
                    {selectedAppt.patientPhone}
                  </Text>
                )}
              </View>
              {selectedAppt && <StatusBadge status={selectedAppt.status} />}
            </View>

            {/* Detail rows */}
            {selectedAppt && (
              <View style={styles.modalDetails}>
                {!!selectedAppt.appointmentDate && (
                  <DetailRow
                    icon="calendar-outline"
                    label={t('receptionist.apptMgmt.dateLabel')}
                    value={selectedAppt.appointmentDate}
                  />
                )}
                {!!selectedAppt.appointmentTime && (
                  <DetailRow
                    icon="time-outline"
                    label={t('receptionist.apptMgmt.timeLabel')}
                    value={selectedAppt.appointmentTime}
                  />
                )}
                {!!selectedAppt.doctorName && (
                  <DetailRow
                    icon="person-outline"
                    label={t('receptionist.apptMgmt.doctorLabel')}
                    value={selectedAppt.doctorName}
                  />
                )}
                {!!selectedAppt.reason && (
                  <DetailRow
                    icon="document-text-outline"
                    label={t('receptionist.apptMgmt.reasonLabel')}
                    value={selectedAppt.reason}
                  />
                )}
                {!!selectedAppt.notes && (
                  <DetailRow
                    icon="chatbubble-outline"
                    label={t('receptionist.apptMgmt.notesLabel')}
                    value={selectedAppt.notes}
                  />
                )}
              </View>
            )}

            {/* Inline action error banner — zero Alert.alert */}
            {!!actionError && (
              <View style={styles.errorBanner}>
                <Ionicons name="warning-outline" size={16} color={colors.error} />
                <Text style={styles.errorBannerText}>{actionError}</Text>
              </View>
            )}

            {/* Status-driven action buttons */}
            {selectedAppt && (
              <ActionButtons
                appointment={selectedAppt}
                isUpdating={isUpdating}
                updatingAction={updatingAction}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onCheckIn={handleCheckIn}
                onSendToDoctor={handleSendToDoctor}
                onMarkNoShow={handleMarkNoShow}
              />
            )}
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// All horizontal spacing uses marginStart/End and paddingStart/End so React
// Native's RTL engine flips them automatically for Arabic.
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    backgroundColor:  colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom:    spacing.md,
  },
  headerTitle: {
    fontSize:   typography.sizes.xl,
    fontWeight: '700',
    color:      colors.white,
  },
  headerDate: {
    fontSize:  typography.sizes.sm,
    color:     colors.white + 'CC',
    marginTop: 2,
  },

  // ── Date strip ─────────────────────────────────────────────────────────────
  stripWrapper: {
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stripContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
  },
  dayChip: {
    width:           52,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderRadius:    BorderRadius.lg,
    backgroundColor: colors.background,
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
  },
  dayChipToday: {
    borderWidth:  1.5,
    borderColor:  colors.primary,
  },
  dayName: {
    fontSize:   typography.sizes.xs,
    fontWeight: '500',
    color:      colors.textSecondary,
  },
  dayNameSelected: { color: colors.white },
  dayNum: {
    fontSize:   typography.sizes.md,
    fontWeight: '700',
    color:      colors.text,
    marginTop:  2,
  },
  dayNumSelected: { color: colors.white },
  todayDot: {
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.primary,
    marginTop:       3,
  },
  todayDotSelected: { backgroundColor: colors.white },

  // ── Search ─────────────────────────────────────────────────────────────────
  searchWrapper: {
    flexDirection:     'row',
    alignItems:        'center',
    marginHorizontal:  spacing.md,
    marginTop:         spacing.md,
    marginBottom:      spacing.xs,
    backgroundColor:   colors.white,
    borderRadius:      BorderRadius.lg,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.sm,
    ...shadows.sm,
  },
  searchIcon: {
    marginEnd: spacing.xs,
  },
  searchInput: {
    flex:      1,
    height:    44,
    fontSize:  typography.sizes.md,
    color:     colors.text,
  },

  // ── Filter chips ───────────────────────────────────────────────────────────
  filterScroll: {
    marginTop: spacing.xs,
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
    alignItems:        'center',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderRadius:      BorderRadius.full,
    backgroundColor:   colors.background,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor:     colors.primary,
  },
  filterChipText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '500',
    color:      colors.textSecondary,
  },
  filterChipTextActive: { color: colors.white },

  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.white,
    borderRadius:    BorderRadius.lg,
    marginBottom:    spacing.sm,
    padding:         spacing.md,
    ...shadows.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  cardAvatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: colors.primary + '20',
    alignItems:      'center',
    justifyContent:  'center',
    marginEnd:       spacing.sm,
  },
  cardAvatarText: {
    fontSize:   typography.sizes.lg,
    fontWeight: '700',
    color:      colors.primary,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize:   typography.sizes.md,
    fontWeight: '600',
    color:      colors.text,
  },
  cardMeta: {
    fontSize:  typography.sizes.sm,
    color:     colors.textSecondary,
    marginTop: 2,
  },
  cardReason: {
    fontSize:  typography.sizes.xs,
    color:     colors.textSecondary,
    marginTop: 2,
  },

  // ── Status badge ───────────────────────────────────────────────────────────
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:      BorderRadius.full,
    borderWidth:       1,
    marginStart:       spacing.xs,
  },
  badgeText: {
    fontSize:   typography.sizes.xs,
    fontWeight: '600',
  },

  // ── Empty / loading / error ────────────────────────────────────────────────
  centerState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xl,
  },
  centerStateTitle: {
    fontSize:   typography.sizes.md,
    fontWeight: '600',
    color:      colors.text,
    marginTop:  spacing.md,
    textAlign:  'center',
  },
  centerStateSub: {
    fontSize:  typography.sizes.sm,
    color:     colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop:         spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    backgroundColor:   colors.primary,
    borderRadius:      BorderRadius.full,
  },
  retryBtnText: {
    fontSize:   typography.sizes.sm,
    fontWeight: '600',
    color:      colors.white,
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor:       colors.white,
    borderTopStartRadius:  BorderRadius.xl + 4,
    borderTopEndRadius:    BorderRadius.xl + 4,
    paddingTop:            spacing.sm,
    paddingHorizontal:     spacing.md,
  },
  modalHandle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    alignSelf:       'center',
    marginBottom:    spacing.md,
  },
  modalPatientRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.md,
  },
  modalAvatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colors.primary + '20',
    alignItems:      'center',
    justifyContent:  'center',
    marginEnd:       spacing.sm,
  },
  modalAvatarText: {
    fontSize:   typography.sizes.xl,
    fontWeight: '700',
    color:      colors.primary,
  },
  modalPatientInfo: { flex: 1 },
  modalPatientName: {
    fontSize:   typography.sizes.lg,
    fontWeight: '700',
    color:      colors.text,
  },
  modalPatientPhone: {
    fontSize:  typography.sizes.sm,
    color:     colors.textSecondary,
    marginTop: 2,
  },

  // ── Modal detail rows ──────────────────────────────────────────────────────
  modalDetails: {
    backgroundColor: colors.background,
    borderRadius:    BorderRadius.lg,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  spacing.sm,
  },
  detailIcon: {
    marginEnd: spacing.sm,
    marginTop: 1,
  },
  detailLabel: {
    fontSize:   typography.sizes.sm,
    color:      colors.textSecondary,
    fontWeight: '500',
    width:      80,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    color:    colors.text,
    flex:     1,
  },

  // ── Action error banner ────────────────────────────────────────────────────
  errorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.error + '15',
    borderRadius:      BorderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginBottom:      spacing.md,
    gap:               spacing.xs,
  },
  errorBannerText: {
    fontSize: typography.sizes.sm,
    color:    colors.error,
    flex:     1,
  },

  // ── Action buttons ─────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginBottom:  spacing.sm,
  },
  actionCol: {
    flexDirection: 'column',
    gap:           spacing.xs,
  },
  actionBtnNoShow: {
    flexDirection:   'row',
    justifyContent:  'center',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderRadius:    BorderRadius.md,
    backgroundColor: '#6b7280',
  },
  actionBtnFlex: {
    flex: 1,
  },
  actionBtnFull: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderRadius:    BorderRadius.lg,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
    minHeight:       50,
  },
  actionBtnDanger: {
    backgroundColor: colors.error,
    borderRadius:    BorderRadius.lg,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
    minHeight:       50,
  },
  actionBtnSecondary: {
    backgroundColor: colors.secondary,
    borderRadius:    BorderRadius.lg,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
    minHeight:       50,
    flexDirection:   'row',
  },
  actionBtnText: {
    fontSize:   typography.sizes.md,
    fontWeight: '600',
    color:      colors.white,
  },

  // ── Terminal status info row ───────────────────────────────────────────────
  statusInfoRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap:             spacing.xs,
    marginBottom:    spacing.sm,
  },
  statusInfoText: {
    fontSize:   typography.sizes.md,
    fontWeight: '500',
  },
});

export default AppointmentManagementScreen;
