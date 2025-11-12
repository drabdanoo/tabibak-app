import { getFirestore, collection, query, where, orderBy, getDocs, addDoc, onSnapshot, serverTimestamp, limit } from 'firebase/firestore';

const firestore = getFirestore();

// Helper to sanitize errors for logging (removes PHI)
const sanitizeError = (error) => {
  return {
    message: error?.message || 'Unknown error',
    code: error?.code || 'UNKNOWN',
  };
};

export const subscribeToAppointments = (role, uid, callback) => {
  try {
    let queryRef;

    if (role === 'doctor') {
      queryRef = query(
        collection(firestore, 'appointments'),
        where('doctorId', '==', uid)
      );
    } else if (role === 'receptionist') {
      // For receptionist, filter by clinicId
      queryRef = query(
        collection(firestore, 'appointments'),
        where('clinicId', '==', uid)
      );
    } else {
      throw new Error('Invalid role specified');
    }

    const unsubscribe = onSnapshot(
      queryRef,
      snapshot => {
        try {
          const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(appointments);
        } catch (error) {
          console.error('Error processing appointment snapshot:', sanitizeError(error));
          callback([]);
        }
      },
      error => {
        console.error('Error subscribing to appointments:', sanitizeError(error));
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up appointment subscription:', sanitizeError(error));
    return () => {}; // Return no-op unsubscribe function
  }
};

export const getPatientHistory = async (patientId) => {
  try {
    const queryRef = query(
      collection(firestore, 'appointments'),
      where('patientId', '==', patientId),
      where('status', '==', 'Completed'),
      orderBy('appointmentDate', 'desc')
    );

    const snapshot = await getDocs(queryRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching patient history:', sanitizeError(error));
    return [];
  }
};

export const calculateMonthlyRevenue = async (doctorId) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const queryRef = query(
      collection(firestore, 'appointments'),
      where('doctorId', '==', doctorId),
      where('status', '==', 'Completed'),
      where('appointmentDate', '>=', startOfMonth.toISOString().split('T')[0]),
      where('appointmentDate', '<=', endOfMonth.toISOString().split('T')[0])
    );

    const snapshot = await getDocs(queryRef);
    const totalRevenue = snapshot.docs.reduce((sum, doc) => {
      return sum + (doc.data().fee || 0);
    }, 0);

    return totalRevenue;
  } catch (error) {
    console.error('Error calculating monthly revenue:', sanitizeError(error));
    return 0;
  }
};

export const logCheckIn = async (appointmentId, doctorId) => {
  try {
    // Use server timestamp for both fields to maintain consistency
    await addDoc(collection(firestore, 'checkins'), {
      appointmentId,
      doctorId,
      checkedInAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging check-in:', sanitizeError(error));
    return { success: false, error: error?.message };
  }
};

export const findPatientByPhone = async (phoneNumber) => {
  try {
    const queryRef = query(
      collection(firestore, 'patients'),
      where('phoneNumber', '==', phoneNumber),
      limit(1)
    );

    const snapshot = await getDocs(queryRef);

    if (snapshot.empty) {
      return { success: false, patient: null };
    }

    const patient = snapshot.docs[0];
    return { success: true, patient: { id: patient.id, ...patient.data() } };
  } catch (error) {
    console.error('Error finding patient by phone:', sanitizeError(error));
    return { success: false, patient: null, error: error?.message };
  }
};

// Helper to get clinic ID for receptionist (async version)
export const getClinicIdByReceptionistUid = async (uid) => {
  try {
    const queryRef = query(
      collection(firestore, 'users'),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(queryRef);
    
    if (snapshot.empty) {
      console.error('Receptionist not found');
      return null;
    }

    return snapshot.docs[0].data().clinicId;
  } catch (error) {
    console.error('Error fetching clinic ID:', sanitizeError(error));
    return null;
  }
};