import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// ── Sub-component: single info row ────────────────────────────────────────
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={20} color={Colors.primary} style={styles.infoIcon} />
    <View style={styles.infoTextContainer}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

// ── Main screen ───────────────────────────────────────────────────────────
const DoctorProfileScreen = () => {
  const { userProfile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const initials = userProfile?.fullName
    ? userProfile.fullName
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '؟';

  const handleSignOut = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
            setSigningOut(false);
          },
        },
      ],
    );
  };

  // specialization field may be stored as 'specialization' or 'specialty'
  const specialty = userProfile?.specialization ?? userProfile?.specialty;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName}>{userProfile?.fullName || '—'}</Text>
        {!!specialty && <Text style={styles.headerSpecialty}>{specialty}</Text>}
        <Text style={styles.headerPhone}>{userProfile?.phoneNumber || '—'}</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>المعلومات الشخصية</Text>

        <InfoRow icon="person-outline"  label="الاسم الكامل"  value={userProfile?.fullName} />
        <InfoRow icon="call-outline"    label="رقم الهاتف"    value={userProfile?.phoneNumber} />
        <InfoRow icon="medical-outline" label="التخصص"        value={specialty} />

        {/* ── Sign-out ── */}
        <TouchableOpacity
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          {signingOut ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={Colors.white} />
              <Text style={styles.signOutText}>تسجيل الخروج</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundLight },

  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: { fontSize: 30, fontWeight: 'bold', color: Colors.white },
  headerName: { fontSize: FontSizes.xl, fontWeight: 'bold', color: Colors.white, marginBottom: Spacing.xs },
  headerSpecialty: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.9)', marginBottom: Spacing.xs },
  headerPhone: { fontSize: FontSizes.md, color: 'rgba(255,255,255,0.85)', writingDirection: 'ltr' },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.lg },

  sectionTitle: {
    fontSize: FontSizes.lg, fontWeight: '700',
    color: Colors.text, textAlign: 'right', marginBottom: Spacing.md,
  },

  infoRow: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
    marginBottom: Spacing.sm, shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
    shadowRadius: 3, elevation: 1,
  },
  infoIcon: { marginRight: Spacing.md },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: FontSizes.sm, color: Colors.textLight, textAlign: 'right' },
  infoValue: { fontSize: FontSizes.md, fontWeight: '600', color: Colors.text, marginTop: 2, textAlign: 'right' },

  signOutButton: {
    backgroundColor: Colors.error, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xl, gap: Spacing.sm,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  signOutButtonDisabled: { opacity: 0.6 },
  signOutText: { color: Colors.white, fontSize: FontSizes.md, fontWeight: '600' },
});

export default DoctorProfileScreen;
