import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import firestoreService from '../../firebase/firestoreService';
import { colors, spacing, typography } from '../../config/theme';

const DoctorHomeScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [revenueLoading, setRevenueLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = firestoreService.subscribeToAppointments(
      'doctor',
      user.uid,
      setAppointments
    );
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const loadMonthlyRevenue = async () => {
      try {
        setRevenueLoading(true);
        const revenue = await firestoreService.calculateMonthlyRevenue(user.uid);
        setMonthlyRevenue(revenue);
      } catch (error) {
        console.error('Error loading monthly revenue:', error);
      } finally {
        setRevenueLoading(false);
      }
    };

    loadMonthlyRevenue();
  }, [user.uid]);

  const prioritizedAppointments = appointments.sort((a, b) => {
    const statusOrder = { Confirmed: 0, Pending: 1, Completed: 2, Cancelled: 3 };
    return (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
  });

  const filteredAppointments = prioritizedAppointments.filter(appointment =>
    appointment.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFinishVisit = (appointment) => {
    navigation.navigate('DoctorVisitNotes', { appointment });
  };

  const handleViewHistory = (patientId) => {
    navigation.navigate('PatientHistory', { patientId });
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Revenue Dashboard */}
      <View style={styles.revenueCard}>
        <View style={styles.revenueHeader}>
          <View>
            <Text style={styles.revenueLabel}>Monthly Revenue</Text>
            {revenueLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.revenueAmount}>${monthlyRevenue.toFixed(2)}</Text>
            )}
          </View>
          <View style={styles.signOutButton}>
            <TouchableOpacity onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search appointments..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor={colors.textSecondary}
      />

      {/* Appointments List */}
      <FlatList
        data={filteredAppointments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.appointmentCard}>
            <View style={styles.cardHeader}>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{item.patientName}</Text>
                <Text style={styles.appointmentTime}>
                  {item.appointmentDate} at {item.appointmentTime}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'Confirmed' && styles.statusConfirmed,
                  item.status === 'Pending' && styles.statusPending,
                  item.status === 'Completed' && styles.statusCompleted,
                ]}
              >
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            {item.reason && (
              <Text style={styles.reason}>Reason: {item.reason}</Text>
            )}

            {item.status === 'Confirmed' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => handleFinishVisit(item)}
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                  <Text style={styles.buttonText}>Finish Visit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => handleViewHistory(item.patientId)}
                >
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <Text style={styles.buttonTextSecondary}>History</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  revenueCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  revenueAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.primary,
  },
  signOutButton: {
    padding: spacing.sm,
  },
  searchBar: {
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  appointmentCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  appointmentTime: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  statusConfirmed: {
    backgroundColor: colors.success + '20',
  },
  statusPending: {
    backgroundColor: colors.warning + '20',
  },
  statusCompleted: {
    backgroundColor: colors.primary + '20',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  reason: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  buttonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
});

export default DoctorHomeScreen;