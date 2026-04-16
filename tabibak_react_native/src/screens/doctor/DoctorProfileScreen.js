/**
 * DoctorProfileScreen — Phase 3: Doctor Core
 * Profile display + Schedule & Availability Management.
 *
 * ── Architecture Notes ──────────────────────────────────────────────────────
 *
 * ┌─ AVAILABILITY STATE STRUCTURE ─────────────────────────────────────────────
 * │
 * │  The canonical schedule state is a plain JS object keyed by lowercase
 * │  English day name. Each value is a day descriptor:
 * │
 * │    schedule = {
 * │      monday:    { active: true,  start: '09:00', end: '17:00' },
 * │      tuesday:   { active: true,  start: '09:00', end: '17:00' },
 * │      wednesday: { active: true,  start: '09:00', end: '17:00' },
 * │      thursday:  { active: true,  start: '09:00', end: '17:00' },
 * │      friday:    { active: false, start: '09:00', end: '17:00' },
 * │      saturday:  { active: false, start: '09:00', end: '17:00' },
 * │      sunday:    { active: false, start: '09:00', end: '17:00' },
 * │    }
 * │
 * │  `start` / `end` — 24-hour 'HH:mm' strings (e.g., '09:00', '14:30').
 * │  String format is timezone-agnostic, directly comparable with string
 * │  inequality ('09:00' < '14:30'), and what Firestore stores. The backend
 * │  booking algorithm reads (end − start) / consultationDuration to derive
 * │  the total number of bookable slots for that day.
 * │
 * │  `consultationDuration` — integer (minutes): 15 | 30 | 60.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ TIME PICKER STRATEGY ─────────────────────────────────────────────────────
 * │
 * │  Uses @react-native-community/datetimepicker v8 with a PLATFORM-SPLIT
 * │  approach because Android and iOS render the component very differently:
 * │
 * │  ANDROID
 * │  ────────
 * │  The library ALWAYS renders as a native system dialog (modal OS widget).
 * │  Strategy: mount <DateTimePicker> only when `pickerTarget !== null`.
 * │  `onChange(event, date)` fires ONCE:
 * │    • event.type === 'set'       → call commitPickedTime(date), then unmount.
 * │    • event.type === 'dismissed' → discard, unmount.
 * │  Set `pickerTarget = null` to unmount after either outcome.
 * │
 * │  iOS
 * │  ───
 * │  The library renders a UIPickerView drum-roll (spinner) inline wherever
 * │  placed. Strategy: host it inside a React Native <Modal> (bottom sheet)
 * │  with Cancel / Done action buttons.
 * │    • onChange fires on EVERY wheel tick → update `pickerTemp` (not
 * │      committed to schedule state yet).
 * │    • "Done" tap  → commitPickedTime(pickerTemp), close modal.
 * │    • "Cancel" / backdrop tap → discard pickerTemp, close modal.
 * │
 * │  In both cases the picker operates on a `Date` object (library requirement)
 * │  while schedule state stores 'HH:mm' strings. Two helpers bridge the gap:
 * │    parseTimeToDate('09:00')  → Date (today at 09:00 local time)
 * │    formatDateToTime(Date)    → '09:00' (24-hour HH:mm, zero-padded)
 * │
 * │  minuteInterval={15} constrains selection to 00 / 15 / 30 / 45 — standard
 * │  for medical appointment booking.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ SAVE STRATEGY ────────────────────────────────────────────────────────────
 * │
 * │  ALL changes (day toggles, time edits, duration selection) are held in
 * │  local React state and do NOT touch Firestore until the doctor explicitly
 * │  presses "Save Schedule". On press, a single updateDoc writes:
 * │    { schedule, consultationDuration, scheduleUpdatedAt: serverTimestamp() }
 * │  to users/{uid} — the doctor's Firestore profile document.
 * │
 * │  Pre-save validation: for every active day, assert day.start < day.end
 * │  (string comparison is sufficient for 24-hour 'HH:mm' format). An Alert
 * │  identifies the offending day before the Firestore write is attempted.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ DATA HYDRATION ───────────────────────────────────────────────────────────
 * │
 * │  useDoctorProfile(uid): one-time getDoc on mount (not onSnapshot — the
 * │  profile is stable during an editing session; live updates add no value).
 * │  On success, merges the Firestore schedule with DEFAULT_SCHEDULE so that
 * │  all 7 day keys always exist — guards against partial documents from
 * │  doctors who registered before the schedule feature was introduced.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 *
 * ┌─ RTL COMPLIANCE ───────────────────────────────────────────────────────────
 * │
 * │  ⚠️  Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right, or
 * │  positional `left`/`right`. Logical properties exclusively:
 * │    marginStart / marginEnd / paddingStart / paddingEnd /
 * │    borderStartWidth / borderEndWidth / start / end
 * │  DayRow layout:
 * │    LTR: [Day name (flex:1)] [Start btn] [–] [End btn] [Switch]
 * │    RTL: [Switch] [End btn] [–] [Start btn] [Day name (flex:1)]
 * │  flex-row reversal in Arabic produces the correct reading-order layout
 * │  automatically — zero additional RTL-specific code required.
 * │  The picker sheet uses borderTopStartRadius / borderTopEndRadius so the
 * │  rounded corners remain on the correct corners in both directions.
 * │
 * └────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';
import storageService from '../../services/storageService';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Ordered list of all 7 days, used to render the DayRow list deterministically. */
const DAYS = [
  { key: 'monday',    label: 'Monday'    },
  { key: 'tuesday',   label: 'Tuesday'   },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday',  label: 'Thursday'  },
  { key: 'friday',    label: 'Friday'    },
  { key: 'saturday',  label: 'Saturday'  },
  { key: 'sunday',    label: 'Sunday'    },
];

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
];

/**
 * Seed defaults used when no Firestore schedule exists yet (new doctor).
 * Mon–Thu active 09:00–17:00; Fri–Sun off.
 */
const DEFAULT_SCHEDULE = {
  monday:    { active: true,  start: '09:00', end: '17:00' },
  tuesday:   { active: true,  start: '09:00', end: '17:00' },
  wednesday: { active: true,  start: '09:00', end: '17:00' },
  thursday:  { active: true,  start: '09:00', end: '17:00' },
  friday:    { active: false, start: '09:00', end: '17:00' },
  saturday:  { active: false, start: '09:00', end: '17:00' },
  sunday:    { active: false, start: '09:00', end: '17:00' },
};

const DEFAULT_DURATION = 30; // minutes

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * '14:30' → '2:30 PM'  |  '09:00' → '9:00 AM'
 * Used for display only — schedule state always stores 24-hour strings.
 */
function formatTime12(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * '09:30' → Date (today's date with hours set to 09:30 local time).
 * DateTimePicker requires a `Date` object as its `value` prop.
 */
function parseTimeToDate(timeStr) {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Date → '14:30'  (24-hour HH:mm, zero-padded).
 * Converts what DateTimePicker returns back to the string stored in schedule.
 */
function formatDateToTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One-time getDoc of users/{uid}.
 * Not onSnapshot — profile data is stable while the doctor is editing;
 * live updates would overwrite unsaved local changes without warning.
 */
function useDoctorProfile(uid) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      getDoc(doc(db, 'users', uid)).catch(() => null),
      getDoc(doc(db, 'doctors', uid)).catch(() => null),
    ]).then(([userSnap, doctorSnap]) => {
      if (cancelled) return;
      const userData   = userSnap?.exists()   ? userSnap.data()   : {};
      const doctorData = doctorSnap?.exists()  ? doctorSnap.data() : {};
      // doctors/{uid} wins for name/about/photoURL; users/{uid} wins for schedule
      setProfile({ id: uid, ...userData, ...doctorData });
    }).catch((err) => {
      if (!cancelled) console.error('[DoctorProfile] fetch:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [uid]);

  return { profile, loading, setProfile };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components  (all module-level React.memo — never recreated on re-render)
// ─────────────────────────────────────────────────────────────────────────────

/** Circular avatar — shows photo if available, initials otherwise. */
const Avatar = React.memo(function Avatar({ name = 'Dr', size = 72, photoURL, onPress, editMode }) {
  const initials = (name || 'Dr')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={editMode ? 0.7 : 1}
      style={{ alignItems: 'center' }}
    >
      <View style={[S.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        {photoURL ? (
          <Image
            source={{ uri: photoURL }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        ) : (
          <Text style={[S.avatarText, { fontSize: Math.round(size * 0.36) }]}>
            {initials || 'Dr'}
          </Text>
        )}
      </View>
      {editMode && (
        <View style={S.avatarEditBadge}>
          <Ionicons name="camera-outline" size={12} color={Colors.white} />
        </View>
      )}
    </TouchableOpacity>
  );
});

/**
 * Compact pill that displays one time value (Start or End).
 * Tapping opens the system time-picker for that slot.
 *
 * Layout (LTR):  [label (xs text)]
 *                [clock icon] [time value]
 * Layout (RTL): flex-row reversal handles the icon/value flip automatically.
 */
const TimeButton = React.memo(function TimeButton({ time, label, onPress }) {
  return (
    <TouchableOpacity
      style={S.timeBtn}
      onPress={onPress}
      activeOpacity={0.72}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      <Text style={S.timeBtnLabel}>{label}</Text>
      <View style={S.timeBtnValueRow}>
        <Ionicons name="time-outline" size={11} color={Colors.primary} />
        <Text style={S.timeBtnValue}>{formatTime12(time)}</Text>
      </View>
    </TouchableOpacity>
  );
});

/**
 * A single day row inside the Working Hours card.
 *
 * LTR layout:  [Day name (flex:1)] [Start btn] [–] [End btn] [Switch]
 * RTL layout:  [Switch] [End btn] [–] [Start btn] [Day name (flex:1)]
 *
 * In Arabic (RTL), flexDirection:'row' reverses automatically, placing the
 * day name on the reading-start side (right) and the Switch on the
 * reading-end side (left). Zero RTL-specific overrides needed.
 */
const DayRow = React.memo(function DayRow({
  label,
  active,
  start,
  end,
  onToggle,
  onPressStart,
  onPressEnd,
}) {
  return (
    <View style={S.dayRow}>

      {/* ── Day name — flex:1 absorbs all residual space ─────────────── */}
      <Text
        style={[S.dayLabel, !active && S.dayLabelOff]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {/* ── Time range OR "Day off" label ────────────────────────────── */}
      {active ? (
        <View style={S.timeRange}>
          <TimeButton time={start} label="Start" onPress={onPressStart} />
          <Text style={S.timeSep} accessibilityElementsHidden>–</Text>
          <TimeButton time={end}   label="End"   onPress={onPressEnd}   />
        </View>
      ) : (
        <Text style={S.dayOffLabel}>Day off</Text>
      )}

      {/* ── Switch — always at the logical END of the row ────────────── */}
      <Switch
        value={active}
        onValueChange={onToggle}
        trackColor={{
          false: Colors.border,
          true:  Colors.primary + '55',
        }}
        thumbColor={active ? Colors.primary : Colors.gray}
        ios_backgroundColor={Colors.border}
        style={S.daySwitch}
      />
    </View>
  );
});

/**
 * Segmented control for consultation duration (15 / 30 / 60 min).
 *
 * Three pill buttons in a trough. The selected option shows a checkmark icon
 * and elevated white background (same pill-trough pattern as MyAppointmentsScreen
 * and PatientDetailsScreen). RTL-safe: flexDirection:'row' + gap reverses.
 */
const DurationSegment = React.memo(function DurationSegment({ value, onChange }) {
  return (
    <View style={S.durationSegment}>
      {DURATIONS.map(({ value: v, label }) => {
        const selected = v === value;
        return (
          <TouchableOpacity
            key={v}
            style={[S.durationOption, selected && S.durationOptionSelected]}
            onPress={() => onChange(v)}
            activeOpacity={0.75}
          >
            {selected && (
              <Ionicons
                name="checkmark-circle"
                size={13}
                color={Colors.primary}
              />
            )}
            <Text style={[S.durationLabel, selected && S.durationLabelSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DoctorProfileScreen({ navigation }) {
  const { user, userProfile: cachedProfile, signOut } = useAuth();
  const uid    = user?.uid;
  const insets = useSafeAreaInsets();

  const { profile, loading: profileLoading, setProfile } = useDoctorProfile(uid);

  // ── Profile edit state ────────────────────────────────────────────────────
  const [editMode,      setEditMode]      = useState(false);
  const [editName,      setEditName]      = useState('');
  const [editBio,       setEditBio]       = useState('');
  const [editPhoto,     setEditPhoto]     = useState(null); // local URI while editing
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // ── Schedule local state ───────────────────────────────────────────────────
  // All edits stay local until "Save Schedule" is pressed (Rule 4).
  const [schedule,             setSchedule]             = useState(DEFAULT_SCHEDULE);
  const [consultationDuration, setConsultationDuration] = useState(DEFAULT_DURATION);
  const [saving,               setSaving]               = useState(false);

  // ── Hydrate from Firestore once profile is fetched ────────────────────────
  useEffect(() => {
    if (!profile) return;

    // Merge with DEFAULT_SCHEDULE to guarantee all 7 day keys exist.
    // Doctors who registered before the schedule feature was added will have
    // no `schedule` field — merging produces a complete, valid starting state.
    if (profile.schedule && typeof profile.schedule === 'object') {
      const merged = {};
      DAYS.forEach(({ key }) => {
        merged[key] = profile.schedule[key] ?? DEFAULT_SCHEDULE[key];
      });
      setSchedule(merged);
    }

    if (profile.consultationDuration) {
      setConsultationDuration(profile.consultationDuration);
    }
  }, [profile]);

  // ── Time picker state ──────────────────────────────────────────────────────
  // pickerTarget: { day: string, field: 'start' | 'end' } | null
  // null = picker closed; non-null = picker open for that day/field.
  const [pickerTarget, setPickerTarget] = useState(null);

  // pickerDate: the Date value fed to DateTimePicker. Set when picker opens.
  const [pickerDate,   setPickerDate]   = useState(() => new Date());

  // pickerTemp: iOS only — tracks drum-roll position before the user taps Done.
  // Never committed until Done is pressed (prevents partial-scroll commits).
  const [pickerTemp,   setPickerTemp]   = useState(() => new Date());

  // ── Handler: toggle a day active/inactive ─────────────────────────────────
  const handleToggleDay = useCallback((dayKey, value) => {
    setSchedule(prev => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], active: value },
    }));
  }, []);

  // ── Handler: open the time picker for a specific day + field ─────────────
  const handleOpenPicker = useCallback((dayKey, field) => {
    const timeStr = schedule[dayKey]?.[field] ?? '09:00';
    const date    = parseTimeToDate(timeStr);
    setPickerTarget({ day: dayKey, field });
    setPickerDate(date);
    setPickerTemp(date); // seed iOS drum-roll at the current value
  }, [schedule]);

  // ── Internal: write a chosen Date back into schedule state ────────────────
  const commitPickedTime = useCallback((date, target) => {
    if (!target) return;
    const timeStr = formatDateToTime(date);
    setSchedule(prev => ({
      ...prev,
      [target.day]: {
        ...prev[target.day],
        [target.field]: timeStr,
      },
    }));
  }, []);

  // ── Handler: Android onChange (fires exactly once per interaction) ─────────
  const handleAndroidChange = useCallback((event, selectedDate) => {
    const target = pickerTarget; // capture ref before nulling
    setPickerTarget(null);       // unmount: Android dialog auto-dismissed
    if (event.type === 'set' && selectedDate) {
      commitPickedTime(selectedDate, target);
    }
    // type === 'dismissed' → user cancelled; discard, no state change
  }, [pickerTarget, commitPickedTime]);

  // ── Handler: iOS onChange (fires on every drum-roll tick) ─────────────────
  // Updates pickerTemp only — does NOT commit to schedule yet.
  const handleIOSChange = useCallback((_event, selectedDate) => {
    if (selectedDate) setPickerTemp(selectedDate);
  }, []);

  // ── Handler: iOS "Done" ───────────────────────────────────────────────────
  const handleIOSDone = useCallback(() => {
    const target = pickerTarget;
    setPickerTarget(null);
    commitPickedTime(pickerTemp, target);
  }, [pickerTarget, pickerTemp, commitPickedTime]);

  // ── Handler: iOS "Cancel" / backdrop tap ──────────────────────────────────
  const handleIOSCancel = useCallback(() => {
    setPickerTarget(null);
    // pickerTemp is discarded — schedule is unchanged
  }, []);

  // ── Handler: save schedule to Firestore ───────────────────────────────────
  const handleSaveSchedule = useCallback(async () => {
    if (!uid) {
      Alert.alert('Error', 'User session expired. Please sign in again.');
      return;
    }

    // Validate: for every active day, start must be strictly before end.
    // String comparison works correctly for 'HH:mm' format.
    for (const { key, label } of DAYS) {
      const day = schedule[key];
      if (!day) continue;
      if (day.active && day.start >= day.end) {
        Alert.alert(
          'Invalid Hours',
          `${label}: start time (${formatTime12(day.start)}) must be earlier ` +
          `than end time (${formatTime12(day.end)}).`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        schedule,
        consultationDuration,
        scheduleUpdatedAt: serverTimestamp(),
      });
      Alert.alert(
        'Saved ✓',
        'Your availability schedule has been updated successfully.',
      );
    } catch (err) {
      console.error('[DoctorProfile] save schedule:', err);
      Alert.alert('Error', 'Could not save your schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [schedule, consultationDuration, uid]);

  // ── Handler: enter / exit edit mode ──────────────────────────────────────
  const handleEnterEdit = useCallback(() => {
    setEditName(doctorName);
    setEditBio(about);
    setEditPhoto(null);
    setEditMode(true);
  }, [doctorName, about]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditPhoto(null);
  }, []);

  // ── Handler: pick a new profile photo ─────────────────────────────────────
  const handlePickPhoto = useCallback(async () => {
    if (!editMode) return;
    const result = await storageService.openGallery({ allowsEditing: true, aspect: [1, 1] });
    if (result?.uri) setEditPhoto(result.uri);
  }, [editMode]);

  // ── Handler: save profile (name + bio + optional photo) ───────────────────
  const handleSaveProfile = useCallback(async () => {
    if (!uid) return;
    setSavingProfile(true);
    try {
      let photoURL = profile?.photoURL ?? null;

      if (editPhoto) {
        setPhotoUploading(true);
        const uploadResult = await storageService.uploadDoctorPhoto(uid, editPhoto);
        setPhotoUploading(false);
        if (uploadResult?.success) photoURL = uploadResult.photoURL;
      }

      const updates = {
        name:      editName.trim() || doctorName,
        fullName:  editName.trim() || doctorName,
        about:     editBio.trim(),
        updatedAt: serverTimestamp(),
      };
      if (photoURL) updates.photoURL = photoURL;

      await Promise.all([
        updateDoc(doc(db, 'doctors', uid), updates),
        updateDoc(doc(db, 'users',   uid), {
          fullName:  updates.fullName,
          updatedAt: updates.updatedAt,
        }),
      ]);

      // Update local state so the new photo/name/bio renders immediately
      setProfile(prev => ({ ...prev, ...updates, photoURL }));

      setEditMode(false);
      setEditPhoto(null);
      Alert.alert('Saved ✓', 'Profile updated successfully.');
    } catch (err) {
      console.error('[DoctorProfile] save profile:', err);
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSavingProfile(false);
      setPhotoUploading(false);
    }
  }, [uid, editName, editBio, editPhoto, profile, doctorName, setProfile]);

  // ── Handler: sign out with confirmation ───────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  }, [signOut]);

  // ── Derived display values ─────────────────────────────────────────────────
  const doctorName  = profile?.fullName    ?? profile?.name ?? cachedProfile?.fullName ?? 'Doctor';
  const specialty   = profile?.specialty   ?? cachedProfile?.specialty   ?? '';
  const phone       = profile?.phoneNumber ?? cachedProfile?.phoneNumber ?? user?.phoneNumber ?? '';
  const about       = profile?.about       ?? '';
  const photoURL    = profile?.photoURL    ?? null;
  const rating      = profile?.averageRating  ?? 0;
  const reviewCount = profile?.totalReviews   ?? 0;

  const activeDayCount = useMemo(
    () => DAYS.filter(({ key }) => schedule[key]?.active).length,
    [schedule],
  );

  // ── Picker label (used in iOS modal title) ────────────────────────────────
  const pickerTitle = pickerTarget
    ? `${pickerTarget.field === 'start' ? 'Start' : 'End'} Time · ${
        pickerTarget.day.charAt(0).toUpperCase() + pickerTarget.day.slice(1)
      }`
    : '';

  // ─────────────────────────────────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <View style={[S.root, S.loadingRoot]}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={S.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <ScrollView
        style={S.scroll}
        contentContainerStyle={[
          S.scrollContent,
          { paddingBottom: Math.max(insets.bottom + Spacing.xl, Spacing.xxl) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── PROFILE HEADER ────────────────────────────────────────────────
            Full-bleed green card. paddingTop absorbs the status-bar height
            via safe-area insets so the avatar is never occluded.
            Settings gear sits in the absolute top-end corner (RTL-safe `end`).
        ─────────────────────────────────────────────────────────────────── */}
        <View style={[S.profileHeader, { paddingTop: insets.top + Spacing.lg }]}>

          {/* Settings / Edit toggle — absolute top-end corner */}
          {editMode ? (
            <TouchableOpacity
              style={[S.settingsIconBtn, { top: insets.top + Spacing.sm }]}
              onPress={handleCancelEdit}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-outline" size={24} color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[S.settingsIconBtn, { top: insets.top + Spacing.sm }]}
              onPress={() => navigation.navigate('Settings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="settings-outline" size={22} color={Colors.white} />
            </TouchableOpacity>
          )}

          {/* Edit profile pencil — absolute top-start corner */}
          {!editMode && (
            <TouchableOpacity
              style={[S.editProfileBtn, { top: insets.top + Spacing.sm }]}
              onPress={handleEnterEdit}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="pencil-outline" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}

          {/* Avatar */}
          <Avatar
            name={editMode ? editName : doctorName}
            size={80}
            photoURL={editPhoto ?? photoURL}
            onPress={handlePickPhoto}
            editMode={editMode}
          />

          {/* Name — editable in edit mode */}
          {editMode ? (
            <TextInput
              style={S.profileNameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.55)"
              maxLength={60}
              textAlign="center"
            />
          ) : (
            <Text style={S.profileName} numberOfLines={2}>
              Dr. {doctorName}
            </Text>
          )}

          {/* Specialty badge */}
          {specialty ? (
            <View style={S.specialtyBadge}>
              <Ionicons name="briefcase-outline" size={12} color={Colors.primary} />
              <Text style={S.specialtyText}>{specialty}</Text>
            </View>
          ) : null}

          {/* Stats strip */}
          <View style={S.statsStrip}>
            <View style={S.statItem}>
              <Text style={S.statValue}>{activeDayCount}</Text>
              <Text style={S.statLabel}>{'Active\nDays'}</Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statItem}>
              <Text style={S.statValue}>
                {rating > 0 ? rating.toFixed(1) : '—'}
              </Text>
              <Text style={S.statLabel}>
                {reviewCount > 0 ? `${reviewCount} Reviews` : 'Rating'}
              </Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statItem}>
              <Text style={S.statValue}>{consultationDuration}</Text>
              <Text style={S.statLabel}>{'Min\nPer Slot'}</Text>
            </View>
          </View>
        </View>

        {/* ── PERSONAL INFO CARD ────────────────────────────────────────────
            Read-only. Phone + About/bio. Hidden entirely if both are empty.
        ─────────────────────────────────────────────────────────────────── */}
        <View style={S.card}>
          <View style={S.cardHeader}>
            <View style={S.cardHeaderIcon}>
              <Ionicons name="person-outline" size={16} color={Colors.primary} />
            </View>
            <Text style={S.cardTitle}>Personal Information</Text>
          </View>

          {phone ? (
            <View style={S.infoRow}>
              <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
              <Text style={S.infoLabel}>Phone</Text>
              <Text style={S.infoValue} numberOfLines={1}>{phone}</Text>
            </View>
          ) : null}

          <View style={[S.infoRow, { alignItems: 'flex-start' }]}>
            <Ionicons
              name="document-text-outline"
              size={14}
              color={Colors.textSecondary}
              style={{ marginTop: editMode ? 10 : 2 }}
            />
            <Text style={S.infoLabel}>About</Text>
            {editMode ? (
              <TextInput
                style={S.bioInput}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Write a short bio about yourself…"
                placeholderTextColor={Colors.textSecondary}
                multiline
                maxLength={400}
                textAlignVertical="top"
              />
            ) : (
              <Text style={[S.infoValue, S.infoValueMultiline]}>
                {about || '—'}
              </Text>
            )}
          </View>

          {editMode && (
            <TouchableOpacity
              style={[S.saveProfileBtn, savingProfile && S.saveBtnDisabled]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
              activeOpacity={0.85}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
              )}
              <Text style={S.saveBtnText}>
                {photoUploading ? 'Uploading photo…' : savingProfile ? 'Saving…' : 'Save Profile'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── WORKING HOURS CARD ────────────────────────────────────────────
            The primary deliverable: 7 DayRows + Consultation Duration.
        ─────────────────────────────────────────────────────────────────── */}
        <View style={S.card}>
          <View style={S.cardHeader}>
            <View style={S.cardHeaderIcon}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
            </View>
            <Text style={S.cardTitle}>Working Hours</Text>
          </View>

          <Text style={S.cardSubtitle}>
            Toggle days on or off and tap a time pill to adjust your working window.
          </Text>

          {/* ── 7 Day Rows ────────────────────────────────────────────────── */}
          <View style={S.daysContainer}>
            {DAYS.map(({ key, label }, idx) => {
              const day = schedule[key] ?? DEFAULT_SCHEDULE[key];
              return (
                <React.Fragment key={key}>
                  {idx > 0 && <View style={S.rowDivider} />}
                  <DayRow
                    label={label}
                    active={day.active}
                    start={day.start}
                    end={day.end}
                    onToggle={v => handleToggleDay(key, v)}
                    onPressStart={() => handleOpenPicker(key, 'start')}
                    onPressEnd={()   => handleOpenPicker(key, 'end')}
                  />
                </React.Fragment>
              );
            })}
          </View>

          {/* ── Consultation Duration ──────────────────────────────────────── */}
          <View style={S.durationSection}>
            <View style={S.durationSectionHeader}>
              <Ionicons
                name="hourglass-outline"
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={S.durationSectionTitle}>Consultation Duration</Text>
            </View>
            <Text style={S.durationSectionHint}>
              Duration of each bookable appointment slot.
            </Text>
            <DurationSegment
              value={consultationDuration}
              onChange={setConsultationDuration}
            />
          </View>
        </View>

        {/* ── SAVE BUTTON ────────────────────────────────────────────────────
            Positioned below the card. The doctor scrolls down to act —
            this reduces accidental taps while adjusting day rows above.
        ─────────────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[S.saveBtn, saving && S.saveBtnDisabled]}
          onPress={handleSaveSchedule}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="save-outline" size={20} color={Colors.white} />
          )}
          <Text style={S.saveBtnText}>
            {saving ? 'Saving…' : 'Save Schedule'}
          </Text>
        </TouchableOpacity>

        {/* ── ACCOUNT ACTIONS ────────────────────────────────────────────────
            Account Settings row + Sign Out row. Two rows separated by a
            hairline divider, wrapped in a card.
        ─────────────────────────────────────────────────────────────────── */}
        <View style={S.accountCard}>
          <TouchableOpacity
            style={S.actionRow}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <View style={S.actionIconWrap}>
              <Ionicons
                name="settings-outline"
                size={18}
                color={Colors.textSecondary}
              />
            </View>
            <Text style={S.actionLabel}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={S.rowDivider} />

          <TouchableOpacity
            style={S.actionRow}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <View style={[S.actionIconWrap, S.actionIconDanger]}>
              <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            </View>
            <Text style={[S.actionLabel, S.actionLabelDanger]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── TIME PICKER ──────────────────────────────────────────────────────
          Rendered OUTSIDE the ScrollView so it floats over all content.

          ANDROID:
            Plain <DateTimePicker> mounted only when pickerTarget !== null.
            The OS presents it as a native modal dialog automatically.
            After onChange fires (set or dismissed), we null pickerTarget
            to unmount — the OS has already closed its dialog by then.

          iOS:
            <Modal> bottom-sheet wrapping a spinner-mode <DateTimePicker>.
            Cancel / Done buttons control whether pickerTemp is committed.
            Backdrop touch triggers Cancel.
      ─────────────────────────────────────────────────────────────────────── */}

      {/* Android picker */}
      {pickerTarget !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={handleAndroidChange}
          minuteInterval={15}
        />
      )}

      {/* iOS picker sheet */}
      {pickerTarget !== null && Platform.OS === 'ios' && (
        <Modal
          transparent
          animationType="slide"
          visible
          onRequestClose={handleIOSCancel}
          statusBarTranslucent
        >
          <View style={S.pickerBackdrop}>

            {/* Semi-transparent backdrop — tap to cancel */}
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={handleIOSCancel}
            />

            {/* Bottom sheet */}
            <View style={[S.pickerSheet, { paddingBottom: insets.bottom }]}>

              {/* Sheet header: Cancel | Title | Done */}
              <View style={S.pickerSheetHeader}>
                <TouchableOpacity
                  onPress={handleIOSCancel}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={S.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>

                <Text style={S.pickerTitle} numberOfLines={1}>
                  {pickerTitle}
                </Text>

                <TouchableOpacity
                  onPress={handleIOSDone}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={S.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* UIPickerView drum-roll spinner */}
              <DateTimePicker
                value={pickerTemp}
                mode="time"
                display="spinner"
                onChange={handleIOSChange}
                minuteInterval={15}
                style={S.pickerControl}
                textColor={Colors.text}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// RTL RULE: Zero marginLeft/Right, paddingLeft/Right, borderLeftWidth/Right,
// or positional left/right. Logical properties exclusively.
// Symmetric properties (paddingHorizontal, paddingVertical, gap) are fine.
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // ── Root ──────────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingRoot: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Profile Header ─────────────────────────────────────────────────────────
  // paddingTop is set inline via `insets.top + Spacing.lg`
  profileHeader: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  // Settings gear: absolute, RTL-safe `end` instead of `right`
  settingsIconBtn: {
    position: 'absolute',
    end: Spacing.md,
    // `top` is set inline via `insets.top + Spacing.sm`
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
  },

  // ── Avatar ────────────────────────────────────────────────────────────────
  // White border + semi-transparent white fill to float above the green BG
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: '800',
    color: Colors.white,
  },

  // ── Doctor name & specialty ───────────────────────────────────────────────
  profileName: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.white,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  specialtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginTop: Spacing.xs,
    gap: 4,
  },
  specialtyText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Stats strip ───────────────────────────────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: Colors.white,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
    lineHeight: 14,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },

  // ── Personal info rows ────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.xs,
  },
  infoLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    width: 48,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  infoValueMultiline: {
    lineHeight: 20,
  },

  // ── Days container (bordered box wrapping all 7 DayRows) ──────────────────
  daysContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },

  // ── Single day row ─────────────────────────────────────────────────────────
  // LTR: [Day name (flex:1)] … [Switch]
  // RTL: [Switch] … [Day name (flex:1)]   ← flexDirection:'row' reverses auto
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.white,
    gap: Spacing.sm,
    minHeight: 62,
  },
  dayLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  dayLabelOff: {
    color: Colors.textSecondary,
  },
  dayOffLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  daySwitch: {
    flexShrink: 0,
  },

  // ── Time range (Start – End) ───────────────────────────────────────────────
  timeRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeSep: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '300',
  },

  // ── Time button pill ───────────────────────────────────────────────────────
  timeBtn: {
    backgroundColor: Colors.primary + '12',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '35',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    alignItems: 'center',
    minWidth: 62,
  },
  timeBtnLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  timeBtnValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeBtnValue: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Row divider (hairline between day rows, account actions) ──────────────
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // ── Consultation duration section ─────────────────────────────────────────
  durationSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  durationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  durationSectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  durationSectionHint: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },

  // ── Duration segment control (pill-trough) ────────────────────────────────
  durationSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 3,
  },
  durationOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  durationOptionSelected: {
    backgroundColor: Colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  durationLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  durationLabelSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // ── Save Schedule button ───────────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
  },
  saveBtnDisabled: {
    opacity: 0.62,
    elevation: 0,
    shadowOpacity: 0,
  },
  saveBtnText: {
    fontSize: FontSizes.md,
    fontWeight: '800',
    color: Colors.white,
  },

  // ── Account actions card ───────────────────────────────────────────────────
  accountCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionIconDanger: {
    backgroundColor: Colors.error + '18',
  },
  actionLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  actionLabelDanger: {
    color: Colors.error,
  },

  // ── iOS time-picker modal ──────────────────────────────────────────────────
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.46)',
    justifyContent: 'flex-end',
  },
  // borderTopStartRadius / borderTopEndRadius: RTL-safe logical corner radii.
  // Maps to top-left/top-right in LTR and top-right/top-left in RTL.
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopStartRadius: BorderRadius.xl,
    borderTopEndRadius: BorderRadius.xl,
    paddingTop: Spacing.xs,
    // paddingBottom set inline via insets.bottom
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.sm,
  },
  pickerCancelText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pickerDoneText: {
    fontSize: FontSizes.sm,
    fontWeight: '800',
    color: Colors.primary,
  },
  pickerControl: {
    height: 200,
  },

  // ── Edit profile ──────────────────────────────────────────────────────────
  editProfileBtn: {
    position: 'absolute',
    start: Spacing.md,
    padding: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  profileNameInput: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.white,
    marginTop: Spacing.sm,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.55)',
    paddingBottom: 4,
    minWidth: 180,
  },
  bioInput: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minHeight: 80,
    marginStart: Spacing.xs,
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
});
