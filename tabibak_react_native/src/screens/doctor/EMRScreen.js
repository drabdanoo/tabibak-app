/**
 * EMRScreen.js — Electronic Medical Record Viewer (Doctor Stack)
 *
 * Navigation entry:  navigation.navigate('EMR', { patientId, patientName })
 *
 * Architecture contracts enforced:
 *   ✓ Service layer  — all Firestore calls via emrService.getPatientEMR()
 *   ✓ Design system  — ScreenContainer, PrimaryButton, colors/spacing/typography
 *   ✓ i18n           — every string through t('doctor.emr.*')
 *   ✓ RTL            — marginStart/End, paddingStart/End, borderStartWidth
 *   ✓ 3-State UI     — loading → error+retry → success
 *   ✓ Zero Alert.alert — doc-open failures are inline
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons }           from '@expo/vector-icons';
import { useTranslation }     from 'react-i18next';
import { useSafeAreaInsets }  from 'react-native-safe-area-context';

import { ScreenContainer, PrimaryButton } from '../../components/ui';
import { colors, spacing, typography, BorderRadius, shadows } from '../../config/theme';
import emrService from '../../services/emrService';

// ─────────────────────────────────────────────────────────────────────────────
// Static lookup tables  (colours only — labels come from i18n)
// ─────────────────────────────────────────────────────────────────────────────

const BLOOD_TYPE_COLOR = {
  'A+':  '#ef4444', 'A-':  '#fca5a5',
  'B+':  '#3b82f6', 'B-':  '#93c5fd',
  'AB+': '#8b5cf6', 'AB-': '#c4b5fd',
  'O+':  '#f59e0b', 'O-':  '#fcd34d',
};

/** Colour palette per document category — label key resolved at render */
const CATEGORY_STYLE = {
  lab:          { labelKey: 'doctor.emr.catLab',          color: '#3b82f6', bg: '#dbeafe' },
  imaging:      { labelKey: 'doctor.emr.catImaging',      color: '#8b5cf6', bg: '#ede9fe' },
  prescription: { labelKey: 'doctor.emr.catPrescription', color: colors.primary, bg: '#d1fae5' },
  report:       { labelKey: 'doctor.emr.catReport',       color: '#f59e0b', bg: '#fef3c7' },
  general:      { labelKey: 'doctor.emr.catGeneral',      color: colors.gray,   bg: '#f3f4f6' },
};

const FILE_ICON = {
  pdf:  'document-text-outline',
  jpg:  'image-outline',
  jpeg: 'image-outline',
  png:  'image-outline',
  heic: 'image-outline',
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function calcAge(dob) {
  if (!dob) return null;
  const birth = dob.toDate ? dob.toDate() : new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const mDiff = now.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function fileExt(fileType = '') {
  return (fileType.split('/')[1] ?? fileType).toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Wrappable pill row for medical tags (allergies, meds, conditions) */
const TagRow = memo(({ tags, color, bg }) => {
  if (!tags?.length) return null;
  return (
    <View style={styles.tagRow}>
      {tags.map((tag, i) => (
        <View key={i} style={[styles.tag, { backgroundColor: bg }]}>
          <Text style={[styles.tagText, { color }]}>{tag}</Text>
        </View>
      ))}
    </View>
  );
});

/** Section block with left-start accent stripe */
const SectionBlock = memo(({ title, accentColor, children }) => (
  <View style={[styles.sectionBlock, { borderStartColor: accentColor ?? colors.primary }]}>
    <Text style={[styles.sectionBlockTitle, { color: accentColor ?? colors.primary }]}>
      {title}
    </Text>
    {children}
  </View>
));

/** Icon + label + value info row */
const InfoRow = memo(({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={15} color={colors.textSecondary} style={styles.infoIcon} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value ?? '—'}</Text>
  </View>
));

// ─────────────────────────────────────────────────────────────────────────────
// EncounterCard — collapsible notes with "show more"
// ─────────────────────────────────────────────────────────────────────────────

const EncounterCard = memo(({ item }) => {
  const { t }         = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const notes        = item.clinicalNotes ?? '';
  const diagnosis    = item.diagnosis     ?? '';
  const prescriptions = item.prescriptions ?? [];
  const isLong       = notes.length > 120;
  const displayNotes = isLong && !expanded ? notes.slice(0, 120) + '…' : notes;

  return (
    <View style={styles.encounterCard}>
      {/* Date + time header */}
      <View style={styles.encounterHeader}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={13} color={colors.primary} />
          <Text style={styles.dateBadgeText}>{formatDate(item.appointmentDate)}</Text>
        </View>
        {!!item.appointmentTime && (
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{item.appointmentTime}</Text>
          </View>
        )}
      </View>

      {/* Reason */}
      {!!item.reason && (
        <View style={styles.encounterRow}>
          <Text style={styles.encounterRowLabel}>{t('doctor.emr.reason')}: </Text>
          <Text style={styles.encounterRowValue}>{item.reason}</Text>
        </View>
      )}

      {/* Clinical notes */}
      {!!notes && (
        <View style={styles.encounterSection}>
          <Text style={styles.encounterSectionTitle}>{t('doctor.emr.clinicalNotes')}</Text>
          <Text style={styles.encounterNotes}>{displayNotes}</Text>
          {isLong && (
            <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
              <Text style={styles.showMore}>
                {expanded ? t('doctor.emr.showLess') : t('doctor.emr.showMore')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Diagnosis */}
      {!!diagnosis && (
        <View style={styles.encounterSection}>
          <Text style={styles.encounterSectionTitle}>{t('doctor.emr.diagnosis')}</Text>
          <Text style={styles.encounterNotes}>{diagnosis}</Text>
        </View>
      )}

      {/* Prescriptions */}
      {prescriptions.length > 0 && (
        <View style={styles.encounterSection}>
          <Text style={styles.encounterSectionTitle}>{t('doctor.emr.prescriptions')}</Text>
          {prescriptions.map((rx, i) => (
            <View key={i} style={styles.rxRow}>
              <Ionicons name="medkit-outline" size={13} color={colors.primary} />
              <Text style={styles.rxText}>
                {rx.drug}
                {rx.dosage    ? ` — ${rx.dosage}`       : ''}
                {rx.frequency ? ` (${rx.frequency})`    : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DocCard — tappable document row
// ─────────────────────────────────────────────────────────────────────────────

const DocCard = memo(({ item, onOpen, docOpenError }) => {
  const { t }   = useTranslation();
  const ext     = fileExt(item.fileType ?? '');
  const icon    = FILE_ICON[ext] ?? 'document-outline';
  const cat     = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.general;

  return (
    <TouchableOpacity
      style={styles.docCard}
      onPress={() => onOpen(item)}
      activeOpacity={0.75}
    >
      <View style={[styles.docIconBox, { backgroundColor: cat.bg }]}>
        <Ionicons name={icon} size={22} color={cat.color} />
      </View>

      <View style={styles.docContent}>
        <Text style={styles.docTitle} numberOfLines={1}>
          {item.title ?? t('doctor.emr.docDefaultTitle')}
        </Text>
        {!!item.description && (
          <Text style={styles.docDesc} numberOfLines={1}>{item.description}</Text>
        )}
        <View style={styles.docMeta}>
          <View style={[styles.catPill, { backgroundColor: cat.bg }]}>
            <Text style={[styles.catPillText, { color: cat.color }]}>{t(cat.labelKey)}</Text>
          </View>
          <Text style={styles.docDate}>{formatDate(item.uploadedAt)}</Text>
        </View>
      </View>

      <Ionicons name="open-outline" size={16} color={colors.gray} />
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Overview tab
// ─────────────────────────────────────────────────────────────────────────────

const OverviewTab = memo(({ patient }) => {
  const { t } = useTranslation();
  if (!patient) return null;

  const age        = calcAge(patient.dateOfBirth);
  const allergies  = patient.medicalHistory?.allergies          ?? patient.allergies         ?? [];
  const meds       = patient.medicalHistory?.currentMedications ?? patient.currentMedications ?? [];
  const conditions = patient.medicalHistory?.chronicConditions  ?? patient.chronicConditions  ?? [];
  const bColor     = BLOOD_TYPE_COLOR[patient.bloodType] ?? colors.primary;

  const genderLabel =
    patient.gender === 'male'   ? t('doctor.emr.genderMale')   :
    patient.gender === 'female' ? t('doctor.emr.genderFemale') :
    patient.gender ?? '—';

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Demographics */}
      <SectionBlock title={t('doctor.emr.demographics')}>
        <InfoRow icon="person-outline"    label={t('doctor.emr.name')}  value={patient.name ?? patient.displayName} />
        <InfoRow icon="call-outline"      label={t('doctor.emr.phone')} value={patient.phoneNumber ?? patient.phone} />
        {!!patient.email && (
          <InfoRow icon="mail-outline"    label={t('doctor.emr.email')} value={patient.email} />
        )}
        {age !== null && (
          <InfoRow icon="calendar-outline" label={t('doctor.emr.age')}  value={t('doctor.emr.ageYears', { n: age })} />
        )}
        <InfoRow icon="transgender-outline" label={t('doctor.emr.gender')} value={genderLabel} />
        {!!patient.bloodType && (
          <View style={styles.infoRow}>
            <Ionicons name="water-outline" size={15} color={colors.textSecondary} style={styles.infoIcon} />
            <Text style={styles.infoLabel}>{t('doctor.emr.bloodType')}</Text>
            <View style={[styles.bloodBadge, { backgroundColor: bColor + '22' }]}>
              <Text style={[styles.bloodBadgeText, { color: bColor }]}>{patient.bloodType}</Text>
            </View>
          </View>
        )}
        {!!patient.city && (
          <InfoRow icon="location-outline" label={t('doctor.emr.city')} value={patient.city} />
        )}
      </SectionBlock>

      {/* Allergies */}
      <SectionBlock title={t('doctor.emr.allergies')} accentColor="#ef4444">
        {allergies.length
          ? <TagRow tags={allergies} color="#ef4444" bg="#fee2e2" />
          : <Text style={styles.emptyHint}>{t('doctor.emr.noAllergies')}</Text>
        }
      </SectionBlock>

      {/* Medications */}
      <SectionBlock title={t('doctor.emr.medications')} accentColor="#3b82f6">
        {meds.length
          ? <TagRow tags={meds} color="#3b82f6" bg="#dbeafe" />
          : <Text style={styles.emptyHint}>{t('doctor.emr.noMedications')}</Text>
        }
      </SectionBlock>

      {/* Chronic conditions */}
      <SectionBlock title={t('doctor.emr.conditions')} accentColor="#8b5cf6">
        {conditions.length
          ? <TagRow tags={conditions} color="#8b5cf6" bg="#ede9fe" />
          : <Text style={styles.emptyHint}>{t('doctor.emr.noConditions')}</Text>
        }
      </SectionBlock>
    </ScrollView>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Encounters tab
// ─────────────────────────────────────────────────────────────────────────────

const EncountersTab = memo(({ encounters }) => {
  const { t } = useTranslation();

  if (!encounters.length) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={52} color={colors.border} />
        <Text style={styles.emptyStateTitle}>{t('doctor.emr.noEncounters')}</Text>
        <Text style={styles.emptyStateHint}>{t('doctor.emr.noEncountersSub')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={encounters}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <EncounterCard item={item} />}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Documents tab
// ─────────────────────────────────────────────────────────────────────────────

const DocumentsTab = memo(({ documents, onOpen, docOpenError }) => {
  const { t } = useTranslation();

  if (!documents.length) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="folder-open-outline" size={52} color={colors.border} />
        <Text style={styles.emptyStateTitle}>{t('doctor.emr.noDocuments')}</Text>
        <Text style={styles.emptyStateHint}>{t('doctor.emr.noDocumentsSub')}</Text>
      </View>
    );
  }

  return (
    <>
      {!!docOpenError && (
        <View style={styles.docErrorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={styles.docErrorText}>{docOpenError}</Text>
        </View>
      )}
      <FlatList
        data={documents}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <DocCard item={item} onOpen={onOpen} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EMRScreen — root
// ─────────────────────────────────────────────────────────────────────────────

const EMRScreen = ({ route, navigation }) => {
  const { patientId, patientName } = route.params ?? {};
  const { t }    = useTranslation();
  const insets   = useSafeAreaInsets();

  const [patient,      setPatient]      = useState(null);
  const [encounters,   setEncounters]   = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState(null);
  const [activeTab,    setActiveTab]    = useState(0);
  const [docOpenError, setDocOpenError] = useState('');
  const [retryKey,     setRetryKey]     = useState(0);

  // ── Load all three data sources in parallel ──────────────────────────────
  useEffect(() => {
    if (!patientId) {
      setError(t('doctor.emr.loadError'));
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    emrService.getPatientEMR(patientId)
      .then(({ patient, encounters, documents }) => {
        if (!active) return;
        setPatient(patient);
        setEncounters(encounters);
        setDocuments(documents);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(t('doctor.emr.loadError'));
        setIsLoading(false);
      });

    return () => { active = false; };
  }, [patientId, retryKey]);

  // ── Open document via system handler ─────────────────────────────────────
  const handleOpenDoc = useCallback(async (doc) => {
    setDocOpenError('');
    if (!doc.fileUrl) {
      setDocOpenError(t('doctor.emr.cannotOpen'));
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(doc.fileUrl);
      if (canOpen) {
        await Linking.openURL(doc.fileUrl);
      } else {
        setDocOpenError(t('doctor.emr.cannotOpen'));
      }
    } catch {
      setDocOpenError(t('doctor.emr.openError'));
    }
  }, [t]);

  // ── Tab configuration ─────────────────────────────────────────────────────
  const TABS = useMemo(() => [
    { key: 'overview',   label: t('doctor.emr.tabOverview'),   badge: null },
    { key: 'encounters', label: t('doctor.emr.tabEncounters'), badge: encounters.length || null },
    { key: 'documents',  label: t('doctor.emr.tabDocuments'),  badge: documents.length  || null },
  ], [t, encounters.length, documents.length]);

  const displayName = patient?.name ?? patientName ?? '';
  const age         = patient ? calcAge(patient.dateOfBirth) : null;
  const bColor      = BLOOD_TYPE_COLOR[patient?.bloodType] ?? colors.primary;

  // ─── 3-State: Loading ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenContainer scrollable={false} padded={false} edges={['top', 'bottom']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  // ─── 3-State: Error ───────────────────────────────────────────────────────
  if (error) {
    return (
      <ScreenContainer scrollable={false} padded={false} edges={['top', 'bottom']}>
        {/* Back */}
        <TouchableOpacity
          style={[styles.backBtn, { marginTop: insets.top + spacing.sm }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" size={52} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <PrimaryButton
            label={t('common.retry')}
            onPress={() => setRetryKey(k => k + 1)}
            style={styles.retryButton}
          />
        </View>
      </ScreenContainer>
    );
  }

  // ─── 3-State: Success ─────────────────────────────────────────────────────
  return (
    <ScreenContainer scrollable={false} padded={false} edges={['bottom']}>

      {/* ── Tinted header (bleeds under status bar) ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>

        {/* Patient identity strip */}
        <View style={styles.patientStrip}>
          {/* Avatar initial */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName.trim()[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>

          {/* Name + meta */}
          <View style={styles.patientInfo}>
            <Text style={styles.patientName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.patientMeta}>
              {age !== null && (
                <Text style={styles.patientMetaText}>
                  {t('doctor.emr.ageYears', { n: age })}
                </Text>
              )}
              {!!patient?.bloodType && (
                <>
                  <Text style={styles.patientMetaSep}>·</Text>
                  <View style={[styles.bloodBadge, { backgroundColor: bColor }]}>
                    <Text style={[styles.bloodBadgeText, { color: colors.white }]}>
                      {patient.bloodType}
                    </Text>
                  </View>
                </>
              )}
              {!!patient?.gender && (
                <>
                  <Text style={styles.patientMetaSep}>·</Text>
                  <Text style={styles.patientMetaText}>
                    {patient.gender === 'male'
                      ? t('doctor.emr.genderMale')
                      : t('doctor.emr.genderFemale')}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {TABS.map(({ key, label, badge }, idx) => {
          const active = idx === activeTab;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => { setActiveTab(idx); setDocOpenError(''); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {label}
              </Text>
              {!!badge && (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                    {badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Tab content ── */}
      <View style={styles.tabContent}>
        {activeTab === 0 && <OverviewTab   patient={patient} />}
        {activeTab === 1 && <EncountersTab encounters={encounters} />}
        {activeTab === 2 && (
          <DocumentsTab
            documents={documents}
            onOpen={handleOpenDoc}
            docOpenError={docOpenError}
          />
        )}
      </View>

    </ScreenContainer>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Centered states ────────────────────────────────────────────────────────
  centeredState: {
    flex: 1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    fontSize:  typography.sizes.md,
    color:     colors.error,
    textAlign: 'center',
  },
  retryButton: { marginTop: spacing.sm },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor:  colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom:    spacing.md,
  },
  backBtn: {
    alignSelf:    'flex-start',
    marginBottom: spacing.sm,
  },
  patientStrip: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  avatar: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: colors.white + '30',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    fontSize:   typography.sizes.xl,
    fontWeight: '700',
    color:      colors.white,
  },
  patientInfo: { flex: 1 },
  patientName: {
    fontSize:   typography.sizes.md,
    fontWeight: '700',
    color:      colors.white,
  },
  patientMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     2,
  },
  patientMetaText: {
    fontSize: typography.sizes.xs,
    color:    colors.white + 'cc',
  },
  patientMetaSep: {
    fontSize: typography.sizes.xs,
    color:    colors.white + '80',
  },
  bloodBadge: {
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:   1,
  },
  bloodBadgeText: {
    fontSize:   typography.sizes.xs,
    fontWeight: '700',
  },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection:     'row',
    backgroundColor:   colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  tabItem: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    paddingVertical:  spacing.sm,
    gap:              4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive:      { borderBottomColor: colors.primary },
  tabLabel:           { fontSize: typography.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  tabLabelActive:     { color: colors.primary, fontWeight: '700' },
  tabBadge: {
    backgroundColor:   colors.borderLight,
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical:   1,
    minWidth:          20,
    alignItems:        'center',
  },
  tabBadgeActive:     { backgroundColor: colors.primary + '22' },
  tabBadgeText:       { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  tabBadgeTextActive: { color: colors.primary },

  // ── Tab content ───────────────────────────────────────────────────────────
  tabContent: { flex: 1 },
  tabScroll:  { flex: 1 },
  tabScrollContent: {
    padding:       spacing.md,
    paddingBottom: spacing.xxl,
  },
  listContent: {
    padding:       spacing.md,
    paddingBottom: spacing.xxl,
  },

  // ── Section block ──────────────────────────────────────────────────────────
  sectionBlock: {
    backgroundColor: colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    borderStartWidth: 3,
    ...shadows.sm,
  },
  sectionBlockTitle: {
    fontSize:     typography.sizes.sm,
    fontWeight:   '700',
    marginBottom: spacing.sm,
  },

  // ── Info rows ──────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 5,
    gap:             spacing.sm,
  },
  infoIcon:  { width: 20 },
  infoLabel: { flex: 1, fontSize: typography.sizes.sm, color: colors.textSecondary },
  infoValue: { fontSize: typography.sizes.sm, color: colors.text, fontWeight: '500' },

  // ── Medical tags ───────────────────────────────────────────────────────────
  tagRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     4,
  },
  tag: {
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
  },
  tagText:  { fontSize: typography.sizes.xs, fontWeight: '600' },
  emptyHint: {
    fontSize:   typography.sizes.xs,
    color:      colors.textSecondary,
    fontStyle:  'italic',
    marginTop:  4,
  },

  // ── Encounter card ─────────────────────────────────────────────────────────
  encounterCard: {
    backgroundColor: colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         spacing.md,
    ...shadows.sm,
  },
  encounterHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  dateBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   colors.primary + '15',
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
  },
  dateBadgeText: { fontSize: typography.sizes.xs, color: colors.primary, fontWeight: '600' },
  timeBadge: {
    backgroundColor:   colors.borderLight,
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  timeBadgeText: { fontSize: typography.sizes.xs, color: colors.textSecondary },
  encounterRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  spacing.xs,
  },
  encounterRowLabel: { fontSize: typography.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  encounterRowValue: { flex: 1, fontSize: typography.sizes.sm, color: colors.text },
  encounterSection:  { marginTop: spacing.sm },
  encounterSectionTitle: {
    fontSize:     typography.sizes.xs,
    fontWeight:   '700',
    color:        colors.textSecondary,
    marginBottom: 4,
  },
  encounterNotes: {
    fontSize:   typography.sizes.sm,
    color:      colors.text,
    lineHeight: 20,
  },
  showMore: {
    fontSize:   typography.sizes.xs,
    color:      colors.primary,
    fontWeight: '600',
    marginTop:  4,
  },
  rxRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginTop:     3,
  },
  rxText: { fontSize: typography.sizes.sm, color: colors.text, flex: 1 },

  // ── Document card ──────────────────────────────────────────────────────────
  docCard: {
    backgroundColor: colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    ...shadows.sm,
  },
  docIconBox: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  docContent: { flex: 1, gap: 3 },
  docTitle:   { fontSize: typography.sizes.sm, color: colors.text, fontWeight: '600' },
  docDesc:    { fontSize: typography.sizes.xs, color: colors.textSecondary },
  docMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  catPill: {
    borderRadius:      BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical:   1,
  },
  catPillText: { fontSize: 10, fontWeight: '600' },
  docDate:     { fontSize: 10, color: colors.textSecondary },

  // ── Doc open inline error ──────────────────────────────────────────────────
  docErrorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    backgroundColor:   colors.error + '12',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginHorizontal:  spacing.md,
    marginTop:         spacing.sm,
    borderRadius:      BorderRadius.md,
  },
  docErrorText: {
    flex:      1,
    fontSize:  typography.sizes.xs,
    color:     colors.error,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
    padding:        spacing.lg,
  },
  emptyStateTitle: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text },
  emptyStateHint:  { fontSize: typography.sizes.sm, color: colors.textSecondary, textAlign: 'center' },
});

export default EMRScreen;
