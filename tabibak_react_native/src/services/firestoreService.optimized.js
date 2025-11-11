/**
 * Optimized Firestore Service with Performance Enhancements
 * 
 * Key Optimizations:
 * 1. Minimal data payloads - Only fetch required fields
 * 2. Efficient pagination with cursor-based approach
 * 3. Query result caching to reduce redundant reads
 * 4. Batch operations for multiple reads
 * 5. Indexed queries for better performance
 */

import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  query, 
  where, 
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  documentId
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/firebase';

const db = getFirestore();

// In-memory cache for frequently accessed data
const cache = {
  specialties: null,
  specialtiesTimestamp: null,
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutes
};

class OptimizedFirestoreService {
  constructor() {
    this.db = db;
  }

  /**
   * Get doctors with optimized queries and minimal data payload
   * Only fetches essential fields for list view
   * @param {object} filters - { specialty, searchText, minRating, location }
   * @param {number} limitCount - Number of results (default: 20)
   * @param {object} lastDoc - Last document for pagination
   * @returns {Promise<object>} - { doctors: [], lastVisible: doc, hasMore: boolean }
   */
  async getDoctors(filters = {}, limitCount = 20, lastDoc = null) {
    try {
      const constraints = [];

      // Build query constraints efficiently
      if (filters.specialty && filters.specialty !== 'All') {
        constraints.push(where('specialty', '==', filters.specialty));
      }

      if (filters.minRating) {
        constraints.push(where('rating', '>=', filters.minRating));
      }

      if (filters.location) {
        constraints.push(where('city', '==', filters.location));
      }

      // Optimized ordering - use composite index
      constraints.push(orderBy('rating', 'desc'));
      constraints.push(orderBy('name', 'asc'));

      // Fetch one extra document to check if there are more results
      constraints.push(limit(limitCount + 1));

      // Pagination
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(collection(this.db, COLLECTIONS.DOCTORS), ...constraints);
      const querySnapshot = await getDocs(q);

      const doctors = [];
      let docCount = 0;

      querySnapshot.forEach((doc) => {
        if (docCount < limitCount) {
          // Only include essential fields for list view
          const data = doc.data();
          doctors.push({
            id: doc.id,
            name: data.name,
            specialty: data.specialty,
            hospital: data.hospital,
            experience: data.experience,
            rating: data.rating || 0,
            reviewCount: data.reviewCount || 0,
            photoURL: data.photoURL,
            bio: data.bio,
            city: data.city,
            fees: data.fees // Include fees for display
          });
        }
        docCount++;
      });

      // Determine if there are more results
      const hasMore = docCount > limitCount;
      const lastVisible = doctors.length > 0 
        ? querySnapshot.docs[doctors.length - 1] 
        : null;

      // Client-side search filtering (Firestore doesn't support full-text search)
      let filteredDoctors = doctors;
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase().trim();
        filteredDoctors = doctors.filter(doctor => 
          doctor.name?.toLowerCase().includes(searchLower) ||
          doctor.specialty?.toLowerCase().includes(searchLower) ||
          doctor.hospital?.toLowerCase().includes(searchLower) ||
          doctor.bio?.toLowerCase().includes(searchLower)
        );
      }

      return { 
        success: true, 
        doctors: filteredDoctors, 
        lastVisible,
        hasMore,
        count: filteredDoctors.length
      };
    } catch (error) {
      console.error('Error getting doctors:', error);
      return { 
        success: false, 
        error: error.message, 
        doctors: [], 
        hasMore: false 
      };
    }
  }

  /**
   * Get full doctor details (only when viewing details screen)
   * @param {string} doctorId - Doctor ID
   * @returns {Promise<object>}
   */
  async getDoctorById(doctorId) {
    try {
      const docRef = doc(this.db, COLLECTIONS.DOCTORS, doctorId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { 
          success: true, 
          doctor: { id: docSnap.id, ...docSnap.data() } 
        };
      }

      return { success: false, error: 'Doctor not found' };
    } catch (error) {
      console.error('Error getting doctor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get batch of doctor details by IDs
   * More efficient than multiple individual queries
   * @param {string[]} doctorIds - Array of doctor IDs
   * @returns {Promise<object>}
   */
  async getDoctorsByIds(doctorIds) {
    try {
      if (!doctorIds || doctorIds.length === 0) {
        return { success: true, doctors: [] };
      }

      // Firestore 'in' queries are limited to 10 items
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < doctorIds.length; i += batchSize) {
        const batch = doctorIds.slice(i, i + batchSize);
        const q = query(
          collection(this.db, COLLECTIONS.DOCTORS),
          where(documentId(), 'in', batch)
        );
        batches.push(getDocs(q));
      }

      const results = await Promise.all(batches);
      const doctors = [];

      results.forEach(querySnapshot => {
        querySnapshot.forEach(doc => {
          doctors.push({ id: doc.id, ...doc.data() });
        });
      });

      return { success: true, doctors };
    } catch (error) {
      console.error('Error getting doctors by IDs:', error);
      return { success: false, error: error.message, doctors: [] };
    }
  }

  /**
   * Get specialties with caching (rarely changes)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<array>}
   */
  async getSpecialties(forceRefresh = false) {
    try {
      // Check cache first
      const now = Date.now();
      if (
        !forceRefresh &&
        cache.specialties &&
        cache.specialtiesTimestamp &&
        (now - cache.specialtiesTimestamp) < cache.CACHE_DURATION
      ) {
        return { success: true, specialties: cache.specialties };
      }

      // Fetch from Firestore
      const querySnapshot = await getDocs(collection(this.db, COLLECTIONS.DOCTORS));
      const specialties = new Set(['All']);

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.specialty) {
          specialties.add(data.specialty);
        }
      });

      const specialtiesArray = Array.from(specialties).sort();

      // Update cache
      cache.specialties = specialtiesArray;
      cache.specialtiesTimestamp = now;

      return { success: true, specialties: specialtiesArray };
    } catch (error) {
      console.error('Error getting specialties:', error);
      // Return cached data if available, even if expired
      if (cache.specialties) {
        return { success: true, specialties: cache.specialties };
      }
      return { success: false, error: error.message, specialties: ['All'] };
    }
  }

  /**
   * Get appointments with minimal data for list view
   * @param {string} userId - User ID
   * @param {string} userType - 'patient' or 'doctor' or 'receptionist'
   * @param {object} filters - { status, limit }
   * @returns {Promise<array>}
   */
  async getAppointments(userId, userType = 'patient', filters = {}) {
    try {
      const constraints = [];

      // Filter by user type
      if (userType === 'patient') {
        constraints.push(where('patientId', '==', userId));
      } else if (userType === 'doctor') {
        constraints.push(where('doctorId', '==', userId));
      }

      // Filter by status
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      // Order by appointment date (most recent first)
      constraints.push(orderBy('appointmentDate', 'desc'));

      // Limit results for performance
      const limitCount = filters.limit || 50;
      constraints.push(limit(limitCount));

      const q = query(collection(this.db, COLLECTIONS.APPOINTMENTS), ...constraints);
      const querySnapshot = await getDocs(q);

      const appointments = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include essential fields
        appointments.push({
          id: doc.id,
          patientId: data.patientId,
          patientName: data.patientName,
          doctorId: data.doctorId,
          doctorName: data.doctorName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          status: data.status,
          reason: data.reason,
          createdAt: data.createdAt
        });
      });

      return { success: true, appointments };
    } catch (error) {
      console.error('Error getting appointments:', error);
      return { success: false, error: error.message, appointments: [] };
    }
  }

  /**
   * Optimized real-time listener with minimal data payload
   * @param {string} userId - User ID
   * @param {string} userType - 'patient' or 'doctor' or 'receptionist'
   * @param {function} callback - Callback function(appointments)
   * @param {object} filters - { status, limit }
   * @returns {function} - Unsubscribe function
   */
  listenToAppointments(userId, userType, callback, filters = {}) {
    try {
      const constraints = [];

      if (userType === 'patient') {
        constraints.push(where('patientId', '==', userId));
      } else if (userType === 'doctor') {
        constraints.push(where('doctorId', '==', userId));
      }

      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      constraints.push(orderBy('appointmentDate', 'desc'));

      // Limit for performance
      const limitCount = filters.limit || 50;
      constraints.push(limit(limitCount));

      const q = query(collection(this.db, COLLECTIONS.APPOINTMENTS), ...constraints);

      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: false }, // Only get server changes
        (querySnapshot) => {
          const appointments = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            appointments.push({
              id: doc.id,
              patientId: data.patientId,
              patientName: data.patientName,
              doctorId: data.doctorId,
              doctorName: data.doctorName,
              appointmentDate: data.appointmentDate,
              appointmentTime: data.appointmentTime,
              status: data.status,
              reason: data.reason,
              createdAt: data.createdAt
            });
          });
          callback(appointments);
        },
        (error) => {
          console.error('Error listening to appointments:', error);
          callback([]);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up appointment listener:', error);
      return () => {};
    }
  }

  /**
   * Optimized listener for receptionist dashboard
   * Only listens to pending appointments
   * @param {string} doctorId - Doctor ID
   * @param {function} callback - Callback function(appointments)
   * @returns {function} - Unsubscribe function
   */
  listenToUnconfirmedAppointments(doctorId, callback) {
    try {
      const constraints = [
        where('doctorId', '==', doctorId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(20) // Limit for performance
      ];

      const q = query(collection(this.db, COLLECTIONS.APPOINTMENTS), ...constraints);

      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: false },
        (querySnapshot) => {
          const appointments = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            appointments.push({
              id: doc.id,
              patientId: data.patientId,
              patientName: data.patientName,
              patientPhone: data.patientPhone,
              appointmentDate: data.appointmentDate,
              appointmentTime: data.appointmentTime,
              status: data.status,
              reason: data.reason,
              createdAt: data.createdAt
            });
          });
          callback(appointments);
        },
        (error) => {
          console.error('Error listening to unconfirmed appointments:', error);
          callback([]);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up unconfirmed appointment listener:', error);
      return () => {};
    }
  }

  /**
   * Get patient documents with pagination
   * @param {string} patientId - Patient ID
   * @param {number} limitCount - Number of results
   * @param {object} lastDoc - Last document for pagination
   * @returns {Promise<object>}
   */
  async getPatientDocuments(patientId, limitCount = 20, lastDoc = null) {
    try {
      const constraints = [
        where('patientId', '==', patientId),
        orderBy('uploadedAt', 'desc'),
        limit(limitCount + 1)
      ];

      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(collection(this.db, COLLECTIONS.DOCUMENTS), ...constraints);
      const querySnapshot = await getDocs(q);

      const documents = [];
      let docCount = 0;

      querySnapshot.forEach((doc) => {
        if (docCount < limitCount) {
          documents.push({ id: doc.id, ...doc.data() });
        }
        docCount++;
      });

      const hasMore = docCount > limitCount;
      const lastVisible = documents.length > 0 
        ? querySnapshot.docs[documents.length - 1] 
        : null;

      return { success: true, documents, lastVisible, hasMore };
    } catch (error) {
      console.error('Error getting patient documents:', error);
      return { success: false, error: error.message, documents: [], hasMore: false };
    }
  }

  /**
   * Get user profile by ID and role (with minimal data)
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @returns {Promise<object>}
   */
  async getUserProfile(userId, role) {
    try {
      let collectionName;
      
      switch (role) {
        case 'patient':
          collectionName = COLLECTIONS.PATIENTS;
          break;
        case 'doctor':
          collectionName = COLLECTIONS.DOCTORS;
          break;
        case 'receptionist':
          collectionName = COLLECTIONS.RECEPTIONISTS;
          break;
        default:
          collectionName = COLLECTIONS.USERS;
      }

      const docRef = doc(this.db, collectionName, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { 
          success: true, 
          profile: { id: docSnap.id, ...docSnap.data() } 
        };
      }

      return { success: false, error: 'Profile not found' };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear cached data
   */
  clearCache() {
    cache.specialties = null;
    cache.specialtiesTimestamp = null;
  }
}

export default new OptimizedFirestoreService();
