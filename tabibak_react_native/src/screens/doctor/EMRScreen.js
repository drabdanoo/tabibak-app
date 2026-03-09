/**
 * EMRScreen.js — Electronic Medical Record Viewer (Doctor Stack)
 *
 * ── Navigation Entry Points ──────────────────────────────────────────────────
 *
 *   From PatientDetailsScreen:
 *     navigation.navigate('EMR', { patientId, patientName })
 *
 *   From DoctorAppointmentsScreen (future):
 *     navigation.navigate('EMR', { patientId, patientName })
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 * THREE DATA SOURCES (all one-time getDocs — not onSnapshot, EMR is read-rarely
 * and does not need live updates in a clinical review context):
 *
 *   1. patients/{patientId}           → demographics + medical history
 *   2. appointments collection        → encounter history
 *        where('patientId', '==', uid)
 *        where('status',    '==', 'completed')
 *        orderBy('appointmentDate',   'desc')
 *        limit(50)
 *   3. documents collection           → uploaded medical files
 *        where('patientId', '==', uid)
 *        orderBy('uploadedAt', 'desc')
 *        limit(30)
 *
 *   All three queries fire in parallel via Promise.all. A single `isLoading`
 *   gate covers the whole batch — no per-section spinners.
 *
 * THREE TABS (segmented pill control — same visual as PatientDetailsScreen):
 *
 *   OVERVIEW  — Patient demographics, blood type, medical history tags
 *               (allergies / medications / chronic conditions)
 *
 *   ENCOUNTERS — FlatList of completed appointment cards (date, reason,
 *               clinical notes, diagnosis, prescriptions). Collapsible notes
 *               with "Show more" for long entries.
 *
 *   DOCUMENTS — FlatList of uploaded medical documents. Tap → Linking.openURL.
 *               Grouped by category with color-coded pills.
 *
 * RTL COMPLIANCE:
 *   marginStart / marginEnd          → never marginLeft / marginRight
 *   paddingStart / paddingEnd        → never paddingLeft / paddingRight
 *   borderStartWidth                 → never borderLeftWidth
 *   borderTopStartRadius / End       → never borderTopLeftRadius / Right
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
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';
import { COLLECTIONS } from '../../config/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TABS = ['نظرة عامة', 'الزيارات', 'المستندات'];

const BLOOD_TYPE_COLOR = {
  'A+':  '#ef4444', 'A-':  '#fca5a5',
  'B+':  '#3b82f6', 'B-':  '#93c5fd',
  'AB+': '#8b5cf6', 'AB-': '#c4b5fd',
  'O+':  '#f59e0b', 'O-':  '#fcd34d',
};

const CATEGORY_CONFIG = {
  lab:          { label: 'مختبر',         color: '#3b82f6', bg: '#dbeafe' },
  imaging:      { label: 'تصوير',         color: '#8b5cf6', bg: '#ede9fe' },
  prescription: { label: 'وصفة طبية',    color: Colors.primary, bg: '#d1fae5' },
  report:       { label: 'تقرير',         color: '#f59e0b', bg: '#fef3c7' },
  general:      { label: 'عام',           color: Colors.gray,   bg: '#f3f4f6' },
};

const FILE_ICON = {
  pdf:  'document-text-outline',
  jpg:  'image-outline',
  jpeg: 'image-outline',
  png:  'image-outline',
  heic: 'image-outline',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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
// Sub-components — all memo'd for FlatList perf
// ─────────────────────────────────────────────────────────────────────────────

/** Horizontal pill row for medical tags (allergies, meds, conditions) */
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

/** Section header with left accent border */
const SectionBlock = memo(({ title, accentColor, children }) => (
  <View style={[styles.sectionBlock, { borderStartColor: accentColor ?? Colors.primary }]}>
    <Text style={[styles.sectionBlockTitle, { color: accentColor ?? Colors.primary }]}>
      {title}
    </Text>
    {children}
  </View>
));

/** Key–value info row */
const InfoRow = memo(({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={15} color={Colors.textSecondary} style={styles.infoIcon} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value ?? '—'}</Text>
  </View>
));

/** Encounter card — collapsed notes with "show more" */
const EncounterCard = memo(({ item }) => {
  const [expanded, setExpanded] = useState(false);

  const notes = item.clinicalNotes ?? '';
  const diagnosis = item.diagnosis ?? '';
  const prescriptions = item.prescriptions ?? [];
  const isLong = notes.length > 120;
  const displayNotes = isLong && !expanded ? notes.slice(0, 120) + '…' : notes;

  return (
    <View style={styles.encounterCard}>
      {/* Header row */}
      <View style={styles.encounterHeader}>
        <View style={styles.encounterDateBadge}>
          <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
          <Text style={styles.encounterDateText}>{formatDate(item.appointmentDate)}</Text>
        </View>
        <View style={styles.encounterTimeBadge}>
          <Text style={styles.encounterTimeText}>{item.appointmentTime ?? ''}</Text>
        </View>
      </View>

      {/* Reason */}
      {item.reason ? (
        <View style={styles.encounterReasonRow}>
          <Text style={styles.encounterReasonLabel}>السبب: </Text>
          <Text style={styles.encounterReasonValue}>{item.reason}</Text>
        </View>
      ) : null}

      {/* Clinical notes */}
      {notes ? (
        <View style={styles.encounterSection}>
          <Text style={styles.encounterSectionTitle}>ملاحظات سريرية</Text>
          <Text style={styles.encounterNotes}>{displayNotes}</Text>
          {isLong && (
            <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
              <Text style={styles.showMore}>{expanded ? 'عرض أقل' : 'عرض المزيد'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Diagnosis */}
      {diagnosis ? (
        <View style={styles.encounterSection}>
          <Text style={styles.encounterSectionTitle}>التشخيص</Text>
          <Text style={styles.encounterNotes}>{diagnosis}</Text>
        </View>
      ) : null}

      {/* Prescriptions */}
      {prescriptions.length > 0 && (
        <View style={styles.encounterSection}>
          <Text style={styles.encounterSectionTitle}>الأدوية الموصوفة</Text>
          {prescriptions.map((rx, i) => (
            <View key={i} style={styles.rxRow}>
              <Ionicons name="medkit-outline" size={13} color={Colors.primary} />
              <Text style={styles.rxText}>
                {rx.drug}
                {rx.dosage ? ` — ${rx.dosage}` : ''}
                {rx.frequency ? ` (${rx.frequency})` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

/** Document card */
const DocCard = memo(({ item, onOpen }) => {
  const ext  = fileExt(item.fileType ?? '');
  const icon = FILE_ICON[ext] ?? 'document-outline';
  const cat  = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.general;

  return (
    <TouchableOpacity style={styles.docCard} onPress={() => onOpen(item)} activeOpacity={0.75}>
      <View style={[styles.docIconBox, { backgroundColor: cat.bg }]}>
        <Ionicons name={icon} size={22} color={cat.color} />
      </View>
      <View style={styles.docContent}>
        <Text style={styles.docTitle} numberOfLines={1}>{item.title ?? 'مستند'}</Text>
        {item.description ? (
          <Text style={styles.docDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <View style={styles.docMeta}>
          <View style={[styles.catPill, { backgroundColor: cat.bg }]}>
            <Text style={[styles.catPillText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={styles.docDate}>{formatDate(item.uploadedAt)}</Text>
        </View>
      </View>
      <Ionicons name="open-outline" size={16} color={Colors.gray} />
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab content components
// ─────────────────────────────────────────────────────────────────────────────

const OverviewTab = memo(({ patient }) => {
  if (!patient) return null;

  const age      = calcAge(patient.dateOfBirth);
  const allergies   = patient.medicalHistory?.allergies         ?? patient.allergies         ?? [];
  const medications = patient.medicalHistory?.currentMedications ?? patient.currentMedications ?? [];
  const conditions  = patient.medicalHistory?.chronicConditions  ?? patient.chronicConditions  ?? [];

  const bColor = BLOOD_TYPE_COLOR[patient.bloodType] ?? Colors.primary;

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Demographics ── */}
      <SectionBlock title="البيانات الشخصية">
        <InfoRow icon="person-outline"    label="الاسم"       value={patient.name ?? patient.displayName} />
        <InfoRow icon="call-outline"      label="الهاتف"      value={patient.phoneNumber ?? patient.phone} />
        <InfoRow icon="mail-outline"      label="البريد"      value={patient.email} />
        {age !== null && (
          <InfoRow icon="calendar-outline" label="العمر"       value={`${age} سنة`} />
        )}
        <InfoRow
          icon="transgender-outline"
          label="الجنس"
          value={patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : patient.gender}
        />
        {patient.bloodType && (
          <View style={styles.infoRow}>
            <Ionicons name="water-outline" size={15} color={Colors.textSecondary} style={styles.infoIcon} />
            <Text style={styles.infoLabel}>فصيلة الدم</Text>
            <View style={[styles.bloodBadge, { backgroundColor: bColor + '22' }]}>
              <Text style={[styles.bloodBadgeText, { color: bColor }]}>{patient.bloodType}</Text>
            </View>
          </View>
        )}
        {patient.city && (
          <InfoRow icon="location-outline" label="المدينة"    value={patient.city} />
        )}
      </SectionBlock>

      {/* ── Medical History ── */}
      <SectionBlock title="الحساسيات" accentColor="#ef4444">
        {allergies.length ? (
          <TagRow tags={allergies} color="#ef4444" bg="#fee2e2" />
        ) : (
          <Text style={styles.emptyHint}>لا توجد حساسيات مسجّلة</Text>
        )}
      </SectionBlock>

      <SectionBlock title="الأدوية الحالية" accentColor="#3b82f6">
        {medications.length ? (
          <TagRow tags={medications} color="#3b82f6" bg="#dbeafe" />
        ) : (
          <Text style={styles.emptyHint}>لا توجد أدوية مسجّلة</Text>
        )}
      </SectionBlock>

      <SectionBlock title="الأمراض المزمنة" accentColor="#8b5cf6">
        {conditions.length ? (
          <TagRow tags={conditions} color="#8b5cf6" bg="#ede9fe" />
        ) : (
          <Text style={styles.emptyHint}>لا توجد أمراض مزمنة مسجّلة</Text>
        )}
      </SectionBlock>
    </ScrollView>
  );
});

const EncountersTab = memo(({ encounters }) => {
  if (!encounters.length) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-text-outline" size={52} color={Colors.border} />
        <Text style={styles.emptyStateTitle}>لا توجد زيارات سابقة</Text>
        <Text style={styles.emptyStateHint}>ستظهر الزيارات المكتملة هنا</Text>
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
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
    />
  );
});

const DocumentsTab = memo(({ documents, onOpen }) => {
  if (!documents.length) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="folder-open-outline" size={52} color={Colors.border} />
        <Text style={styles.emptyStateTitle}>لا توجد مستندات</Text>
        <Text style={styles.emptyStateHint}>لم يرفع المريض أي مستندات بعد</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={documents}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <DocCard item={item} onOpen={onOpen} />}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EMRScreen
// ─────────────────────────────────────────────────────────────────────────────

const EMRScreen = ({ route, navigation }) => {
  const { patientId, patientName } = route.params ?? {};

  const db = getFirestore();

  const [patient,    setPatient]    = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [documents,  setDocuments]  = useState([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState(null);
  const [activeTab,  setActiveTab]  = useState(0);

  // ── Fetch all three data sources in parallel ──────────────────────────────
  useEffect(() => {
    if (!patientId) {
      setError('معرّف المريض غير موجود');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchAll = async () => {
      try {
        const patientRef  = doc(db, COLLECTIONS.PATIENTS, patientId);

        const encounterQ  = query(
          collection(db, COLLECTIONS.APPOINTMENTS),
          where('patientId', '==', patientId),
          where('status',    '==', 'completed'),
          orderBy('appointmentDate', 'desc'),
          limit(50),
        );

        const documentsQ  = query(
          collection(db, COLLECTIONS.DOCUMENTS),
          where('patientId', '==', patientId),
          orderBy('uploadedAt', 'desc'),
          limit(30),
        );

        const [patientSnap, encounterSnap, docsSnap] = await Promise.all([
          getDoc(patientRef),
          getDocs(encounterQ),
          getDocs(documentsQ),
        ]);

        if (!isMounted) return;

        if (patientSnap.exists()) {
          setPatient({ id: patientSnap.id, ...patientSnap.data() });
        }

        setEncounters(
          encounterSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        );

        setDocuments(
          docsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        );
      } catch (err) {
        if (isMounted) setError('تعذّر تحميل السجل الطبي');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAll();
    return () => { isMounted = false; };
  }, [patientId, db]);

  // ── Open document ─────────────────────────────────────────────────────────
  const handleOpenDoc = useCallback(async (doc) => {
    if (!doc.fileUrl) {
      Alert.alert('خطأ', 'رابط الملف غير متاح.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(doc.fileUrl);
      if (canOpen) {
        await Linking.openURL(doc.fileUrl);
      } else {
        Alert.alert('تعذّر فتح الملف', 'لا يوجد تطبيق مدعوم لفتح هذا الملف.');
      }
    } catch {
      Alert.alert('خطأ', 'تعذّر فتح المستند.');
    }
  }, []);

  // ── Header: set title dynamically ────────────────────────────────────────
  useEffect(() => {
    if (patientName) {
      navigation.setOptions({ title: `سجل: ${patientName}` });
    }
  }, [navigation, patientName]);

  // ── Tab badge counts ──────────────────────────────────────────────────────
  const tabCounts = useMemo(() => ({
    0: null,
    1: encounters.length || null,
    2: documents.length  || null,
  }), [encounters.length, documents.length]);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل السجل الطبي…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
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

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Patient banner ── */}
      {patient && (
        <View style={styles.patientBanner}>
          <View style={styles.bannerAvatar}>
            <Text style={styles.bannerAvatarText}>
              {(patient.name ?? patientName ?? 'م')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerName}>{patient.name ?? patientName}</Text>
            <Text style={styles.bannerMeta}>
              {patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : ''}
              {patient.bloodType ? ` · فصيلة ${patient.bloodType}` : ''}
              {calcAge(patient.dateOfBirth) !== null
                ? ` · ${calcAge(patient.dateOfBirth)} سنة`
                : ''}
            </Text>
          </View>
        </View>
      )}

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {TABS.map((label, idx) => {
          const active = idx === activeTab;
          const count  = tabCounts[idx];
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => setActiveTab(idx)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {label}
              </Text>
              {count ? (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Tab content ── */}
      <View style={styles.tabContent}>
        {activeTab === 0 && <OverviewTab   patient={patient} />}
        {activeTab === 1 && <EncountersTab encounters={encounters} />}
        {activeTab === 2 && <DocumentsTab  documents={documents} onOpen={handleOpenDoc} />}
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen:  { flex: 1, backgroundColor: Colors.background },

  // ── Centered states ────────────────────────────────────────────────────────
  centeredState: {
    flex: 1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        Spacing.lg,
    gap:            Spacing.sm,
  },
  loadingText: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  errorText:   { fontSize: FontSizes.md, color: Colors.error, textAlign: 'center' },
  retryBtn: {
    marginTop:       Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.sm,
    borderRadius:    BorderRadius.full,
  },
  retryBtnText: { color: Colors.white, fontWeight: '600', fontSize: FontSizes.sm },

  // ── Patient banner ─────────────────────────────────────────────────────────
  patientBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    gap:             Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bannerAvatar: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems:     'center',
    justifyContent: 'center',
  },
  bannerAvatarText: { fontSize: FontSizes.lg, fontWeight: '700', color: Colors.white },
  bannerInfo:  { flex: 1 },
  bannerName:  { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  bannerMeta:  { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection:   'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  },
  tabItem: {
    flex: 1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabLabel:      { fontSize: FontSizes.sm, color: Colors.textSecondary, fontWeight: '500' },
  tabLabelActive:{ color: Colors.primary, fontWeight: '700' },
  tabBadge: {
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: Colors.primary + '22' },
  tabBadgeText:   { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  tabBadgeTextActive: { color: Colors.primary },

  // ── Tab content wrapper ───────────────────────────────────────────────────
  tabContent: { flex: 1 },

  tabScroll:  { flex: 1 },

  // paddings inside ScrollView / FlatList
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  // ── Section block ──────────────────────────────────────────────────────────
  sectionBlock: {
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing.md,
    marginBottom:    Spacing.sm,
    borderStartWidth: 3,
    borderStartColor: Colors.primary,
    elevation:    1,
    shadowColor:  Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionBlockTitle: {
    fontSize:     FontSizes.sm,
    fontWeight:   '700',
    color:        Colors.primary,
    marginBottom: Spacing.sm,
    textAlign:    'right',
  },

  // ── Info rows ──────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical: 5,
    gap: Spacing.sm,
  },
  infoIcon:  { width: 20 },
  infoLabel: { flex: 1, fontSize: FontSizes.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500', textAlign: 'right' },

  // ── Blood type badge ───────────────────────────────────────────────────────
  bloodBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  bloodBadgeText: { fontSize: FontSizes.sm, fontWeight: '700' },

  // ── Medical tags ───────────────────────────────────────────────────────────
  tagRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
    marginTop:     4,
  },
  tag: {
    borderRadius:    BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: FontSizes.xs, fontWeight: '600' },

  // ── Empty hint ─────────────────────────────────────────────────────────────
  emptyHint: {
    fontSize: FontSizes.xs,
    color:    Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // ── Encounter card ─────────────────────────────────────────────────────────
  encounterCard: {
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing.md,
    elevation:       1,
    shadowColor:     Colors.black,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    2,
  },
  encounterHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    Spacing.sm,
  },
  encounterDateBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: Colors.primary + '15',
    borderRadius:    BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical:   3,
  },
  encounterDateText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: '600' },
  encounterTimeBadge: {
    backgroundColor: Colors.borderLight,
    borderRadius:    BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  encounterTimeText: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  encounterReasonRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    marginBottom:  Spacing.xs,
  },
  encounterReasonLabel: {
    fontSize:   FontSizes.sm,
    color:      Colors.textSecondary,
    fontWeight: '500',
  },
  encounterReasonValue: {
    flex: 1,
    fontSize: FontSizes.sm,
    color:    Colors.text,
    textAlign: 'right',
  },
  encounterSection: { marginTop: Spacing.sm },
  encounterSectionTitle: {
    fontSize:     FontSizes.xs,
    fontWeight:   '700',
    color:        Colors.textSecondary,
    marginBottom: 4,
    textAlign:    'right',
  },
  encounterNotes: {
    fontSize:   FontSizes.sm,
    color:      Colors.text,
    lineHeight: 20,
    textAlign:  'right',
  },
  showMore: {
    fontSize:   FontSizes.xs,
    color:      Colors.primary,
    fontWeight: '600',
    marginTop:  4,
    textAlign:  'right',
  },
  rxRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    marginTop:     3,
  },
  rxText: { fontSize: FontSizes.sm, color: Colors.text, flex: 1, textAlign: 'right' },

  // ── Document card ──────────────────────────────────────────────────────────
  docCard: {
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
    elevation:       1,
    shadowColor:     Colors.black,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    2,
  },
  docIconBox: {
    width:           44,
    height:          44,
    borderRadius:    BorderRadius.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  docContent:  { flex: 1, gap: 3 },
  docTitle:    { fontSize: FontSizes.sm, color: Colors.text, fontWeight: '600', textAlign: 'right' },
  docDesc:     { fontSize: FontSizes.xs, color: Colors.textSecondary, textAlign: 'right' },
  docMeta:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, justifyContent: 'flex-end' },
  catPill: {
    borderRadius:    BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  catPillText: { fontSize: 10, fontWeight: '600' },
  docDate:     { fontSize: 10, color: Colors.textSecondary },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.sm,
    padding:        Spacing.lg,
  },
  emptyStateTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.text },
  emptyStateHint:  { fontSize: FontSizes.sm, color: Colors.textSecondary, textAlign: 'center' },

  // ── tab padding ───────────────────────────────────────────────────────────
  tabScrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
});

export default EMRScreen;
