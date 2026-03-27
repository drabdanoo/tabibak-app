/**
 * DoctorMapScreen
 * ───────────────
 * Displays all seeded doctors that have GPS coordinates as pins on a Google Map.
 * Tapping a pin shows a callout (name + specialty + address).
 * Tapping the callout navigates to DoctorDetails.
 *
 * Data: Firestore `doctors` collection, filtered client-side for docs
 * where latitude & longitude are not null.
 *
 * Requires: react-native-maps + Maps SDK for Android API key in AndroidManifest.xml
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

const { width: SW } = Dimensions.get('window');

// Mosul / Nineveh center
const INITIAL_REGION = {
  latitude:      36.335,
  longitude:     43.119,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'DR';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

const DoctorMapScreen = ({ navigation, route }) => {
  // Optional: navigate here with { focusDoctor: doctorObject } to zoom
  // straight to one clinic pin (e.g. from DoctorDetailsScreen).
  const focusDoctor = route?.params?.focusDoctor ?? null;

  const [allDoctors, setAllDoctors]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [selectedId, setSelectedId]   = useState(focusDoctor?.id ?? null);
  const mapRef = useRef(null);

  // ── Fetch doctors ────────────────────────────────────────────────────────
  useEffect(() => {
    // Focus mode: just show the one doctor — no Firestore fetch needed
    if (focusDoctor) {
      if (focusDoctor.latitude && focusDoctor.longitude) {
        setAllDoctors([focusDoctor]);
      }
      setLoading(false);
      return;
    }

    // Browse mode: fetch all seeded doctors with coordinates
    let cancelled = false;
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        setError(null);

        const snap = await getDocs(
          query(collection(db, 'doctors'), where('isSeeded', '==', true))
        );

        if (cancelled) return;

        setAllDoctors(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => d.latitude && d.longitude)
        );
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDoctors();
    return () => { cancelled = true; };
  }, []);

  // ── Zoom to focusDoctor once doctors are loaded ──────────────────────────
  useEffect(() => {
    if (!mapRef.current || loading) return;

    if (focusDoctor?.latitude && focusDoctor?.longitude) {
      // Zoom tightly to the specific clinic
      mapRef.current.animateToRegion(
        {
          latitude:       focusDoctor.latitude,
          longitude:      focusDoctor.longitude,
          latitudeDelta:  0.008,
          longitudeDelta: 0.008,
        },
        600,
      );
      return;
    }

    // No focusDoctor — fit to all visible pins
    if (filtered.length > 0) {
      mapRef.current.fitToCoordinates(
        filtered.map(d => ({ latitude: d.latitude, longitude: d.longitude })),
        { edgePadding: { top: 80, right: 40, bottom: 80, left: 40 }, animated: true },
      );
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter by search text ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return allDoctors;
    const q = search.trim().toLowerCase();
    return allDoctors.filter(
      d =>
        (d.name      || '').toLowerCase().includes(q) ||
        (d.specialty || '').toLowerCase().includes(q) ||
        (d.address   || '').toLowerCase().includes(q),
    );
  }, [allDoctors, search]);

  // ── Fit to search results (only when user is actively searching) ─────────
  useEffect(() => {
    if (!mapRef.current || loading || focusDoctor || !search.trim()) return;
    if (filtered.length === 0) return;
    mapRef.current.fitToCoordinates(
      filtered.map(d => ({ latitude: d.latitude, longitude: d.longitude })),
      { edgePadding: { top: 80, right: 40, bottom: 80, left: 40 }, animated: true },
    );
  }, [filtered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate to DoctorDetails ────────────────────────────────────────────
  const handleCalloutPress = useCallback(
    doctor => {
      navigation.navigate('DoctorDetails', { doctor, doctorId: doctor.id });
    },
    [navigation],
  );

  // ── Zoom to selected marker ──────────────────────────────────────────────
  const handleMarkerPress = useCallback(doctor => {
    setSelectedId(doctor.id);
    mapRef.current?.animateToRegion(
      {
        latitude:      doctor.latitude,
        longitude:     doctor.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      350,
    );
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={S.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={S.loadingText}>Loading doctors map…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={S.center}>
        <Ionicons name="alert-circle-outline" size={56} color={Colors.error} />
        <Text style={S.errorTitle}>Failed to load map</Text>
        <Text style={S.errorSub}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={S.root}>
      {/* ── Map ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={S.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton
        toolbarEnabled={false}
      >
        {filtered.map(doctor => (
          <Marker
            key={doctor.id}
            coordinate={{ latitude: doctor.latitude, longitude: doctor.longitude }}
            pinColor={
              selectedId === doctor.id ? Colors.secondary : Colors.primary
            }
            onPress={() => handleMarkerPress(doctor)}
          >
            <Callout
              tooltip={false}
              onPress={() => handleCalloutPress(doctor)}
              style={S.callout}
            >
              <View style={S.calloutInner}>
                <Text style={S.calloutName} numberOfLines={2}>
                  {doctor.name}
                </Text>
                {!!doctor.specialty && (
                  <Text style={S.calloutSpecialty} numberOfLines={1}>
                    {doctor.specialty}
                  </Text>
                )}
                {!!doctor.address && (
                  <View style={S.calloutAddressRow}>
                    <Ionicons name="location-outline" size={11} color={Colors.textSecondary} />
                    <Text style={S.calloutAddress} numberOfLines={2}>
                      {doctor.address}
                    </Text>
                  </View>
                )}
                <View style={S.calloutBtn}>
                  <Text style={S.calloutBtnText}>View Profile →</Text>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* ── Search overlay ──────────────────────────────────────────── */}
      <SafeAreaView style={S.searchOverlay} pointerEvents="box-none">
        {/* Back button */}
        <TouchableOpacity
          style={S.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>

        {/* Search bar — only shown in browse mode */}
        {!focusDoctor && (
          <View style={S.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
            <TextInput
              style={S.searchInput}
              placeholder="Search name, specialty, address…"
              placeholderTextColor={Colors.gray}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Ionicons name="close-circle" size={16} color={Colors.gray} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Title bar in focus mode */}
        {!!focusDoctor && (
          <View style={S.focusTitle}>
            <Text style={S.focusTitleText} numberOfLines={1}>
              {focusDoctor.name || 'Clinic Location'}
            </Text>
            {!!focusDoctor.specialty && (
              <Text style={S.focusSubText} numberOfLines={1}>
                {focusDoctor.specialty}
              </Text>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* ── Count badge ─────────────────────────────────────────────── */}
      <View style={S.countBadge} pointerEvents="none">
        <Ionicons name="medical-outline" size={13} color={Colors.white} />
        <Text style={S.countText}>
          {focusDoctor
            ? (focusDoctor.name || 'Clinic location')
            : `${filtered.length} doctor${filtered.length !== 1 ? 's' : ''}`}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Loading / Error ──────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    gap: 12,
  },
  loadingText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
  },
  errorSub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Search overlay ───────────────────────────────────────────────────────
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'android' ? Spacing.lg : Spacing.sm,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
    height: 44,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    paddingVertical: 0,
  },

  // ── Count badge ──────────────────────────────────────────────────────────
  countBadge: {
    position: 'absolute',
    bottom: Spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 4,
    gap: 5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  countText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.white,
  },

  // ── Focus mode title ─────────────────────────────────────────────────────
  focusTitle: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    justifyContent: 'center',
  },
  focusTitleText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  focusSubText: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    marginTop: 1,
  },

  // ── Callout ──────────────────────────────────────────────────────────────
  callout: {
    width: Math.min(SW * 0.65, 240),
  },
  calloutInner: {
    padding: 10,
    gap: 4,
  },
  calloutName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  calloutSpecialty: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  calloutAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
    marginTop: 2,
  },
  calloutAddress: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  calloutBtn: {
    marginTop: 6,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  calloutBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default DoctorMapScreen;
