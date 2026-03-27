/**
 * PrescriptionInboxScreen — Patient Prescription Inbox
 *
 * Chat-like view showing prescriptions delivered by doctors.
 * Patient can view but cannot reply — read-only.
 * Prescriptions are fetched from `prescriptions` Firestore collection.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDateTime(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    + '  ·  '
    + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

const PrescriptionBubble = React.memo(function PrescriptionBubble({ item, onMarkRead }) {
  const isUnread = item.status === 'unread';

  return (
    <View style={[S.bubble, isUnread && S.bubbleUnread]}>
      {/* Doctor header */}
      <View style={S.bubbleHeader}>
        <View style={S.bubbleDoctorIcon}>
          <Ionicons name="person-outline" size={14} color={Colors.primary} />
        </View>
        <View style={S.bubbleDoctorInfo}>
          <Text style={S.bubbleDoctorName}>{item.doctorName || 'Your Doctor'}</Text>
          <Text style={S.bubbleTime}>{formatDateTime(item.createdAt)}</Text>
        </View>
        {isUnread && (
          <View style={S.unreadDot} />
        )}
      </View>

      {/* Diagnosis */}
      {item.diagnosis ? (
        <View style={S.diagnosisRow}>
          <Ionicons name="medical-outline" size={13} color={Colors.textSecondary} />
          <Text style={S.diagnosisText}>{item.diagnosis}</Text>
        </View>
      ) : null}

      {/* Rx label */}
      <View style={S.rxLabel}>
        <Ionicons name="document-text-outline" size={13} color={Colors.primary} />
        <Text style={S.rxLabelText}>Prescription</Text>
      </View>

      {/* Medications */}
      {(item.medications ?? []).map((med, i) => (
        <View key={i} style={S.medRow}>
          <View style={S.medIndexBadge}>
            <Text style={S.medIndexText}>{i + 1}</Text>
          </View>
          <View style={S.medInfo}>
            <Text style={S.medDrug}>{med.drug || '—'}</Text>
            {(med.dosage || med.frequency) ? (
              <Text style={S.medDetail}>
                {[med.dosage, med.frequency].filter(Boolean).join('  ·  ')}
              </Text>
            ) : null}
          </View>
        </View>
      ))}

      {/* Mark as read */}
      {isUnread && (
        <TouchableOpacity style={S.markReadBtn} onPress={() => onMarkRead(item.id)} activeOpacity={0.8}>
          <Ionicons name="checkmark-done-outline" size={14} color={Colors.primary} />
          <Text style={S.markReadText}>Mark as read</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PrescriptionInboxScreen({ navigation }) {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'prescriptions'),
      where('patientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setPrescriptions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[PrescriptionInbox]', err);
        setError('Could not load prescriptions. Please try again.');
        setLoading(false);
      },
    );

    return unsub;
  }, [user?.uid]);

  const handleMarkRead = useCallback(async (id) => {
    try {
      await updateDoc(doc(db, 'prescriptions', id), { status: 'read' });
    } catch (err) {
      console.error('[PrescriptionInbox] markRead:', err);
    }
  }, []);

  const keyExtractor = useCallback((item) => item.id, []);
  const renderItem   = useCallback(
    ({ item }) => <PrescriptionBubble item={item} onMarkRead={handleMarkRead} />,
    [handleMarkRead],
  );

  const unreadCount = prescriptions.filter(p => p.status === 'unread').length;

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={S.headerTitle}>Prescriptions</Text>
          {unreadCount > 0 && (
            <View style={S.headerBadge}>
              <Text style={S.headerBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.7)" />
      </View>

      {/* Sub-label */}
      <View style={S.subLabel}>
        <Ionicons name="information-circle-outline" size={13} color={Colors.textSecondary} />
        <Text style={S.subLabelText}>View-only. Contact your doctor for questions.</Text>
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
      ) : prescriptions.length === 0 ? (
        <View style={S.centered}>
          <Ionicons name="document-text-outline" size={56} color={Colors.border} />
          <Text style={S.emptyTitle}>No Prescriptions</Text>
          <Text style={S.emptySub}>Your doctor will send prescriptions here after your appointment.</Text>
        </View>
      ) : (
        <FlatList
          data={prescriptions}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[S.list, { paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
          inverted={false}
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
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.primary,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  headerBadge: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  subLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subLabelText: {
    fontSize: 11,
    color: Colors.textSecondary,
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
  },

  // ── Prescription bubble ────────────────────────────────────────────────────
  bubble: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderStartWidth: 3,
    borderStartColor: Colors.primary + '55',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  bubbleUnread: {
    borderStartColor: Colors.primary,
    backgroundColor: Colors.primary + '06',
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bubbleDoctorIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleDoctorInfo: {
    flex: 1,
    gap: 2,
  },
  bubbleDoctorName: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  bubbleTime: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  diagnosisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  diagnosisText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  rxLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  rxLabelText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  medIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  medIndexText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  medInfo: {
    flex: 1,
    gap: 2,
  },
  medDrug: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  medDetail: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Colors.primary + '12',
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
});
