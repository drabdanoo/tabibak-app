/**
 * DoctorDetailsScreen — Phase 2: Patient Core
 *
 * ── Architecture Notes ─────────────────────────────────────────────────────
 *
 * Two-Phase Data Hydration:
 *   Phase 1 (instant): route.params.doctor carries the partial object already
 *   fetched by PatientHomeScreen's doctor list (name, specialty, photoURL,
 *   rating, city, experience, consultationFee, isAvailable). This seeds useState
 *   so the hero section renders with zero latency — no loading spinner is
 *   shown on the primary visible UI.
 *
 *   Phase 2 (background): A single getDoctorById(doctorId) call fetches the
 *   deep profile fields (bio, workingHours, hospital, education, languages).
 *   When it resolves, state is updated via spread-merge:
 *     { ...partialDoctor, ...fullDoctor }
 *   so any fresher server-side fields (e.g., updated photo) also overwrite.
 *   Deep content sections show a compact ActivityIndicator until resolved.
 *
 * Sticky Footer Architecture:
 *   Root:    <View flex:1>          — fills the screen edge-to-edge
 *   Child 1: <ScrollView flex:1>   — owns all scrollable profile content
 *   Child 2: <View style={S.footer}> — sibling to ScrollView (NOT a child),
 *            creating a natural dock at the screen bottom without absolute
 *            positioning. paddingBottom={Math.max(insets.bottom, Spacing.md)}
 *            ensures it clears the iOS home indicator and Android nav bar.
 *   A <View style={{ height: footerClearance }}> at the tail of the ScrollView
 *   guarantees the last content section is never hidden beneath the footer.
 *
 * RTL Compliance:
 *   ⚠️ This app is in Arabic. Zero marginLeft/Right, paddingLeft/Right,
 *   left/right positional values used. All directional spacing uses logical
 *   properties exclusively: marginStart, marginEnd, paddingStart, paddingEnd,
 *   start, end, borderStartWidth, borderEndWidth.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

// Approximate height of the footer button area (excluding safe-area padding).
// Used to calculate the scroll-content bottom spacer.
const FOOTER_CONTENT_HEIGHT = 72;

const DAY_ORDER = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday', 'Sunday',
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure presentational sub-components (module-scope → stable identity)
// ─────────────────────────────────────────────────────────────────────────────

const StarRating = React.memo(({ rating = 0, reviewCount = 0 }) => {
  const rounded = Math.round(rating);
  return (
    <View style={S.ratingRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rounded ? 'star' : 'star-outline'}
          size={15}
          color={i <= rounded ? Colors.warning : 'rgba(255,255,255,0.45)'}
        />
      ))}
      <Text style={S.ratingValue}>{rating.toFixed(1)}</Text>
      {reviewCount > 0 && (
        <Text style={S.reviewCount}>({reviewCount} reviews)</Text>
      )}
    </View>
  );
});

const StatChip = React.memo(({ icon, label, onPress }) => {
  const inner = (
    <>
      <Ionicons name={icon} size={12} color={Colors.white} />
      <Text style={S.statChipText}>{label}</Text>
      {!!onPress && <Ionicons name="open-outline" size={10} color="rgba(255,255,255,0.7)" />}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={S.statChip} onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={S.statChip}>{inner}</View>;
});

/** Single labelled row inside an Overview card. Returns null if value is falsy. */
const InfoRow = React.memo(({ icon, label, value, isLast = false }) => {
  if (!value) return null;
  return (
    <View style={[S.infoRow, isLast && S.infoRowLast]}>
      <View style={S.infoIconWrap}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={S.infoText}>
        <Text style={S.infoLabel}>{label}</Text>
        <Text style={S.infoValue}>{value}</Text>
      </View>
    </View>
  );
});

/** White card with a section title and arbitrary children. */
const SectionCard = React.memo(({ title, children }) => (
  <View style={S.sectionCard}>
    <Text style={S.sectionTitle}>{title}</Text>
    {children}
  </View>
));

const WorkingHoursSection = React.memo(({ workingHours }) => {
  if (!workingHours || Object.keys(workingHours).length === 0) return null;

  // Render canonical week order first, then any extra keys.
  const ordered = [
    ...DAY_ORDER.filter(d => d in workingHours),
    ...Object.keys(workingHours).filter(d => !DAY_ORDER.includes(d)),
  ];

  return (
    <SectionCard title="Working Hours">
      {ordered.map((day, idx) => {
        const hours = workingHours[day];
        const isOpen = hours && typeof hours === 'object' && hours.open === true;
        const hasValidTimes =
          isOpen &&
          typeof hours.start === 'string' &&
          typeof hours.end === 'string';
        const isLast = idx === ordered.length - 1;

        return (
          <View key={day} style={[S.hourRow, isLast && S.hourRowLast]}>
            <Text style={[S.dayText, isOpen && S.dayTextOpen]}>{day}</Text>
            <View style={[S.hoursBadge, isOpen ? S.hoursBadgeOpen : S.hoursBadgeClosed]}>
              <Text style={[S.hoursText, isOpen ? S.hoursTextOpen : S.hoursTextClosed]}>
                {hasValidTimes ? `${hours.start} – ${hours.end}` : 'Closed'}
              </Text>
            </View>
          </View>
        );
      })}
    </SectionCard>
  );
});

const LanguagesSection = React.memo(({ languages }) => {
  if (!languages || languages.length === 0) return null;
  return (
    <SectionCard title="Languages">
      <View style={S.chipWrap}>
        {languages.map((lang, i) => (
          <View key={i} style={S.chip}>
            <Text style={S.chipText}>{lang}</Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DoctorDetailsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();

  // ── Phase 1: Instant render — seed from route.params ─────────────
  const { doctor: paramDoctor, doctorId: paramDoctorId } = route.params ?? {};
  const resolvedId = paramDoctorId ?? paramDoctor?.id;

  const [doctor, setDoctor] = useState(paramDoctor ?? null);

  // ── Phase 2: Background deep fetch ───────────────────────────────
  const [deepLoading, setDeepLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!resolvedId) {
      setDeepLoading(false);
      return;
    }

    firestoreService.getDoctorById(resolvedId).then(result => {
      if (result.success) {
        // Merge: partial card data (fast) + full Firestore document.
        // Firestore wins on any conflicting field so stale card data is corrected.
        setDoctor(prev => ({ ...(prev ?? {}), ...result.doctor }));
      } else {
        setFetchError(result.error);
      }
      setDeepLoading(false);
    });
  }, [resolvedId]);

  const handleBook = useCallback(() => {
    if (!doctor) return;
    navigation.navigate('BookAppointment', { doctor });
  }, [navigation, doctor]);

  // ── Open doctor location on the in-app map ────────────────────────
  const handleOpenMaps = useCallback(() => {
    if (!doctor) return;
    navigation.navigate('DoctorMap', { focusDoctor: doctor });
  }, [navigation, doctor]);

  // ── Avatar initials fallback ──────────────────────────────────────
  const initials = (doctor?.name ?? 'D')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 2);

  // ── Footer clearance: content height + safe area bottom ──────────
  const footerClearance = FOOTER_CONTENT_HEIGHT + Math.max(insets.bottom, Spacing.md) + Spacing.lg;

  const available = doctor?.isAvailable !== false;

  // ── Hard error: no doctor data at all ────────────────────────────
  if (!doctor && !deepLoading) {
    return (
      <View style={S.root}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <View style={S.centered}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
          <Text style={S.errorTitle}>Doctor not found</Text>
          <TouchableOpacity style={S.retryBtn} onPress={() => navigation.goBack()}>
            <Text style={S.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={S.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.primary}
        translucent={Platform.OS === 'android'}
      />

      {/* ── SCROLLABLE CONTENT ────────────────────────────────────── */}
      <ScrollView
        style={S.scroll}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ── HERO ─────────────────────────────────────────────────── */}
        <View style={S.hero}>
          {/* Status bar spacer — replaces SafeAreaView top edge */}
          <View style={{ height: insets.top, backgroundColor: Colors.primary }} />

          {/* Top bar: back button (flow-based, RTL-safe) */}
          <View style={S.heroTopBar}>
            <TouchableOpacity
              style={S.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              activeOpacity={0.75}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.white} />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={S.avatarWrap}>
            {doctor?.photoURL ? (
              <Image source={{ uri: doctor.photoURL }} style={S.avatar} />
            ) : (
              <View style={[S.avatar, S.avatarFallback]}>
                <Text style={S.avatarInitials}>{initials}</Text>
              </View>
            )}
            {/* Availability indicator dot */}
            <View
              style={[
                S.availabilityDot,
                { backgroundColor: available ? Colors.success : Colors.error },
              ]}
            />
          </View>

          {/* Name */}
          <Text style={S.heroName}>{doctor?.name ?? '—'}</Text>

          {/* Specialty */}
          <Text style={S.heroSpecialty}>
            {doctor?.specialty ?? 'General Practice'}
          </Text>

          {/* Rating */}
          <StarRating
            rating={doctor?.rating ?? 0}
            reviewCount={doctor?.reviewCount ?? 0}
          />

          {/* Stats chips */}
          <View style={S.statsRow}>
            {!!doctor?.experience && (
              <StatChip icon="briefcase-outline" label={`${doctor.experience} yr exp`} />
            )}
            {!!doctor?.city && (
              <StatChip
                icon="location-outline"
                label={doctor.city}
                onPress={(doctor?.latitude && doctor?.longitude) || doctor?.address
                  ? handleOpenMaps
                  : undefined}
              />
            )}
            {!!doctor?.consultationFee && (
              <StatChip icon="cash-outline" label={`$${doctor.consultationFee}`} />
            )}
            <StatChip
              icon={available ? 'checkmark-circle-outline' : 'time-outline'}
              label={available ? 'Available' : 'Busy'}
            />
          </View>
        </View>

        {/* ── DEEP CONTENT ─────────────────────────────────────────── */}
        {deepLoading ? (
          <View style={S.deepLoadingWrap}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={S.deepLoadingText}>Loading full profile…</Text>
          </View>
        ) : fetchError ? (
          <View style={S.deepLoadingWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={Colors.gray} />
            <Text style={S.deepLoadingText}>
              Showing limited info — full profile could not be loaded
            </Text>
          </View>
        ) : (
          <>
            {/* ── Overview card ── */}
            {(doctor?.hospital || doctor?.education || doctor?.experience || doctor?.consultationFee) && (
              <SectionCard title="Overview">
                <InfoRow
                  icon="business-outline"
                  label="Hospital / Clinic"
                  value={doctor?.hospital}
                />
                <InfoRow
                  icon="school-outline"
                  label="Education"
                  value={doctor?.education}
                />
                <InfoRow
                  icon="briefcase-outline"
                  label="Experience"
                  value={doctor?.experience ? `${doctor.experience} years` : null}
                />
                <InfoRow
                  icon="cash-outline"
                  label="Consultation Fee"
                  value={doctor?.consultationFee ? `$${doctor.consultationFee}` : null}
                  isLast
                />
              </SectionCard>
            )}

            {/* ── About ── */}
            {!!doctor?.bio && (
              <SectionCard title="About">
                <Text style={S.bioText}>{doctor.bio}</Text>
              </SectionCard>
            )}

            {/* ── Working Hours ── */}
            <WorkingHoursSection workingHours={doctor?.workingHours} />

            {/* ── Languages ── */}
            <LanguagesSection languages={doctor?.languages} />
          </>
        )}

        {/* Footer clearance — last content never hides under the sticky footer */}
        <View style={{ height: footerClearance }} />
      </ScrollView>

      {/* ── STICKY FOOTER — sibling to ScrollView, docked at screen bottom ── */}
      <View style={[S.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={S.footerInner}>
          {/* Fee display */}
          {!!doctor?.consultationFee && (
            <View style={S.footerFee}>
              <Text style={S.footerFeeLabel}>Fee</Text>
              <Text style={S.footerFeeValue}>${doctor.consultationFee}</Text>
            </View>
          )}

          {/* Book CTA */}
          <TouchableOpacity
            style={[S.bookBtn, !doctor?.consultationFee && S.bookBtnFull]}
            onPress={handleBook}
            activeOpacity={0.85}
            disabled={!doctor}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.white} />
            <Text style={S.bookBtnText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// RTL RULE: No marginLeft/Right, paddingLeft/Right, left/right positional
// values anywhere. Logical properties only.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.error,
    marginTop: Spacing.md,
  },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  retryBtnText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: FontSizes.sm,
  },

  // ── Hero ──────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingBottom: Spacing.xl + Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  heroTopBar: {
    // Flow-based row — back button sits at start, RTL-safe automatically
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrap: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: Colors.primaryDark,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.white,
  },
  // Availability dot — uses `end` not `right`
  availabilityDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: Colors.primary,
    bottom: 4,
    end: 2,
  },
  heroName: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  heroSpecialty: {
    fontSize: FontSizes.md,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: Spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: Spacing.md,
  },
  ratingValue: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.white,
    marginStart: 4,
  },
  reviewCount: {
    fontSize: FontSizes.xs,
    color: 'rgba(255,255,255,0.65)',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    gap: 4,
  },
  statChipText: {
    fontSize: FontSizes.xs,
    color: Colors.white,
    fontWeight: '600',
  },

  // ── Deep loading ─────────────────────────────────────────────────
  deepLoadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  deepLoadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // ── Section card ─────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },

  // ── Info rows (inside Overview card) ─────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    marginBottom: 0,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: Spacing.md,
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },

  // ── About ─────────────────────────────────────────────────────────
  bioText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Working Hours ─────────────────────────────────────────────────
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  hourRowLast: {
    borderBottomWidth: 0,
  },
  dayText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  dayTextOpen: {
    color: Colors.text,
  },
  hoursBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  hoursBadgeOpen: {
    backgroundColor: Colors.success + '1A',
  },
  hoursBadgeClosed: {
    backgroundColor: Colors.border,
  },
  hoursText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  hoursTextOpen: {
    color: Colors.success,
  },
  hoursTextClosed: {
    color: Colors.textSecondary,
  },

  // ── Languages ─────────────────────────────────────────────────────
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: '500',
  },

  // ── Sticky Footer ─────────────────────────────────────────────────
  footer: {
    backgroundColor: Colors.white,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  footerFee: {
    flexShrink: 0,
  },
  footerFeeLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  footerFeeValue: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  bookBtnFull: {
    // No fee shown → button is the only footer child, flex:1 already spans full width
  },
  bookBtnText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.white,
  },
});