import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import firestoreService from '../../services/firestoreService';
import { colors, spacing, typography } from '../../config/theme';

const DoctorProfileScreen = ({ navigation }) => {
  const { user, userProfile, signOut } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthlyRevenue();
  }, [user]);

  const loadMonthlyRevenue = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const monthlyRevenue = await firestoreService.calculateMonthlyRevenue(user.uid);
      setRevenue(monthlyRevenue);
    } catch (error) {
      console.error('Error loading revenue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const success = await signOut();
            if (!success) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    // Placeholder navigation - to be implemented
    Alert.alert('Coming Soon', 'Profile editing will be available soon.');
  };

  if (!userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={80} color={colors.primary} />
          </View>
          <Text style={styles.doctorName}>{userProfile.name || 'Doctor'}</Text>
          <Text style={styles.specialty}>{userProfile.specialty || 'Specialist'}</Text>
        </View>

        {/* Monthly Revenue Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash" size={32} color={colors.success} />
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardLabel}>Monthly Revenue</Text>
              <Text style={styles.cardSubLabel}>
                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.revenueAmount}>
              IQD {revenue.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Profile Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Professional Information</Text>
          <View style={styles.divider} />

          {userProfile.specialty && (
            <View style={styles.infoRow}>
              <Ionicons name="medical" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Specialty</Text>
                <Text style={styles.infoValue}>{userProfile.specialty}</Text>
              </View>
            </View>
          )}

          {userProfile.clinicAddress && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Clinic Address</Text>
                <Text style={styles.infoValue}>{userProfile.clinicAddress}</Text>
              </View>
            </View>
          )}

          {userProfile.phoneNumber && (
            <View style={styles.infoRow}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Contact</Text>
                <Text style={styles.infoValue}>{userProfile.phoneNumber}</Text>
              </View>
            </View>
          )}

          {userProfile.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{userProfile.email}</Text>
              </View>
            </View>
          )}

          {userProfile.experience && (
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Experience</Text>
                <Text style={styles.infoValue}>{userProfile.experience} years</Text>
              </View>
            </View>
          )}
        </View>

        {/* Clinic Hours (if available) */}
        {userProfile.clinicHours && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Clinic Hours</Text>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>{userProfile.clinicHours}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditProfile}
          >
            <Ionicons name="create" size={20} color={colors.primary} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out" size={20} color={colors.error} />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

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
    padding: spacing.md,
  },
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  doctorName: {
    fontSize: typography.sizes.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  specialty: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: '600',
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
  cardHeaderText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  cardLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  cardSubLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  revenueAmount: {
    fontSize: typography.sizes.xxl,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'center',
    marginTop: spacing.sm,
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
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editButton: {
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  signOutButton: {
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutButtonText: {
    color: colors.error,
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});

export default DoctorProfileScreen;
