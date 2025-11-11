import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../config/theme';

const ProfileSetupScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const { createProfile } = useAuth();

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name');
      return;
    }

    if (!dateOfBirth.trim()) {
      Alert.alert('Required Field', 'Please enter your date of birth');
      return;
    }

    if (!gender) {
      Alert.alert('Required Field', 'Please select your gender');
      return;
    }

    setLoading(true);

    try {
      const success = await createProfile({
        fullName: fullName.trim(),
        dateOfBirth,
        gender
      });

      if (success) {
        // Navigation will be handled by AuthContext
        // User will be redirected to Patient stack
      } else {
        Alert.alert('Error', 'Failed to create profile. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      console.error('Profile creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Ionicons name="person-add" size={80} color={Colors.primary} />
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Please provide your information
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={Colors.gray}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={Colors.gray}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'male' && styles.genderButtonSelected
                ]}
                onPress={() => setGender('male')}
              >
                <Ionicons 
                  name="male" 
                  size={24} 
                  color={gender === 'male' ? Colors.white : Colors.primary} 
                />
                <Text style={[
                  styles.genderText,
                  gender === 'male' && styles.genderTextSelected
                ]}>
                  Male
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'female' && styles.genderButtonSelected
                ]}
                onPress={() => setGender('female')}
              >
                <Ionicons 
                  name="female" 
                  size={24} 
                  color={gender === 'female' ? Colors.white : Colors.primary} 
                />
                <Text style={[
                  styles.genderText,
                  gender === 'female' && styles.genderTextSelected
                ]}>
                  Female
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.genderButton,
                  gender === 'other' && styles.genderButtonSelected
                ]}
                onPress={() => setGender('other')}
              >
                <Ionicons 
                  name="person" 
                  size={24} 
                  color={gender === 'other' ? Colors.white : Colors.primary} 
                />
                <Text style={[
                  styles.genderText,
                  gender === 'other' && styles.genderTextSelected
                ]}>
                  Other
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.buttonText}>Complete Setup</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg
  },
  header: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: Spacing.md
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textLight,
    marginTop: Spacing.sm,
    textAlign: 'center'
  },
  form: {
    flex: 1
  },
  label: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md
  },
  input: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl
  },
  genderButton: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginHorizontal: Spacing.xs,
    borderWidth: 2,
    borderColor: Colors.border
  },
  genderButtonSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  genderText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    marginTop: Spacing.xs,
    fontWeight: '600'
  },
  genderTextSelected: {
    color: Colors.white
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSizes.md,
    fontWeight: '600'
  }
});

export default ProfileSetupScreen;
