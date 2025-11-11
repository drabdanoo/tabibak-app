/**
 * Accessible Book Appointment Screen
 * Implements WCAG 2.1 AA accessibility standards
 * 
 * Key Accessibility Features:
 * 1. Screen reader support (accessibilityLabel, accessibilityHint, accessibilityRole)
 * 2. Minimum touch target size (44x44 points)
 * 3. Proper focus management
 * 4. Semantic structure
 * 5. Color contrast compliance
 * 6. Dynamic type support
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  AccessibilityInfo
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import appointmentService from '../../services/appointmentService';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography } from '../../config/theme';

export default function AccessibleBookAppointmentScreen({ route, navigation }) {
  const { doctor } = route.params;
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Refs for focus management
  const dateButtonRef = useRef(null);
  const reasonInputRef = useRef(null);
  const bookButtonRef = useRef(null);

  useEffect(() => {
    loadAvailableSlots();
  }, [selectedDate]);

  // Announce screen to screen readers
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Book appointment screen for Dr. ${doctor.name}`
    );
  }, []);

  const loadAvailableSlots = async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const slots = await appointmentService.getAvailableTimeSlots(
        doctor.id,
        dateStr
      );
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error loading slots:', error);
    }
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      // Announce date change to screen readers
      const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      AccessibilityInfo.announceForAccessibility(`Date selected: ${dateStr}`);
    }
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    // Announce time selection
    AccessibilityInfo.announceForAccessibility(`Time selected: ${time}`);
  };

  const handleBookAppointment = async () => {
    // Validation
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }

    if (!selectedTime) {
      Alert.alert('Error', 'Please select a time');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for your appointment');
      return;
    }

    try {
      setLoading(true);

      const appointmentData = {
        doctorId: doctor.id,
        doctorName: doctor.name,
        patientId: user.uid,
        patientName: user.displayName || user.phoneNumber,
        patientPhone: user.phoneNumber,
        appointmentDate: selectedDate.toISOString().split('T')[0],
        appointmentTime: selectedTime,
        reason: reason.trim(),
        status: 'pending'
      };

      const result = await appointmentService.bookAppointment(appointmentData);

      if (result.success) {
        AccessibilityInfo.announceForAccessibility('Appointment booked successfully');
        Alert.alert(
          'Success',
          'Your appointment has been booked successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <ScrollView 
      style={styles.container}
      accessible={true}
      accessibilityLabel="Book appointment form"
    >
      {/* Doctor Info Card */}
      <View 
        style={styles.doctorCard}
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel={`Booking appointment with Dr. ${doctor.name}, ${doctor.specialty}`}
      >
        <Text style={styles.doctorName}>{doctor.name}</Text>
        <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
        {doctor.hospital && (
          <Text style={styles.doctorHospital}>{doctor.hospital}</Text>
        )}
      </View>

      {/* Date Selection */}
      <View style={styles.section}>
        <Text 
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          Select Date
        </Text>
        
        <TouchableOpacity
          ref={dateButtonRef}
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Selected date: ${formatDate(selectedDate)}`}
          accessibilityHint="Double tap to change date"
          // Minimum touch target size
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons 
            name="calendar-outline" 
            size={24} 
            color={colors.primary}
            importantForAccessibility="no" 
          />
          <Text style={styles.dateButtonText}>
            {formatDate(selectedDate)}
          </Text>
          <Ionicons 
            name="chevron-down" 
            size={24} 
            color={colors.gray}
            importantForAccessibility="no"
          />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
            accessible={true}
            accessibilityLabel="Date picker"
          />
        )}
      </View>

      {/* Time Selection */}
      <View style={styles.section}>
        <Text 
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          Select Time
        </Text>

        {availableSlots.length === 0 ? (
          <View 
            style={styles.noSlotsContainer}
            accessible={true}
            accessibilityLabel="No available time slots for selected date"
          >
            <Ionicons name="time-outline" size={48} color={colors.gray} importantForAccessibility="no" />
            <Text style={styles.noSlotsText}>No available slots</Text>
          </View>
        ) : (
          <View 
            style={styles.timeGrid}
            accessible={false}
          >
            {availableSlots.map((slot) => {
              const isSelected = selectedTime === slot.time;
              const isDisabled = !slot.available;

              return (
                <TouchableOpacity
                  key={slot.time}
                  style={[
                    styles.timeSlot,
                    isSelected && styles.timeSlotSelected,
                    isDisabled && styles.timeSlotDisabled,
                  ]}
                  onPress={() => !isDisabled && handleTimeSelect(slot.time)}
                  disabled={isDisabled}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${slot.time} ${isDisabled ? 'unavailable' : isSelected ? 'selected' : 'available'}`}
                  accessibilityHint={isDisabled ? 'This time slot is not available' : 'Double tap to select this time'}
                  accessibilityState={{
                    selected: isSelected,
                    disabled: isDisabled
                  }}
                  // Minimum touch target size
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text
                    style={[
                      styles.timeSlotText,
                      isSelected && styles.timeSlotTextSelected,
                      isDisabled && styles.timeSlotTextDisabled,
                    ]}
                    importantForAccessibility="no"
                  >
                    {slot.time}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Reason Input */}
      <View style={styles.section}>
        <Text 
          style={styles.sectionTitle}
          accessibilityRole="header"
        >
          Reason for Visit
        </Text>
        
        <TextInput
          ref={reasonInputRef}
          style={styles.reasonInput}
          placeholder="E.g., Regular checkup, Fever, Consultation..."
          placeholderTextColor={colors.gray}
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          maxLength={200}
          accessible={true}
          accessibilityLabel="Reason for visit"
          accessibilityHint="Enter the reason for your appointment, up to 200 characters"
          accessibilityRole="text"
          // Minimum height for touch target
          textAlignVertical="top"
        />
        
        <Text 
          style={styles.characterCount}
          accessible={true}
          accessibilityLabel={`${reason.length} of 200 characters used`}
        >
          {reason.length}/200
        </Text>
      </View>

      {/* Book Button */}
      <TouchableOpacity
        ref={bookButtonRef}
        style={[styles.bookButton, loading && styles.bookButtonDisabled]}
        onPress={handleBookAppointment}
        disabled={loading}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Book appointment"
        accessibilityHint="Double tap to confirm and book your appointment"
        accessibilityState={{ disabled: loading }}
        // Minimum touch target size
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} importantForAccessibility="no" />
        ) : (
          <>
            <Ionicons 
              name="checkmark-circle" 
              size={24} 
              color={colors.white} 
              importantForAccessibility="no"
            />
            <Text style={styles.bookButtonText} importantForAccessibility="no">
              Book Appointment
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Help Text */}
      <View 
        style={styles.helpContainer}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel="Booking help information"
      >
        <Ionicons 
          name="information-circle-outline" 
          size={20} 
          color={colors.textSecondary}
          importantForAccessibility="no" 
        />
        <Text style={styles.helpText}>
          Your appointment request will be sent to the doctor for confirmation.
          You will receive a notification once confirmed.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  doctorCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  doctorName: {
    fontSize: typography.sizes.xl,
    fontWeight: '600',
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
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray,
    // Minimum touch target height
    minHeight: 48,
  },
  dateButtonText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: spacing.md,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  timeSlot: {
    width: '30%',
    aspectRatio: 2.5,
    margin: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray,
    // Minimum touch target size
    minHeight: 44,
    minWidth: 80,
  },
  timeSlotSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeSlotDisabled: {
    backgroundColor: colors.background,
    borderColor: colors.gray,
    opacity: 0.4,
  },
  timeSlotText: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.text,
  },
  timeSlotTextSelected: {
    color: colors.white,
  },
  timeSlotTextDisabled: {
    color: colors.textSecondary,
  },
  noSlotsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noSlotsText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  reasonInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.gray,
    // Minimum height for better touch target
    minHeight: 100,
  },
  characterCount: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    // Minimum touch target height
    minHeight: 48,
  },
  bookButtonDisabled: {
    opacity: 0.6,
  },
  bookButtonText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.white,
    marginLeft: spacing.sm,
  },
  helpContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  helpText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
});
