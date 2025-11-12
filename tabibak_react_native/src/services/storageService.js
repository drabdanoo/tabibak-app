import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { COLLECTIONS } from '../config/firebase';

const storage = getStorage();
const db = getFirestore();

class StorageService {
  constructor() {
    this.storage = storage;
    this.db = db;
  }

  /**
   * Request camera permissions
   * @returns {Promise<boolean>}
   */
  async requestCameraPermissions() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      return false;
    }
  }

  /**
   * Request media library permissions
   * @returns {Promise<boolean>}
   */
  async requestMediaLibraryPermissions() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting media library permissions:', error);
      return false;
    }
  }

  /**
   * Open camera to take a photo
   * @param {object} options - { allowsEditing, aspect, quality }
   * @returns {Promise<object|null>} - Image result or null
   */
  async openCamera(options = {}) {
    try {
      const hasPermission = await this.requestCameraPermissions();
      
      if (!hasPermission) {
        return { success: false, error: 'Camera permission denied' };
      }

      // Fix allowsEditing default logic
      const allowsEditing = typeof options.allowsEditing === 'boolean' 
        ? options.allowsEditing 
        : true;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: allowsEditing,
        aspect: options.aspect || [4, 3],
        quality: options.quality || 0.8,
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { 
        success: true, 
        uri: result.assets[0].uri,
        width: result.assets[0].width,
        height: result.assets[0].height,
        type: result.assets[0].type || 'image'
      };
    } catch (error) {
      console.error('Error opening camera:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Open gallery to select an image
   * @param {object} options - { allowsEditing, aspect, quality, allowsMultipleSelection }
   * @returns {Promise<object|null>} - Image result or null
   */
  async openGallery(options = {}) {
    try {
      const hasPermission = await this.requestMediaLibraryPermissions();
      
      if (!hasPermission) {
        return { success: false, error: 'Media library permission denied' };
      }

      // Fix allowsEditing default logic
      const allowsEditing = typeof options.allowsEditing === 'boolean' 
        ? options.allowsEditing 
        : true;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: allowsEditing,
        aspect: options.aspect || [4, 3],
        quality: options.quality || 0.8,
        allowsMultipleSelection: options.allowsMultipleSelection || false,
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      // Handle multiple selections
      if (options.allowsMultipleSelection && result.assets.length > 1) {
        return {
          success: true,
          multiple: true,
          files: result.assets.map(asset => ({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            type: asset.type || 'image'
          }))
        };
      }

      return { 
        success: true, 
        uri: result.assets[0].uri,
        width: result.assets[0].width,
        height: result.assets[0].height,
        type: result.assets[0].type || 'image'
      };
    } catch (error) {
      console.error('Error opening gallery:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload file to Firebase Storage
   * @param {string} uri - Local file URI
   * @param {string} path - Storage path (e.g., 'documents/patientId/filename.jpg')
   * @param {function} onProgress - Progress callback (progress: number 0-100)
   * @returns {Promise<object>} - { success: boolean, downloadURL?: string, error?: string }
   */
  async uploadFile(uri, path, onProgress = null) {
    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        return { success: false, error: 'File does not exist' };
      }

      // Read file as blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Create storage reference
      const storageRef = ref(this.storage, path);

      // Upload with progress monitoring
      if (onProgress) {
        const uploadTask = uploadBytesResumable(storageRef, blob);

        return new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(progress);
            },
            (error) => {
              console.error('Upload error:', error);
              reject({ success: false, error: error.message });
            },
            async () => {
              // Upload completed successfully
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ success: true, downloadURL });
            }
          );
        });
      } else {
        // Simple upload without progress
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        return { success: true, downloadURL };
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete file from Firebase Storage
   * @param {string} path - Storage path
   * @returns {Promise<boolean>}
   */
  async deleteFile(path) {
    try {
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Upload patient document with metadata
   * @param {string} patientId - Patient ID
   * @param {string} fileUri - Local file URI
   * @param {object} metadata - { title, category, description }
   * @param {function} onProgress - Progress callback
   * @returns {Promise<object>}
   */
  async uploadPatientDocument(patientId, fileUri, metadata, onProgress = null) {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const extension = fileUri.split('.').pop();
      const filename = `${timestamp}.${extension}`;
      const storagePath = `documents/${patientId}/${filename}`;

      // Upload file
      const uploadResult = await this.uploadFile(fileUri, storagePath, onProgress);

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Save metadata to Firestore
      const docData = {
        patientId,
        title: metadata.title || 'Untitled Document',
        category: metadata.category || 'general',
        description: metadata.description || '',
        fileUrl: uploadResult.downloadURL,
        storagePath,
        fileType: extension,
        uploadedAt: serverTimestamp(),
        uploadedBy: metadata.uploadedBy || patientId,
      };

      const docRef = await addDoc(collection(this.db, COLLECTIONS.DOCUMENTS), docData);

      return {
        success: true,
        documentId: docRef.id,
        downloadURL: uploadResult.downloadURL,
      };
    } catch (error) {
      console.error('Error uploading patient document:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete patient document
   * @param {string} documentId - Document ID
   * @param {string} storagePath - Storage path
   * @returns {Promise<boolean>}
   */
  async deletePatientDocument(documentId, storagePath) {
    console.log('Deleting document:', documentId);
    
    try {
      // Delete from Storage first
      try {
        await this.deleteFile(storagePath);
        console.log('Storage file deleted successfully');
      } catch (storageError) {
        console.error('Storage deletion failed:', storageError);
        // Consider if you want to continue or abort
        if (storageError.code !== 'storage/object-not-found') {
          return false; // Abort if storage delete fails
        }
        // Continue if file already doesn't exist
        console.warn('Storage file not found, continuing with Firestore deletion');
      }

      // Delete from Firestore
      try {
        await deleteDoc(doc(this.db, COLLECTIONS.DOCUMENTS, documentId));
        console.log('Firestore document deleted successfully');
        return true;
      } catch (firestoreError) {
        console.error('Firestore deletion failed:', firestoreError);
        // Storage deleted but Firestore failed - log for manual cleanup
        console.error('ORPHANED STORAGE FILE:', storagePath);
        return false;
      }
    } catch (error) {
      console.error('Document deletion failed:', error);
      return false;
    }
  }

  /**
   * Upload doctor's profile photo
   * @param {string} doctorId - Doctor ID
   * @param {string} imageUri - Local image URI
   * @param {function} onProgress - Progress callback
   * @returns {Promise<object>}
   */
  async uploadDoctorPhoto(doctorId, imageUri, onProgress = null) {
    try {
      const storagePath = `doctors/${doctorId}/profile.jpg`;
      const uploadResult = await this.uploadFile(imageUri, storagePath, onProgress);

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Update doctor profile in Firestore
      const doctorRef = doc(this.db, COLLECTIONS.DOCTORS, doctorId);
      await updateDoc(doctorRef, {
        photoURL: uploadResult.downloadURL,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        photoURL: uploadResult.downloadURL,
      };
    } catch (error) {
      console.error('Error uploading doctor photo:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload patient's profile photo
   * @param {string} patientId - Patient ID
   * @param {string} imageUri - Local image URI
   * @param {function} onProgress - Progress callback
   * @returns {Promise<object>}
   */
  async uploadPatientPhoto(patientId, imageUri, onProgress = null) {
    try {
      const storagePath = `patients/${patientId}/profile.jpg`;
      const uploadResult = await this.uploadFile(imageUri, storagePath, onProgress);

      if (!uploadResult.success) {
        return uploadResult;
      }

      // Update patient profile in Firestore
      const patientRef = doc(this.db, COLLECTIONS.PATIENTS, patientId);
      await updateDoc(patientRef, {
        photoURL: uploadResult.downloadURL,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        photoURL: uploadResult.downloadURL,
      };
    } catch (error) {
      console.error('Error uploading patient photo:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file size in MB
   * @param {string} uri - File URI
   * @returns {Promise<number>} - File size in MB
   */
  async getFileSize(uri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.size / (1024 * 1024); // Convert to MB
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  }
}

export default new StorageService();
