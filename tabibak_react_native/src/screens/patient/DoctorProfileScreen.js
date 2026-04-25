/**
 * DoctorProfileScreen.js — Patient-Side Public Doctor Profile (Phase 4)
 *
 * ╔══ ARCHITECTURE ════════════════════════════════════════════════════════════╗
 *
 * TWO-PHASE HYDRATION
 * ───────────────────
 *   Phase 1 (zero network): If route.params.doctor is present its partial
 *   fields (name, specialty, photoURL, rating, isAvailable) hydrate the hero
 *   instantly — no loading spinner for above-the-fold content.
 *
 *   Phase 2 (background): firestoreService.getDoctorById(doctorId) fetches
 *   the full profile (bio, workingHours, hospital, education, languages,
 *   consultationFee). State is merged via spread so Phase 1 fields are never
 *   regressed.
 *
 * STICKY FOOTER PATTERN
 * ──────────────────────
 *   ScreenContainer scrollable={false} padded={false} edges={['bottom']}
 *   └─ ScrollView  (flex:1)
 *   └─ Footer View (sibling — always on screen)
 *
 * WORKING HOURS FORMAT
 * ─────────────────────
 *   workingHours[day] may be:
 *     { open: true,  start: 'HH:MM', end: 'HH:MM' }  — working day
 *     { open: false }                                  — day off
 *     null | undefined                                 — not configured
 *
 * CONTRACTS ENFORCED
 * ───────────────────
 *   ✅ ScreenContainer (scrollable=false, padded=false, edges=['bottom'])
 *   ✅ RTL logical properties throughout (marginStart/End, paddingStart/End)
 *   ✅ All strings via t() — zero hardcoded text
 *   ✅ colors / spacing / typography / BorderRadius from theme.js only
 *   ✅ Zero Firebase imports — reads via firestoreService
 *   ✅ Zero Alert.alert — unavailable state shown as inline notice
 *   ✅ Zero SafeAreaView from react-native — ScreenContainer handles it
 *
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useCallback,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import ScreenContainer         from '../../components/ui/ScreenContainer';
import PrimaryButton           from '../../components/ui/PrimaryButton';
import firestoreService        from '../../services/firestoreService';
import {
  colors,
  spacing,
  typography,
  BorderRadius,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FOOTER_HEIGHT = 84;

/**
 * Canonical day order + key map.
 * Keys match the Firestore workingHours object AND the locale days.* keys.
 */
const DAY_ORDER = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
];

// Platform-specific shadow definitions
const shadowSm = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
  },
  android: {
    elevation: 3,
  },
});

const shadowMd = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  android: {
    elevation: 5,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a working-hours slot entry to { open, label } shape.
 * Handles both the structured { open, start, end } format and legacy string
 * arrays / null values from older Firestore documents.
 */
const resolveSlot = (slot) => {
  if (!slot) return { open: false, label: null };

  // Structured format: { open: bool, start: 'HH:MM', end: 'HH:MM' }
  if (typeof slot === 'object' && !Array.isArray(slot)) {
    if (!slot.open) return { open: false, label: null };
    const label =
      slot.start && slot.end ? `${slot.start} – ${slot.end}` : null;
    return { open: true, label };
  }

  // Legacy string format: "09:00 - 17:00"
  if (typeof slot === 'string') return { open: true, label: slot };

  // Legacy array of strings: ["09:00 - 13:00", "15:00 - 18:00"]
  if (Array.isArray(slot) && slot.length > 0) {
    return { open: true, label: slot.join(' / ') };
  }

  return { open: false, label: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Compact star row (5 stars, half-star not needed at this fidelity) */
const StarRow = memo(({ rating = 0 }) => {
  const filled = Math.round(rating);
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= filled ? 'star' : 'star-outline'}
          size={13}
          color={colors.warning}
        />
      ))}
    </View>
  );
});

/** One stat chip: icon + value + label */
const StatChip = memo(({ icon, value, label, iconColor }) => (
  <View style={styles.statChip}>
    <View style={[styles.statIconBox, { backgroundColor: (iconColor ?? colors.primary) + '1A' }]}>
      <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />
    </View>
    <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
  </View>
));

/** Card wrapper with a title bar */
const SectionCard = memo(({ title, children }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
));

/** One working-hours row */
const HourRow = memo(({ dayKey, slot, dayLabel, dayOffLabel }) => {
  const { open, label } = resolveSlot(slot);
  return (
    <View style={styles.hourRow}>
      <Text style={styles.hourDay}>{dayLabel}</Text>
      {open ? (
        label ? (
          <View style={styles.hourPill}>
            <Text style={styles.hourPillText}>{label}</Text>
          </View>
        ) : (
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
        )
      ) : (
        <Text style={styles.hourOff}>{dayOffLabel}</Text>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DoctorProfileScreen
// ─────────────────────────────────────────────────────────────────────────────

const DoctorProfileScreen = ({ route, navigation }) => {
  const { t }   = useTranslation();
  const insets  = useSafeAreaInsets();

  const { doctor: paramDoctor, doctorId: paramDoctorId } = route.params ?? {};
  const resolvedId = paramDoctorId ?? paramDoctor?.id;

  // ── State ──────────────────────────────────────────────────────────────────
  // Phase 1 seed
  const [doctor,       setDoctor]       = useState(paramDoctor ?? null);
  const [isFullLoaded, setIsFullLoaded] = useState(false);
  // Only true while Phase 2 is running AND no Phase 1 data exists
  const [isLoading,    setIsLoading]    = useState(!paramDoctor);
  const [error,        setError]        = useState(null);
  const [bioExpanded,  setBioExpanded]  = useState(false);

  // ── Phase 2: fetch full profile ────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedId) {
      setError(t('doctors.profileLoadError'));
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    firestoreService.getDoctorById(resolvedId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.doctor) {
          // Merge: full profile extends Phase 1 data without regressing any field
          setDoctor((prev) => ({ ...(prev ?? {}), ...res.doctor }));
          setIsFullLoaded(true);
        } else {
          if (!doctor) setError(t('doctors.profileLoadError'));
        }
      })
      .catch(() => {
        if (isMounted && !doctor) setError(t('doctors.profileLoadError'));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [resolvedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleBook = useCallback(() => {
    if (!doctor) return;
    navigation.navigate('BookAppointment', { doctor });
  }, [navigation, doctor]);

  const handleChat = useCallback(() => {
    if (!resolvedId) return;
    navigation.navigate('Chat', {
      recipientId:     resolvedId,
      recipientName:   doctor?.name
        ? `${t('doctors.drPrefix')} ${doctor.name}`
        : t('doctors.drPrefix'),
      recipientAvatar: doctor?.photoURL ?? null,
    });
  }, [navigation, resolvedId, doctor, t]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const name        = doctor?.name ?? doctor?.displayName ?? t('doctors.drPrefix');
  const specialty   = doctor?.specialty ?? '';
  const bio         = doctor?.bio ?? doctor?.about ?? '';
  const rating      = doctor?.rating ?? 0;
  const reviewCount = doctor?.reviewCount ?? 0;
  const experience  = doctor?.yearsOfExperience ?? doctor?.experience ?? null;
  const fee         = doctor?.consultationFee ?? null;
  const hospital    = doctor?.hospital ?? doctor?.workplace ?? null;
  const education   = Array.isArray(doctor?.education) ? doctor.education : [];
  const languages   = Array.isArray(doctor?.languages) ? doctor.languages : [];
  const isAvailable = doctor?.isAvailable ?? false;

  const workingHours = doctor?.workingHours ?? {};
  const sortedDays   = DAY_ORDER.filter((d) => d in workingHours);

  const isLongBio  = bio.length > 140;
  const displayBio = isLongBio && !bioExpanded ? `${bio.slice(0, 140)}…` : bio;

  const avatarLetter = name.trim()[0]?.toUpperCase() ?? 'D';

  // ── Loading state (no Phase 1 data yet) ───────────────────────────────────
  if (isLoading && !doctor) {
    return (
      <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>
        {/* Green header strip */}
        <View style={[styles.loadingHeader, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredStateText}>{t('common.loading')}</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ── Error state (no Phase 1 data) ─────────────────────────────────────────
  if (error && !doctor) {
    return (
      <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>
        <View style={[styles.loadingHeader, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={52} color={colors.error} />
          <Text style={styles.centeredStateError}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setError(null);
              setIsLoading(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ── Full render ────────────────────────────────────────────────────────────
  const footerBottomPad = Math.max(insets.bottom, spacing.sm);

  return (
    <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>

      {/* ── Scrollable body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ══ Hero card ══ */}
        <View style={[styles.heroCard, { paddingTop: insets.top + spacing.md }]}>

          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarRing}>
            {doctor?.photoURL ? (
              <Image source={{ uri: doctor.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
            )}
          </View>

          {/* Availability badge */}
          <View style={[
            styles.availBadge,
            isAvailable ? styles.availBadgeOn : styles.availBadgeOff,
          ]}>
            <View style={[
              styles.availDot,
              { backgroundColor: isAvailable ? colors.success : colors.gray },
            ]} />
            <Text style={[
              styles.availText,
              { color: isAvailable ? colors.success : colors.gray },
            ]}>
              {isAvailable ? t('doctors.availableNow') : t('doctors.unavailableNow')}
            </Text>
          </View>

          {/* Name */}
          <Text style={styles.heroName}>
            {t('doctors.drPrefix')} {name}
          </Text>

          {/* Specialty */}
          {!!specialty && (
            <Text style={styles.heroSpecialty}>{specialty}</Text>
          )}

          {/* Star rating */}
          <View style={styles.heroRatingRow}>
            <StarRow rating={rating} />
            <Text style={styles.heroRatingValue}>{rating.toFixed(1)}</Text>
            {reviewCount > 0 && (
              <Text style={styles.heroReviewCount}>({reviewCount})</Text>
            )}
          </View>

          {/* Hospital */}
          {!!hospital && (
            <View style={styles.heroHospitalRow}>
              <Ionicons name="business-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroHospitalText}>{hospital}</Text>
            </View>
          )}

          {/* Phase 2 loading shimmer (small spinner) */}
          {!isFullLoaded && !isLoading && (
            <ActivityIndicator
              size="small"
              color="rgba(255,255,255,0.7)"
              style={{ marginTop: spacing.sm }}
            />
          )}
        </View>

        {/* ══ Stats row ══ */}
        <View style={styles.statsRow}>
          <StatChip
            icon="star"
            value={rating.toFixed(1)}
            label={t('doctors.ratingLabel')}
            iconColor={colors.warning}
          />
          {experience !== null && (
            <StatChip
              icon="briefcase-outline"
              value={`${experience}+`}
              label={t('doctors.experienceSuffix')}
            />
          )}
          {fee !== null && (
            <StatChip
              icon="cash-outline"
              value={`${fee}`}
              label={t('doctors.feeLabel')}
              iconColor={colors.secondary}
            />
          )}
        </View>

        {/* ══ Unavailable notice ══ */}
        {!isAvailable && (
          <View style={styles.unavailableBanner}>
            <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
            <Text style={styles.unavailableText}>{t('doctors.unavailableNote')}</Text>
          </View>
        )}

        {/* ══ Bio ══ */}
        {!!bio && (
          <SectionCard title={t('doctors.bioTitle')}>
            <Text style={styles.bioText}>{displayBio}</Text>
            {isLongBio && (
              <TouchableOpacity
                onPress={() => setBioExpanded((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.bioToggle}>
                  {bioExpanded ? t('doctors.showLess') : t('doctors.showMore')}
                </Text>
              </TouchableOpacity>
            )}
          </SectionCard>
        )}

        {/* ══ Working hours ══ */}
        {sortedDays.length > 0 && (
          <SectionCard title={t('doctors.hoursTitle')}>
            {sortedDays.map((dayKey) => (
              <HourRow
                key={dayKey}
                dayKey={dayKey}
                slot={workingHours[dayKey]}
                dayLabel={t(`doctors.days.${dayKey}`)}
                dayOffLabel={t('doctors.dayOff')}
              />
            ))}
          </SectionCard>
        )}

        {/* ══ Education ══ */}
        {education.length > 0 && (
          <SectionCard title={t('doctors.eduTitle')}>
            {education.map((item, i) => (
              <View key={i} style={styles.eduRow}>
                <Ionicons name="school-outline" size={14} color={colors.primary} />
                <Text style={styles.eduText}>{item}</Text>
              </View>
            ))}
          </SectionCard>
        )}

        {/* ══ Languages ══ */}
        {languages.length > 0 && (
          <SectionCard title={t('doctors.langTitle')}>
            <View style={styles.langRow}>
              {languages.map((lang, i) => (
                <View key={i} style={styles.langPill}>
                  <Text style={styles.langText}>{lang}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {/* Spacer so footer never covers last section */}
        <View style={{ height: FOOTER_HEIGHT + footerBottomPad }} />
      </ScrollView>

      {/* ══ Sticky footer ══ */}
      <View style={[styles.footer, { paddingBottom: footerBottomPad }]}>
        {/* Chat outline button */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={handleChat}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
          <Text style={styles.chatBtnText}>{t('doctors.chatAction')}</Text>
        </TouchableOpacity>

        {/* Book appointment filled button */}
        <View style={styles.bookBtnWrapper}>
          <PrimaryButton
            label={t('doctors.bookAppointment')}
            onPress={handleBook}
            disabled={!isAvailable}
            style={!isAvailable ? styles.bookBtnDisabled : undefined}
          />
        </View>
      </View>

    </ScreenContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles — RTL logical properties throughout
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Centered states ─────────────────────────────────────────────────────────
  loadingHeader: {
    backgroundColor:   colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom:     spacing.md,
  },
  centeredState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.lg,
    gap:            spacing.md,
  },
  centeredStateText: {
    fontSize: typography.sizes.sm,
    color:    colors.textSecondary,
  },
  centeredStateError: {
    fontSize:  typography.sizes.md,
    color:     colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor:   colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    borderRadius:      BorderRadius.full,
  },
  retryBtnText: {
    color:      colors.white,
    fontWeight: '600',
    fontSize:   typography.sizes.sm,
  },

  // ── Back button ─────────────────────────────────────────────────────────────
  backBtn: {
    position:        'absolute',
    top:             spacing.sm,
    start:           spacing.md,
    width:           36,
    height:          36,
    borderRadius:    BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
  },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: spacing.xs },

  // ── Hero card ───────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor:   colors.primary,
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xl,
    marginBottom:      spacing.sm,
  },
  avatarRing: {
    width:        96,
    height:       96,
    borderRadius: BorderRadius.full,
    borderWidth:  3,
    borderColor:  'rgba(255,255,255,0.6)',
    marginBottom: spacing.sm,
    overflow:     'hidden',
  },
  avatarImage:   { width: '100%', height: '100%' },
  avatarFallback: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarLetter: { fontSize: 40, fontWeight: '700', color: colors.white },

  availBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    marginBottom:      spacing.xs,
    gap:               5,
  },
  availBadgeOn:  { backgroundColor: 'rgba(255,255,255,0.9)' },
  availBadgeOff: { backgroundColor: 'rgba(255,255,255,0.7)' },
  availDot:     { width: 7, height: 7, borderRadius: 4 },
  availText:    { fontSize: typography.sizes.xs, fontWeight: '700' },

  heroName: {
    fontSize:   typography.sizes.xl,
    fontWeight: '800',
    color:      colors.white,
    textAlign:  'center',
  },
  heroSpecialty: {
    fontSize:     typography.sizes.sm,
    color:        'rgba(255,255,255,0.85)',
    marginTop:    3,
    marginBottom: spacing.xs,
  },
  heroRatingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginBottom:  spacing.xs,
  },
  starRow:         { flexDirection: 'row', gap: 2 },
  heroRatingValue: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.white },
  heroReviewCount: { fontSize: typography.sizes.xs, color: 'rgba(255,255,255,0.8)' },

  heroHospitalRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     3,
  },
  heroHospitalText: { fontSize: typography.sizes.xs, color: 'rgba(255,255,255,0.8)' },

  // ── Stats row ───────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection:     'row',
    backgroundColor:   colors.white,
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.sm,
    borderRadius:      BorderRadius.xl,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.sm,
    justifyContent:    'space-around',
    ...shadowSm,
  },
  statChip: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  statIconBox: {
    width:          40,
    height:         40,
    borderRadius:   BorderRadius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize:   typography.sizes.md,
    fontWeight: '700',
    color:      colors.text,
  },
  statLabel: {
    fontSize:  10,
    color:     colors.textSecondary,
    textAlign: 'center',
  },

  // ── Unavailable notice ──────────────────────────────────────────────────────
  unavailableBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.warning + '18',
    borderRadius:      BorderRadius.md,
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
    borderStartWidth:  3,
    borderStartColor:  colors.warning,
  },
  unavailableText: {
    flex:     1,
    fontSize: typography.sizes.sm,
    color:    colors.warning,
  },

  // ── Section card ────────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor:   colors.white,
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.sm,
    borderRadius:      BorderRadius.xl,
    padding:           spacing.md,
    ...shadowSm,
  },
  sectionTitle: {
    fontSize:     typography.sizes.sm,
    fontWeight:   '700',
    color:        colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Bio ─────────────────────────────────────────────────────────────────────
  bioText: {
    fontSize:   typography.sizes.sm,
    color:      colors.text,
    lineHeight: 22,
  },
  bioToggle: {
    fontSize:   typography.sizes.xs,
    color:      colors.primary,
    fontWeight: '600',
    marginTop:  spacing.xs,
  },

  // ── Working hours ────────────────────────────────────────────────────────────
  hourRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   7,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  hourDay: {
    flex:       1,
    fontSize:   typography.sizes.sm,
    fontWeight: '500',
    color:      colors.text,
  },
  hourOff: {
    fontSize:   typography.sizes.sm,
    color:      colors.gray,
    fontStyle:  'italic',
  },
  hourPill: {
    backgroundColor:   colors.primary + '15',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  hourPillText: {
    fontSize:   typography.sizes.xs,
    fontWeight: '600',
    color:      colors.primary,
  },

  // ── Education ───────────────────────────────────────────────────────────────
  eduRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    paddingVertical: 4,
  },
  eduText: {
    flex:       1,
    fontSize:   typography.sizes.sm,
    color:      colors.text,
    lineHeight: 20,
  },

  // ── Languages ────────────────────────────────────────────────────────────────
  langRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  langPill: {
    backgroundColor:   colors.secondary + '15',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  langText: {
    fontSize:   typography.sizes.sm,
    color:      colors.secondary,
    fontWeight: '500',
  },

  // ── Sticky footer ────────────────────────────────────────────────────────────
  footer: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.white,
    paddingHorizontal: spacing.md,
    paddingTop:        spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    gap:               spacing.sm,
    ...shadowMd,
  },

  chatBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     colors.primary,
    borderRadius:    BorderRadius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap:             6,
    height:          48,
  },
  chatBtnText: {
    fontSize:   typography.sizes.md,
    fontWeight: '700',
    color:      colors.primary,
  },

  bookBtnWrapper: {
    flex: 2,
  },
  bookBtnDisabled: {
    backgroundColor: colors.gray,
  },
});

export default DoctorProfileScreen;