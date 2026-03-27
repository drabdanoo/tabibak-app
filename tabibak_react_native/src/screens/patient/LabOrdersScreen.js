/**
 * LabOrdersScreen — Patient Lab Orders Inbox
 *
 * Shows all lab orders requested by doctors for this patient.
 * Orders are fetched from `labOrders` collection filtered by patientId.
 * Each order shows: tests list, requesting doctor, date, diagnosis, status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import LabResultModal from './LabResultModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG = {
  pending:            { label: 'Pending',          bg: '#F59E0B', color: '#FFF' },
  results_submitted:  { label: 'Results Sent',     bg: '#3B82F6', color: '#FFF' },
  completed:          { label: 'Completed',        bg: '#22C55E', color: '#FFF' },
  cancelled:          { label: 'Cancelled',        bg: '#EF4444', color: '#FFF' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

const LabOrderCard = React.memo(function LabOrderCard({ item, onPress }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;

  return (
    <TouchableOpacity style={S.card} onPress={onPress} activeOpacity={0.75}>
      {/* Header row */}
      <View style={S.cardHeader}>
        <View style={S.cardIconWrap}>
          <Ionicons name="flask-outline" size={20} color={Colors.primary} />
        </View>
        <View style={S.cardHeaderText}>
          <Text style={S.cardDate}>{formatDate(item.createdAt)}</Text>
          {item.diagnosis ? (
            <Text style={S.cardDiagnosis} numberOfLines={1}>{item.diagnosis}</Text>
          ) : null}
        </View>
        <View style={[S.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[S.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Tests list */}
      <View style={S.testsWrap}>
        {(item.tests ?? []).map((test, i) => (
          <View key={i} style={S.testChip}>
            <Ionicons name="checkmark-circle-outline" size={12} color={Colors.primary} />
            <Text style={S.testChipText}>{test}</Text>
          </View>
        ))}
      </View>

      {item.tests?.length > 0 && (
        <Text style={S.testsCount}>
          {item.tests.length} test{item.tests.length > 1 ? 's' : ''} requested
        </Text>
      )}

      {/* Send results CTA — only on pending orders */}
      {item.status === 'pending' && (
        <View style={S.sendResultsRow}>
          <Ionicons name="cloud-upload-outline" size={14} color={Colors.primary} />
          <Text style={S.sendResultsText}>Tap to send your results</Text>
        </View>
      )}
      {item.status === 'results_submitted' && (
        <View style={S.sendResultsRow}>
          <Ionicons name="checkmark-done" size={14} color="#3B82F6" />
          <Text style={[S.sendResultsText, { color: '#3B82F6' }]}>Results sent — tap to view</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function LabOrdersScreen({ navigation }) {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible,  setModalVisible]  = useState(false);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'labOrders'),
      where('patientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[LabOrdersScreen]', err);
        setError('Could not load lab orders. Please try again.');
        setLoading(false);
      },
    );

    return unsub;
  }, [user?.uid]);

  const handleOpenOrder = useCallback((item) => {
    setSelectedOrder(item);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedOrder(null);
  }, []);

  const keyExtractor = useCallback((item) => item.id, []);
  const renderItem   = useCallback(
    ({ item }) => <LabOrderCard item={item} onPress={() => handleOpenOrder(item)} />,
    [handleOpenOrder],
  );

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <LabResultModal
        visible={modalVisible}
        order={selectedOrder}
        onClose={handleCloseModal}
      />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Lab Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={S.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={S.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.error} />
          <Text style={S.errorText}>{error}</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={S.centered}>
          <Ionicons name="flask-outline" size={56} color={Colors.border} />
          <Text style={S.emptyTitle}>No Lab Orders</Text>
          <Text style={S.emptySub}>Your doctor has not requested any lab tests yet.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[S.list, { paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardDate: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  cardDiagnosis: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  testsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  testChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
  },
  testChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  testsCount: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sendResultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sendResultsText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
});
