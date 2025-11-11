import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';
import { USER_ROLES } from '../../config/firebase';

const RoleSelectionScreen = ({ navigation }) => {
  const handleRoleSelect = (role) => {
    if (role === USER_ROLES.PATIENT) {
      navigation.navigate('PhoneAuth');
    } else {
      // For doctors and receptionists, navigate to email login
      navigation.navigate('EmailLogin', { role });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="medical" size={80} color={Colors.primary} />
          <Text style={styles.title}>Tabibok</Text>
          <Text style={styles.subtitle}>Choose your role to continue</Text>
        </View>

        <View style={styles.rolesContainer}>
          <TouchableOpacity 
            style={[styles.roleCard, styles.patientCard]}
            onPress={() => handleRoleSelect(USER_ROLES.PATIENT)}
            activeOpacity={0.8}
          >
            <Ionicons name="person" size={48} color={Colors.primary} />
            <Text style={styles.roleTitle}>Patient</Text>
            <Text style={styles.roleDescription}>
              Book appointments, view medical records
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.roleCard, styles.doctorCard]}
            onPress={() => handleRoleSelect(USER_ROLES.DOCTOR)}
            activeOpacity={0.8}
          >
            <Ionicons name="medkit" size={48} color={Colors.secondary} />
            <Text style={styles.roleTitle}>Doctor</Text>
            <Text style={styles.roleDescription}>
              Manage appointments, patient records
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.roleCard, styles.receptionistCard]}
            onPress={() => handleRoleSelect(USER_ROLES.RECEPTIONIST)}
            activeOpacity={0.8}
          >
            <Ionicons name="desktop" size={48} color={Colors.info} />
            <Text style={styles.roleTitle}>Receptionist</Text>
            <Text style={styles.roleDescription}>
              Confirm appointments, manage schedule
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: Spacing.md
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textLight,
    marginTop: Spacing.sm
  },
  rolesContainer: {
    flex: 1
  },
  roleCard: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  patientCard: {
    borderColor: Colors.primary + '20'
  },
  doctorCard: {
    borderColor: Colors.secondary + '20'
  },
  receptionistCard: {
    borderColor: Colors.info + '20'
  },
  roleTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm
  },
  roleDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: Spacing.xs
  }
});

export default RoleSelectionScreen;
