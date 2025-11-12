import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import { colors, spacing, typography } from '../../config/theme';

export default function DoctorDetailsScreen({ route, navigation }) {
  const { doctorId } = route.params;
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoctorDetails();
  }, [doctorId]);

  const loadDoctorDetails = async () => {
    try {
      setLoading(true);
      const result = await firestoreService.getDoctorById(doctorId);
      
      if (result.success) {
        setDoctor(result.doctor);
      }
    } catch (error) {
      console.error('Error loading doctor details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = () => {
    navigation.navigate('BookAppointment', { doctor });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!doctor) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
        <Text style={styles.errorText}>Doctor not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.imageContainer}>
            {doctor.photoURL ? (
              <Image source={{ uri: doctor.photoURL }} style={styles.doctorImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="person" size={60} color={colors.gray} />
              </View>
            )}
          </View>

          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.specialty}>{doctor.specialty}</Text>

          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={20} color={colors.warning} />
            <Text style={styles.ratingText}>
              {doctor.rating?.toFixed(1) || '0.0'}
            </Text>
            <Text style={styles.reviewCount}>
              ({doctor.reviewCount || 0} reviews)
            </Text>
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          {doctor.hospital && (
            <View style={styles.infoCard}>
              <Ionicons name="business" size={24} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Hospital</Text>
                <Text style={styles.infoValue}>{doctor.hospital}</Text>
              </View>
            </View>
          )}

          {doctor.experience && (
            <View style={styles.infoCard}>
              <Ionicons name="briefcase" size={24} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Experience</Text>
                <Text style={styles.infoValue}>{doctor.experience} years</Text>
              </View>
            </View>
          )}

          {doctor.education && (
            <View style={styles.infoCard}>
              <Ionicons name="school" size={24} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Education</Text>
                <Text style={styles.infoValue}>{doctor.education}</Text>
              </View>
            </View>
          )}

          {doctor.fees && (
            <View style={styles.infoCard}>
              <Ionicons name="cash" size={24} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Consultation Fee</Text>
                <Text style={styles.infoValue}>${doctor.fees}</Text>
              </View>
            </View>
          )}
        </View>

        {/* About Section */}
        {doctor.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{doctor.bio}</Text>
          </View>
        )}

        {/* Working Hours */}
        {doctor.workingHours && Object.keys(doctor.workingHours).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Working Hours</Text>
            {Object.entries(doctor.workingHours).map(([day, hours]) => {
              // Defensive validation
              if (!hours || typeof hours !== 'object') {
                return (
                  <View key={day} style={styles.hourRow}>
                    <Text style={styles.dayText}>{day}</Text>
                    <Text style={styles.hoursText}>Unavailable</Text>
                  </View>
                );
              }
              
              const isOpen = hours.open === true;
              const hasValidTimes = typeof hours.start === 'string' && typeof hours.end === 'string';
              
              return (
                <View key={day} style={styles.hourRow}>
                  <Text style={styles.dayText}>{day}</Text>
                  <Text style={styles.hoursText}>
                    {isOpen && hasValidTimes ? `${hours.start} - ${hours.end}` : 'Closed'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Languages */}
        {doctor.languages && doctor.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.chipContainer}>
              {doctor.languages.map((lang, index) => (
                <View key={index} style={styles.chip}>
                  <Text style={styles.chipText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.bookButton} onPress={handleBookAppointment}>
          <Ionicons name="calendar" size={24} color={colors.white} />
          <Text style={styles.bookButtonText}>Book Appointment</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
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
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.white,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  imageContainer: {
    marginBottom: spacing.md,
  },
  doctorImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  specialty: {
    fontSize: typography.sizes.lg,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.xs,
  },
  reviewCount: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  infoSection: {
    padding: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
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
  bioText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  dayText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: '500',
  },
  hoursText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
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
  bookButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});
