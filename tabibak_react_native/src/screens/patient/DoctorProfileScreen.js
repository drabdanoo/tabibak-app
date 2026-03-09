/**
 * DoctorProfileScreen.js — Patient-Side Public Doctor Profile (Patient Stack)
 *
 * ── Navigation Entry Points ──────────────────────────────────────────────────
 *
 *   From MyAppointmentsScreen (tap doctor name on a completed appointment):
 *     navigation.navigate('DoctorProfile', { doctorId, doctor })
 *
 *   From ChatScreen (tap participant header):
 *     navigation.navigate('DoctorProfile', { doctorId })
 *
 *   From any patient screen:
 *     navigation.navigate('DoctorProfile', { doctorId })
 *     navigation.navigate('DoctorProfile', { doctorId, doctor })  // preloaded
 *
 * ── Two-Phase Hydration ───────────────────────────────────────────────────────
 *
 *   Phase 1 (zero network cost): If route.params.doctor is present, its partial
 *   fields (name, specialty, photoURL, rating, isAvailable) hydrate the hero
 *   section instantly — no loading spinner for above-the-fold content.
 *
 *   Phase 2 (background): firestoreService.getDoctorById(doctorId) fetches the
 *   full profile (bio, workingHours, hospital, education, consultationFee,
 *   languages). On resolve, state is merged via spread so Phase 1 fields are
 *   never regressed.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *   ScrollView layout:
 *     · Hero card    — avatar initials (or photo), name, specialty, availability
 *     · Stats row    — rating, experience, consultationFee
 *     · Bio          — expandable (120-char collapse)
 *     · Working hours — day/time grid
 *     · Actions      — sticky footer (Book Appointment + Chat)
 *
 *   Sticky footer:
 *     Root View (flex:1) → ScrollView (flex:1) + Footer View (sibling)
 *     The ScrollView ends with a spacer equal to the footer height so the last
 *     content section is never obscured.
 *
 * ── Key Distinction From DoctorDetailsScreen ─────────────────────────────────
 *
 *   DoctorDetailsScreen  — Doctor-browsing/booking funnel (DoctorList → Details
 *     → Book). Heavy layout with tab strip, photo hero, full review list.
 *   DoctorProfileScreen  — Context-driven profile card (accessed from appt
 *     history or chat). Lighter single-scroll layout focused on identity +
 *     quick actions.
 *
 * ── RTL COMPLIANCE ────────────────────────────────────────────────────────────
 *   marginStart / marginEnd          → never marginLeft / marginRight
 *   paddingStart / paddingEnd        → never paddingLeft / paddingRight
 *   borderStartWidth                 → never borderLeftWidth
 *   borderTopStartRadius / End       → never borderTopLeftRadius / Right
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
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FOOTER_HEIGHT = 80; // approximate footer area height for scroll spacer

const DAY_ORDER = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday', 'Sunday',
];

const DAY_AR = {
  Monday:    'الاثنين',
  Tuesday:   'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday:  'الخميس',
  Friday:    'الجمعة',
  Saturday:  'السبت',
  Sunday:    'الأحد',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Single star-rating display */
const StarRating = memo(({ rating = 0 }) => {
  const rounded = Math.round(rating);
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rounded ? 'star' : 'star-outline'}
          size={14}
          color={Colors.warning}
        />
      ))}
    </View>
  );
});

/** Stat chip: icon + number + label */
const StatChip = memo(({ icon, value, label, color }) => (
  <View style={styles.statChip}>
    <View style={[styles.statIconBox, { backgroundColor: (color ?? Colors.primary) + '18' }]}>
      <Ionicons name={icon} size={18} color={color ?? Colors.primary} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

/** Section card wrapper */
const SectionCard = memo(({ title, children }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
));

/** Working-hours row (one day) */
const HourRow = memo(({ day, slots }) => {
  const isOff = !slots || (Array.isArray(slots) && slots.length === 0);
  return (
    <View style={styles.hourRow}>
      <Text style={styles.hourDay}>{DAY_AR[day] ?? day}</Text>
      {isOff ? (
        <Text style={styles.hourOff}>إجازة</Text>
      ) : (
        <View style={styles.hourSlots}>
          {(Array.isArray(slots) ? slots : [slots]).map((slot, i) => (
            <View key={i} style={styles.hourSlotPill}>
              <Text style={styles.hourSlotText}>{slot}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DoctorProfileScreen
// ─────────────────────────────────────────────────────────────────────────────

const DoctorProfileScreen = ({ route, navigation }) => {
  const { doctor: paramDoctor, doctorId: paramDoctorId } = route.params ?? {};
  const resolvedId = paramDoctorId ?? paramDoctor?.id;

  const insets = useSafeAreaInsets();

  // Phase 1: seed with partial data from route params
  const [doctor,       setDoctor]       = useState(paramDoctor ?? null);
  const [isFullLoaded, setIsFullLoaded] = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState(null);
  const [bioExpanded,  setBioExpanded]  = useState(false);

  // ── Phase 2: fetch full profile ───────────────────────────────────────────
  useEffect(() => {
    if (!resolvedId) {
      setError('معرّف الطبيب غير موجود');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    firestoreService.getDoctorById(resolvedId)
      .then(res => {
        if (!isMounted) return;
        if (res.success && res.doctor) {
          // Merge: full profile overwrites partial but never deletes Phase 1 fields
          setDoctor(prev => ({ ...(prev ?? {}), ...res.doctor }));
          setIsFullLoaded(true);
        } else {
          if (!doctor) setError('تعذّر تحميل بيانات الطبيب');
        }
      })
      .catch(() => {
        if (isMounted && !doctor) setError('تعذّر تحميل بيانات الطبيب');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [resolvedId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleBook = useCallback(() => {
    if (!doctor) return;
    navigation.navigate('BookAppointment', { doctor });
  }, [navigation, doctor]);

  const handleChat = useCallback(() => {
    if (!resolvedId) return;
    navigation.navigate('Chat', {
      recipientId:   resolvedId,
      recipientName: doctor?.name ? `د. ${doctor.name}` : 'الطبيب',
      recipientAvatar: doctor?.photoURL ?? null,
    });
  }, [navigation, resolvedId, doctor]);

  // ── Derived values ────────────────────────────────────────────────────────
  const name        = doctor?.name ?? doctor?.displayName ?? 'الطبيب';
  const specialty   = doctor?.specialty ?? '';
  const bio         = doctor?.bio ?? doctor?.about ?? '';
  const rating      = doctor?.rating ?? 0;
  const reviewCount = doctor?.reviewCount ?? 0;
  const experience  = doctor?.yearsOfExperience ?? doctor?.experience ?? null;
  const fee         = doctor?.consultationFee ?? null;
  const hospital    = doctor?.hospital ?? doctor?.workplace ?? null;
  const education   = doctor?.education ?? [];
  const languages   = doctor?.languages ?? [];
  const isAvailable = doctor?.isAvailable ?? false;

  const workingHours = doctor?.workingHours ?? {};
  const sortedDays   = DAY_ORDER.filter(d => d in workingHours);

  const isLongBio  = bio.length > 140;
  const displayBio = isLongBio && !bioExpanded ? bio.slice(0, 140) + '…' : bio;

  const avatarLetter = name[0]?.toUpperCase() ?? 'د';

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading && !doctor) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الملف الشخصي…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !doctor) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={52} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setIsLoading(true); setError(null); }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Full render ───────────────────────────────────────────────────────────
  const footerPadding = Math.max(insets.bottom, Spacing.md);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Hero card ══ */}
        <View style={styles.heroCard}>
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
            styles.availabilityBadge,
            isAvailable ? styles.availabilityOn : styles.availabilityOff,
          ]}>
            <View style={[
              styles.availabilityDot,
              { backgroundColor: isAvailable ? Colors.primary : Colors.gray },
            ]} />
            <Text style={[
              styles.availabilityText,
              { color: isAvailable ? Colors.primary : Colors.gray },
            ]}>
              {isAvailable ? 'متاح للحجز' : 'غير متاح الآن'}
            </Text>
          </View>

          {/* Name + specialty */}
          <Text style={styles.heroName}>د. {name}</Text>
          {specialty ? (
            <Text style={styles.heroSpecialty}>{specialty}</Text>
          ) : null}

          {/* Star rating */}
          <View style={styles.heroRating}>
            <StarRating rating={rating} />
            <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
            {reviewCount > 0 && (
              <Text style={styles.ratingCount}>({reviewCount})</Text>
            )}
          </View>

          {/* Hospital */}
          {hospital ? (
            <View style={styles.heroHospital}>
              <Ionicons name="business-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.heroHospitalText}>{hospital}</Text>
            </View>
          ) : null}

          {/* Loading overlay — shows only if full profile hasn't arrived yet
              but Phase 1 data is already rendered */}
          {isLoading && (
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={styles.heroLoadingIndicator}
            />
          )}
        </View>

        {/* ══ Stats row ══ */}
        <View style={styles.statsRow}>
          <StatChip
            icon="star"
            value={rating.toFixed(1)}
            label="التقييم"
            color={Colors.warning}
          />
          {experience !== null && (
            <StatChip
              icon="briefcase-outline"
              value={`${experience}+`}
              label="سنوات خبرة"
            />
          )}
          {fee !== null && (
            <StatChip
              icon="cash-outline"
              value={`${fee} ر.س`}
              label="سعر الاستشارة"
              color="#3b82f6"
            />
          )}
        </View>

        {/* ══ Bio ══ */}
        {bio ? (
          <SectionCard title="نبذة عن الطبيب">
            <Text style={styles.bioText}>{displayBio}</Text>
            {isLongBio && (
              <TouchableOpacity
                onPress={() => setBioExpanded(v => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.bioToggle}>
                  {bioExpanded ? 'عرض أقل' : 'عرض المزيد'}
                </Text>
              </TouchableOpacity>
            )}
          </SectionCard>
        ) : null}

        {/* ══ Working hours ══ */}
        {sortedDays.length > 0 && (
          <SectionCard title="ساعات العمل">
            {sortedDays.map(day => (
              <HourRow key={day} day={day} slots={workingHours[day]} />
            ))}
          </SectionCard>
        )}

        {/* ══ Education ══ */}
        {education.length > 0 && (
          <SectionCard title="التعليم والشهادات">
            {education.map((item, i) => (
              <View key={i} style={styles.eduRow}>
                <Ionicons name="school-outline" size={15} color={Colors.primary} />
                <Text style={styles.eduText}>{item}</Text>
              </View>
            ))}
          </SectionCard>
        )}

        {/* ══ Languages ══ */}
        {languages.length > 0 && (
          <SectionCard title="اللغات">
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
        <View style={{ height: FOOTER_HEIGHT + footerPadding }} />
      </ScrollView>

      {/* ══ Sticky footer ══ */}
      <View style={[styles.footer, { paddingBottom: footerPadding }]}>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={handleChat}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
          <Text style={styles.chatBtnText}>مراسلة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bookBtn, !isAvailable && styles.bookBtnDisabled]}
          onPress={isAvailable ? handleBook : () => Alert.alert('غير متاح', 'الطبيب غير متاح للحجز حالياً.')}
          activeOpacity={0.85}
        >
          <Ionicons name="calendar-outline" size={18} color={Colors.white} />
          <Text style={styles.bookBtnText}>احجز موعداً</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: { flex: 1, backgroundColor: Colors.background },

  // ── Centered states ────────────────────────────────────────────────────────
  centeredState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        Spacing.lg,
    gap:            Spacing.sm,
  },
  loadingText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  errorText:   { fontSize: FontSizes.md, color: Colors.error, textAlign: 'center' },
  retryBtn: {
    backgroundColor:   Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
    borderRadius:      BorderRadius.full,
  },
  retryBtnText: { color: Colors.white, fontWeight: '600', fontSize: FontSizes.sm },

  // ── Scroll ─────────────────────────────────────────────────────────────────
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: Spacing.sm },

  // ── Hero card ──────────────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: Colors.white,
    alignItems:      'center',
    paddingTop:      Spacing.xl,
    paddingBottom:   Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom:    Spacing.sm,
    elevation:       2,
    shadowColor:     Colors.black,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.07,
    shadowRadius:    4,
  },
  avatarRing: {
    width:        100,
    height:       100,
    borderRadius: BorderRadius.full,
    borderWidth:  3,
    borderColor:  Colors.primary,
    marginBottom: Spacing.md,
    overflow:     'hidden',
  },
  avatarImage:   { width: '100%', height: '100%' },
  avatarFallback: {
    flex:           1,
    backgroundColor: Colors.primary,
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 40, fontWeight: '700', color: Colors.white },

  // Availability badge
  availabilityBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
    marginBottom:      Spacing.sm,
    gap:               5,
  },
  availabilityOn:  { backgroundColor: Colors.primary + '15' },
  availabilityOff: { backgroundColor: Colors.gray + '18' },
  availabilityDot: { width: 7, height: 7, borderRadius: 4 },
  availabilityText: { fontSize: FontSizes.xs, fontWeight: '600' },

  heroName:      { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.text },
  heroSpecialty: {
    fontSize:    FontSizes.sm,
    color:       Colors.textSecondary,
    marginTop:   3,
    marginBottom: Spacing.sm,
  },

  heroRating: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginBottom:  Spacing.sm,
  },
  starRow:      { flexDirection: 'row', gap: 2 },
  ratingValue:  { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.text },
  ratingCount:  { fontSize: FontSizes.xs, color: Colors.textSecondary },

  heroHospital: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     4,
  },
  heroHospitalText: { fontSize: FontSizes.xs, color: Colors.textSecondary },

  heroLoadingIndicator: { marginTop: Spacing.sm },

  // ── Stats row ──────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection:   'row',
    backgroundColor: Colors.white,
    marginBottom:    Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    justifyContent:  'space-around',
    elevation:       1,
    shadowColor:     Colors.black,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    2,
  },
  statChip: {
    alignItems:  'center',
    gap:         4,
    flex:        1,
  },
  statIconBox: {
    width:          40,
    height:         40,
    borderRadius:   BorderRadius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  // ── Section card ───────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor:   Colors.white,
    marginHorizontal:  Spacing.md,
    marginBottom:      Spacing.sm,
    borderRadius:      BorderRadius.xl,
    padding:           Spacing.md,
    elevation:         1,
    shadowColor:       Colors.black,
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.05,
    shadowRadius:      2,
  },
  sectionTitle: {
    fontSize:     FontSizes.sm,
    fontWeight:   '700',
    color:        Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign:    'right',
  },

  // ── Bio ────────────────────────────────────────────────────────────────────
  bioText: {
    fontSize:  FontSizes.sm,
    color:     Colors.text,
    lineHeight: 22,
    textAlign: 'right',
  },
  bioToggle: {
    fontSize:   FontSizes.xs,
    color:      Colors.primary,
    fontWeight: '600',
    marginTop:  Spacing.xs,
    textAlign:  'right',
  },

  // ── Working hours ──────────────────────────────────────────────────────────
  hourRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  hourDay:  {
    flex:       1,
    fontSize:   FontSizes.sm,
    color:      Colors.text,
    fontWeight: '500',
    textAlign:  'right',
  },
  hourOff:  { fontSize: FontSizes.sm, color: Colors.gray, fontStyle: 'italic' },
  hourSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
  hourSlotPill: {
    backgroundColor:   Colors.primary + '15',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  hourSlotText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },

  // ── Education ──────────────────────────────────────────────────────────────
  eduRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           Spacing.sm,
    paddingVertical: 4,
  },
  eduText: {
    flex:       1,
    fontSize:   FontSizes.sm,
    color:      Colors.text,
    textAlign:  'right',
    lineHeight: 20,
  },

  // ── Languages ──────────────────────────────────────────────────────────────
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'flex-end' },
  langPill: {
    backgroundColor:   Colors.primary + '15',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  langText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: '500' },

  // ── Sticky footer ──────────────────────────────────────────────────────────
  footer: {
    flexDirection:     'row',
    backgroundColor:   Colors.white,
    paddingHorizontal: Spacing.md,
    paddingTop:        Spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
    gap:               Spacing.sm,
    elevation:         8,
    shadowColor:       Colors.black,
    shadowOffset:      { width: 0, height: -2 },
    shadowOpacity:     0.07,
    shadowRadius:      4,
  },

  // "Chat" outline button
  chatBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1.5,
    borderColor:    Colors.primary,
    borderRadius:   BorderRadius.xl,
    paddingVertical: Spacing.sm,
    gap:            6,
  },
  chatBtnText: {
    fontSize:   FontSizes.md,
    color:      Colors.primary,
    fontWeight: '700',
  },

  // "Book" filled button
  bookBtn: {
    flex:           2,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius:   BorderRadius.xl,
    paddingVertical: Spacing.sm,
    gap:            6,
  },
  bookBtnDisabled: { backgroundColor: Colors.gray },
  bookBtnText: {
    fontSize:   FontSizes.md,
    color:      Colors.white,
    fontWeight: '700',
  },
});

export default DoctorProfileScreen;
