/**
 * userService.js — Authenticated user profile mutations
 *
 * Handles write operations for authenticated user profiles in Firestore.
 * The lazy `get db()` getter prevents getFirestore() from running at module
 * load time before authService has called initializeApp().
 *
 * Used by:
 *   PatientProfileScreen  — updateUserProfile (patient edits their own data)
 */

import {
  getFirestore,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/firebase';

class UserService {
  // ── Lazy Firestore instance ─────────────────────────────────────────────────
  get db() {
    if (!this._db) this._db = getFirestore();
    return this._db;
  }

  /**
   * Update a patient's editable profile fields.
   *
   * Only the keys present in `data` are touched; all other fields on the
   * document remain unchanged (Firestore updateDoc partial-update semantics).
   *
   * @param {string} uid  — Patient Firebase UID (= PATIENTS document ID)
   * @param {object} data — Subset of profile fields to write.
   *   Supported keys: fullName, gender, bloodType, dateOfBirth
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async updateUserProfile(uid, data) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.PATIENTS, uid), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('[userService.updateUserProfile]', error);
      return { success: false, error: error.message };
    }
  }
}

export default new UserService();
