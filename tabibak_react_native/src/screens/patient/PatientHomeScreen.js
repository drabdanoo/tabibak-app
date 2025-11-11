import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

const PatientHomeScreen = ({ navigation }) => {
  const { userProfile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{userProfile?.fullName || 'Patient'}</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('DoctorList')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '20' }]}>
              <Ionicons name="people" size={32} color={Colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Find a Doctor</Text>
              <Text style={styles.actionDescription}>Browse available doctors</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.gray} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('BookAppointment')}
          >
            <View style={[styles.iconContainer, { backgroundColor: Colors.secondary + '20' }]}>
              <Ionicons name="calendar" size={32} color={Colors.secondary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Book Appointment</Text>
              <Text style={styles.actionDescription}>Schedule a new visit</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.gray} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={Colors.gray} />
            <Text style={styles.emptyText}>No upcoming appointments</Text>
            <Text style={styles.emptySubtext}>Book your first appointment</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  greeting: {
    fontSize: FontSizes.md,
    color: Colors.white,
    opacity: 0.9
  },
  userName: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: Spacing.xs
  },
  logoutButton: {
    padding: Spacing.sm
  },
  content: {
    flex: 1
  },
  section: {
    padding: Spacing.lg
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md
  },
  actionContent: {
    flex: 1
  },
  actionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text
  },
  actionDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl
  },
  emptyText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md
  },
  emptySubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs
  }
});

export default PatientHomeScreen;
