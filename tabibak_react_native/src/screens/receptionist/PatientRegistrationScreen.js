/**
 * PatientRegistrationScreen.js — Walk-In & New Patient Registration (Phase 4)
 *
 * ╔══ ARCHITECTURE NOTES ═══════════════════════════════════════════════════════╗
 *
 * 1. ENTRY POINT — two paths reach this screen
 * ─────────────────────────────────────────────
 *   a) Dashboard FAB:  navigation.navigate('PatientRegistration', { walkIn: true })
 *   b) Future manual:  navigation.navigate('PatientRegistration')
 *
 *   When `walkIn: true` the appointment is written with status = 'waiting'
 *   (patient is physically present → skip the pending→confirmed step).
 *   Without walkIn the appointment writes status = 'pending'.
 *
 * 2. DOCTOR LIST — single getDocs on mount
 * ─────────────────────────────────────────
 *   Doctors are loaded once via getDocs(DOCTORS) on mount — no real-time
 *   listener needed since the doctor roster changes infrequently.
 *   A searchable doctor-picker Modal filters the list client-side.
 *
 * 3. APPOINTMENT CREATION — direct addDoc (no Cloud Function)
 * ────────────────────────────────────────────────────────────
 *   Walk-in registrations bypass the bookAppointment Cloud Function because:
 *   (a) Closure / duplicate checks are irrelevant — patient is physically present.
 *   (b) The receptionist has authority to override scheduling restrictions.
 *   Direct addDoc gives atomic write with serverTimestamp audit fields.
 *
 * 4. RTL COMPLIANCE
 * ──────────────────
 *   All directional styles use logical properties:
 *     marginStart / marginEnd       → never marginLeft / marginRight
 *     paddingStart / paddingEnd     → never paddingLeft / paddingRight
 *     borderStartWidth              → never borderLeftWidth
 *     borderTopStartRadius / End    → never borderTopLeftRadius / Right
 *
 * ╚═════════════════════════════════════════════════════════════════════════════╝
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useAuth }     from '../../contexts/AuthContext';
import { COLLECTIONS } from '../../config/firebase';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
} from '../../config/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Rounds a Date to the next 30-minute boundary (e.g. 09:10 → 09:30) */
function nextHalfHour() {
  const d = new Date();
  const m = d.getMinutes();
  const remainder = m % 30;
  if (remainder !== 0) d.setMinutes(m + (30 - remainder), 0, 0);
  else                 d.setSeconds(0, 0);
  return d;
}

/** Formats a Date as 'HH:MM AM/PM' (en-US, 12-hour) for Firestore storage */
function formatTime12h(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Formats a Date as 'HH:MM' (ar-SA) for display */
function formatTimeDisplay(date) {
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Form field wrapper: label + input + error message */
const Field = memo(({ label, required, error, children }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
    {children}
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
));

/** Single doctor row in the picker Modal */
const DoctorRow = memo(({ doctor, onSelect }) => (
  <TouchableOpacity
    style={styles.doctorRow}
    onPress={() => onSelect(doctor)}
    activeOpacity={0.7}
  >
    <View style={styles.doctorAvatar}>
      <Text style={styles.doctorAvatarText}>{(doctor.name ?? 'د')[0]}</Text>
    </View>
    <View style={styles.doctorRowInfo}>
      <Text style={styles.doctorRowName}>{doctor.name ?? '—'}</Text>
      {doctor.specialty ? (
        <Text style={styles.doctorRowSpec}>{doctor.specialty}</Text>
      ) : null}
    </View>
    <Ionicons name="chevron-back-outline" size={18} color={Colors.gray} />
  </TouchableOpacity>
));

// ─────────────────────────────────────────────────────────────────────────────
// PatientRegistrationScreen
// ─────────────────────────────────────────────────────────────────────────────

const PatientRegistrationScreen = ({ navigation, route }) => {
  const isWalkIn = route?.params?.walkIn === true;
  const { user } = useAuth();

  // ── Form state ────────────────────────────────────────────────────────────
  const [patientName, setPatientName]   = useState('');
  const [phoneNumber, setPhoneNumber]   = useState('');
  const [gender, setGender]             = useState('');   // 'male' | 'female' | ''
  const [reason, setReason]             = useState('');
  const [notes, setNotes]               = useState('');
  const [errors, setErrors]             = useState({});

  // ── Doctor picker state ────────────────────────────────────────────────────
  const [doctors, setDoctors]                   = useState([]);
  const [isDoctorsLoading, setIsDoctorsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor]     = useState(null);
  const [pickerVisible, setPickerVisible]       = useState(false);
  const [doctorSearch, setDoctorSearch]         = useState('');

  // ── Time picker state ─────────────────────────────────────────────────────
  const [appointmentTime, setAppointmentTime] = useState(nextHalfHour);
  const [showTimePicker, setShowTimePicker]   = useState(false);

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMountedRef = useRef(true);
  const db           = useRef(getFirestore()).current;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Load doctors on mount ─────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, COLLECTIONS.DOCTORS))
      .then((snapshot) => {
        if (!isMountedRef.current) return;
        setDoctors(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch((err) => console.error('[PatientRegistration] doctors load error:', err))
      .finally(() => {
        if (isMountedRef.current) setIsDoctorsLoading(false);
      });
  }, [db]);

  // ── Filtered doctor list ──────────────────────────────────────────────────
  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q),
    );
  }, [doctors, doctorSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDoctorSelect = useCallback((doctor) => {
    setSelectedDoctor(doctor);
    setPickerVisible(false);
    setDoctorSearch('');
    setErrors((prev) => ({ ...prev, doctor: undefined }));
  }, []);

  const handleTimePickerChange = useCallback((event, date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) setAppointmentTime(date);
  }, []);

  const clearError = useCallback((field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs = {};
    if (!patientName.trim())     errs.patientName = 'الاسم الكامل مطلوب';
    if (!phoneNumber.trim())     errs.phoneNumber  = 'رقم الهاتف مطلوب';
    else if (!/^\d{7,15}$/.test(phoneNumber.replace(/[\s+\-()]/g, '')))
                                 errs.phoneNumber  = 'رقم هاتف غير صالح';
    if (!selectedDoctor)         errs.doctor       = 'يرجى اختيار الطبيب';
    if (!reason.trim())          errs.reason       = 'سبب الزيارة مطلوب';
    return errs;
  }, [patientName, phoneNumber, selectedDoctor, reason]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      // Build appointmentDate Timestamp (today + selected time)
      const apptDate = new Date();
      apptDate.setHours(appointmentTime.getHours(), appointmentTime.getMinutes(), 0, 0);

      const status      = isWalkIn ? 'waiting' : 'pending';
      const auditFields = isWalkIn
        ? { confirmedAt: serverTimestamp(), waitingAt: serverTimestamp() }
        : {};

      await addDoc(collection(db, COLLECTIONS.APPOINTMENTS), {
        // Patient info
        patientId:    null,                        // no system account for walk-ins
        patientName:  patientName.trim(),
        patientPhone: phoneNumber.trim(),
        gender:       gender || null,

        // Doctor info
        doctorId:   selectedDoctor.id,
        doctorName: selectedDoctor.name ?? '—',

        // Appointment fields
        appointmentDate: Timestamp.fromDate(apptDate),
        appointmentTime: formatTime12h(appointmentTime),
        status,
        isWalkIn,
        type:   'walk-in',
        reason: reason.trim(),
        notes:  notes.trim() || null,

        // Audit trail
        createdBy:     user?.uid ?? null,
        createdByRole: 'receptionist',
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
        ...auditFields,
      });

      // Navigate back first, then show success alert
      navigation.goBack();
      Alert.alert(
        'تم التسجيل ✓',
        `تم تسجيل ${patientName.trim()} في قائمة ${isWalkIn ? 'الانتظار' : 'المواعيد'} بنجاح.`,
      );
    } catch (err) {
      console.error('[PatientRegistration] addDoc error:', err);
      Alert.alert('خطأ', 'تعذّر تسجيل الموعد. حاول مرة أخرى.');
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  }, [
    validate, isWalkIn, appointmentTime, patientName, phoneNumber,
    gender, selectedDoctor, reason, notes, user, db, navigation,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Walk-in banner */}
          {isWalkIn && (
            <View style={styles.walkInBanner}>
              <Ionicons name="walk-outline" size={20} color="#92400e" />
              <Text style={styles.walkInBannerText}>
                تسجيل زيارة مباشرة — سيُضاف المريض فوراً لقائمة الانتظار
              </Text>
            </View>
          )}

          {/* ── Section: Patient Info ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>معلومات المريض</Text>
            </View>

            <Field label="الاسم الكامل" required error={errors.patientName}>
              <TextInput
                style={[styles.input, errors.patientName && styles.inputError]}
                placeholder="أدخل اسم المريض..."
                placeholderTextColor={Colors.gray}
                value={patientName}
                onChangeText={(v) => { setPatientName(v); clearError('patientName'); }}
                textAlign="right"
                returnKeyType="next"
              />
            </Field>

            <Field label="رقم الهاتف" required error={errors.phoneNumber}>
              <TextInput
                style={[styles.input, errors.phoneNumber && styles.inputError]}
                placeholder="05xxxxxxxx"
                placeholderTextColor={Colors.gray}
                value={phoneNumber}
                onChangeText={(v) => { setPhoneNumber(v); clearError('phoneNumber'); }}
                keyboardType="phone-pad"
                textAlign="right"
                returnKeyType="next"
              />
            </Field>

            {/* Gender selector */}
            <Field label="الجنس">
              <View style={styles.genderRow}>
                {[
                  { id: 'male',   label: '♂ ذكر'  },
                  { id: 'female', label: '♀ أنثى' },
                ].map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genderBtn, gender === g.id && styles.genderBtnActive]}
                    onPress={() => setGender((prev) => (prev === g.id ? '' : g.id))}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.genderBtnText, gender === g.id && styles.genderBtnTextActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          </View>

          {/* ── Section: Appointment Details ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>تفاصيل الموعد</Text>
            </View>

            {/* Doctor picker */}
            <Field label="الطبيب" required error={errors.doctor}>
              <TouchableOpacity
                style={[styles.pickerTrigger, errors.doctor && styles.inputError]}
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.75}
              >
                {selectedDoctor ? (
                  <View style={styles.pickerSelected}>
                    <View style={styles.pickerSelectedAvatar}>
                      <Text style={styles.pickerSelectedAvatarText}>
                        {(selectedDoctor.name ?? 'د')[0]}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.pickerSelectedName}>{selectedDoctor.name}</Text>
                      {selectedDoctor.specialty ? (
                        <Text style={styles.pickerSelectedSpec}>{selectedDoctor.specialty}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.pickerPlaceholder}>
                    {isDoctorsLoading ? 'جاري تحميل الأطباء...' : 'اختر الطبيب...'}
                  </Text>
                )}
                <Ionicons name="chevron-down-outline" size={18} color={Colors.gray} />
              </TouchableOpacity>
            </Field>

            {/* Time picker */}
            <Field label="وقت الموعد" required>
              <TouchableOpacity
                style={styles.pickerTrigger}
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.75}
              >
                <View style={styles.timeDisplay}>
                  <Ionicons name="time-outline" size={18} color={Colors.primary} />
                  <Text style={styles.timeDisplayText}>{formatTimeDisplay(appointmentTime)}</Text>
                </View>
                <Ionicons name="chevron-down-outline" size={18} color={Colors.gray} />
              </TouchableOpacity>
            </Field>

            {/* Reason */}
            <Field label="سبب الزيارة" required error={errors.reason}>
              <TextInput
                style={[styles.input, styles.inputMulti, errors.reason && styles.inputError]}
                placeholder="صف سبب الزيارة..."
                placeholderTextColor={Colors.gray}
                value={reason}
                onChangeText={(v) => { setReason(v); clearError('reason'); }}
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
            </Field>

            {/* Notes (optional) */}
            <Field label="ملاحظات إضافية">
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="أي معلومات إضافية (اختياري)..."
                placeholderTextColor={Colors.gray}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                textAlign="right"
                textAlignVertical="top"
              />
            </Field>
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons
                  name={isWalkIn ? 'log-in-outline' : 'calendar-outline'}
                  size={20}
                  color={Colors.white}
                />
                <Text style={styles.submitBtnText}>
                  {isWalkIn ? 'تسجيل الوصول' : 'حجز الموعد'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ══ Doctor Picker Modal ══ */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.pickerModal}>
          {/* Modal header */}
          <View style={styles.pickerModalHeader}>
            <TouchableOpacity
              onPress={() => { setPickerVisible(false); setDoctorSearch(''); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-outline" size={26} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.pickerModalTitle}>اختر الطبيب</Text>
            <View style={{ width: 26 }} />
          </View>

          {/* Search */}
          <View style={styles.pickerSearch}>
            <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="ابحث باسم الطبيب أو التخصص..."
              placeholderTextColor={Colors.gray}
              value={doctorSearch}
              onChangeText={setDoctorSearch}
              textAlign="right"
              autoFocus
            />
            {doctorSearch.length > 0 && (
              <TouchableOpacity onPress={() => setDoctorSearch('')}>
                <Ionicons name="close-circle" size={18} color={Colors.gray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Doctor list */}
          {isDoctorsLoading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredDoctors}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => (
                <DoctorRow doctor={item} onSelect={handleDoctorSelect} />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.centeredState}>
                  <Ionicons name="search-outline" size={40} color={Colors.border} />
                  <Text style={styles.emptyText}>لا يوجد طبيب بهذا الاسم</Text>
                </View>
              }
              keyboardShouldPersistTaps="handled"
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ══ Time Picker ══
          iOS:    bottom-sheet Modal with spinner
          Android: native dialog                   */}
      {showTimePicker && (
        Platform.OS === 'ios' ? (
          <Modal
            transparent
            animationType="fade"
            onRequestClose={() => setShowTimePicker(false)}
          >
            <View style={styles.timePickerOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => setShowTimePicker(false)}
                activeOpacity={1}
              />
              <View style={styles.timePickerSheet}>
                <View style={styles.timePickerHeader}>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.timePickerDone}>تم</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={appointmentTime}
                  mode="time"
                  display="spinner"
                  onChange={handleTimePickerChange}
                  locale="ar"
                  minuteInterval={5}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={appointmentTime}
            mode="time"
            display="default"
            onChange={handleTimePickerChange}
            minuteInterval={5}
          />
        )
      )}
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL compliance:
//   ✓ No marginLeft / marginRight  — uses marginStart / marginEnd
//   ✓ No paddingLeft / paddingRight — uses paddingHorizontal (neutral)
//   ✓ No borderLeftWidth            — none needed in this form screen
//   ✓ No borderTopLeftRadius        — uses borderTopStartRadius / EndRadius
//   ✓ hitSlop uses symmetric values (no logical alternative in the API)
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  screen: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding:    Spacing.md,
    gap:        Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  // ── Walk-in banner ───────────────────────────────────────────────────────

  walkInBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  '#fef3c7',
    borderRadius:     BorderRadius.lg,
    padding:          Spacing.md,
    gap:              Spacing.sm,
    borderStartWidth: 4,
    borderStartColor: '#f59e0b',
  },
  walkInBannerText: {
    flex:       1,
    color:      '#92400e',
    fontSize:   FontSizes.sm,
    fontWeight: '600',
    textAlign:  'right',
  },

  // ── Sections ─────────────────────────────────────────────────────────────

  section: {
    backgroundColor: Colors.white,
    borderRadius:    BorderRadius.xl,
    padding:         Spacing.md,
    gap:             Spacing.md,
    elevation:       1,
    shadowColor:     Colors.black,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    2,
  },
  sectionHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.xs,
    paddingBottom:   Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.text,
  },

  // ── Form fields ───────────────────────────────────────────────────────────

  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize:   FontSizes.sm,
    fontWeight: '600',
    color:      Colors.text,
    textAlign:  'right',
  },
  required: {
    color: Colors.error,
  },
  fieldError: {
    fontSize: FontSizes.xs,
    color:    Colors.error,
    textAlign: 'right',
  },

  // ── Inputs ────────────────────────────────────────────────────────────────

  input: {
    borderWidth:      1,
    borderColor:      Colors.border,
    borderRadius:     BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Platform.OS === 'ios' ? 12 : 8,
    fontSize:         FontSizes.md,
    color:            Colors.text,
    backgroundColor:  Colors.white,
  },
  inputMulti: {
    minHeight:         80,
    textAlignVertical: 'top',
    paddingTop:        Spacing.sm,
  },
  inputError: {
    borderColor: Colors.error,
  },

  // ── Gender selector ───────────────────────────────────────────────────────

  genderRow: {
    flexDirection: 'row',
    gap:           Spacing.sm,
  },
  genderBtn: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: Spacing.sm,
    borderRadius:   BorderRadius.md,
    borderWidth:    1,
    borderColor:    Colors.border,
    backgroundColor: Colors.white,
  },
  genderBtnActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  genderBtnText: {
    fontSize:   FontSizes.sm,
    color:      Colors.textSecondary,
    fontWeight: '600',
  },
  genderBtnTextActive: {
    color: Colors.white,
  },

  // ── Picker trigger (doctor + time) ───────────────────────────────────────

  pickerTrigger: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    borderWidth:      1,
    borderColor:      Colors.border,
    borderRadius:     BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Platform.OS === 'ios' ? 12 : 8,
    backgroundColor:  Colors.white,
    gap:              Spacing.xs,
  },
  pickerPlaceholder: {
    flex:     1,
    fontSize: FontSizes.md,
    color:    Colors.gray,
  },
  pickerSelected: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  pickerSelectedAvatar: {
    width:          36,
    height:         36,
    borderRadius:   BorderRadius.full,
    backgroundColor: Colors.primaryLight + '30',
    alignItems:     'center',
    justifyContent: 'center',
  },
  pickerSelectedAvatarText: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.primary,
  },
  pickerSelectedName: {
    fontSize:   FontSizes.sm,
    fontWeight: '700',
    color:      Colors.text,
  },
  pickerSelectedSpec: {
    fontSize: FontSizes.xs,
    color:    Colors.textSecondary,
  },

  // Time display
  timeDisplay: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  timeDisplayText: {
    fontSize:   FontSizes.md,
    fontWeight: '700',
    color:      Colors.text,
  },

  // ── Submit button ─────────────────────────────────────────────────────────

  submitBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius:   BorderRadius.lg,
    paddingVertical: Spacing.md,
    gap:            Spacing.sm,
    elevation:      3,
    shadowColor:    Colors.primaryDark,
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.3,
    shadowRadius:   4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color:      Colors.white,
    fontSize:   FontSizes.md,
    fontWeight: '700',
  },

  // ── Doctor picker Modal ───────────────────────────────────────────────────

  pickerModal: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  pickerModalHeader: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    padding:          Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor:  Colors.white,
  },
  pickerModalTitle: {
    fontSize:   FontSizes.lg,
    fontWeight: '700',
    color:      Colors.text,
  },
  pickerSearch: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.white,
    margin:           Spacing.md,
    borderRadius:     BorderRadius.lg,
    borderWidth:      1,
    borderColor:      Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical:  Platform.OS === 'ios' ? 10 : 4,
    gap:              Spacing.xs,
  },
  pickerSearchInput: {
    flex:     1,
    fontSize: FontSizes.sm,
    color:    Colors.text,
  },
  doctorRow: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical:  Spacing.sm,
    gap:              Spacing.sm,
  },
  doctorAvatar: {
    width:          44,
    height:         44,
    borderRadius:   BorderRadius.full,
    backgroundColor: Colors.primaryLight + '25',
    alignItems:     'center',
    justifyContent: 'center',
  },
  doctorAvatarText: {
    fontSize:   FontSizes.lg,
    fontWeight: '700',
    color:      Colors.primary,
  },
  doctorRowInfo: {
    flex: 1,
    gap:  2,
  },
  doctorRowName: {
    fontSize:   FontSizes.md,
    fontWeight: '600',
    color:      Colors.text,
  },
  doctorRowSpec: {
    fontSize: FontSizes.xs,
    color:    Colors.textSecondary,
  },
  separator: {
    height:           1,
    backgroundColor:  Colors.border,
    marginHorizontal: Spacing.md,
  },

  // ── Time picker (iOS bottom sheet) ───────────────────────────────────────

  timePickerOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'flex-end',
  },
  timePickerSheet: {
    backgroundColor:      Colors.white,
    borderTopStartRadius: BorderRadius.xl,
    borderTopEndRadius:   BorderRadius.xl,
    overflow:             'hidden',
  },
  timePickerHeader: {
    flexDirection:    'row',
    // flex-start → physical right in RTL for "تم" button
    justifyContent:   'flex-start',
    padding:          Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  timePickerDone: {
    color:      Colors.primary,
    fontSize:   FontSizes.md,
    fontWeight: '700',
  },

  // ── Shared states ─────────────────────────────────────────────────────────

  centeredState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        Spacing.xl,
    gap:            Spacing.md,
    minHeight:      200,
  },
  emptyText: {
    fontSize:  FontSizes.md,
    color:     Colors.textSecondary,
    textAlign: 'center',
  },
});

export default PatientRegistrationScreen;
