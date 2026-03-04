import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import appointmentService from '../../services/appointmentService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../config/theme';

// ── Status display config ─────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:      { label: 'معلق',        color: '#f59e0b' },
  confirmed:    { label: 'مؤكد',        color: '#10b981' },
  completed:    { label: 'مكتمل',       color: '#3b82f6' },
  cancelled:    { label: 'ملغي',        color: '#ef4444' },
  rejected:     { label: 'مرفوض',       color: '#ef4444' },
  'checked-in': { label: 'وصل المريض', color: '#8b5cf6' },
};

// ── Filter tabs ───────────────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',       label: 'الكل' },
  { key: 'pending',   label: 'معلق' },
  { key: 'confirmed', label: 'مؤكد' },
  { key: 'completed', label: 'مكتمل' },
];

// ── Main screen ───────────────────────────────────────────────────────────
const AppointmentManagementScreen = () => {
  const { user, userProfile } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    // Receptionists listen on their linked doctor's appointments
    const doctorId = userProfile?.doctorId;
    if (!user || !doctorId) return;

    const unsubscribe = firestoreService.listenToAppointments(
      doctorId,
      'doctor',
      (updated) => {
        setAppointments(updated);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => { if (unsubscribe) unsubscribe(); };
  }, [user, userProfile]);

  // ── Filtering + sorting ───────────────────────────────────────────────
  const displayed = (
    activeFilter === 'all'
      ? appointments
      : appointments.filter((a) => a.status === activeFilter)
  ).slice().sort((a, b) => {
    const da = a.appointmentDate?.toDate?.() || new Date(a.appointmentDate);
    const db = b.appointmentDate?.toDate?.() || new Date(b.appointmentDate);
    return db - da;
  });

  // ── Actions ───────────────────────────────────────────────────────────
  const handleConfirm = (id) => {
    Alert.alert('تأكيد الموعد', 'هل تريد تأكيد هذا الموعد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        onPress: async () => {
          setActionLoading(id);
          const result = await appointmentService.confirmAppointment(id);
          setActionLoading(null);
          if (!result.success) Alert.alert('خطأ', result.error || 'فشل تأكيد الموعد');
        },
      },
    ]);
  };

  const handleReject = (id) => {
    Alert.alert('رفض الموعد', 'هل تريد رفض هذا الموعد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'رفض',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(id);
          const result = await appointmentService.updateAppointmentStatus(id, 'rejected');
          setActionLoading(null);
          if (!result.success) Alert.alert('خطأ', result.error || 'فشل رفض الموعد');
        },
      },
    ]);
  };

  const handleCheckIn = async (id) => {
    setActionLoading(id);
    const result = await appointmentService.updateAppointmentStatus(id, 'checked-in');
    setActionLoading(null);
    if (!result.success) Alert.alert('خطأ', result.error || 'فشل تسجيل وصول المريض');
  };

  // ── Render one card ───────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const aptDate = item.appointmentDate?.toDate?.() || new Date(item.appointmentDate);
    const cfg = STATUS_CONFIG[item.status] || { label: item.status, color: colors.gray };
    const isProcessing = actionLoading === item.id;
    const isNew =
      (Date.now() - (item.createdAt?.toDate?.() || new Date(item.createdAt)).getTime()) < 300000;

    return (
      <View style={[styles.card, isNew && styles.newCard]}>
        {isNew && (
          <View style={styles.newPip}>
            <Text style={styles.newPipText}>جديد</Text>
          </View>
        )}

        {/* Name + badge */}
        <View style={styles.cardHeader}>
          <Text style={styles.patientName}>{item.patientName || 'مريض'}</Text>
          <View style={[styles.badge, { backgroundColor: cfg.color + '20', borderColor: cfg.color }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Date & time */}
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>
            {aptDate.toLocaleDateString('ar-IQ', {
              weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Text>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={styles.metaIconSpaced} />
          <Text style={styles.metaText}>
            {item.appointmentTime ||
              aptDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Reason / notes */}
        {!!item.reason && (
          <Text style={styles.reason} numberOfLines={2}>السبب: {item.reason}</Text>
        )}

        {/* Actions or spinner */}
        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.actionLoader} />
        ) : (
          <>
            {item.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.confirmBtn]}
                  onPress={() => handleConfirm(item.id)}
                >
                  <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                  <Text style={styles.actionBtnText}>تأكيد</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(item.id)}
                >
                  <Ionicons name="close-circle" size={16} color={colors.error} />
                  <Text style={[styles.actionBtnText, { color: colors.error }]}>رفض</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === 'confirmed' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.checkInBtn]}
                  onPress={() => handleCheckIn(item.id)}
                >
                  <Ionicons name="clipboard-outline" size={16} color={colors.white} />
                  <Text style={styles.actionBtnText}>تسجيل الوصول</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Filter tabs ── */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === f.key && styles.filterTabTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(true)}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={56} color={colors.gray} />
            <Text style={styles.emptyText}>لا توجد مواعيد</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filters: {
    flexDirection: 'row', backgroundColor: colors.white,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm,
  },
  filterTab: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center', backgroundColor: colors.background },
  filterTabActive: { backgroundColor: colors.primary + '20' },
  filterTabText: { fontSize: typography.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  filterTabTextActive: { color: colors.primary, fontWeight: '700' },

  list: { padding: spacing.md, paddingBottom: spacing.xl },

  card: {
    backgroundColor: colors.white, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  newCard: { borderColor: colors.primary, borderWidth: 2 },
  newPip: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    backgroundColor: colors.error, paddingHorizontal: spacing.sm,
    paddingVertical: 3, borderRadius: 4,
  },
  newPipText: { color: colors.white, fontSize: typography.sizes.xs, fontWeight: '700' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  patientName: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: typography.sizes.xs, fontWeight: '600' },

  cardMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, flexWrap: 'wrap', gap: spacing.xs },
  metaIconSpaced: { marginLeft: spacing.sm },
  metaText: { fontSize: typography.sizes.sm, color: colors.textSecondary },

  reason: { fontSize: typography.sizes.sm, color: colors.textSecondary, fontStyle: 'italic', marginBottom: spacing.sm },

  actions: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: 8, gap: spacing.xs },
  confirmBtn:  { backgroundColor: colors.success },
  rejectBtn:   { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.error },
  checkInBtn:  { backgroundColor: colors.primary },
  actionBtnText: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.white },
  actionLoader: { marginTop: spacing.sm },

  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { fontSize: typography.sizes.md, color: colors.textSecondary, marginTop: spacing.md },
});

export default AppointmentManagementScreen;
