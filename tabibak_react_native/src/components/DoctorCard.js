import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../config/theme';

const DoctorCard = ({ doctor, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress && onPress(doctor.id)} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={styles.imageContainer}>
          {doctor.photoURL ? (
            <Image source={{ uri: doctor.photoURL }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="person" size={36} color={Colors.gray} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{doctor.name || 'Dr. Unknown'}</Text>
          <Text style={styles.specialty} numberOfLines={1}>{doctor.specialty || 'General'}</Text>

          <View style={styles.metaRow}>
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color={Colors.warning} />
              <Text style={styles.metaText}>{(doctor.rating || 0).toFixed(1)}</Text>
              <Text style={styles.metaSmall}> ({doctor.reviewCount || 0})</Text>
            </View>

            {doctor.fees != null && (
              <Text style={styles.fees}>${doctor.fees}</Text>
            )}
          </View>
        </View>

        <View style={styles.chev}>
          <Ionicons name="chevron-forward" size={22} color={Colors.gray} />
        </View>
      </View>

      {doctor.bio ? <Text style={styles.bio} numberOfLines={2}>{doctor.bio}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  imageContainer: {
    marginRight: Spacing.md
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 36
  },
  placeholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center'
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text
  },
  specialty: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    marginTop: 4
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    justifyContent: 'space-between'
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginLeft: 6
  },
  metaSmall: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary
  },
  fees: {
    fontSize: FontSizes.md,
    color: Colors.text,
    fontWeight: '600'
  },
  chev: {
    marginLeft: Spacing.sm
  },
  bio: {
    marginTop: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: FontSizes.sm
  }
});

export default memo(DoctorCard);
