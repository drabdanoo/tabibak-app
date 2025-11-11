/**
 * Optimized Doctor List Screen with Performance Enhancements
 * 
 * Key Optimizations:
 * 1. React.memo for component memoization
 * 2. useCallback for stable function references
 * 3. useMemo for expensive computations
 * 4. Optimized FlatList with proper keys and props
 * 5. Debounced search to reduce queries
 * 6. Image optimization with caching
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import optimizedFirestoreService from '../../services/firestoreService.optimized';
import { colors, spacing, typography } from '../../config/theme';

// Debounce utility function
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Memoized Doctor Card Component
const DoctorCard = memo(({ doctor, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.doctorCard}
      onPress={() => onPress(doctor.id)}
      activeOpacity={0.7}
    >
      <View style={styles.doctorCardContent}>
        <View style={styles.doctorImageContainer}>
          {doctor.photoURL ? (
            <Image 
              source={{ uri: doctor.photoURL }} 
              style={styles.doctorImage}
              resizeMode="cover"
              // Enable caching
              cache="force-cache"
            />
          ) : (
            <View style={styles.doctorImagePlaceholder}>
              <Ionicons name="person" size={40} color={colors.gray} />
            </View>
          )}
        </View>

        <View style={styles.doctorInfo}>
          <Text style={styles.doctorName} numberOfLines={1}>
            {doctor.name || 'Dr. Unknown'}
          </Text>
          <Text style={styles.doctorSpecialty} numberOfLines={1}>
            {doctor.specialty || 'General'}
          </Text>
          
          {doctor.hospital && (
            <View style={styles.doctorDetail}>
              <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.doctorDetailText} numberOfLines={1}>
                {doctor.hospital}
              </Text>
            </View>
          )}

          {doctor.experience && (
            <View style={styles.doctorDetail}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.doctorDetailText} numberOfLines={1}>
                {doctor.experience} years
              </Text>
            </View>
          )}

          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.ratingText}>
              {doctor.rating?.toFixed(1) || '0.0'} ({doctor.reviewCount || 0})
            </Text>
          </View>

          {doctor.fees && (
            <Text style={styles.feesText}>
              ${doctor.fees}
            </Text>
          )}
        </View>

        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={24} color={colors.gray} />
        </View>
      </View>

      {doctor.bio && (
        <Text style={styles.doctorBio} numberOfLines={2}>
          {doctor.bio}
        </Text>
      )}
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.doctor.id === nextProps.doctor.id &&
    prevProps.doctor.rating === nextProps.doctor.rating &&
    prevProps.doctor.reviewCount === nextProps.doctor.reviewCount
  );
});

DoctorCard.displayName = 'DoctorCard';

// Memoized Specialty Chip Component
const SpecialtyChip = memo(({ specialty, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        isSelected && styles.filterChipActive
      ]}
      onPress={() => onPress(specialty)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          isSelected && styles.filterChipTextActive
        ]}
      >
        {specialty}
      </Text>
    </TouchableOpacity>
  );
});

SpecialtyChip.displayName = 'SpecialtyChip';

// Main Component
export default function OptimizedDoctorListScreen({ navigation }) {
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState(['All']);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Debounce search text for better performance
  const debouncedSearchText = useDebounce(searchText, 500);

  // Load specialties on mount
  useEffect(() => {
    loadSpecialties();
  }, []);

  // Load doctors when specialty or search changes
  useEffect(() => {
    loadDoctors();
  }, [selectedSpecialty, debouncedSearchText]);

  const loadSpecialties = async () => {
    const result = await optimizedFirestoreService.getSpecialties();
    if (result.success) {
      setSpecialties(result.specialties);
    }
  };

  const loadDoctors = useCallback(async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const filters = {
        specialty: selectedSpecialty !== 'All' ? selectedSpecialty : null,
        searchText: debouncedSearchText
      };

      const result = await optimizedFirestoreService.getDoctors(filters, 20);
      
      if (result.success) {
        setDoctors(result.doctors);
        setLastVisible(result.lastVisible);
        setHasMore(result.hasMore);
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSpecialty, debouncedSearchText]);

  const loadMoreDoctors = useCallback(async () => {
    if (loadingMore || !hasMore || !lastVisible) return;

    try {
      setLoadingMore(true);

      const filters = {
        specialty: selectedSpecialty !== 'All' ? selectedSpecialty : null,
        searchText: debouncedSearchText
      };

      const result = await optimizedFirestoreService.getDoctors(filters, 20, lastVisible);
      
      if (result.success && result.doctors.length > 0) {
        setDoctors(prev => [...prev, ...result.doctors]);
        setLastVisible(result.lastVisible);
        setHasMore(result.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more doctors:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastVisible, selectedSpecialty, debouncedSearchText]);

  const handleSpecialtySelect = useCallback((specialty) => {
    setSelectedSpecialty(specialty);
    setLastVisible(null);
    setHasMore(true);
  }, []);

  const handleDoctorPress = useCallback((doctorId) => {
    navigation.navigate('DoctorDetails', { doctorId });
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setLastVisible(null);
    setHasMore(true);
    loadDoctors(true);
  }, [loadDoctors]);

  const handleClearSearch = useCallback(() => {
    setSearchText('');
  }, []);

  // Memoized render functions
  const renderDoctorCard = useCallback(({ item }) => (
    <DoctorCard 
      doctor={item} 
      onPress={handleDoctorPress}
    />
  ), [handleDoctorPress]);

  const keyExtractor = useCallback((item) => item.id, []);

  const renderHeader = useMemo(() => (
    <View style={styles.header}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors, specialties..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor={colors.gray}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={20} color={colors.gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Specialty Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {specialties.map((specialty) => (
          <SpecialtyChip
            key={specialty}
            specialty={specialty}
            isSelected={selectedSpecialty === specialty}
            onPress={handleSpecialtySelect}
          />
        ))}
      </ScrollView>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>
          {doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'} found
        </Text>
        {debouncedSearchText && (
          <Text style={styles.searchingText}>
            Searching for "{debouncedSearchText}"
          </Text>
        )}
      </View>
    </View>
  ), [searchText, specialties, selectedSpecialty, doctors.length, debouncedSearchText, handleClearSearch, handleSpecialtySelect]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  }, [loadingMore]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color={colors.gray} />
      <Text style={styles.emptyText}>No doctors found</Text>
      <Text style={styles.emptySubtext}>
        Try adjusting your search or filters
      </Text>
      {selectedSpecialty !== 'All' && (
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={() => handleSpecialtySelect('All')}
        >
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [selectedSpecialty, handleSpecialtySelect]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading doctors...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={doctors}
        renderItem={renderDoctorCard}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMoreDoctors}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[
          styles.listContent,
          doctors.length === 0 && styles.listContentEmpty
        ]}
        showsVerticalScrollIndicator={false}
        // Performance optimizations
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        // Don't re-render unnecessarily
        extraData={selectedSpecialty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    height: 48,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  filterContainer: {
    marginBottom: spacing.md,
  },
  filterContent: {
    paddingRight: spacing.md,
  },
  filterChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.white,
  },
  resultsHeader: {
    marginTop: spacing.xs,
  },
  resultsText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  searchingText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  doctorCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doctorCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorImageContainer: {
    marginRight: spacing.md,
  },
  doctorImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  doctorImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  doctorSpecialty: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  doctorDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  doctorDetailText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ratingText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  feesText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.success,
    marginTop: spacing.xs,
  },
  arrowContainer: {
    marginLeft: spacing.sm,
  },
  doctorBio: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  loadingMoreText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  resetButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  resetButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
});
