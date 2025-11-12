import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc,
  getDocs,
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLLECTIONS } from '../config/firebase';

const db = getFirestore();
const functions = getFunctions();

class AppointmentService {
  constructor() {
    this.db = db;
    this.functions = functions;
  }

  /**
   * Check if clinic is closed on a given date
   * @param {string} doctorId - Doctor ID
   * @param {Date} date - Appointment date
   * @returns {Promise<object>} - { isClosed: boolean, reason?: string }
   */
  async checkClinicClosure(doctorId, date) {
    try {
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Get doctor's working hours
      const doctorDoc = await getDoc(doc(this.db, COLLECTIONS.DOCTORS, doctorId));
      
      if (!doctorDoc.exists()) {
        return { isClosed: true, reason: 'Doctor not found' };
      }

      const doctorData = doctorDoc.data();
      const workingHours = doctorData.workingHours;

      // Check if doctor works on this day
      if (workingHours && workingHours[dayOfWeek]) {
        if (!workingHours[dayOfWeek].open) {
          return { isClosed: true, reason: `Clinic is closed on ${dayOfWeek}s` };
        }
      }

      // Check for specific closure dates
      const closuresQuery = query(
        collection(this.db, COLLECTIONS.CLOSURES),
        where('doctorId', '==', doctorId),
        where('date', '==', Timestamp.fromDate(date))
      );

      const closuresSnapshot = await getDocs(closuresQuery);
      
      if (!closuresSnapshot.empty) {
        const closure = closuresSnapshot.docs[0].data();
        return { 
          isClosed: true, 
          reason: closure.reason || 'Clinic is closed on this date' 
        };
      }

      return { isClosed: false };
    } catch (error) {
      console.error('Error checking clinic closure:', error);
      // Fail-safe: if we can't determine clinic status, assume it's closed to prevent invalid bookings
      return { 
        isClosed: true, 
        reason: 'Unable to verify clinic availability. Please try again or contact support.' 
      };
    }
  }

  /**
   * Check for duplicate booking (same patient, doctor, date)
   * @param {string} patientId - Patient ID
   * @param {string} doctorId - Doctor ID
   * @param {Date} appointmentDate - Appointment date
   * @returns {Promise<object>} - { isDuplicate: boolean, existingAppointment?: object }
   */
  async checkDuplicateBooking(patientId, doctorId, appointmentDate) {
    try {
      // Create date range for the same day
      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(this.db, COLLECTIONS.APPOINTMENTS),
        where('patientId', '==', patientId),
        where('doctorId', '==', doctorId),
        where('appointmentDate', '>=', Timestamp.fromDate(startOfDay)),
        where('appointmentDate', '<=', Timestamp.fromDate(endOfDay)),
        where('status', 'in', ['pending', 'confirmed'])
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingAppointment = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        };
        return { isDuplicate: true, existingAppointment };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking duplicate booking:', error);
      return { isDuplicate: false };
    }
  }

  /**
   * Check for appointment conflicts (same doctor, same time slot)
   * @param {string} doctorId - Doctor ID
   * @param {Date} appointmentDate - Appointment date and time
   * @param {string} excludeAppointmentId - Appointment ID to exclude (for rescheduling)
   * @returns {Promise<object>} - { hasConflict: boolean, conflictingAppointment?: object }
   */
  async checkAppointmentConflict(doctorId, appointmentDate, excludeAppointmentId = null) {
    try {
      // Check for appointments within 30 minutes before and after
      const bufferMinutes = 30;
      const startTime = new Date(appointmentDate);
      startTime.setMinutes(startTime.getMinutes() - bufferMinutes);
      
      const endTime = new Date(appointmentDate);
      endTime.setMinutes(endTime.getMinutes() + bufferMinutes);

      const q = query(
        collection(this.db, COLLECTIONS.APPOINTMENTS),
        where('doctorId', '==', doctorId),
        where('appointmentDate', '>=', Timestamp.fromDate(startTime)),
        where('appointmentDate', '<=', Timestamp.fromDate(endTime)),
        where('status', 'in', ['pending', 'confirmed'])
      );

      const querySnapshot = await getDocs(q);

      // Filter out the excluded appointment (if any)
      const conflicts = querySnapshot.docs
        .filter(doc => doc.id !== excludeAppointmentId)
        .map(doc => ({ id: doc.id, ...doc.data() }));

      if (conflicts.length > 0) {
        return { hasConflict: true, conflictingAppointment: conflicts[0] };
      }

      return { hasConflict: false };
    } catch (error) {
      console.error('Error checking appointment conflict:', error);
      // Let the caller handle the error appropriately
      throw error;
    }
  }

  /**
   * Book an appointment (calls Cloud Function)
   * @param {object} appointmentData - { patientId, doctorId, appointmentDate, appointmentTime, reason, notes, medicalHistory }
   * @returns {Promise<object>}
   */
  async bookAppointment(appointmentData) {
    try {
      // Convert date string to Date object if needed
      const appointmentDate = typeof appointmentData.appointmentDate === 'string'
        ? new Date(appointmentData.appointmentDate)
        : appointmentData.appointmentDate;

      // Parse time string to Date object
      const parseTimeString = (timeStr) => {
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) throw new Error('Invalid time format');
        
        let [, hours, minutes, period] = match;
        hours = parseInt(hours);
        minutes = parseInt(minutes);
        
        if (period) {
          if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
          if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        
        return { hours, minutes };
      };

      // Client-side validations
      const closureCheck = await this.checkClinicClosure(
        appointmentData.doctorId,
        appointmentDate
      );

      if (closureCheck.isClosed) {
        return {
          success: false,
          error: closureCheck.reason
        };
      }

      const duplicateCheck = await this.checkDuplicateBooking(
        appointmentData.patientId,
        appointmentData.doctorId,
        appointmentDate
      );

      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: 'You already have an appointment with this doctor on the selected date'
        };
      }

      // Parse time and create datetime for conflict check
      const { hours, minutes } = parseTimeString(appointmentData.appointmentTime);
      const appointmentDateTime = new Date(appointmentDate);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      const conflictCheck = await this.checkAppointmentConflict(
        appointmentData.doctorId,
        appointmentDateTime,
        appointmentData.excludeAppointmentId // Pass the exclude ID correctly
      );

      if (conflictCheck.hasConflict) {
        return {
          success: false,
          error: 'This time slot is not available. Please select a different time.'
        };
      }

      // Call Cloud Function to create appointment
      const bookAppointmentFn = httpsCallable(this.functions, 'bookAppointment');
      const result = await bookAppointmentFn({
        patientId: appointmentData.patientId,
        patientName: appointmentData.patientName,
        patientPhone: appointmentData.patientPhone,
        doctorId: appointmentData.doctorId,
        doctorName: appointmentData.doctorName,
        appointmentDate: typeof appointmentData.appointmentDate === 'string'
          ? appointmentData.appointmentDate
          : appointmentData.appointmentDate.toISOString().split('T')[0],
        appointmentTime: appointmentData.appointmentTime,
        reason: appointmentData.reason,
        notes: appointmentData.notes || '',
        status: appointmentData.status || 'pending',
        medicalHistory: appointmentData.medicalHistory || {
          allergies: 'None',
          currentMedications: 'None',
          chronicConditions: 'None'
        }
      });

      if (result.data.success) {
        return {
          success: true,
          appointmentId: result.data.appointmentId,
          message: 'Appointment booked successfully'
        };
      }

      return {
        success: false,
        error: result.data.error || 'Failed to book appointment'
      };
    } catch (error) {
      console.error('Error booking appointment:', error);
      return {
        success: false,
        error: error.message || 'Failed to book appointment'
      };
    }
  }

  /**
   * Cancel an appointment
   * @param {string} appointmentId - Appointment ID
   * @param {string} cancelReason - Reason for cancellation
   * @returns {Promise<object>}
   */
  async cancelAppointment(appointmentId, cancelReason = '') {
    try {
      const cancelAppointmentFn = httpsCallable(this.functions, 'cancelAppointment');
      const result = await cancelAppointmentFn({
        appointmentId,
        cancelReason
      });

      return {
        success: result.data.success,
        message: result.data.message || 'Appointment cancelled'
      };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reschedule an appointment (Receptionist)
   * @param {string} appointmentId - Appointment ID
   * @param {Date} newAppointmentDate - New appointment date
   * @param {string} reason - Reason for rescheduling
   * @returns {Promise<object>}
   */
  async rescheduleAppointment(appointmentId, newAppointmentDate, reason = '') {
    try {
      // Get current appointment
      const appointmentDoc = await getDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId));
      
      if (!appointmentDoc.exists()) {
        return {
          success: false,
          error: 'Appointment not found'
        };
      }

      const appointment = appointmentDoc.data();

      // Check for conflicts at new time
      const conflictCheck = await this.checkAppointmentConflict(
        appointment.doctorId,
        newAppointmentDate,
        appointmentId
      );

      if (conflictCheck.hasConflict) {
        return {
          success: false,
          error: 'The new time slot is not available'
        };
      }

      // Call Cloud Function
      const rescheduleFn = httpsCallable(this.functions, 'rescheduleAppointment');
      const result = await rescheduleFn({
        appointmentId,
        newAppointmentDate: newAppointmentDate.toISOString(),
        reason
      });

      return {
        success: result.data.success,
        message: result.data.message || 'Appointment rescheduled'
      };
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Confirm an appointment (Receptionist)
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<object>}
   */
  async confirmAppointment(appointmentId) {
    try {
      const confirmFn = httpsCallable(this.functions, 'confirmAppointment');
      const result = await confirmFn({ appointmentId });

      return {
        success: result.data.success,
        message: result.data.message || 'Appointment confirmed'
      };
    } catch (error) {
      console.error('Error confirming appointment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete an appointment (Doctor finishes visit)
   * @param {string} appointmentId - Appointment ID
   * @param {object} visitData - { diagnosis, prescription, notes }
   * @returns {Promise<object>}
   */
  async completeAppointment(appointmentId, visitData = {}) {
    try {
      const completeFn = httpsCallable(this.functions, 'completeAppointment');
      const result = await completeFn({
        appointmentId,
        ...visitData
      });

      return {
        success: result.data.success,
        message: result.data.message || 'Visit completed'
      };
    } catch (error) {
      console.error('Error completing appointment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available time slots for a doctor on a specific date
   * @param {string} doctorId - Doctor ID
   * @param {Date} date - Selected date
   * @returns {Promise<array>} - Array of available time slots
   */
  async getAvailableTimeSlots(doctorId, date) {
    try {
      // Get doctor's working hours
      const doctorDoc = await getDoc(doc(this.db, COLLECTIONS.DOCTORS, doctorId));
      
      if (!doctorDoc.exists()) {
        return [];
      }

      const doctorData = doctorDoc.data();
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const workingHours = doctorData.workingHours?.[dayOfWeek];

      if (!workingHours || !workingHours.open) {
        return [];
      }

      // Validate time format
      const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

      const validateAndParseTime = (timeStr) => {
        if (typeof timeStr !== 'string' || !TIME_REGEX.test(timeStr)) {
          return null;
        }
        const [hours, minutes] = timeStr.split(':').map(Number);
        return { hours, minutes };
      };

      // Validate working hours
      const startTime = validateAndParseTime(workingHours.start);
      const endTime = validateAndParseTime(workingHours.end);

      if (!startTime || !endTime) {
        console.error('Invalid working hours configuration:', workingHours);
        return { slots: [], error: 'Invalid working hours configuration' };
      }

      // Single batch query for all appointments on the date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const appointmentsSnapshot = await getDocs(
        query(
          collection(this.db, COLLECTIONS.APPOINTMENTS),
          where('doctorId', '==', doctorId),
          where('appointmentDate', '>=', Timestamp.fromDate(startOfDay)),
          where('appointmentDate', '<=', Timestamp.fromDate(endOfDay)),
          where('status', 'in', ['pending', 'confirmed'])
        )
      );
      
      // Build occupied slots map
      const occupiedSlots = new Set();
      appointmentsSnapshot.forEach(doc => {
        const appointment = doc.data();
        const appointmentTime = appointment.appointmentDate.toDate();
        const slotKey = `${appointmentTime.getHours()}:${appointmentTime.getMinutes()}`;
        occupiedSlots.add(slotKey);
      });

      // Generate time slots (30-minute intervals)
      const slots = [];
      const startTimeDate = new Date(date);
      startTimeDate.setHours(startTime.hours, startTime.minutes, 0, 0);

      const endTimeDate = new Date(date);
      endTimeDate.setHours(endTime.hours, endTime.minutes, 0, 0);

      let currentTime = new Date(startTimeDate);

      while (currentTime < endTimeDate) {
        const slotDate = new Date(currentTime);
        const slotKey = `${slotDate.getHours()}:${slotDate.getMinutes()}`;
        
        slots.push({
          time: slotDate,
          available: !occupiedSlots.has(slotKey),
          display: slotDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
          })
        });

        currentTime.setMinutes(currentTime.getMinutes() + 30);
      }

      return slots;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      return [];
    }
  }

  /**
   * Complete an appointment and save visit notes
   * @param {string} appointmentId - Appointment ID
   * @param {string} diagnosis - Doctor's diagnosis
   * @param {string} prescription - Doctor's prescription
   * @returns {Promise<object>} - { success: boolean, error?: string }
   */
  async finishAppointment(appointmentId, diagnosis, prescription) {
    try {
      const appointmentRef = doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId);
      
      await updateDoc(appointmentRef, {
        status: 'Completed',
        diagnosis,
        prescription,
        completedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error completing appointment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update appointment status
   * @param {string} appointmentId - Appointment ID
   * @param {string} status - New status (e.g., 'Confirmed', 'Rejected', 'Checked-in')
   * @returns {Promise<object>} - { success: boolean, error?: string }
   */
  async updateAppointmentStatus(appointmentId, status) {
    try {
      const appointmentRef = doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId);
      
      await updateDoc(appointmentRef, {
        status,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating appointment status:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new AppointmentService();
