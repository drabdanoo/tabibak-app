import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import notificationService from '../../services/notificationService';
import appointmentService from '../../services/appointmentService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../config/theme';

export default function ReceptionistDashboardScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const [unconfirmedAppointments, setUnconfirmedAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const previousCountRef = useRef(0);

  useEffect(() => {
    if (!user || !userProfile?.doctorId) return;

    // Listen for pending (unconfirmed) appointments
    const unsubscribePending = firestoreService.listenToUnconfirmedAppointments(
      userProfile.doctorId,
      (updatedAppointments) => {
        if (updatedAppointments.length > previousCountRef.current) {
          notificationService.playNotificationSound();
        }
        previousCountRef.current = updatedAppointments.length;
        setUnconfirmedAppointments(updatedAppointments);
        setLoading(false);
        setRefreshing(false);
      }
    );

    // Listen for all appointments (for stats)
    const unsubscribeAll = firestoreService.listenToAppointments(
      userProfile.doctorId,
      'doctor',
      (appointments) => setAllAppointments(appointments)
    );

    return () => {
      if (unsubscribePending) unsubscribePending();
      if (unsubscribeAll) unsubscribeAll();
    };
  }, [user, userProfile]);

  const onRefresh = () => setRefreshing(true);

  const handleConfirmAppointment = async (appointmentId) => {
    Alert.alert(
      'تأكيد الموعد',
      'هل تريد تأكيد هذا الموعد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          onPress: async () => {
            const result = await appointmentService.confirmAppointment(appointmentId);
            if (result.success) {
              Alert.alert('تم', 'تم تأكيد الموعد بنجاح');
            } else {
              Alert.alert('خطأ', result.error || 'فشل تأكيد الموعد');
            }
          },
        },
      ]
    );
  };

  const handleReschedule = (appointment) => {
    navigation.navigate('RescheduleAppointment', { appointment });
  };

  const renderAppointmentCard = (appointment) => {
    const aptDate =
      appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
    const isNew =
      (Date.now() - (appointment.createdAt?.toDate?.() || new Date(appointment.createdAt)).getTime()) < 300000;

    return (
      <View key={appointment.id} style={[styles.appointmentCard, isNew && styles.newAppointmentCard]}>
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>جديد</Text>
          </View>
        )}

        <View style={styles.appointmentHeader}>
          <View style={styles.appointmentInfo}>
            <Text style={styles.patientName}>{appointment.patientName || 'مريض'}</Text>
            <Text style={styles.appointmentReason}>{appointment.reason || 'استشارة عامة'}</Text>
          </View>
        </View>

        <View style={styles.appointmentDetails}>
          <View style={styles.appointmentDetail}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.appointmentDetailText}>
              {aptDate.toLocaleDateString('ar-IQ', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.appointmentDetail}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.appointmentDetailText}>
              {aptDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {appointment.notes && (
          <Text style={styles.notesText} numberOfLines={2}>
            ملاحظات: {appointment.notes}
          </Text>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={() => handleConfirmAppointment(appointment.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.white} />
            <Text style={styles.actionButtonText}>تأكيد</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rescheduleButton]}
            onPress={() => handleReschedule(appointment)}
          >
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>إعادة جدولة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>جارٍ التحميل...</Text>
      </View>
    );
  }

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const todayAppointments = allAppointments.filter((apt) => {
    const d = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
    return d >= todayStart && d <= todayEnd;
  });
  const confirmedToday = todayAppointments.filter((a) => a.status === 'confirmed').length;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>لوحة تحكم الاستقبال</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('ar-IQ', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="hourglass-outline" size={28} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{unconfirmedAppointments.length}</Text>
            <Text style={styles.statLabel}>في انتظار التأكيد</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle-outline" size={28} color={colors.success} />
            </View>
            <Text style={styles.statValue}>{confirmedToday}</Text>
            <Text style={styles.statLabel}>مؤكد اليوم</Text>
          </View>
        </View>

        {/* ── Pending appointments inbox ──
            FIX: badge was a <View> inside <Text> → crash on native.
                 Now badge sits next to the <Text> inside a <View> row. */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>في انتظار التأكيد</Text>
            {unconfirmedAppointments.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unconfirmedAppointments.length}</Text>
              </View>
            )}
          </View>

          {unconfirmedAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={64} color={colors.success} />
              <Text style={styles.emptyText}>أحسنت! لا توجد مواعيد معلقة</Text>
              <Text style={styles.emptySubtext}>جميع المواعيد تمت معالجتها</Text>
            </View>
          ) : (
            unconfirmedAppointments.map(renderAppointmentCard)
          )}
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Appointments')}
            >
              <Ionicons name="calendar" size={32} color={colors.primary} />
              <Text style={styles.actionText}>جميع المواعيد</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('PatientRegistration')}
            >
              <Ionicons name="person-add" size={32} color={colors.primary} />
              <Text style={styles.actionText}>تسجيل مريض</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications" size={32} color={colors.primary} />
              <Text style={styles.actionText}>الإشعارات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person" size={32} color={colors.primary} />
              <Text style={styles.actionText}>ملفي الشخصي</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, fontSize: typography.sizes.md, color: colors.textSecondary },
  scrollView: { flex: 1 },
  header: { backgroundColor: colors.white, padding: spacing.lg },
  welcomeText: { fontSize: typography.sizes.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, textAlign: 'right' },
  dateText: { fontSize: typography.sizes.sm, color: colors.textSecondary, textAlign: 'right' },
  statsContainer: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: spacing.md,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  statIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: typography.sizes.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  statLabel: { fontSize: typography.sizes.xs, color: colors.textSecondary, textAlign: 'center' },
  section: { backgroundColor: colors.white, padding: spacing.md, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.sizes.lg, fontWeight: '600', color: colors.text },
  badge: { backgroundColor: colors.error, borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: colors.white, fontSize: typography.sizes.xs, fontWeight: '700' },
  appointmentCard: {
    backgroundColor: colors.background, borderRadius: 12, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border || '#e0e0e0',
  },
  newAppointmentCard: { borderColor: colors.primary, borderWidth: 2 },
  newBadge: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    backgroundColor: colors.error, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 4,
  },
  newBadgeText: { color: colors.white, fontSize: typography.sizes.xs, fontWeight: '700' },
  appointmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  appointmentInfo: { flex: 1 },
  patientName: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  appointmentReason: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  appointmentDetails: { flexDirection: 'row', marginTop: spacing.sm },
  appointmentDetail: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg },
  appointmentDetailText: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginLeft: spacing.xs },
  notesText: { fontSize: typography.sizes.sm, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.sm },
  actionButtons: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: 8, gap: spacing.xs },
  confirmButton: { backgroundColor: colors.success },
  rescheduleButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary },
  actionButtonText: { fontSize: typography.sizes.sm, fontWeight: '600', color: colors.white },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.text, marginTop: spacing.md },
  emptySubtext: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  actionCard: { width: '48%', backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, margin: spacing.xs, alignItems: 'center' },
  actionText: { fontSize: typography.sizes.sm, color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
});
