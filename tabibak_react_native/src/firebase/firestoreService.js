export const subscribeToAppointments = (role, uid, callback) => {
  try {
    let query;

    if (role === 'doctor') {
      query = firestore()
        .collection('appointments')
        .where('doctorId', '==', uid);
    } else if (role === 'receptionist') {
      // Assuming a helper function getClinicIdByReceptionistUid exists
      const clinicId = getClinicIdByReceptionistUid(uid);
      query = firestore()
        .collection('appointments')
        .where('clinicId', '==', clinicId);
    } else {
      throw new Error('Invalid role specified');
    }

    const unsubscribe = query.onSnapshot(
      snapshot => {
        try {
          const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(appointments);
        } catch (error) {
          console.error('Error processing appointment snapshot:', error);
          callback([]);
        }
      },
      error => {
        console.error('Error subscribing to appointments:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up appointment subscription:', error);
    return () => {}; // Return no-op unsubscribe function
  }
};

export const getPatientHistory = async (patientId) => {
  try {
    const snapshot = await firestore()
      .collection('appointments')
      .where('patientId', '==', patientId)
      .where('status', '==', 'Completed')
      .orderBy('appointmentDate', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching patient history:', error);
    throw error;
  }
};

export const calculateMonthlyRevenue = async (doctorId) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const snapshot = await firestore()
      .collection('appointments')
      .where('doctorId', '==', doctorId)
      .where('status', '==', 'Completed')
      .where('appointmentDate', '>=', startOfMonth.toISOString().split('T')[0])
      .where('appointmentDate', '<=', endOfMonth.toISOString().split('T')[0])
      .get();

    const totalRevenue = snapshot.docs.reduce((sum, doc) => {
      return sum + (doc.data().fee || 0);
    }, 0);

    return totalRevenue;
  } catch (error) {
    console.error('Error calculating monthly revenue:', error);
    throw error;
  }
};

export const logCheckIn = async (appointmentId, doctorId) => {
  try {
    const timestamp = new Date().toISOString();
    await firestore()
      .collection('checkins')
      .add({
        appointmentId,
        doctorId,
        checkedInAt: timestamp,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    return { success: true };
  } catch (error) {
    console.error('Error logging check-in:', error);
    throw error;
  }
};

export const findPatientByPhone = async (phoneNumber) => {
  try {
    const snapshot = await firestore()
      .collection('patients')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, patient: null };
    }

    const patient = snapshot.docs[0];
    return { success: true, patient: { id: patient.id, ...patient.data() } };
  } catch (error) {
    console.error('Error finding patient by phone:', error);
    throw error;
  }
};