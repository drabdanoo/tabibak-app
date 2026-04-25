/**
 * features.js — Vanbook Feature Flags
 *
 * This file controls which features are visible in the app.
 * It was introduced to allow a "store-safe" build for individual
 * Apple App Store submission, while keeping all code intact for
 * future restoration (e.g. when submitting under an organisation account).
 *
 * ─── HOW TO RESTORE ALL FEATURES ────────────────────────────────────────────
 *
 *  1. Set every flag below to `true`
 *  2. In src/locales/en.js restore the original labels:
 *       roles.patient        → 'Patient'
 *       roles.doctor         → 'Doctor'
 *       roles.receptionist   → 'Receptionist'
 *       roles.patientDesc    → 'Book appointments, view medical records'
 *       roles.doctorDesc     → 'Manage appointments, patient records'
 *       appointments.fee     → 'Consultation Fee'
 *       appointments.medicalHistoryTitle → 'Medical History'
 *       appointments.medicalHistorySub   → 'Help the doctor prepare...'
 *       appointments.allergiesLabel      → 'Allergies'
 *       appointments.medicationsLabel    → 'Current Medications'
 *       appointments.conditionsLabel     → 'Chronic Conditions'
 *       doctors section titleKey         → 'Doctors' / 'Find a Doctor'
 *       patient.profileScreen.patientLabel → 'Patient'
 *       doctor.stats.today               → "Today's Patients"
 *       doctor.patientDetails            → 'Patient Details'
 *  3. In src/locales/ar.js restore:
 *       auth.profileSubtitle  → 'بعض التفاصيل حتى يتعرّف عليك طبيبك'
 *       auth.profileDoctorNote → 'مطلوب من طبيبك — الاسم وتاريخ الميلاد...'
 *  4. Run `expo start` / EAS build as normal
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const FEATURES = {
  /**
   * PATIENT — Prescription Inbox
   * Shows the PrescriptionInboxScreen tab/quick card for patients.
   * Firestore: reads from `prescriptions` collection.
   */
  PRESCRIPTION_INBOX: false,

  /**
   * PATIENT — Lab Orders
   * Shows the LabOrdersScreen tab/quick card for patients.
   * Firestore: reads from `labOrders` collection.
   */
  LAB_ORDERS: false,

  /**
   * PATIENT — Medical Documents tab
   * Adds a "Documents" tab in PatientTabs and a quick action in PatientProfile.
   * Firestore: reads from `documents` sub-collection.
   */
  MEDICAL_DOCUMENTS_TAB: false,

  /**
   * PATIENT PROFILE — Extended fields (blood type, gender)
   * Adds blood-type grid and gender chip selector to PatientProfileScreen.
   * Firestore: writes `bloodType` and `gender` to patients/{uid}.
   */
  EXTENDED_PATIENT_PROFILE: false,

  /**
   * DOCTOR — EMR Screen (standalone Electronic Medical Record)
   * Registers EMRScreen in DoctorStack and enables navigation to it.
   */
  EMR_SCREEN: false,

  /**
   * DOCTOR — Standalone Prescription Screen
   * Registers PrescriptionScreen in DoctorStack and enables navigation to it.
   * Note: inline prescriptions inside PatientDetailsScreen → Visit tab
   * are NOT affected by this flag (they are always available to the doctor).
   */
  PRESCRIPTION_SCREEN: false,
};
