/**
 * DoctorSettingsScreen.js — Doctor Settings & Preferences (Phase 3/4)
 *
 * Accessed from DoctorProfileScreen → gear icon → navigation.navigate('Settings').
 * No route params needed — reads the auth user from AuthContext.
 *
 * Settings categories:
 *   1. Notifications   — toggle preferences stored in AsyncStorage
 *   2. Schedule        — shortcut back to DoctorProfile for schedule management
 *   3. Account         — sign out, privacy, support
 *   4. About           — app version
 *
 * RTL compliance:
 *   marginStart / marginEnd   → never marginLeft / marginRight
 *   borderStartWidth          → never borderLeftWidth
 */

import React, {
  useState,
  useCallback,
  useEffect,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../contexts/AuthContext';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// AsyncStorage keys
// ─────────────────────────────────────────────────────────────────────────────

const PREFS_KEY = '@doctor_settings_prefs';

const DEFAULT_PREFS = {
  notifNewAppointment: true,
  notifAppointmentReminder: true,
  notifCancellation: true,
  notifChatMessage: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const SectionHeader = memo(({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
));

const ToggleRow = memo(({ icon, label, subtitle, value, onToggle }) => (
  <View style={styles.settingRow}>
    <View style={styles.rowIconBox}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: Colors.border, true: Colors.primaryLight ?? Colors.primary }}
      thumbColor={value ? Colors.primary : Colors.white}
      ios_backgroundColor={Colors.border}
    />
  </View>
));

const MenuRow = memo(({ icon, label, subtitle, onPress, destructive }) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.rowIconBox, destructive && styles.rowIconBoxRed]}>
      <Ionicons name={icon} size={18} color={destructive ? Colors.error : Colors.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelRed]}>{label}</Text>
      {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
    </View>
    {!destructive && (
      <Ionicons name="chevron-back-outline" size={16} color={Colors.gray} />
    )}
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// DoctorSettingsScreen
// ─────────────────────────────────────────────────────────────────────────────

const DoctorSettingsScreen = ({ navigation }) => {
  const { user, userProfile, signOut } = useAuth();

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // ── Load saved prefs ──────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      })
      .catch(() => {/* ignore read errors — use defaults */ })
      .finally(() => setIsLoadingPrefs(false));
  }, []);

  // ── Toggle a preference ───────────────────────────────────────────────────
  const togglePref = useCallback((key) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'تسجيل الخروج',
      'هل تريد تسجيل الخروج من حسابك؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج', style: 'destructive',
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

  const doctorName = userProfile?.name ?? userProfile?.displayName ?? '—';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ══ Profile mini-card ══ */}
        <View style={styles.profileCard}>
          <View style={styles.miniAvatar}>
            <Text style={styles.miniAvatarText}>
              {(doctorName[0] ?? 'أ').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{doctorName}</Text>
            <Text style={styles.profileSpec}>{userProfile?.specialty ?? '—'}</Text>
          </View>
        </View>

        {/* ══ Notifications ══ */}
        <View style={styles.card}>
          <SectionHeader title="الإشعارات" />

          {isLoadingPrefs ? (
            <View style={styles.prefsLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : (
            <>
              <ToggleRow
                icon="calendar-outline"
                label="مواعيد جديدة"
                subtitle="إشعار عند حجز موعد جديد"
                value={prefs.notifNewAppointment}
                onToggle={() => togglePref('notifNewAppointment')}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="alarm-outline"
                label="تذكير المواعيد"
                subtitle="تذكير قبل ٣٠ دقيقة من الموعد"
                value={prefs.notifAppointmentReminder}
                onToggle={() => togglePref('notifAppointmentReminder')}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="close-circle-outline"
                label="إلغاء المواعيد"
                subtitle="إشعار عند إلغاء موعد من قِبل المريض"
                value={prefs.notifCancellation}
                onToggle={() => togglePref('notifCancellation')}
              />
              <View style={styles.divider} />
              <ToggleRow
                icon="chatbubble-outline"
                label="رسائل المحادثة"
                subtitle="إشعار عند وصول رسالة جديدة"
                value={prefs.notifChatMessage}
                onToggle={() => togglePref('notifChatMessage')}
              />
            </>
          )}
        </View>

        {/* ══ Schedule ══ */}
        <View style={styles.card}>
          <SectionHeader title="الجدول والتوفر" />
          <MenuRow
            icon="time-outline"
            label="إدارة ساعات العمل"
            subtitle="تعديل الجدول الأسبوعي وأوقات الراحة"
            onPress={() => navigation.goBack()}  // DoctorProfileScreen has schedule management
          />
          <View style={styles.divider} />
          <MenuRow
            icon="ban-outline"
            label="إضافة يوم إجازة"
            subtitle="حظر تاريخ معين من الحجوزات"
            onPress={() => navigation.goBack()}
          />
        </View>

        {/* ══ Account ══ */}
        <View style={styles.card}>
          <SectionHeader title="الحساب والأمان" />
          <MenuRow
            icon="person-outline"
            label="تعديل الملف الشخصي"
            subtitle="الاسم، التخصص، السيرة الذاتية"
            onPress={() => navigation.goBack()}
          />
          <View style={styles.divider} />
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
            />
          )}
        </View>

        {/* ══ About ══ */}
        <View style={styles.card}>
          <SectionHeader title="حول التطبيق" />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>الإصدار</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>البيئة</Text>
            <Text style={styles.aboutValue}>Production</Text>
          </View>
        </View>

        <Text style={styles.footerText}>Vanbook v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { gap: Spacing.md, paddingVertical: Spacing.md, paddingBottom: Spacing.xxl },

  // ── Mini profile card ──────────────────────────────────────────────────────
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: Spacing.sm,
    elevation: 1,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  miniAvatar: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.white },
  profileName: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  profileSpec: { fontSize: FontSizes.sm, color: Colors.textSecondary },

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
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'right',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },

  // ── Setting rows ──────────────────────────────────────────────────────────
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  rowIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconBoxRed: { backgroundColor: '#fee2e2' },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  rowLabelRed: { color: Colors.error, fontWeight: '600' },
  rowSubtitle: { fontSize: FontSizes.xs, color: Colors.textSecondary },

  // ── Prefs loading ─────────────────────────────────────────────────────────
  prefsLoading: {
    alignItems: 'center',
    padding: Spacing.md,
  },

  // ── About rows ────────────────────────────────────────────────────────────
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  aboutLabel: { fontSize: FontSizes.md, color: Colors.text, fontWeight: '500' },
  aboutValue: { fontSize: FontSizes.sm, color: Colors.textSecondary },

  // ── Sign-out row ──────────────────────────────────────────────────────────
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  signOutText: { fontSize: FontSizes.sm, color: Colors.error },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerText: {
    textAlign: 'center',
    fontSize: FontSizes.xs,
    color: Colors.gray,
  },
});

export default DoctorSettingsScreen;
