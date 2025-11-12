import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import appointmentService from '../../services/appointmentService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../config/theme';

export default function BookAppointmentScreen({ route, navigation }) {
  const { doctor } = route.params;
  const { user } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  // Medical History Fields
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadAvailableSlots = async () => {
    try {
      setLoading(true);
      const slots = await appointmentService.getAvailableTimeSlots(doctor.id, selectedDate);
      setAvailableSlots(slots);
      
      // Auto-select first available slot
      const firstAvailable = slots.find(slot => slot.available);
      if (firstAvailable) {
        setSelectedTime(firstAvailable.time);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    
    if (date) {
      // Don't allow past dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (date < today) {
        Alert.alert('Invalid Date', 'Please select a future date');
        return;
      }
      
      setSelectedDate(date);
      setSelectedTime(null); // Reset time when date changes
    }
  };

  const handleTimeSlotSelect = (slot) => {
    if (slot.available) {
      setSelectedTime(slot.time);
    } else {
      Alert.alert('Unavailable', 'This time slot is already booked');
    }
  };

  const validateForm = () => {
    if (!selectedDate) {
      Alert.alert('Required', 'Please select a date');
      return false;
    }

    if (!selectedTime) {
      Alert.alert('Required', 'Please select a time');
      return false;
    }

    if (!reason.trim()) {
      Alert.alert('Required', 'Please provide a reason for visit');
      return false;
    }

    return true;
  };

  const handleBookAppointment = async () => {
    if (!validateForm()) return;

    try {
      setBookingLoading(true);

      // Step 1: Check clinic closure
      const dateStr = selectedDate.toISOString().split('T')[0];
      const closureCheck = await appointmentService.checkClinicClosure(doctor.id, dateStr);
      
      if (closureCheck.isClosed) {
        Alert.alert('Clinic Closed', closureCheck.reason || 'The clinic is closed on this date');
        setBookingLoading(false);
        return;
      }

      // Step 2: Check for duplicate booking
      const duplicateCheck = await appointmentService.checkDuplicateBooking(
        user.uid,
        doctor.id,
        dateStr
      );

      if (duplicateCheck.isDuplicate) {
        Alert.alert(
          'Duplicate Booking',
          'You already have a pending or confirmed appointment with this doctor on this date.',
          [
            {
              text: 'View Appointment',
              onPress: () => {
                navigation.navigate('Appointments');
              }
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        setBookingLoading(false);
        return;
      }

      // Step 3: Prepare appointment data with medical history
      const appointmentData = {
        patientId: user.uid,
        patientName: user.displayName || user.phoneNumber,
        patientPhone: user.phoneNumber,
        doctorId: doctor.id,
        doctorName: doctor.name,
        appointmentDate: dateStr,
        appointmentTime: selectedTime,
        reason: reason.trim(),
        notes: notes.trim(),
        status: 'pending',
        // Medical History
        medicalHistory: {
          allergies: allergies.trim() || 'None',
          currentMedications: currentMedications.trim() || 'None',
          chronicConditions: chronicConditions.trim() || 'None'
        }
      };

      // Step 4: Book appointment
      const result = await appointmentService.bookAppointment(appointmentData);

      if (result.success) {
        Alert.alert(
          'Success',
          'Your appointment has been booked successfully! You will receive a notification once the doctor confirms.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Appointments')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const renderTimeSlots = () => {
    if (loading) {
      return (
        <View style={styles.slotsLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.slotsLoadingText}>Loading available slots...</Text>
        </View>
      );
    }

    if (availableSlots.length === 0) {
      return (
        <View style={styles.noSlotsContainer}>
          <Ionicons name="calendar-outline" size={48} color={colors.gray} />
          <Text style={styles.noSlotsText}>No available slots for this date</Text>
          <Text style={styles.noSlotsSubtext}>Please select a different date</Text>
        </View>
      );
    }

    return (
      <View style={styles.slotsGrid}>
        {availableSlots.map((slot, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.slotChip,
              !slot.available && styles.slotChipDisabled,
              selectedTime && 
              slot.time.getTime() === selectedTime.getTime() && 
              styles.slotChipSelected
            ]}
            onPress={() => handleTimeSlotSelect(slot)}
            disabled={!slot.available}
          >
            <Text
              style={[
                styles.slotChipText,
                !slot.available && styles.slotChipTextDisabled,
                selectedTime && 
                slot.time.getTime() === selectedTime.getTime() && 
                styles.slotChipTextSelected
              ]}
            >
              {slot.display}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Doctor Info */}
        <View style={styles.doctorCard}>
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
            {doctor.hospital && (
              <Text style={styles.doctorHospital}>{doctor.hospital}</Text>
            )}
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={24} color={colors.primary} />
            <Text style={styles.dateButtonText}>
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.gray} />
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Time Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          {renderTimeSlots()}
        </View>

        {/* Reason for Visit */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reason for Visit <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Regular checkup, flu symptoms, etc."
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Medical History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="medical" size={24} color={colors.primary} />
            <Text style={styles.sectionTitleLarge}>Medical History</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Help the doctor prepare for your visit by providing your medical information
          </Text>

          {/* Allergies */}
          <Text style={styles.inputLabel}>Allergies</Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Penicillin, peanuts, latex (or 'None')"
            value={allergies}
            onChangeText={setAllergies}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          {/* Current Medications */}
          <Text style={styles.inputLabel}>Current Medications</Text>
          <TextInput
            style={styles.textInput}
            placeholder="List all medications you're currently taking (or 'None')"
            value={currentMedications}
            onChangeText={setCurrentMedications}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          {/* Chronic Conditions */}
          <Text style={styles.inputLabel}>Chronic Conditions</Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Diabetes, hypertension, asthma (or 'None')"
            value={chronicConditions}
            onChangeText={setChronicConditions}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Your medical information is confidential and will only be shared with your doctor.
            </Text>
          </View>
        </View>

        {/* Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Any additional information for the doctor"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookButton, bookingLoading && styles.bookButtonDisabled]}
          onPress={handleBookAppointment}
          disabled={bookingLoading}
        >
          {bookingLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={colors.white} />
              <Text style={styles.bookButtonText}>Book Appointment</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  doctorCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  doctorInfo: {
    alignItems: 'center',
  },
  doctorName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  doctorSpecialty: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  doctorHospital: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  section: {
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitleLarge: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
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
  required: {
    color: colors.error,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  dateButtonText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  slotsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  slotsLoadingText: {
    marginLeft: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  noSlotsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noSlotsText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  noSlotsSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  slotChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    margin: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gray,
    minWidth: 80,
    alignItems: 'center',
  },
  slotChipDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  slotChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotChipText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: '500',
  },
  slotChipTextDisabled: {
    color: colors.gray,
    textDecorationLine: 'line-through',
  },
  slotChipTextSelected: {
    color: colors.white,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.gray,
    minHeight: 80,
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
  bookButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  bookButtonDisabled: {
    opacity: 0.6,
  },
  bookButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});

