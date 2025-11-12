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