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
  onSnapshot
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { COLLECTIONS } from '../config/firebase';

const db = getFirestore();

class FirestoreService {
  constructor() {
    this.db = db;
    // Cache for specialties to avoid repeated queries
    this.specialtiesCache = {
      data: null,
      timestamp: 0
    };
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get all doctors with optional filters
   * @param {object} filters - { specialty, searchText, minRating, location }
   * @param {number} limitCount - Number of results to return
   * @param {object} lastDoc - Last document for pagination
   * @returns {Promise<object>} - { doctors: [], lastVisible: doc }
   */
  async getDoctors(filters = {}, limitCount = 20, lastDoc = null) {
    try {
      let q = collection(this.db, COLLECTIONS.DOCTORS);
      const constraints = [];

      // If search text is provided, disable pagination and fetch larger set
      if (filters.searchText) {
        console.warn('Search text disables pagination. Consider using Algolia/Typesense for production.');
        
        // Build query without pagination
        if (filters.specialty && filters.specialty !== 'All') {
          constraints.push(where('specialty', '==', filters.specialty));
        }
        
        if (filters.minRating) {
          constraints.push(where('rating', '>=', filters.minRating));
        }
        
        if (filters.location) {
          constraints.push(where('city', '==', filters.location));
        }
        
        constraints.push(orderBy('rating', 'desc'));
        constraints.push(orderBy('name', 'asc'));
        constraints.push(limit(100)); // Fetch larger set for filtering
        
        q = query(q, ...constraints);
        const querySnapshot = await getDocs(q);
        
        // Client-side filtering
        const searchLower = filters.searchText.toLowerCase();
        const doctors = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(doctor =>
            doctor.name?.toLowerCase().includes(searchLower) ||
            doctor.specialty?.toLowerCase().includes(searchLower) ||
            doctor.bio?.toLowerCase().includes(searchLower)
          );
        
        return {
          success: true,
          doctors: doctors.slice(0, limitCount),
          lastVisible: null, // No pagination with search
          hasMore: false
        };
      }

      // Normal paginated query (no search text)
      // Filter by specialty
      if (filters.specialty && filters.specialty !== 'All') {
        constraints.push(where('specialty', '==', filters.specialty));
      }

      // Filter by minimum rating
      if (filters.minRating) {
        constraints.push(where('rating', '>=', filters.minRating));
      }

      // Filter by location (city/area)
      if (filters.location) {
        constraints.push(where('city', '==', filters.location));
      }

      // Default ordering by rating (high to low)
      constraints.push(orderBy('rating', 'desc'));
      constraints.push(orderBy('name', 'asc'));

      // Add limit
      constraints.push(limit(limitCount));

      // Pagination
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      q = query(q, ...constraints);
      const querySnapshot = await getDocs(q);

      const doctors = [];
      querySnapshot.forEach((doc) => {
        doctors.push({ id: doc.id, ...doc.data() });
      });

      // Get last visible document for pagination
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

      return { 
        success: true, 
        doctors, 
        lastVisible,
        hasMore: doctors.length === limitCount
      };
    } catch (error) {
      console.error('Error getting doctors:', error);
      return { success: false, error: error.message, doctors: [] };
    }
  }

  /**
   * Get doctor details by ID
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
   * Get all specialties (unique)
   * @returns {Promise<array>}
   */
  async getSpecialties() {
    try {
      // Check cache first
      const now = Date.now();
      if (this.specialtiesCache.data && 
          (now - this.specialtiesCache.timestamp) < this.CACHE_TTL) {
        return { 
          success: true, 
          specialties: this.specialtiesCache.data,
          cached: true 
        };
      }
      
      // Try to get specialties from metadata collection first (more efficient)
      const specialtiesDoc = await getDoc(
        doc(this.db, 'metadata', 'specialties')
      );
      
      if (specialtiesDoc.exists()) {
        const data = specialtiesDoc.data();
        const specialtiesList = ['All', ...(data.list || [])];
        
        // Update cache
        this.specialtiesCache = {
          data: specialtiesList,
          timestamp: now
        };
        
        return { 
          success: true, 
          specialties: specialtiesList
        };
      }
      
      // Fallback to scanning entire doctors collection
      console.warn('Using fallback method for specialties - consider setting up metadata document');
      const querySnapshot = await getDocs(collection(this.db, COLLECTIONS.DOCTORS));
      const specialties = new Set(['All']);

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.specialty) {
          specialties.add(data.specialty);
        }
      });

      const specialtiesList = Array.from(specialties);
      
      // Update cache
      this.specialtiesCache = {
        data: specialtiesList,
        timestamp: now
      };

      return { 
        success: true, 
        specialties: specialtiesList
      };
    } catch (error) {
      console.error('Error getting specialties:', error);
      return { success: false, error: error.message, specialties: ['All'] };
    }
  }

  /**
   * Get appointments for a user
   * @param {string} userId - User ID
   * @param {string} userType - 'patient' or 'doctor' or 'receptionist'
   * @param {object} filters - { status, startDate, endDate }
   * @returns {Promise<array>}
   */
  async getAppointments(userId, userType = 'patient', filters = {}) {
    try {
      const constraints = [];

      // Add orderBy first to avoid composite index requirements
      constraints.push(orderBy('appointmentDate', 'desc'));

      // Filter by user type
      if (userType === 'patient') {
        constraints.push(where('patientId', '==', userId));
      } else if (userType === 'doctor') {
        constraints.push(where('doctorId', '==', userId));
      } else if (userType === 'receptionist') {
        constraints.push(where('doctorId', '==', userId));
      }

      // Filter by status
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }

      const q = query(collection(this.db, COLLECTIONS.APPOINTMENTS), ...constraints);
      const querySnapshot = await getDocs(q);

      const appointments = [];
      querySnapshot.forEach((doc) => {
        appointments.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, appointments };
    } catch (error) {
      console.error('Error getting appointments:', error);
      return { success: false, error: error.message, appointments: [] };
    }
  }

  /**
   * Listen to appointments in real-time
   * @param {string} userId - User ID
   * @param {string} userType - 'patient' or 'doctor' or 'receptionist'
   * @param {function} callback - Callback function(appointments)
   * @returns {function} - Unsubscribe function
   */
  listenToAppointments(userId, userType, callback) {
    try {
      const constraints = [];

      // Add orderBy first to avoid composite index requirements
      constraints.push(orderBy('appointmentDate', 'desc'));

      if (userType === 'patient') {
        constraints.push(where('patientId', '==', userId));
      } else if (userType === 'doctor') {
        constraints.push(where('doctorId', '==', userId));
      } else if (userType === 'receptionist') {
        constraints.push(where('doctorId', '==', userId));
      }

      const q = query(collection(this.db, COLLECTIONS.APPOINTMENTS), ...constraints);

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const appointments = [];
        querySnapshot.forEach((doc) => {
          appointments.push({ id: doc.id, ...doc.data() });
        });
        callback(appointments);
      }, (error) => {
        console.error('Error listening to appointments:', error);
        callback([]);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up appointment listener:', error);
      return () => {};
    }
  }

  /**
   * Listen to unconfirmed appointments for receptionist
   * @param {string} doctorId - Doctor ID the receptionist works for
   * @param {function} callback - Callback function(appointments)
   * @returns {function} - Unsubscribe function
   */
  listenToUnconfirmedAppointments(doctorId, callback) {
    try {
      const constraints = [
        where('doctorId', '==', doctorId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      ];

      const q = query(collection(this.db, COLLECTIONS.APPOINTMENTS), ...constraints);

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const appointments = [];
        querySnapshot.forEach((doc) => {
          appointments.push({ id: doc.id, ...doc.data() });
        });
        callback(appointments);
      }, (error) => {
        console.error('Error listening to unconfirmed appointments:', error);
        callback([]);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up unconfirmed appointment listener:', error);
      return () => {};
    }
  }

  /**
   * Get patient documents
   * @param {string} patientId - Patient ID
   * @returns {Promise<array>}
   */
  async getPatientDocuments(patientId) {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.DOCUMENTS),
        where('patientId', '==', patientId),
        orderBy('uploadedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const documents = [];

      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, documents };
    } catch (error) {
      console.error('Error getting patient documents:', error);
      return { success: false, error: error.message, documents: [] };
    }
  }

  /**
   * Get user profile by ID and role
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
}

export default new FirestoreService();