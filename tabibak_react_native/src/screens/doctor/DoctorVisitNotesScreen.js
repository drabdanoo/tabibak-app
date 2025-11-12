import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import appointmentService from '../../services/appointmentService';
import { colors, spacing, typography } from '../../config/theme';

const DoctorVisitNotesScreen = ({ route, navigation }) => {
  const { appointment } = route.params;
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!diagnosis.trim() || !prescription.trim()) {
      Alert.alert('Validation Error', 'Please fill in both diagnosis and prescription fields.');
      return;
    }

    try {
      setLoading(true);
      const result = await appointmentService.finishAppointment(
        appointment.id,
        diagnosis.trim(),
        prescription.trim()
      );

      if (result.success) {
        Alert.alert('Success', 'Visit completed successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('DoctorHome'),
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to complete visit.');
      }
    } catch (error) {
      console.error('Error completing visit:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Visit Notes</Text>
          <Text style={styles.patientInfo}>
            Patient: {appointment.patientName}
          </Text>
          <Text style={styles.appointmentTime}>
            {appointment.appointmentDate} at {appointment.appointmentTime}
          </Text>
        </View>

        {/* Diagnosis Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stethoscope" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Diagnosis</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Enter diagnosis notes..."
            value={diagnosis}
            onChangeText={setDiagnosis}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Prescription Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Prescription</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Enter prescription details..."
            value={prescription}
            onChangeText={setPrescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            This information will be saved and the visit will be marked as completed.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          disabled={loading}
          onPress={handleSubmit}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={colors.white} />
              <Text style={styles.submitButtonText}>Complete Visit</Text>
            </>
          )}
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
  header: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  patientInfo: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  appointmentTime: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.gray,
    minHeight: 120,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    lineHeight: 18,
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
  },
  submitButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});

export default DoctorVisitNotesScreen;
