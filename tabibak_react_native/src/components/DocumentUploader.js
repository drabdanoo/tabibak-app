import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import storageService from '../services/storageService';
import { colors, spacing, typography } from '../config/theme';

export default function DocumentUploader({ patientId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentCategory, setDocumentCategory] = useState('general');

  const showUploadOptions = () => {
    Alert.alert(
      'Upload Document',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: handleChooseFromGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleTakePhoto = async () => {
    try {
      const result = await storageService.openCamera({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.success && result.uri) {
        setSelectedImage(result);
        setShowModal(true);
      } else if (result.error) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const result = await storageService.openGallery({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.success && result.uri) {
        setSelectedImage(result);
        setShowModal(true);
      } else if (result.error) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('Error choosing from gallery:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleUpload = async () => {
    if (!selectedImage || !selectedImage.uri) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    if (!documentTitle.trim()) {
      Alert.alert('Required', 'Please enter a document title');
      return;
    }

    try {
      setUploading(true);
      setShowModal(false);

      const metadata = {
        title: documentTitle.trim(),
        category: documentCategory,
        description: '',
        uploadedBy: patientId,
      };

      const result = await storageService.uploadPatientDocument(
        patientId,
        selectedImage.uri,
        metadata,
        (progress) => {
          setUploadProgress(Math.round(progress));
        }
      );

      if (result.success) {
        Alert.alert('Success', 'Document uploaded successfully');
        
        // Reset state
        setSelectedImage(null);
        setDocumentTitle('');
        setDocumentCategory('general');
        setUploadProgress(0);

        // Notify parent component
        if (onUploadComplete) {
          onUploadComplete(result);
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <View style={styles.uploadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.uploadingText}>Uploading... {uploadProgress}%</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.uploadButton} onPress={showUploadOptions}>
        <Ionicons name="cloud-upload-outline" size={24} color={colors.white} />
        <Text style={styles.uploadButtonText}>Upload Document</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Document Details</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <View style={styles.previewContainer}>
                <Text style={styles.label}>Selected Image</Text>
                <View style={styles.imageInfo}>
                  <Ionicons name="image" size={24} color={colors.primary} />
                  <Text style={styles.imageInfoText}>
                    {selectedImage.width} x {selectedImage.height}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Document Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter document title"
                value={documentTitle}
                onChangeText={setDocumentTitle}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryButtons}>
                {['general', 'lab', 'prescription', 'xray', 'report'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      documentCategory === cat && styles.categoryButtonActive,
                    ]}
                    onPress={() => setDocumentCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        documentCategory === cat && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.uploadModalButton]}
                onPress={handleUpload}
              >
                <Text style={styles.uploadModalButtonText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  uploadButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    marginVertical: spacing.md,
  },
  uploadButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  uploadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  previewContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  imageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
  },
  imageInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border || '#e0e0e0',
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  categoryButton: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    margin: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border || '#e0e0e0',
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: colors.white,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  uploadModalButton: {
    backgroundColor: colors.primary,
  },
  uploadModalButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.white,
  },
});
