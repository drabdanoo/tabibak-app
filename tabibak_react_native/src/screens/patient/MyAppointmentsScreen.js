import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import appointmentService from '../../services/appointmentService';
import { colors, spacing, typography, BorderRadius } from '../../config/theme';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:    { label: 'بانتظار التأكيد', color: '#92400e', bgColor: '#fef3c7' },
  confirmed:  { label: 'مؤكد',            color: '#1e40af', bgColor: '#dbeafe' },
  completed:  { label: 'مكتمل',           color: '#065f46', bgColor: '#d1fae5' },
  cancelled:  { label: 'ملغي',            color: '#374151', bgColor: '#f3f4f6' },
  rejected:   { label: 'مرفوض',           color: '#991b1b', bgColor: '#fee2e2' },
  'checked-in': { label: 'في العيادة',    color: '#5b21b6', bgColor: '#ede9fe' },
};

const getStatus = (rawStatus = '') => {
  const key = rawStatus.toLowerCase().replace(/-/g, '-');
  return STATUS[key] ?? { label: rawStatus, color: colors.textSecondary, bgColor: colors.backgroundLight };
};

// ─── Date / time helpers ──────────────────────────────────────────────────────
const formatDate = (dateObj) => {
  if (!dateObj) return '—';
  return dateObj.toLocaleDateString('ar-IQ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTime = (dateObj) => {
  if (!dateObj) return '';
  return dateObj.toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// ─── Appointment card ─────────────────────────────────────────────────────────
const AppointmentCard = ({ item, onCancel }) => {
  const statusCfg = getStatus(item.status);
  const dateObj = item.appointmentDateObj;
  const canCancel = ['pending', 'confirmed'].includes((item.status ?? '').toLowerCase());

  return (
    <View style={styles.card}>
      {/* Doctor name + status badge */}
      <View style={styles.cardHeader}>
        <View style={styles.doctorRow}>
          <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{item.doctorName ?? 'الطبيب'}</Text>
            {item.specialty ? (
              <Text style={styles.specialty}>{item.specialty}</Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: statusCfg.bgColor }]}>
          <Text style={[styles.badgeText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* Date & time */}
      <View style={styles.detailRow}>
        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.detailText}>{formatDate(dateObj)}</Text>
      </View>
      {dateObj && (
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{formatTime(dateObj)}</Text>
        </View>
      )}

      {/* Reason */}
      {item.reason ? (
        <View style={styles.detailRow}>
          <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText} numberOfLines={2}>{item.reason}</Text>
        </View>
      ) : null}

      {/* Cancel button — only for pending/confirmed */}
      {canCancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => onCancel(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={18} color={colors.error} />
          <Text style={styles.cancelButtonText}>إلغاء الموعد</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
const UPCOMING_STATUSES = new Set(['pending', 'confirmed', 'checked-in']);

export default function MyAppointmentsScreen() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'past'
  const [cancellingId, setCancellingId] = useState(null);

  // ─── Load ─────────────────────────────────────────────────────────────────
  const loadAppointments = useCallback(async () => {
    if (!user) return;
    try {
      const data = await appointmentService.getAppointmentsByPatient(user.uid);
      setAppointments(data);
    } catch (err) {
      console.error('Error loading appointments:', err);
      Alert.alert('خطأ', 'تعذّر تحميل المواعيد. يرجى المحاولة مجدداً.');
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    loadAppointments().finally(() => setLoading(false));
  }, [loadAppointments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = appointments.filter((a) => {
    const s = (a.status ?? '').toLowerCase();
    return filter === 'upcoming' ? UPCOMING_STATUSES.has(s) : !UPCOMING_STATUSES.has(s);
  });

  // ─── Cancel ───────────────────────────────────────────────────────────────
  const handleCancel = (item) => {
    Alert.alert(
      'إلغاء الموعد',
      'هل أنت متأكد من رغبتك في إلغاء هذا الموعد؟',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'نعم، إلغاء',
          style: 'destructive',
          onPress: () => confirmCancel(item),
        },
      ],
    );
  };

  const confirmCancel = async (item) => {
    setCancellingId(item.id);
    try {
      const result = await appointmentService.cancelAppointment(item.id, '');
      if (result.success) {
        // Optimistic update — mark as cancelled locally without refetch
        setAppointments((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, status: 'cancelled' } : a)),
        );
      } else {
        Alert.alert('خطأ', result.error || 'فشل إلغاء الموعد. يرجى المحاولة مجدداً.');
      }
    } catch (err) {
      Alert.alert('خطأ', 'حدث خطأ غير متوقع. يرجى المحاولة مجدداً.');
      console.error('Cancel error:', err);
    } finally {
      setCancellingId(null);
    }
  };

  // ─── Empty state ──────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={72} color={colors.border} />
      <Text style={styles.emptyTitle}>
        {filter === 'upcoming' ? 'لا توجد مواعيد قادمة' : 'لا توجد مواعيد سابقة'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'upcoming' ? 'احجز موعداً مع طبيبك من قائمة الأطباء' : ''}
      </Text>
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مواعيدي</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, filter === 'upcoming' && styles.tabActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.tabText, filter === 'upcoming' && styles.tabTextActive]}>
            القادمة
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'past' && styles.tabActive]}
          onPress={() => setFilter('past')}
        >
          <Text style={[styles.tabText, filter === 'past' && styles.tabTextActive]}>
            السابقة
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          cancellingId === item.id ? (
            <View style={[styles.card, styles.cardCancelling]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.cancellingText}>جارٍ الإلغاء...</Text>
            </View>
          ) : (
            <AppointmentCard item={item} onCancel={handleCancel} />
          )
        )}
        contentContainerStyle={filtered.length === 0 ? styles.flatListEmpty : styles.flatListContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // ── List ──────────────────────────────────────────────────────────────────
  flatListContent: {
    padding: spacing.md,
  },
  flatListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.white,
    borderRadius: BorderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCancelling: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 80,
  },
  cancellingText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  doctorInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  doctorName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
  },
  specialty: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginLeft: spacing.sm,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.xs,
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  // ── Empty state ───────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
