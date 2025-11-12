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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../config/theme';

export default function DoctorDashboardScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({
    today: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let unsubscribe;

    if (user) {
      // Setup real-time listener for appointments
      unsubscribe = firestoreService.listenToAppointments(
        user.uid,
        'doctor',
        (updatedAppointments) => {
          setAppointments(updatedAppointments);
          calculateStats(updatedAppointments);
          setLoading(false);
          setRefreshing(false);
        }
      );
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const calculateStats = (appointmentsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayAppointments = appointmentsList.filter((apt) => {
      const aptDate = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
      return aptDate >= today && aptDate <= todayEnd;
    });

    const pending = appointmentsList.filter((apt) => apt.status === 'pending').length;
    const confirmed = appointmentsList.filter((apt) => apt.status === 'confirmed').length;
    const completed = appointmentsList.filter((apt) => apt.status === 'completed').length;

    setStats({
      today: todayAppointments.length,
      pending,
      confirmed,
      completed,
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
  };

  const handleLogout = async () => {
    // Use window.confirm for web, Alert.alert for native
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to logout?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
              { 
                text: 'Cancel', 
                style: 'cancel',
                onPress: () => {
                  resolve(false);
                }
              },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: () => {
                  resolve(true);
                }
              },
            ]
          );
        });
    
    if (!confirmed) {
      return;
    }
    
    try {
      const success = await signOut();
      
      if (!success) {
        if (Platform.OS === 'web') {
          window.alert('Failed to logout. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to logout. Please try again.');
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
      if (Platform.OS === 'web') {
        window.alert(`Failed to logout: ${error.message}`);
      } else {
        Alert.alert('Error', `Failed to logout: ${error.message}`);
      }
    }
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
    const aptDate = appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
    const statusColor = 
      appointment.status === 'pending' ? colors.warning :
      appointment.status === 'confirmed' ? colors.success :
      appointment.status === 'completed' ? colors.info :
      appointment.status === 'cancelled' ? colors.error :
      colors.gray;

    return (
      <TouchableOpacity
        key={appointment.id}
        style={styles.appointmentCard}
        onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: appointment.id })}
      >
        <View style={styles.appointmentHeader}>
          <View style={styles.appointmentInfo}>
            <Text style={styles.patientName}>{appointment.patientName || 'Unknown Patient'}</Text>
            <Text style={styles.appointmentReason}>{appointment.reason || 'General consultation'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{appointment.status}</Text>
          </View>
        </View>

        <View style={styles.appointmentDetails}>
          <View style={styles.appointmentDetail}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.appointmentDetailText}>
              {aptDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
          </View>

          <View style={styles.appointmentDetail}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.appointmentDetailText}>
              {aptDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
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
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const todayAppointments = appointments.filter((apt) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    const aptDate = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
    return aptDate >= today && aptDate <= todayEnd;
  }).sort((a, b) => {
    const dateA = a.appointmentDate?.toDate?.() || new Date(a.appointmentDate);
    const dateB = b.appointmentDate?.toDate?.() || new Date(b.appointmentDate);
    return dateA - dateB;
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back, Doctor!</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {renderStatCard('Today', stats.today, 'today-outline', colors.primary)}
          {renderStatCard('Pending', stats.pending, 'hourglass-outline', colors.warning)}
          {renderStatCard('Confirmed', stats.confirmed, 'checkmark-circle-outline', colors.success)}
          {renderStatCard('Completed', stats.completed, 'checkmark-done-outline', colors.info)}
        </View>

        {/* Today's Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Appointments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllAppointments')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {todayAppointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color={colors.gray} />
              <Text style={styles.emptyText}>No appointments today</Text>
            </View>
          ) : (
            todayAppointments.map(renderAppointmentCard)
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Appointments')}
            >
              <Ionicons name="calendar" size={32} color={colors.primary} />
              <Text style={styles.actionText}>View All Appointments</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionCard, { opacity: 0.5 }]}
              disabled={true}
            >
              <Ionicons name="folder-open" size={32} color={colors.gray} />
              <Text style={[styles.actionText, { color: colors.gray }]}>Patient Records (Coming Soon)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionCard, { opacity: 0.5 }]}
              disabled={true}
            >
              <Ionicons name="time" size={32} color={colors.gray} />
              <Text style={[styles.actionText, { color: colors.gray }]}>My Schedule (Coming Soon)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person" size={32} color={colors.primary} />
              <Text style={styles.actionText}>My Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionCard, { borderColor: colors.error }]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out" size={32} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.white,
    padding: spacing.lg,
  },
  welcomeText: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    margin: spacing.xs,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    marginRight: spacing.md,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statTitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
  },
  seeAllText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  appointmentCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  appointmentInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  appointmentReason: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  appointmentDetails: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  appointmentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  appointmentDetailText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    margin: spacing.xs,
    alignItems: 'center',
  },
  actionText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

