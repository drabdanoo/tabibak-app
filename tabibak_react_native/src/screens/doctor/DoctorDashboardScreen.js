import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../config/theme';

const STATUS_LABELS = {
  pending: 'معلق',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
  'checked-in': 'وصل',
};

export default function DoctorDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ today: 0, pending: 0, confirmed: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = firestoreService.listenToAppointments(
      user.uid,
      'doctor',
      (updatedAppointments) => {
        setAppointments(updatedAppointments);
        calculateStats(updatedAppointments);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => { if (unsubscribe) unsubscribe(); };
  }, [user]);

  const calculateStats = (list) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    setStats({
      today: list.filter((a) => {
        const d = a.appointmentDate?.toDate?.() || new Date(a.appointmentDate);
        return d >= today && d <= todayEnd;
      }).length,
      pending:   list.filter((a) => a.status === 'pending').length,
      confirmed: list.filter((a) => a.status === 'confirmed').length,
      completed: list.filter((a) => a.status === 'completed').length,
    });
  };

  const onRefresh = () => setRefreshing(true);

  // ── Sign-out (native-only Alert — no window.*) ────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('خطأ', 'فشل تسجيل الخروج. يرجى المحاولة مرة أخرى.');
            }
          },
        },
      ]
    );
  };

  const renderStatCard = (title, value, icon, color) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  const renderAppointmentCard = (appointment) => {
    const aptDate =
      appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
    const statusColor =
      appointment.status === 'pending'   ? colors.warning :
      appointment.status === 'confirmed' ? colors.success :
      appointment.status === 'completed' ? colors.info :
      appointment.status === 'cancelled' ? colors.error :
      colors.gray;

    return (
      <TouchableOpacity
        key={appointment.id}
        style={styles.appointmentCard}
        onPress={() => navigation.navigate('Appointments')}
        activeOpacity={0.8}
      >
        <View style={styles.appointmentHeader}>
          <View style={styles.appointmentInfo}>
            <Text style={styles.patientName}>
              {appointment.patientName || 'مريض'}
            </Text>
            <Text style={styles.appointmentReason}>
              {appointment.reason || 'استشارة عامة'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {STATUS_LABELS[appointment.status] || appointment.status}
            </Text>
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
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>جارٍ تحميل لوحة التحكم...</Text>
      </View>
    );
  }

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const todayAppointments = appointments
    .filter((apt) => {
      const d = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
      return d >= todayStart && d <= todayEnd;
    })
    .sort((a, b) => {
      const da = a.appointmentDate?.toDate?.() || new Date(a.appointmentDate);
      const db = b.appointmentDate?.toDate?.() || new Date(b.appointmentDate);
      return da - db;
    });

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
          <Text style={styles.welcomeText}>أهلاً، دكتور!</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('ar-IQ', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsGrid}>
          {renderStatCard('اليوم',  stats.today,     'today-outline',             colors.primary)}
          {renderStatCard('معلق',   stats.pending,   'hourglass-outline',         colors.warning)}
          {renderStatCard('مؤكد',   stats.confirmed, 'checkmark-circle-outline',  colors.success)}
          {renderStatCard('مكتمل',  stats.completed, 'checkmark-done-outline',    colors.info)}
        </View>

        {/* ── Today's appointments ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>مواعيد اليوم</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
              <Text style={styles.seeAllText}>عرض الكل</Text>
            </TouchableOpacity>
          </View>

          {todayAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color={colors.gray} />
              <Text style={styles.emptyText}>لا توجد مواعيد اليوم</Text>
            </View>
          ) : (
            todayAppointments.map(renderAppointmentCard)
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
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person" size={32} color={colors.primary} />
              <Text style={styles.actionText}>ملفي الشخصي</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { borderWidth: 1, borderColor: colors.error }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out" size={32} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>تسجيل الخروج</Text>
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm },
  statCard: {
    width: '48%', backgroundColor: colors.white, borderRadius: 12, padding: spacing.md,
    margin: spacing.xs, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  statIcon: { marginRight: spacing.md },
  statContent: { flex: 1 },
  statValue: { fontSize: typography.sizes.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  statTitle: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  section: { backgroundColor: colors.white, padding: spacing.md, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.sizes.lg, fontWeight: '600', color: colors.text },
  seeAllText: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: '600' },
  appointmentCard: { backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  appointmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  appointmentInfo: { flex: 1 },
  patientName: { fontSize: typography.sizes.md, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  appointmentReason: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 12 },
  statusText: { fontSize: typography.sizes.xs, color: colors.white, fontWeight: '600' },
  appointmentDetails: { flexDirection: 'row', marginTop: spacing.sm },
  appointmentDetail: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg },
  appointmentDetailText: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginLeft: spacing.xs },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: typography.sizes.md, color: colors.textSecondary, marginTop: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  actionCard: { width: '48%', backgroundColor: colors.background, borderRadius: 12, padding: spacing.md, margin: spacing.xs, alignItems: 'center' },
  actionText: { fontSize: typography.sizes.sm, color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
});
