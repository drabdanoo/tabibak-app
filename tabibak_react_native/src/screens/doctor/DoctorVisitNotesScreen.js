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
  const [medications, setMedications] = useState([]);
  const [labRequests, setLabRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Medication form states
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');

  // Lab request state
  const [labTest, setLabTest] = useState('');

  const addMedication = () => {
    if (!medicationName.trim() || !dosage.trim()) {
      Alert.alert('Validation Error', 'Please enter medication name and dosage.');
      return;
    }

    const newMedication = {
      name: medicationName.trim(),
      dosage: dosage.trim(),
      instructions: instructions.trim() || 'As directed',
    };

    setMedications([...medications, newMedication]);
    // Clear form
    setMedicationName('');
    setDosage('');
    setInstructions('');
  };

  const removeMedication = (index) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const addLabRequest = () => {
    if (!labTest.trim()) {
      Alert.alert('Validation Error', 'Please enter a lab test name.');
      return;
    }

    if (labRequests.includes(labTest.trim())) {
      Alert.alert('Duplicate', 'This lab test is already in the list.');
      return;
    }

    setLabRequests([...labRequests, labTest.trim()]);
    setLabTest('');
  };

  const removeLabRequest = (index) => {
    setLabRequests(labRequests.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!diagnosis.trim()) {
      Alert.alert('Validation Error', 'Please enter a diagnosis.');
      return;
    }

    try {
      setLoading(true);
      
      // Call updated finishAppointment with new parameters
      const result = await appointmentService.finishAppointment(
        appointment.id,
        diagnosis.trim(),
        prescription.trim() || 'See prescription details',
        medications,
        labRequests
      );

      if (result.success) {
        // TODO: Call utils.generateRxCard(doctorProfile, appointmentData) here
        // Placeholder for prescription card generation
        console.log('Prescription card generation placeholder');
        
        Alert.alert('Success', 'Visit completed successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Dashboard'),
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
            <Text style={styles.sectionTitle}>General Notes / Prescription</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Enter general prescription notes..."
            value={prescription}
            onChangeText={setPrescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Medications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="medkit" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Medications Prescribed</Text>
          </View>
          
          {/* Medication List */}
          {medications.length > 0 && (
            <View style={styles.medicationList}>
              {medications.map((med, index) => (
                <View key={index} style={styles.medicationCard}>
                  <View style={styles.medicationContent}>
                    <Text style={styles.medicationName}>{med.name}</Text>
                    <Text style={styles.medicationDosage}>{med.dosage}</Text>
                    <Text style={styles.medicationInstructions}>{med.instructions}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeMedication(index)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add Medication Form */}
          <View style={styles.addMedicationForm}>
            <TextInput
              style={styles.smallInput}
              placeholder="Medication name *"
              value={medicationName}
              onChangeText={setMedicationName}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.smallInput, styles.halfInput]}
                placeholder="Dosage *"
                value={dosage}
                onChangeText={setDosage}
              />
              <TextInput
                style={[styles.smallInput, styles.halfInput]}
                placeholder="Instructions"
                value={instructions}
                onChangeText={setInstructions}
              />
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={addMedication}
            >
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.addButtonText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lab Requests Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flask" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Lab Tests Requested</Text>
          </View>

          {/* Lab List */}
          {labRequests.length > 0 && (
            <View style={styles.labList}>
              {labRequests.map((lab, index) => (
                <View key={index} style={styles.labCard}>
                  <Text style={styles.labText}>• {lab}</Text>
                  <TouchableOpacity
                    onPress={() => removeLabRequest(index)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add Lab Form */}
          <View style={styles.addLabForm}>
            <TextInput
              style={styles.smallInput}
              placeholder="Lab test name (e.g., Blood Sugar, X-Ray)"
              value={labTest}
              onChangeText={setLabTest}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addLabRequest}
            >
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.addButtonText}>Add Lab Test</Text>
            </TouchableOpacity>
          </View>
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
  medicationList: {
    marginBottom: spacing.md,
  },
  medicationCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  medicationContent: {
    flex: 1,
  },
  medicationName: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  medicationDosage: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  medicationInstructions: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  removeButton: {
    padding: spacing.xs,
  },
  addMedicationForm: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  smallInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.gray,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  addButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  labList: {
    marginBottom: spacing.md,
  },
  labCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  labText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  addLabForm: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray,
  },
});

export default DoctorVisitNotesScreen;
