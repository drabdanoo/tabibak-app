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
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLLECTIONS } from '../config/firebase';

class AppointmentService {
  // Lazy getters: called on first use, after authService has run initializeApp().
  // Module-level getFirestore()/getFunctions() would execute before initializeApp()
  // due to bundler import order, producing an invalid Firestore handle.
  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  get functions() {
    if (!this._functions) this._functions = getFunctions();
    return this._functions;
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

      // When no appointmentTime is provided, the receptionist will assign the
      // time later. Skip time-parsing and conflict check; write directly to
      // Firestore since the Cloud Function requires a time slot.
      const hasTime = !!appointmentData.appointmentTime;

      if (!hasTime) {
        const docRef = await addDoc(
          collection(this.db, COLLECTIONS.APPOINTMENTS),
          {
            patientId:       appointmentData.patientId,
            patientName:     appointmentData.patientName,
            patientPhone:    appointmentData.patientPhone ?? '',
            doctorId:        appointmentData.doctorId,
            doctorName:      appointmentData.doctorName,
            appointmentDate: appointmentData.appointmentDate,
            appointmentTime: '',  // receptionist assigns later
            reason:          appointmentData.reason,
            notes:           appointmentData.notes || '',
            status:          'pending',
            bookingFor:      appointmentData.bookingFor || 'self',
            ...(appointmentData.familyMemberName ? { familyMemberName: appointmentData.familyMemberName } : {}),
            medicalHistory:  appointmentData.medicalHistory || {
              allergies: 'None',
              currentMedications: 'None',
              chronicConditions: 'None',
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
        return { success: true, appointmentId: docRef.id, message: 'Appointment request submitted' };
      }

      // Time-based flow: parse time and check conflicts
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

      const { hours, minutes } = parseTimeString(appointmentData.appointmentTime);
      const appointmentDateTime = new Date(appointmentDate);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      const conflictCheck = await this.checkAppointmentConflict(
        appointmentData.doctorId,
        appointmentDateTime,
        appointmentData.excludeAppointmentId
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
        status: 'completed',
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

  // ─── Slot engine (used by BookAppointmentScreen) ───────────────────────────

  /**
   * Get available 30-minute time slots for a doctor on a given date.
   *
   * Algorithm:
   *   1. Fetch doctor's workingHours for the weekday.
   *      If closed or config missing → return [].
   *   2. Fetch all pending + confirmed appointments on that date.
   *      Build a Set<'HH:MM'> of occupied time keys.
   *   3. Generate 30-min slots from start→end.
   *      Mark each slot available = !occupied && !past (for today).
   *
   * This is a pure data function — zero UI side-effects.
   *
   * @param {string} doctorId — Firestore doctor document ID
   * @param {string} dateStr  — 'YYYY-MM-DD' in local time
   * @returns {Promise<Array<{ display: string, time: string, available: boolean }>>}
   *   display:   '9:00 AM' — human-readable for the slot chip
   *   time:      '09:00'   — HH:MM stored in appointmentTime field
   *   available: boolean   — false if booked or in the past (today only)
   */
  async getAvailableSlots(doctorId, dateStr) {
    try {
      // 1. Doctor working hours
      const doctorSnap = await getDoc(doc(this.db, COLLECTIONS.DOCTORS, doctorId));
      if (!doctorSnap.exists()) return [];

      const [y, m, d] = dateStr.split('-').map(Number);
      const dayName = new Date(y, m - 1, d)
        .toLocaleDateString('en-US', { weekday: 'long' }); // e.g. 'Monday'

      const dayHours = doctorSnap.data().workingHours?.[dayName];
      // Doctor not working this day
      if (!dayHours?.open || !dayHours.start || !dayHours.end) return [];

      // Parse 'HH:MM' → total minutes
      const toMins = (str) => {
        const parts = str.split(':').map(Number);
        return Number.isFinite(parts[0]) && Number.isFinite(parts[1])
          ? parts[0] * 60 + parts[1]
          : null;
      };
      const startMins = toMins(dayHours.start);
      const endMins   = toMins(dayHours.end);
      if (startMins === null || endMins === null || startMins >= endMins) return [];

      // 2. Booked appointments → occupied Set<'HH:MM'>
      const apptSnap = await getDocs(query(
        collection(this.db, COLLECTIONS.APPOINTMENTS),
        where('doctorId', '==', doctorId),
        where('appointmentDate', '==', dateStr),
        where('status', 'in', ['pending', 'confirmed']),
      ));

      const occupied = new Set();
      apptSnap.forEach(docSnap => {
        const raw = docSnap.data().appointmentTime; // '09:00' or '9:00 AM'
        if (!raw) return;
        let hh, mm;
        if (/[AP]M/i.test(raw)) {
          const [timePart, period] = raw.trim().split(/\s+/);
          [hh, mm] = timePart.split(':').map(Number);
          if (period.toUpperCase() === 'PM' && hh !== 12) hh += 12;
          if (period.toUpperCase() === 'AM' && hh === 12) hh = 0;
        } else {
          [hh, mm] = raw.split(':').map(Number);
        }
        if (Number.isFinite(hh) && Number.isFinite(mm)) {
          occupied.add(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
        }
      });

      // 3. Generate slots; mark past slots on today as unavailable
      const now     = new Date();
      const nowMins = now.getFullYear() === y && (now.getMonth() + 1) === m && now.getDate() === d
        ? now.getHours() * 60 + now.getMinutes()
        : -1; // not today — never filter by time

      const slots = [];
      for (let mins = startMins; mins < endMins; mins += 30) {
        const hh  = Math.floor(mins / 60);
        const mm  = mins % 60;
        const key = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        const period = hh >= 12 ? 'PM' : 'AM';
        const h12    = hh % 12 || 12;
        const display = `${h12}:${String(mm).padStart(2, '0')} ${period}`;
        const isPast  = nowMins >= 0 && mins <= nowMins;
        slots.push({ display, time: key, available: !occupied.has(key) && !isPast });
      }
      return slots;
    } catch (err) {
      console.error('[appointmentService.getAvailableSlots]', err);
      return [];
    }
  }

  // ─── Real-time subscriptions (used by DoctorDashboardScreen) ───────────────

  /**
   * Real-time listener: today's confirmed + completed appointments for a doctor.
   * Ordered by appointmentTime ASC.
   *
   * @param {string}   uid      — Doctor UID
   * @param {function} onChange — Receives array of appointment objects on each update
   * @param {function} onError  — Receives Firestore error on listener failure
   * @returns {function} unsubscribe — call in component cleanup
   */
  subscribeTodaySchedule(uid, onChange, onError) {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    // No orderBy here — avoids the composite index requirement.
    // Sorting is done client-side on appointmentTime (HH:MM string, lexicographic = correct).
    const q = query(
      collection(this.db, COLLECTIONS.APPOINTMENTS),
      where('doctorId', '==', uid),
      where('appointmentDate', '==', today),
      where('status', 'in', ['confirmed', 'completed']),
    );
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (a.appointmentTime ?? '').localeCompare(b.appointmentTime ?? ''));
        onChange(docs);
      },
      onError,
    );
  }

  /**
   * Real-time listener: all pending appointment requests for a doctor,
   * ordered earliest-first (most urgent first).
   *
   * @param {string}   uid      — Doctor UID
   * @param {function} onChange — Receives array of appointment objects on each update
   * @param {function} onError  — Receives Firestore error on listener failure
   * @returns {function} unsubscribe — call in component cleanup
   */
  subscribePendingRequests(uid, onChange, onError) {
    // No orderBy here — avoids composite index requirements.
    // Sorting is done client-side: date first (YYYY-MM-DD lexicographic = correct),
    // then time (HH:MM lexicographic = correct).
    const q = query(
      collection(this.db, COLLECTIONS.APPOINTMENTS),
      where('doctorId', '==', uid),
      where('status', '==', 'pending'),
    );
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const dateComp = (a.appointmentDate ?? '').localeCompare(b.appointmentDate ?? '');
          if (dateComp !== 0) return dateComp;
          return (a.appointmentTime ?? '').localeCompare(b.appointmentTime ?? '');
        });
        onChange(docs);
      },
      onError,
    );
  }

  /**
   * Accept a pending appointment request.
   *
   * @param {string} appointmentId
   * @param {string} doctorUid — Written to confirmedBy field
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async acceptAppointment(appointmentId, doctorUid) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status: 'confirmed',
        confirmedAt: serverTimestamp(),
        confirmedBy: doctorUid ?? 'doctor',
      });
      return { success: true };
    } catch (error) {
      console.error('[appointmentService.acceptAppointment]', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Decline (cancel) a pending appointment request.
   *
   * @param {string} appointmentId
   * @param {string} doctorUid — Written to cancelledBy field
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async declineAppointment(appointmentId, doctorUid) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: doctorUid ?? 'doctor',
      });
      return { success: true };
    } catch (error) {
      console.error('[appointmentService.declineAppointment]', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark a confirmed appointment as completed (visit finished).
   *
   * @param {string} appointmentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async markAppointmentDone(appointmentId) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('[appointmentService.markAppointmentDone]', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Legacy: direct status update ──────────────────────────────────────────

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

  // ─── Receptionist workflow mutations ────────────────────────────────────────
  //
  // All four methods write directly to Firestore (no Cloud Function hop) because
  // these are internal queue-management transitions — no patient notification is
  // triggered.  Each method writes a status-specific timestamp alongside the
  // generic `updatedAt` field so the audit trail stays clean.

  /**
   * Accept (confirm) a pending appointment — receptionist path.
   * pending → confirmed.
   *
   * @param {string} appointmentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async receptionistAccept(appointmentId) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:      'confirmed',
        confirmedAt: serverTimestamp(),
        confirmedBy: 'receptionist',
        updatedAt:   serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('[appointmentService.receptionistAccept]', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Decline (cancel) a pending appointment — receptionist path.
   * pending → cancelled.
   *
   * @param {string} appointmentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async receptionistDecline(appointmentId) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:      'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: 'receptionist',
        updatedAt:   serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('[appointmentService.receptionistDecline]', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check in a confirmed patient — receptionist path.
   * confirmed → waiting.
   *
   * @param {string} appointmentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async checkInPatient(appointmentId) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:    'waiting',
        waitingAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('[appointmentService.checkInPatient]', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a waiting patient to the doctor's room — receptionist path.
   * waiting → in_progress.
   *
   * @param {string} appointmentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendToDoctor(appointmentId) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:       'in_progress',
        inProgressAt: serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('[appointmentService.sendToDoctor]', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Walk-In helpers (used by WalkInBookingScreen) ──────────────────────────

  /**
   * Search for an existing patient by their normalised phone number.
   * The caller must pre-normalise to E.164 Iraqi format (+9647XXXXXXXXX).
   * Returns the first matching patient document object, or null.
   *
   * @param {string} normalizedPhone — e.g. '+9647701234567'
   * @returns {Promise<object|null>}
   */
  async searchPatientByPhone(normalizedPhone) {
    try {
      const snap = await getDocs(query(
        collection(this.db, COLLECTIONS.PATIENTS),
        where('phoneNumber', '==', normalizedPhone),
        limit(1),
      ));
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    } catch (error) {
      console.error('[appointmentService.searchPatientByPhone]', error);
      return null;
    }
  }

  /**
   * Fetch a lightweight doctor list for the walk-in doctor selector.
   * Returns at most 50 doctors sorted by name ascending.
   *
   * @returns {Promise<Array<{ id: string, name: string, specialty: string }>>}
   */
  async fetchDoctorById(doctorId) {
    try {
      const snap = await getDoc(doc(this.db, COLLECTIONS.DOCTORS, doctorId));
      if (!snap.exists()) return null;
      return {
        id:        snap.id,
        name:      snap.data().name      ?? snap.data().fullName ?? '—',
        specialty: snap.data().specialty ?? '',
      };
    } catch (error) {
      console.error('[appointmentService.fetchDoctorById]', error);
      return null;
    }
  }

  async fetchAllDoctors() {
    try {
      const snap = await getDocs(query(
        collection(this.db, COLLECTIONS.DOCTORS),
        orderBy('name', 'asc'),
        limit(50),
      ));
      return snap.docs.map(d => ({
        id:        d.id,
        name:      d.data().name      ?? d.data().fullName ?? '—',
        specialty: d.data().specialty ?? '',
      }));
    } catch (error) {
      console.error('[appointmentService.fetchAllDoctors]', error);
      return [];
    }
  }

  /**
   * Create a walk-in appointment for a receptionist-managed patient.
   *
   * Flow:
   *   1. If `patientData.isNew` → create a lightweight patient document in
   *      COLLECTIONS.PATIENTS and use the new document ID as patientId.
   *   2. Create an appointment document with status: 'waiting' and
   *      appointmentTime set to the current local time ('HH:MM'), so the
   *      patient appears immediately in the receptionist's waiting queue.
   *
   * @param {object} patientData
   *   { id?: string, fullName: string, phoneNumber: string, gender?: string, isNew: boolean }
   * @param {string} doctorId
   * @param {string} doctorName
   * @returns {Promise<{ success: boolean, appointmentId?: string, error?: string }>}
   */
  async createWalkInAppointment(patientData, doctorId, doctorName) {
    try {
      let resolvedPatientId = patientData.id ?? null;

      // ── 1. Register new patient document (walk-in, no Firebase Auth account) ─
      if (patientData.isNew) {
        const newPatientRef = await addDoc(
          collection(this.db, COLLECTIONS.PATIENTS),
          {
            fullName:     patientData.fullName,
            phoneNumber:  patientData.phoneNumber,
            gender:       patientData.gender ?? '',
            role:         'patient',
            registeredBy: 'receptionist',
            dateOfBirth:  '',
            createdAt:    serverTimestamp(),
            updatedAt:    serverTimestamp(),
          },
        );
        resolvedPatientId = newPatientRef.id;
      }

      // ── 2. Build date + time strings from current local time ──────────────
      const now     = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // ── 3. Create the appointment document ────────────────────────────────
      const apptRef = await addDoc(
        collection(this.db, COLLECTIONS.APPOINTMENTS),
        {
          patientId:       resolvedPatientId,
          patientName:     patientData.fullName,
          patientPhone:    patientData.phoneNumber,
          doctorId,
          doctorName,
          appointmentDate:    Timestamp.fromDate(now), // Timestamp — picked up by dashboard range query
          appointmentDateStr: dateStr,                 // string   — used by AppointmentManagementScreen
          appointmentTime: timeStr,
          status:          'waiting',
          reason:          'Walk-in',
          walkIn:          true,
          bookingFor:      'self',
          notes:           '',
          createdAt:       serverTimestamp(),
          updatedAt:       serverTimestamp(),
        },
      );

      return { success: true, appointmentId: apptRef.id };
    } catch (error) {
      console.error('[appointmentService.createWalkInAppointment]', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Receptionist real-time subscription ────────────────────────────────────

  /**
   * Real-time listener: ALL appointments for a given date (any status).
   * Used by AppointmentManagementScreen to power the receptionist's daily queue.
   *
   * Sorted client-side by appointmentTime (HH:MM lexicographic = chronological).
   * No orderBy in the query — avoids composite-index requirements.
   *
   * @param {string}   dateStr  — 'YYYY-MM-DD'
   * @param {function} onChange — Receives sorted appointment array on every update
   * @param {function} onError  — Receives Firestore error on listener failure
   * @returns {function} unsubscribe — call in component cleanup
   */
  /**
   * Fetch completed appointments + consultation fee for the past 7 days.
   * Returns { dailyCounts: [{date, count}], totalRevenue, todayRevenue, consultationFee }
   */
  async getWeeklyStats(doctorId) {
    try {
      // Build last-7-days date strings (YYYY-MM-DD)
      const today = new Date();
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }

      const todayStr = dates[dates.length - 1];

      // Fetch completed appointments for these dates
      const q = query(
        collection(this.db, COLLECTIONS.APPOINTMENTS),
        where('doctorId', '==', doctorId),
        where('status', '==', 'completed'),
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ ...d.data() }));

      // Count per day
      const countMap = {};
      dates.forEach(d => { countMap[d] = 0; });
      all.forEach(a => {
        if (countMap[a.appointmentDate] !== undefined) {
          countMap[a.appointmentDate]++;
        }
      });

      const dailyCounts = dates.map(date => ({
        date,
        dayLabel: new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
        count: countMap[date],
        isToday: date === todayStr,
      }));

      // Fetch consultation fee from doctors collection
      let consultationFee = 0;
      try {
        const docSnap = await getDoc(doc(this.db, COLLECTIONS.DOCTORS, doctorId));
        consultationFee = docSnap.exists() ? (docSnap.data().consultationFee ?? 0) : 0;
      } catch { /* fee unavailable */ }

      const todayCount = countMap[todayStr] ?? 0;
      const weekTotal  = dates.reduce((s, d) => s + countMap[d], 0);

      return {
        dailyCounts,
        consultationFee,
        todayRevenue: todayCount * consultationFee,
        totalRevenue: weekTotal  * consultationFee,
      };
    } catch (err) {
      console.error('[appointmentService.getWeeklyStats]', err);
      return { dailyCounts: [], consultationFee: 0, todayRevenue: 0, totalRevenue: 0 };
    }
  }

  // ─── Mark No-Show ────────────────────────────────────────────────────────
  async markNoShow(appointmentId) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.APPOINTMENTS, appointmentId), {
        status:       'no_show',
        noShowAt:     serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
      return { success: true };
    } catch (err) {
      console.error('[appointmentService.markNoShow]', err);
      return { success: false, error: err.message };
    }
  }

  // ─── Emergency Override — cancel all pending/confirmed for a doctor on a date ─
  async clearDayAppointments(doctorId, dateStr) {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end   = new Date(year, month - 1, day, 23, 59, 59, 999);

      const snap = await getDocs(query(
        collection(this.db, COLLECTIONS.APPOINTMENTS),
        where('doctorId',        '==',  doctorId),
        where('appointmentDate', '>=',  Timestamp.fromDate(start)),
        where('appointmentDate', '<=',  Timestamp.fromDate(end)),
        where('status',          'in',  ['pending', 'confirmed']),
      ));

      if (snap.empty) return { success: true, count: 0 };

      await Promise.all(
        snap.docs.map(d =>
          updateDoc(d.ref, {
            status:      'cancelled',
            cancelledBy: 'doctor_emergency',
            cancelledAt: serverTimestamp(),
            updatedAt:   serverTimestamp(),
          }),
        ),
      );

      return { success: true, count: snap.docs.length };
    } catch (err) {
      console.error('[appointmentService.clearDayAppointments]', err);
      return { success: false, error: err.message };
    }
  }

  subscribeReceptionistAppointments(dateStr, onChange, onError) {
    // Build Timestamp range for the selected date (00:00 → 23:59:59)
    const [year, month, day] = dateStr.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end   = new Date(year, month - 1, day, 23, 59, 59, 999);

    const q = query(
      collection(this.db, COLLECTIONS.APPOINTMENTS),
      where('appointmentDate', '>=', Timestamp.fromDate(start)),
      where('appointmentDate', '<=', Timestamp.fromDate(end)),
      orderBy('appointmentDate', 'asc'),
    );
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (a.appointmentTime ?? '').localeCompare(b.appointmentTime ?? ''));
        onChange(docs);
      },
      onError,
    );
  }
}

export default new AppointmentService();
