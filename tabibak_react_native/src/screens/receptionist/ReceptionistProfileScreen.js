/**
 * ReceptionistProfileScreen.js — Receptionist Profile & Account (Phase 4)
 *
 * Displays the receptionist's profile from AuthContext.userProfile
 * (Firestore receptionists/{uid} document) plus a sign-out action.
 *
 * RTL compliance:
 *   marginStart / marginEnd      → never marginLeft / marginRight
 *   paddingStart / paddingEnd    → never paddingLeft / paddingRight
 *   borderStartWidth             → never borderLeftWidth
 */

import React, { useCallback, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Single info row: icon + label + value */
const InfoRow = memo(({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
));

/** Tappable menu row in the Account section */
const MenuRow = memo(({ icon, label, onPress, destructive }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.menuIconBox, destructive && styles.menuIconBoxDestructive]}>
      <Ionicons name={icon} size={18} color={destructive ? Colors.error : Colors.primary} />
    </View>
    <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>
      {label}
    </Text>
    {!destructive && (
      <Ionicons name="chevron-back-outline" size={18} color={Colors.gray} />
    )}
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// ReceptionistProfileScreen
// ─────────────────────────────────────────────────────────────────────────────

const ReceptionistProfileScreen = () => {
  const { user, userProfile, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Derived display values from the Firestore receptionists/{uid} document
  const name = userProfile?.name ?? userProfile?.displayName ?? 'المستقبِل';
  const phone = userProfile?.phoneNumber ?? user?.phoneNumber ?? '—';
  const email = userProfile?.email ?? user?.email ?? '—';
  const clinicName = userProfile?.clinicName ?? userProfile?.clinic ?? '—';
  const clinicId = userProfile?.clinicId ?? '—';
  const joinedAt = userProfile?.createdAt
    ? (userProfile.createdAt.toDate?.() ?? new Date(userProfile.createdAt))
      .toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  // Avatar initials
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut();
            } catch (err) {
              console.error('[ReceptionistProfile] signOut error:', err);
              Alert.alert('خطأ', 'تعذّر تسجيل الخروج. حاول مرة أخرى.');
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ],
    );
  }, [signOut]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Profile Hero ══ */}
        <View style={styles.hero}>
          {/* Avatar */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || 'م'}</Text>
          </View>

          {/* Name + role */}
          <Text style={styles.heroName}>{name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="headset-outline" size={13} color={Colors.primary} />
            <Text style={styles.roleBadgeText}>موظف الاستقبال</Text>
          </View>
        </View>

        {/* ══ Personal Info ══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>المعلومات الشخصية</Text>
          <InfoRow icon="person-outline" label="الاسم الكامل" value={name} />
          <View style={styles.rowDivider} />
          <InfoRow icon="call-outline" label="رقم الهاتف" value={phone} />
          <View style={styles.rowDivider} />
          <InfoRow icon="mail-outline" label="البريد الإلكتروني" value={email} />
          <View style={styles.rowDivider} />
          <InfoRow icon="calendar-outline" label="تاريخ الانضمام" value={joinedAt} />
        </View>

        {/* ══ Clinic Info ══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>معلومات العيادة</Text>
          <InfoRow icon="business-outline" label="اسم العيادة" value={clinicName} />
          {clinicId !== '—' && (
            <>
              <View style={styles.rowDivider} />
              <InfoRow icon="barcode-outline" label="رقم العيادة" value={clinicId} />
            </>
          )}
        </View>

        {/* ══ Account ══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>الحساب</Text>
          <MenuRow
            icon="shield-checkmark-outline"
            label="الخصوصية والأمان"
            onPress={() => Alert.alert('قريباً', 'هذه الميزة قيد التطوير.')}
          />
          <View style={styles.rowDivider} />
          <MenuRow
            icon="help-circle-outline"
            label="المساعدة والدعم"
            onPress={() => Alert.alert('قريباً', 'هذه الميزة قيد التطوير.')}
          />
          <View style={styles.rowDivider} />

          {/* Sign out */}
          {isSigningOut ? (
            <View style={styles.signOutLoading}>
              <ActivityIndicator size="small" color={Colors.error} />
              <Text style={styles.signOutLoadingText}>جاري تسجيل الخروج...</Text>
            </View>
          ) : (
            <MenuRow
              icon="log-out-outline"
              label="تسجيل الخروج"
              onPress={handleSignOut}
              destructive
            />
          )}
        </View>

        {/* App version */}
        <Text style={styles.versionText}>Vanbook v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  // ── Hero header ──────────────────────────────────────────────────────────

  hero: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.white,
  },
  heroName: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.white,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────

  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xs,
    elevation: 1,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'right',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    letterSpacing: 0.5,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },

  // ── Info rows ─────────────────────────────────────────────────────────────

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },

  // ── Menu rows ─────────────────────────────────────────────────────────────

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconBoxDestructive: {
    backgroundColor: '#fee2e2',
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '500',
  },
  menuLabelDestructive: {
    color: Colors.error,
    fontWeight: '600',
  },

  // ── Sign out loading ──────────────────────────────────────────────────────

  signOutLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  signOutLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.error,
  },

  // ── Footer ────────────────────────────────────────────────────────────────

  versionText: {
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.gray,
  },
});

export default ReceptionistProfileScreen;
