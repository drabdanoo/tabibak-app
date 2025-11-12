import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../firebase/firestoreService';
import { colors, spacing, typography } from '../../config/theme';

const PatientHistoryScreen = ({ route }) => {
  const { patientId } = route.params;
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPatientHistory = async () => {
      try {
        setLoading(true);
        const patientHistory = await firestoreService.getPatientHistory(patientId);
        setHistory(patientHistory);
      } catch (error) {
        console.error('Error loading patient history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPatientHistory();
  }, [patientId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="document-outline"
          size={64}
          color={colors.gray}
        />
        <Text style={styles.emptyText}>No medical history found</Text>
        <Text style={styles.emptySubtext}>
          This patient has no completed appointments yet.
        </Text>
      </View>
    );
  }

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.doctorName}>{item.doctorName}</Text>
          <Text style={styles.visitDate}>{item.appointmentDate}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardContent}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Diagnosis</Text>
          <Text style={styles.sectionValue}>{item.diagnosis}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Prescription</Text>
          <Text style={styles.sectionValue}>{item.prescription}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Medical History</Text>
        <Text style={styles.headerSubtitle}>
          {history.length} previous visit{history.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
      />
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  headerContainer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  doctorName: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  visitDate: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    backgroundColor: colors.background,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  cardContent: {
    gap: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  sectionValue: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
});

export default PatientHistoryScreen;
