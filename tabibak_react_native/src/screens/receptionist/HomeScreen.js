import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../../contexts/AuthContext';
import firestoreService from '../../firebase/firestoreService';
import appointmentService from '../../services/appointmentService';
import { colors, spacing, typography } from '../../config/theme';

const ReceptionistHomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [sound, setSound] = useState();
  const [searchPhoneNumber, setSearchPhoneNumber] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const playSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/notification.mp3')
        );
        setSound(sound);
        await sound.playAsync();
      } catch (error) {
        console.error('Error playing sound:', error);
      }
    };

    const unsubscribe = firestoreService.subscribeToAppointments(
      'receptionist',
      user.uid,
      updatedAppointments => {
        const newPendingAppointments = updatedAppointments.filter(
          appointment => appointment.status === 'Pending'
        );

        if (
          newPendingAppointments.length >
          appointments.filter(a => a.status === 'Pending').length
        ) {
          playSound();
        }

        setAppointments(updatedAppointments);
      }
    );

    return () => {
      unsubscribe();
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [user.uid, appointments]);

  const handleSearchPatient = async () => {
    if (!searchPhoneNumber.trim()) {
      Alert.alert('Input Required', 'Please enter a phone number');
      return;
    }

    try {
      setSearchLoading(true);
      const result = await firestoreService.findPatientByPhone(searchPhoneNumber);
      setSearchResult(result);
    } catch (error) {
      console.error('Error searching patient:', error);
      Alert.alert('Error', 'Failed to search patient');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAcceptAppointment = async (appointmentId) => {
    try {
      const result = await appointmentService.updateAppointmentStatus(
        appointmentId,
        'Confirmed'
      );
      if (result.success) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Appointment confirmed!', ToastAndroid.SHORT);
        } else {
          Alert.alert('Success', 'Appointment confirmed!');
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to confirm appointment');
      }
    } catch (error) {
      console.error('Error accepting appointment:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleRejectAppointment = async (appointmentId) => {
    Alert.alert(
      'Reject Appointment',
      'Are you sure you want to reject this appointment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await appointmentService.updateAppointmentStatus(
                appointmentId,
                'Rejected'
              );
              if (result.success) {
                if (Platform.OS === 'android') {
                  ToastAndroid.show('Appointment rejected!', ToastAndroid.SHORT);
                } else {
                  Alert.alert('Success', 'Appointment rejected!');
                }
              } else {
                Alert.alert('Error', result.error || 'Failed to reject appointment');
              }
            } catch (error) {
              console.error('Error rejecting appointment:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          },
        },
      ]
    );
  };

  const handleCheckIn = async (appointment) => {
    try {
      // Log check-in
      await firestoreService.logCheckIn(appointment.id, appointment.doctorId);

      // Update appointment status
      const result = await appointmentService.updateAppointmentStatus(
        appointment.id,
        'Checked-in'
      );

      if (result.success) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Patient checked in!', ToastAndroid.SHORT);
        } else {
          Alert.alert('Success', 'Patient checked in!');
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to check in patient');
      }
    } catch (error) {
      console.error('Error checking in patient:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleBookAppointment = (patient) => {
    if (searchResult?.patient) {
      navigation.navigate('BookAppointment', { patientId: patient.id });
    }
  };

  const handleRegisterNewPatient = () => {
    navigation.navigate('ReceptionistPatientRegistration', {
      phoneNumber: searchPhoneNumber,
    });
  };

  const pendingAppointments = appointments.filter(
    appointment => appointment.status === 'Pending'
  );
  const confirmedAppointments = appointments.filter(
    appointment => appointment.status === 'Confirmed'
  );

  return (
    <View style={styles.container}>
      {/* Patient Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient by phone..."
            value={searchPhoneNumber}
            onChangeText={setSearchPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearchPatient}
          disabled={searchLoading}
        >
          {searchLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="search" size={20} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Result */}
      {searchResult && (
        <View style={styles.searchResultContainer}>
          {searchResult.success && searchResult.patient ? (
            <View style={styles.resultCard}>
              <View style={styles.resultInfo}>
                <Ionicons name="person-circle" size={40} color={colors.primary} />
                <View style={styles.resultText}>
                  <Text style={styles.resultName}>{searchResult.patient.name}</Text>
                  <Text style={styles.resultPhone}>{searchResult.patient.phoneNumber}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => handleBookAppointment(searchResult.patient)}
              >
                <Text style={styles.bookButtonText}>Book Appointment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noResultCard}>
              <Text style={styles.noResultText}>Patient not found</Text>
              <TouchableOpacity
                style={styles.registerButton}
                onPress={handleRegisterNewPatient}
              >
                <Ionicons name="person-add" size={18} color={colors.white} />
                <Text style={styles.registerButtonText}>Register New Patient</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Appointments Sections */}
      <FlatList
        data={[
          ...pendingAppointments.map(apt => ({ ...apt, section: 'Pending' })),
          ...confirmedAppointments.map(apt => ({ ...apt, section: 'Confirmed' })),
        ]}
        keyExtractor={(item, index) => item.id + index}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View>
            {item.section === 'Pending' && (
              <View style={styles.appointmentCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.patientName}>{item.patientName}</Text>
                    <Text style={styles.appointmentTime}>
                      {item.appointmentDate} at {item.appointmentTime}
                    </Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.badgeText}>Pending</Text>
                  </View>
                </View>

                {item.reason && (
                  <Text style={styles.reason}>Reason: {item.reason}</Text>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.acceptButton]}
                    onPress={() => handleAcceptAppointment(item.id)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                    <Text style={styles.buttonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.rejectButton]}
                    onPress={() => handleRejectAppointment(item.id)}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.error} />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {item.section === 'Confirmed' && (
              <View style={styles.appointmentCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.patientName}>{item.patientName}</Text>
                    <Text style={styles.appointmentTime}>
                      {item.appointmentDate} at {item.appointmentTime}
                    </Text>
                  </View>
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.badgeText}>Confirmed</Text>
                  </View>
                </View>

                {item.reason && (
                  <Text style={styles.reason}>Reason: {item.reason}</Text>
                )}

                {item.status === 'Confirmed' && (
                  <TouchableOpacity
                    style={[styles.button, styles.checkInButton]}
                    onPress={() => handleCheckIn(item)}
                  >
                    <Ionicons name="clipboard-outline" size={18} color={colors.white} />
                    <Text style={styles.buttonText}>Check-in</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={colors.gray} />
            <Text style={styles.emptyText}>No appointments</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchSection: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultContainer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  resultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  resultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  resultPhone: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  bookButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  noResultCard: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  noResultText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  registerButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.sm,
  },
  registerButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
  pendingBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  confirmedBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  badgeText: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  acceptButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.error,
  },
  checkInButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});

export default ReceptionistHomeScreen;