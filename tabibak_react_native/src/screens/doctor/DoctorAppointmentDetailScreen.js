import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../config/theme';

const DoctorAppointmentDetailScreen = ({ route, navigation }) => {
  const { appointment } = route.params;

  if (!appointment) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color={colors.error} />
        <Text style={styles.errorText}>Appointment not found</Text>
      </View>
    );
  }

  const isCompleted = appointment.status === 'Completed';

  const handleStartVisit = () => {
    if (isCompleted) {
      Alert.alert('Info', 'This appointment has already been completed.');
      return;
    }

    navigation.navigate('DoctorVisitNotes', {
      appointment,
    });
  };

  const handleViewHistory = () => {
    navigation.navigate('PatientHistory', {
      patientId: appointment.patientId,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Patient Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={48} color={colors.primary} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.patientName}>{appointment.patientName}</Text>
              <Text style={styles.patientPhone}>{appointment.patientPhone}</Text>
            </View>
            <View style={[
              styles.statusBadge,
              isCompleted ? styles.completedBadge : styles.pendingBadge
            ]}>
              <Text style={styles.statusText}>
                {isCompleted ? 'Completed' : appointment.status}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Appointment Details */}
          <View style={styles.section}>
            <View style={styles.iconRow}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={styles.label}>Appointment Date</Text>
            </View>
            <Text style={styles.value}>{appointment.appointmentDate}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.iconRow}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={styles.label}>Time</Text>
            </View>
            <Text style={styles.value}>{appointment.appointmentTime}</Text>
          </View>

          {appointment.reason && (
            <View style={styles.section}>
              <View style={styles.iconRow}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
                <Text style={styles.label}>Reason for Visit</Text>
              </View>
              <Text style={styles.value}>{appointment.reason}</Text>
            </View>
          )}
        </View>

        {/* Medical History Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Medical History</Text>
          <View style={styles.divider} />

          {appointment.medicalHistory ? (
            <>
              <View style={styles.section}>
                <View style={styles.iconRow}>
                  <Ionicons name="warning" size={20} color={colors.error} />
                  <Text style={styles.label}>Allergies</Text>
                </View>
                <Text style={styles.value}>
                  {appointment.medicalHistory.allergies || 'None'}
                </Text>
              </View>

              <View style={styles.section}>
                <View style={styles.iconRow}>
                  <Ionicons name="medkit" size={20} color={colors.primary} />
                  <Text style={styles.label}>Current Medications</Text>
                </View>
                <Text style={styles.value}>
                  {appointment.medicalHistory.currentMedications || 'None'}
                </Text>
              </View>

              <View style={styles.section}>
                <View style={styles.iconRow}>
                  <Ionicons name="fitness" size={20} color={colors.primary} />
                  <Text style={styles.label}>Chronic Conditions</Text>
                </View>
                <Text style={styles.value}>
                  {appointment.medicalHistory.chronicConditions || 'None'}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.noDataText}>No medical history available</Text>
          )}
        </View>

        {/* Completed Visit Notes (if applicable) */}
        {isCompleted && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Visit Summary</Text>
            <View style={styles.divider} />

            {appointment.diagnosis && (
              <View style={styles.section}>
                <Text style={styles.label}>Diagnosis</Text>
                <Text style={styles.value}>{appointment.diagnosis}</Text>
              </View>
            )}

            {appointment.prescription && (
              <View style={styles.section}>
                <Text style={styles.label}>Prescription</Text>
                <Text style={styles.value}>{appointment.prescription}</Text>
              </View>
            )}

            {appointment.medicationsPrescribed && appointment.medicationsPrescribed.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>Medications Prescribed</Text>
                {appointment.medicationsPrescribed.map((med, index) => (
                  <View key={index} style={styles.medicationItem}>
                    <Text style={styles.medicationName}>• {med.name}</Text>
                    <Text style={styles.medicationDetails}>
                      {med.dosage} - {med.instructions}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {appointment.labRequests && appointment.labRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.label}>Lab Tests Requested</Text>
                {appointment.labRequests.map((lab, index) => (
                  <Text key={index} style={styles.labItem}>• {lab}</Text>
                ))}
              </View>
            )}

            {appointment.completedAt && (
              <View style={styles.section}>
                <Text style={styles.completedText}>
                  Completed: {new Date(appointment.completedAt.seconds * 1000).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleViewHistory}
        >
          <Ionicons name="folder-open" size={20} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>View Full History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            isCompleted && styles.disabledButton
          ]}
          onPress={handleStartVisit}
          disabled={isCompleted}
        >
          <Ionicons 
            name={isCompleted ? "checkmark-done" : "play-circle"} 
            size={20} 
            color={colors.white} 
          />
          <Text style={styles.primaryButtonText}>
            {isCompleted ? 'Visit Completed' : 'Start Visit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    padding: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: typography.sizes.lg,
    color: colors.error,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  patientName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  patientPhone: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  completedBadge: {
    backgroundColor: colors.success + '20',
  },
  pendingBadge: {
    backgroundColor: colors.warning + '20',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.background,
    marginVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  value: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: spacing.lg,
    lineHeight: 20,
  },
  noDataText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  medicationItem: {
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
  },
  medicationName: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  medicationDetails: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  labItem: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
  },
  completedText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.background,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default DoctorAppointmentDetailScreen;
