import React, { useState, useEffect, useCallback } from 'react';
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
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import firestoreService from '../../services/firestoreService';
import { Colors, Spacing, FontSizes } from '../../config/theme';

// Create proper mappings to match the expected variable names in the styles
const colors = Colors;
const spacing = Spacing;
const typography = {
  sizes: FontSizes
};

export default function DoctorListScreen({ navigation }) {
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [specialties, setSpecialties] = useState(['All']);
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadSpecialties();
    loadDoctors();
  }, []);

  useEffect(() => {
    filterDoctors();
  }, [searchText, selectedSpecialty, doctors]);

  const loadSpecialties = async () => {
    const result = await firestoreService.getSpecialties();
    if (result.success) {
      setSpecialties(result.specialties);
    }
  };

  const loadDoctors = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const filters = {
        specialty: selectedSpecialty !== 'All' ? selectedSpecialty : null
      };

      const result = await firestoreService.getDoctors(filters, 20);
      
      if (result.success) {
        setDoctors(result.doctors);
        setLastVisible(result.lastVisible);
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreDoctors = async () => {
    if (loadingMore || !lastVisible) return;

    try {
      setLoadingMore(true);

      const filters = {
        specialty: selectedSpecialty !== 'All' ? selectedSpecialty : null
      };

      const result = await firestoreService.getDoctors(filters, 20, lastVisible);
      
      if (result.success && result.doctors.length > 0) {
        setDoctors(prev => [...prev, ...result.doctors]);
        setLastVisible(result.lastVisible);
      }
    } catch (error) {
      console.error('Error loading more doctors:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const filterDoctors = () => {
    let filtered = [...doctors];

    // Filter by specialty
    if (selectedSpecialty !== 'All') {
      filtered = filtered.filter(doc => doc.specialty === selectedSpecialty);
    }

    // Filter by search text
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.name?.toLowerCase().includes(searchLower) ||
        doc.specialty?.toLowerCase().includes(searchLower) ||
        doc.bio?.toLowerCase().includes(searchLower) ||
        doc.hospital?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredDoctors(filtered);
  };

  const handleSpecialtySelect = (specialty) => {
    setSelectedSpecialty(specialty);
    // Reload doctors with new filter
    loadDoctors();
  };

  const onRefresh = useCallback(() => {
    loadDoctors(true);
  }, [selectedSpecialty]);

  const renderDoctorCard = ({ item }) => (
    <TouchableOpacity
      style={styles.doctorCard}
      onPress={() => navigation.navigate('DoctorDetails', { doctorId: item.id })}
    >
      <View style={styles.doctorCardContent}>
        <View style={styles.doctorImageContainer}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.doctorImage} />
          ) : (
            <View style={styles.doctorImagePlaceholder}>
              <Ionicons name="person" size={40} color={colors.gray} />
            </View>
          )}
        </View>

        <View style={styles.doctorInfo}>
          <Text style={styles.doctorName}>{item.name || 'Dr. Unknown'}</Text>
          <Text style={styles.doctorSpecialty}>{item.specialty || 'General'}</Text>
          
          {item.hospital && (
            <View style={styles.doctorDetail}>
              <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.doctorDetailText}>{item.hospital}</Text>
            </View>
          )}

          {item.experience && (
            <View style={styles.doctorDetail}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.doctorDetailText}>{item.experience} years experience</Text>
            </View>
          )}

          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.ratingText}>
              {item.rating?.toFixed(1) || '0.0'} ({item.reviewCount || 0} reviews)
            </Text>
          </View>
        </View>

        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={24} color={colors.gray} />
        </View>
      </View>

      {item.bio && (
        <Text style={styles.doctorBio} numberOfLines={2}>
          {item.bio}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
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
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
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
          <TouchableOpacity
            key={specialty}
            style={[
              styles.filterChip,
              selectedSpecialty === specialty && styles.filterChipActive
            ]}
            onPress={() => handleSpecialtySelect(specialty)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedSpecialty === specialty && styles.filterChipTextActive
              ]}
            >
              {specialty}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.resultsText}>
        {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'} found
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color={colors.gray} />
      <Text style={styles.emptyText}>No doctors found</Text>
      <Text style={styles.emptySubtext}>
        Try adjusting your search or filters
      </Text>
    </View>
  );

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
        data={filteredDoctors}
        renderItem={renderDoctorCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        onEndReached={loadMoreDoctors}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[
          styles.listContent,
          filteredDoctors.length === 0 && styles.listContentEmpty
        ]}
        showsVerticalScrollIndicator={false}
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
  resultsText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
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
  },
});

