/**
 * emrService.js — Electronic Medical Record data layer
 *
 * Public methods:
 *
 *   getPatientEMR(patientId)
 *     Fires three Firestore queries in parallel via Promise.all:
 *       1. patients/{patientId}      → demographics + medical history
 *       2. appointments collection   → completed encounters (desc date, limit 50)
 *       3. documents collection      → uploaded files (desc uploadedAt, limit 30)
 *     Returns { patient, encounters, documents } — all plain JS objects.
 *     Throws on network/permission error so the caller can display an error state.
 *
 *   fetchPatientCard(patientId, doctorId)
 *     Doctor-scoped view. Fires three Firestore queries in parallel:
 *       1. patients/{patientId}      → demographics + medical history
 *       2. documents collection      → ALL patient docs (client-side filtered by authorizedDoctors)
 *       3. appointments collection   → past appointments between THIS patient and THIS doctor
 *     Returns { patient, documents, encounters } with documents already filtered to only
 *     those the patient explicitly granted this doctor access to.
 *
 *   saveClinicalNote(patientId, doctorId, note)
 *     Writes a note object to the clinical_notes top-level collection.
 *     note: { prognosis, requestedTests, prescribedDrugs }
 *     Returns { success, noteId? }
 *
 * Uses a lazy getter for the Firestore instance to guarantee it is only
 * resolved after authService.js has called initializeApp().
 */

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/firebase';

const CLINICAL_NOTES = 'clinical_notes';

class EMRService {
  /** Lazy Firestore instance — resolved only when first method is called */
  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  /**
   * Fetch a patient's full EMR in a single parallel round-trip.
   *
   * @param {string} patientId  — Firestore UID of the patient document
   * @returns {Promise<{ patient: object|null, encounters: object[], documents: object[] }>}
   * @throws  {Error}  on Firestore failure (caller must handle)
   */
  async getPatientEMR(patientId) {
    const patientRef = doc(this.db, COLLECTIONS.PATIENTS, patientId);

    const encounterQ = query(
      collection(this.db, COLLECTIONS.APPOINTMENTS),
      where('patientId', '==', patientId),
      where('status',    '==', 'completed'),
      orderBy('appointmentDate', 'desc'),
      limit(50),
    );

    const documentsQ = query(
      collection(this.db, COLLECTIONS.DOCUMENTS),
      where('patientId', '==', patientId),
      orderBy('uploadedAt', 'desc'),
      limit(30),
    );

    const [patientSnap, encounterSnap, docsSnap] = await Promise.all([
      getDoc(patientRef),
      getDocs(encounterQ),
      getDocs(documentsQ),
    ]);

    return {
      patient:    patientSnap.exists()
                    ? { id: patientSnap.id, ...patientSnap.data() }
                    : null,
      encounters: encounterSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      documents:  docsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  }

  /**
   * Fetch a doctor-scoped patient card in a single parallel round-trip.
   *
   * Documents are fetched for the patient but then filtered client-side to only
   * those where authorizedDoctors array contains doctorId.  This avoids the need
   * for a composite Firestore index on (patientId + authorizedDoctors).
   *
   * @param {string} patientId  — Firestore UID of the patient
   * @param {string} doctorId   — Firestore UID of the requesting doctor
   * @returns {Promise<{ patient: object|null, documents: object[], encounters: object[] }>}
   * @throws  {Error}  on Firestore failure
   */
  async fetchPatientCard(patientId, doctorId) {
    const patientRef = doc(this.db, COLLECTIONS.PATIENTS, patientId);

    // All documents for this patient — filtered client-side by authorizedDoctors
    const documentsQ = query(
      collection(this.db, COLLECTIONS.DOCUMENTS),
      where('patientId', '==', patientId),
    );

    // Past appointments between this specific patient AND this specific doctor
    const encountersQ = query(
      collection(this.db, COLLECTIONS.APPOINTMENTS),
      where('patientId', '==', patientId),
      where('doctorId',  '==', doctorId),
      where('status',    '==', 'completed'),
      orderBy('appointmentDate', 'desc'),
      limit(50),
    );

    const [patientSnap, docsSnap, encounterSnap] = await Promise.all([
      getDoc(patientRef),
      getDocs(documentsQ),
      getDocs(encountersQ),
    ]);

    // ── Consent filter: only expose docs this doctor is authorised to see ───
    const allDocs = docsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const authorizedDocs = allDocs.filter(
      (d) => Array.isArray(d.authorizedDoctors) && d.authorizedDoctors.includes(doctorId),
    );

    // Sort descending by createdAt / uploadedAt (client-side; no composite index needed)
    authorizedDocs.sort((a, b) => {
      const tsA = (a.createdAt ?? a.uploadedAt)?.toMillis?.() ?? 0;
      const tsB = (b.createdAt ?? b.uploadedAt)?.toMillis?.() ?? 0;
      return tsB - tsA;
    });

    return {
      patient:    patientSnap.exists()
                    ? { id: patientSnap.id, ...patientSnap.data() }
                    : null,
      documents:  authorizedDocs,
      encounters: encounterSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  }

  /**
   * Persist a doctor's clinical note for a patient visit.
   *
   * Writes to the top-level `clinical_notes` collection.
   * Each document is independently addressable so future queries can filter by
   * doctorId, patientId, or appointmentId without a subcollection traversal.
   *
   * @param {string} patientId       — Patient UID
   * @param {string} doctorId        — Doctor UID
   * @param {object} note            — { prognosis, requestedTests, prescribedDrugs, appointmentId? }
   * @returns {Promise<{ success: boolean, noteId?: string, error?: string }>}
   */
  async saveClinicalNote(patientId, doctorId, note = {}) {
    if (!patientId || !doctorId) return { success: false, error: 'Missing patient or doctor ID' };
    try {
      const record = {
        patientId,
        doctorId,
        appointmentId:   note.appointmentId   ?? null,
        prognosis:       (note.prognosis       ?? '').trim(),
        requestedTests:  (note.requestedTests  ?? '').trim(),
        prescribedDrugs: (note.prescribedDrugs ?? '').trim(),
        createdAt:       serverTimestamp(),
      };
      const ref = await addDoc(collection(this.db, CLINICAL_NOTES), record);
      return { success: true, noteId: ref.id };
    } catch (error) {
      console.error('[emrService.saveClinicalNote]', error);
      return { success: false, error: error.message };
    }
  }
}

const emrService = new EMRService();
export default emrService;
export { emrService };
