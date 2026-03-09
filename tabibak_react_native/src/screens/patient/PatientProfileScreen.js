/**
 * PatientProfileScreen.js — Patient Profile & Account (Phase 3/4)
 *
 * Displays profile data from AuthContext.userProfile (PATIENTS collection).
 * Shows personal info, medical history snapshot, and account actions.
 *
 * RTL compliance:
 *   marginStart / marginEnd    → never marginLeft / marginRight
 *   borderStartWidth           → never borderLeftWidth
 */

import React, { useCallback, useState, useMemo, memo } from 'react';
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

const InfoRow = memo(({ icon, label, value, iconBg }) => (
  <View style={styles.infoRow}>
    <View style={[styles.iconBox, iconBg && { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
));

const MedTag = memo(({ label, color, bg }) => (
  <View style={[styles.medTag, { backgroundColor: bg }]}>
    <Text style={[styles.medTagText, { color }]}>{label}</Text>
  </View>
));

const MenuRow = memo(({ icon, label, value, onPress, destructive, chevron = true }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.menuIconBox, destructive && styles.menuIconBoxRed]}>
      <Ionicons name={icon} size={18} color={destructive ? Colors.error : Colors.primary} />
    </View>
    <View style={styles.menuContent}>
      <Text style={[styles.menuLabel, destructive && styles.menuLabelRed]}>{label}</Text>
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
    </View>
    {chevron && !destructive && (
      <Ionicons name="chevron-back-outline" size={16} color={Colors.gray} />
    )}
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// PatientProfileScreen
// ─────────────────────────────────────────────────────────────────────────────

const PatientProfileScreen = ({ navigation }) => {
  const { user, userProfile, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // ── Derived display values ─────────────────────────────────────────────────
  const name   = userProfile?.name        ?? userProfile?.displayName ?? 'المريض';
  const phone  = userProfile?.phoneNumber ?? user?.phoneNumber        ?? '—';
  const email  = userProfile?.email       ?? user?.email              ?? '—';
  const gender = userProfile?.gender === 'male'   ? 'ذكر'
               : userProfile?.gender === 'female' ? 'أنثى'
               : '—';

  const dob = useMemo(() => {
    const raw = userProfile?.dateOfBirth ?? userProfile?.dob;
    if (!raw) return '—';
    try {
      const d = raw?.toDate?.() ?? new Date(raw);
      return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return '—'; }
  }, [userProfile]);

  const bloodType = userProfile?.bloodType ?? userProfile?.blood_type ?? '—';

  const joinedAt = useMemo(() => {
    const raw = userProfile?.createdAt;
    if (!raw) return '—';
    try {
      const d = raw?.toDate?.() ?? new Date(raw);
      return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
    } catch { return '—'; }
  }, [userProfile]);

  // Medical history fields
  const allergies   = userProfile?.medicalHistory?.allergies         ?? userProfile?.allergies         ?? null;
  const medications = userProfile?.medicalHistory?.currentMedications ?? userProfile?.currentMedications ?? null;
  const conditions  = userProfile?.medicalHistory?.chronicConditions  ?? userProfile?.chronicConditions  ?? null;

  // Avatar initials
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'تسجيل الخروج',
      'هل تريد تسجيل الخروج من حسابك؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text:  'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try { await signOut(); }
            catch { Alert.alert('خطأ', 'تعذّر تسجيل الخروج. حاول مرة أخرى.'); }
            finally { setIsSigningOut(false); }
          },
        },
      ],
    );
  }, [signOut]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ══ Profile Hero ══ */}
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || 'م'}</Text>
          </View>
          <Text style={styles.heroName}>{name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="person-circle-outline" size={13} color={Colors.primary} />
            <Text style={styles.roleBadgeText}>مريض</Text>
          </View>
          {/* Quick stats */}
          <View style={styles.heroStats}>
            {bloodType !== '—' && (
              <View style={styles.heroStatChip}>
                <Ionicons name="water-outline" size={14} color="#ef4444" />
                <Text style={styles.heroStatText}>{bloodType}</Text>
              </View>
            )}
            {gender !== '—' && (
              <View style={styles.heroStatChip}>
                <Ionicons name="person-outline" size={14} color={Colors.primary} />
                <Text style={styles.heroStatText}>{gender}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ══ Personal Info ══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>المعلومات الشخصية</Text>
          <InfoRow icon="person-outline"   label="الاسم الكامل"       value={name}      />
          <View style={styles.divider} />
          <InfoRow icon="call-outline"     label="رقم الهاتف"         value={phone}     />
          <View style={styles.divider} />
          <InfoRow icon="mail-outline"     label="البريد الإلكتروني"  value={email}     />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="تاريخ الميلاد"      value={dob}       />
          <View style={styles.divider} />
          <InfoRow icon="water-outline"    label="فصيلة الدم"         value={bloodType} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-number-outline" label="عضو منذ"    value={joinedAt}  />
        </View>

        {/* ══ Medical History ══ */}
        {(allergies || medications || conditions) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>السجل الطبي</Text>

            {allergies && allergies !== 'None' && allergies !== 'لا يوجد' && (
              <View style={styles.medSection}>
                <View style={styles.medSectionHeader}>
                  <Ionicons name="warning-outline" size={15} color="#ef4444" />
                  <Text style={[styles.medSectionTitle, { color: '#ef4444' }]}>الحساسية</Text>
                </View>
                <View style={styles.medTagRow}>
                  {allergies.split(',').map((a) => (
                    <MedTag key={a.trim()} label={a.trim()} color="#dc2626" bg="#fee2e2" />
                  ))}
                </View>
              </View>
            )}

            {medications && medications !== 'None' && medications !== 'لا يوجد' && (
              <View style={styles.medSection}>
                <View style={styles.medSectionHeader}>
                  <Ionicons name="medical-outline" size={15} color={Colors.primary} />
                  <Text style={[styles.medSectionTitle, { color: Colors.primary }]}>الأدوية الحالية</Text>
                </View>
                <View style={styles.medTagRow}>
                  {medications.split(',').map((m) => (
                    <MedTag key={m.trim()} label={m.trim()} color={Colors.primary} bg="#d1fae5" />
                  ))}
                </View>
              </View>
            )}

            {conditions && conditions !== 'None' && conditions !== 'لا يوجد' && (
              <View style={styles.medSection}>
                <View style={styles.medSectionHeader}>
                  <Ionicons name="pulse-outline" size={15} color="#8b5cf6" />
                  <Text style={[styles.medSectionTitle, { color: '#8b5cf6' }]}>الأمراض المزمنة</Text>
                </View>
                <View style={styles.medTagRow}>
                  {conditions.split(',').map((c) => (
                    <MedTag key={c.trim()} label={c.trim()} color="#7c3aed" bg="#ede9fe" />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ══ Quick Actions ══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>الإجراءات السريعة</Text>
          <MenuRow
            icon="calendar-outline"
            label="مواعيدي"
            onPress={() => navigation.navigate('Appointments')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="document-text-outline"
            label="وثائقي الطبية"
            onPress={() => navigation.navigate('Documents')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="chatbubble-outline"
            label="محادثاتي"
            onPress={() => Alert.alert('قريباً', 'هذه الميزة قيد التطوير.')}
          />
        </View>

        {/* ══ Account ══ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>الحساب</Text>
          <MenuRow
            icon="shield-checkmark-outline"
            label="الخصوصية والأمان"
            onPress={() => Alert.alert('قريباً', 'هذه الميزة قيد التطوير.')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="help-circle-outline"
            label="المساعدة والدعم"
            onPress={() => Alert.alert('قريباً', 'هذه الميزة قيد التطوير.')}
          />
          <View style={styles.divider} />

          {isSigningOut ? (
            <View style={styles.signOutRow}>
              <ActivityIndicator size="small" color={Colors.error} />
              <Text style={styles.signOutText}>جاري تسجيل الخروج...</Text>
            </View>
          ) : (
            <MenuRow
              icon="log-out-outline"
              label="تسجيل الخروج"
              onPress={handleSignOut}
              destructive
              chevron={false}
            />
          )}
        </View>

        <Text style={styles.versionText}>Tabibak v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { gap: Spacing.md, paddingBottom: Spacing.xxl },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.primary,
    alignItems:      'center',
    paddingTop:      Spacing.xl,
    paddingBottom:   Spacing.xxl,
    gap:             Spacing.sm,
  },
  avatarCircle: {
    width:           88,
    height:          88,
    borderRadius:    BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth:     3,
    borderColor:     'rgba(255,255,255,0.6)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText:  { fontSize: 36, fontWeight: '700', color: Colors.white },
  heroName:    { fontSize: FontSizes.xl, fontWeight: '800', color: Colors.white },
  roleBadge: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  'rgba(255,255,255,0.9)',
    borderRadius:     BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  4,
    gap:              4,
  },
  roleBadgeText: { fontSize: FontSizes.xs, fontWeight: '700', color: Colors.primary },
  heroStats: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  heroStatChip: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  'rgba(255,255,255,0.2)',
    borderRadius:     BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  4,
    gap:              4,
  },
  heroStatText: { color: Colors.white, fontSize: FontSizes.xs, fontWeight: '600' },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor:  Colors.white,
    marginHorizontal: Spacing.md,
    borderRadius:     BorderRadius.xl,
    paddingVertical:  Spacing.xs,
    elevation:        1,
    shadowColor:      Colors.black,
    shadowOffset:     { width: 0, height: 1 },
    shadowOpacity:    0.05,
    shadowRadius:     2,
  },
  cardTitle: {
    fontSize:          FontSizes.sm,
    fontWeight:        '700',
    color:             Colors.textSecondary,
    textAlign:         'right',
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.sm,
    paddingBottom:     Spacing.xs,
  },
  divider: {
    height:           1,
    backgroundColor:  Colors.borderLight,
    marginHorizontal: Spacing.md,
  },

  // ── Info rows ─────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.sm,
    gap:              Spacing.sm,
  },
  iconBox: {
    width:          36,
    height:         36,
    borderRadius:   BorderRadius.md,
    backgroundColor: Colors.primaryLight + '20',
    alignItems:     'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  infoValue: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.text },

  // ── Medical history ───────────────────────────────────────────────────────
  medSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    gap:               Spacing.xs,
  },
  medSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  medSectionTitle: { fontSize: FontSizes.sm, fontWeight: '700' },
  medTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  medTag: {
    borderRadius:     BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical:  4,
  },
  medTagText: { fontSize: FontSizes.xs, fontWeight: '600' },

  // ── Menu rows ─────────────────────────────────────────────────────────────
  menuRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.sm,
    gap:              Spacing.sm,
  },
  menuIconBox: {
    width:          36,
    height:         36,
    borderRadius:   BorderRadius.md,
    backgroundColor: Colors.primaryLight + '20',
    alignItems:     'center',
    justifyContent: 'center',
  },
  menuIconBoxRed: { backgroundColor: '#fee2e2' },
  menuContent:    { flex: 1, gap: 2 },
  menuLabel:      { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  menuLabelRed:   { color: Colors.error, fontWeight: '600' },
  menuValue:      { fontSize: FontSizes.xs, color: Colors.textSecondary },

  // ── Sign-out loading ──────────────────────────────────────────────────────
  signOutRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.sm,
    gap:              Spacing.sm,
  },
  signOutText: { fontSize: FontSizes.sm, color: Colors.error },

  // ── Footer ────────────────────────────────────────────────────────────────
  versionText: { textAlign: 'center', fontSize: FontSizes.xs, color: Colors.gray },
});

export default PatientProfileScreen;
