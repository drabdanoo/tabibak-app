import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import optimizedFirestoreService from '../../services/firestoreService.optimized';
import DoctorCard from '../../components/DoctorCard';
import { Colors, Spacing, FontSizes } from '../../config/theme';

// Debounce hook
const useDebounce = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

const PAGE_SIZE = 20;

const HomeScreen = ({ navigation }) => {
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState(['All']);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 450);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchSpecialties();
    // initial load
    loadDoctors({ reset: true });
  }, []);

  useEffect(() => {
    // trigger search/filter
    loadDoctors({ reset: true });
  }, [debouncedSearch, selectedSpecialty]);

  const fetchSpecialties = async () => {
    const res = await optimizedFirestoreService.getSpecialties();
    if (res.success) setSpecialties(res.specialties || ['All']);
  };

  const buildFilters = useCallback(() => {
    const filters = {};
    if (selectedSpecialty && selectedSpecialty !== 'All') filters.specialty = selectedSpecialty;
    if (debouncedSearch && debouncedSearch.trim()) filters.searchText = debouncedSearch.trim();
    return filters;
  }, [selectedSpecialty, debouncedSearch]);

  const loadDoctors = async ({ reset = false } = {}) => {
    if (reset) {
      setLoading(true);
      setHasMore(true);
      setLastVisible(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const filters = buildFilters();
      const res = await optimizedFirestoreService.getDoctors(filters, PAGE_SIZE, reset ? null : lastVisible);
      if (res.success) {
        if (reset) {
          setDoctors(res.doctors);
        } else {
          setDoctors(prev => [...prev, ...res.doctors]);
        }
        setLastVisible(res.lastVisible || null);
        setHasMore(res.hasMore);
      }
    } catch (error) {
      console.error('Error loading doctors (HomeScreen):', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    loadDoctors({ reset: false });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDoctors({ reset: true });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={Colors.gray} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors, specialties or hospitals"
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor={Colors.gray}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={18} color={Colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {specialties.map(spec => (
          <TouchableOpacity
            key={spec}
            style={[styles.chip, selectedSpecialty === spec && styles.chipActive]}
            onPress={() => setSelectedSpecialty(spec)}
          >
            <Text style={[styles.chipText, selectedSpecialty === spec && styles.chipTextActive]}>{spec}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item }) => (
    <DoctorCard doctor={item} onPress={(id) => navigation.navigate('DoctorDetails', { doctorId: id })} />
  );

  const ListFooter = () => loadingMore ? (
    <View style={styles.footer}><ActivityIndicator size="small" color={Colors.primary} /></View>
  ) : null;

  if (loading && doctors.length === 0) {
    return (
      <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /><Text style={{ marginTop: 8 }}>Loading doctors...</Text></View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={doctors}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={ListFooter}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing.lg }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.md, backgroundColor: Colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 10, borderRadius: 10 },
  searchInput: { flex: 1, fontSize: FontSizes.md, color: Colors.text },
  filterScroll: { marginTop: Spacing.sm },
  filterContent: { paddingHorizontal: Spacing.xs },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray, marginRight: Spacing.sm },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.text, fontSize: FontSizes.sm },
  chipTextActive: { color: Colors.white },
  footer: { padding: Spacing.md, alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

export default HomeScreen;
