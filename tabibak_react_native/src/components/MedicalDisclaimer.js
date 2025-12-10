import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes } from '../config/theme';

/**
 * Medical Disclaimer Component
 * Required by Google Play Store and Apple App Store for healthcare apps
 * 
 * COMPLIANCE: This disclaimer must be displayed to meet store requirements
 * as per October 30, 2025 health app policy updates.
 */
const MedicalDisclaimer = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Ionicons name="information-circle" size={20} color={Colors.warning} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Medical Disclaimer</Text>
        <Text style={styles.text}>
          This app is NOT a medical device and does NOT diagnose, treat, cure, or prevent any medical condition. 
          Tabibok Health is a booking and communication platform for healthcare services. Always consult qualified 
          healthcare professionals for medical advice, diagnosis, or treatment.
        </Text>
      </View>
    </View>
  );
};

/**
 * Compact Medical Disclaimer (for footer use)
 */
export const CompactMedicalDisclaimer = ({ style }) => {
  return (
    <View style={[styles.compactContainer, style]}>
      <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
      <Text style={styles.compactText}>
        Not a medical device. For informational purposes only.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.warningLight || '#FFF9E6',
    borderWidth: 1,
    borderColor: Colors.warning || '#FFA500',
    borderRadius: 8,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  iconContainer: {
    marginRight: Spacing.sm,
    paddingTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.warning || '#CC8400',
    marginBottom: 4,
  },
  text: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary || '#666',
    lineHeight: 18,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  compactText: {
    fontSize: 11,
    color: Colors.textSecondary || '#999',
    marginLeft: 4,
  },
});

export default MedicalDisclaimer;
