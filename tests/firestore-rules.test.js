'use strict';

/**
 * Firestore security rules tests
 *
 * Covers the rules changed in P1:
 *  - /patients/{uid}         isDoctorForPatient() gating
 *  - /appointmentNotes/{id}  doctorId-scoped read/write/delete
 *  - /familyMembers/{id}     isDoctorForPatient() gating
 *  - /medicalHistory/{id}    isDoctorForPatient() gating
 *
 * How to run:
 *   Option A (recommended):
 *     firebase emulators:exec --only firestore "npm test"
 *
 *   Option B (two terminals):
 *     Terminal 1:  firebase emulators:start --only firestore
 *     Terminal 2:  npm test
 */

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { setDoc, getDoc, doc, collection } = require('firebase/firestore');

const RULES = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');
const PROJECT_ID = 'demo-medconnect-test';

// UIDs used across tests
const DOCTOR_ID   = 'doctor-001';
const PATIENT_ID  = 'patient-001';
const OTHER_PATIENT_ID = 'patient-002';
const ADMIN_ID    = 'admin-001';
const OTHER_DOCTOR_ID = 'doctor-002';

let testEnv;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: 'localhost',
      port: 9090,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write seed data bypassing rules */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

function asDoctor(extraClaims = {})  { return testEnv.authenticatedContext(DOCTOR_ID,  { doctor: true,  ...extraClaims }).firestore(); }
function asPatient(extraClaims = {}) { return testEnv.authenticatedContext(PATIENT_ID, { patient: true, ...extraClaims }).firestore(); }
function asAdmin()   { return testEnv.authenticatedContext(ADMIN_ID, { admin: true }).firestore(); }
function asAnon()    { return testEnv.unauthenticatedContext().firestore(); }
function asOtherDoctor() { return testEnv.authenticatedContext(OTHER_DOCTOR_ID, { doctor: true }).firestore(); }

// ---------------------------------------------------------------------------
// /patients/{uid}
// ---------------------------------------------------------------------------

describe('/patients/{uid}', () => {
  const patientPath = `patients/${PATIENT_ID}`;

  beforeEach(async () => {
    await seed(patientPath, { name: 'Test Patient', uid: PATIENT_ID });
  });

  test('patient can read their own profile', async () => {
    await assertSucceeds(
      getDoc(doc(asPatient(), patientPath))
    );
  });

  test('doctor with patient in patients[] can read', async () => {
    await seed(`doctors/${DOCTOR_ID}`, { patients: [PATIENT_ID] });
    await assertSucceeds(
      getDoc(doc(asDoctor(), patientPath))
    );
  });

  test('doctor WITHOUT patient in patients[] is denied', async () => {
    await seed(`doctors/${DOCTOR_ID}`, { patients: [] });
    await assertFails(
      getDoc(doc(asDoctor(), patientPath))
    );
  });

  test('doctor with no patients field is denied', async () => {
    await seed(`doctors/${DOCTOR_ID}`, { name: 'Dr. Test' }); // no patients field
    await assertFails(
      getDoc(doc(asDoctor(), patientPath))
    );
  });

  test('admin can read any patient', async () => {
    await assertSucceeds(
      getDoc(doc(asAdmin(), patientPath))
    );
  });

  test('unauthenticated user is denied', async () => {
    await assertFails(
      getDoc(doc(asAnon(), patientPath))
    );
  });

  test('different patient cannot read another patient profile', async () => {
    const otherPatientDb = testEnv.authenticatedContext('patient-other', { patient: true }).firestore();
    await assertFails(
      getDoc(doc(otherPatientDb, patientPath))
    );
  });
});

// ---------------------------------------------------------------------------
// /appointmentNotes/{noteId}
// ---------------------------------------------------------------------------

describe('/appointmentNotes/{noteId}', () => {
  const noteId   = 'note-001';
  const notePath = `appointmentNotes/${noteId}`;

  beforeEach(async () => {
    await seed(notePath, {
      doctorId:  DOCTOR_ID,
      patientId: PATIENT_ID,
      notes:     'Patient responded well.',
    });
  });

  test('note author (doctor) can read their own note', async () => {
    await assertSucceeds(
      getDoc(doc(asDoctor(), notePath))
    );
  });

  test('patient can read a note about themselves', async () => {
    await assertSucceeds(
      getDoc(doc(asPatient(), notePath))
    );
  });

  test('admin can read any note', async () => {
    await assertSucceeds(
      getDoc(doc(asAdmin(), notePath))
    );
  });

  test('different doctor cannot read another doctor\'s note', async () => {
    await assertFails(
      getDoc(doc(asOtherDoctor(), notePath))
    );
  });

  test('doctor can create a note with their own doctorId', async () => {
    const newNotePath = 'appointmentNotes/note-new';
    await assertSucceeds(
      setDoc(doc(asDoctor(), newNotePath), {
        doctorId:  DOCTOR_ID,
        patientId: PATIENT_ID,
        notes:     'New note.',
      })
    );
  });

  test('doctor cannot create a note with a different doctorId', async () => {
    const newNotePath = 'appointmentNotes/note-fake';
    await assertFails(
      setDoc(doc(asDoctor(), newNotePath), {
        doctorId:  OTHER_DOCTOR_ID,   // spoofing another doctor
        patientId: PATIENT_ID,
        notes:     'Injected note.',
      })
    );
  });

  test('doctor can delete their own note', async () => {
    const { deleteDoc } = require('firebase/firestore');
    await assertSucceeds(
      deleteDoc(doc(asDoctor(), notePath))
    );
  });

  test('different doctor cannot delete another doctor\'s note', async () => {
    const { deleteDoc } = require('firebase/firestore');
    await assertFails(
      deleteDoc(doc(asOtherDoctor(), notePath))
    );
  });
});

// ---------------------------------------------------------------------------
// /familyMembers/{memberId}
// ---------------------------------------------------------------------------

describe('/familyMembers/{memberId}', () => {
  const memberId   = 'member-001';
  const memberPath = `familyMembers/${memberId}`;

  beforeEach(async () => {
    await seed(memberPath, {
      primaryUserId: PATIENT_ID,
      name: 'Family Member',
    });
  });

  test('primary user (patient) can read their family member', async () => {
    await assertSucceeds(
      getDoc(doc(asPatient(), memberPath))
    );
  });

  test('doctor with patient in patients[] can read family member', async () => {
    await seed(`doctors/${DOCTOR_ID}`, { patients: [PATIENT_ID] });
    await assertSucceeds(
      getDoc(doc(asDoctor(), memberPath))
    );
  });

  test('doctor WITHOUT patient in patients[] is denied', async () => {
    await seed(`doctors/${DOCTOR_ID}`, { patients: [] });
    await assertFails(
      getDoc(doc(asDoctor(), memberPath))
    );
  });

  test('admin can read family members', async () => {
    await assertSucceeds(
      getDoc(doc(asAdmin(), memberPath))
    );
  });
});

// ---------------------------------------------------------------------------
// /medicalHistory/{historyId}
// ---------------------------------------------------------------------------

describe('/medicalHistory/{historyId}', () => {
  const historyPath = `medicalHistory/history-001`;

  beforeEach(async () => {
    await seed(historyPath, {
      patientId: PATIENT_ID,
      notes: 'Chronic condition.',
    });
  });

  test('patient can read their own medical history', async () => {
    await assertSucceeds(
      getDoc(doc(asPatient(), historyPath))
    );
  });

  test('doctor with patient in patients[] can read medical history', async () => {
    await seed(`doctors/${DOCTOR_ID}`, { patients: [PATIENT_ID] });
    await assertSucceeds(
      getDoc(doc(asDoctor(), historyPath))
    );
  });

  test('doctor WITHOUT patient in patients[] is denied', async () => {
    await seed(`doctors/${DOCTOR_ID}`, { patients: [] });
    await assertFails(
      getDoc(doc(asDoctor(), historyPath))
    );
  });

  test('admin can read medical history', async () => {
    await assertSucceeds(
      getDoc(doc(asAdmin(), historyPath))
    );
  });
});

// ---------------------------------------------------------------------------
// /prescriptions  — doctorId-scoped create/update
// ---------------------------------------------------------------------------

describe('/prescriptions/{prescriptionId}', () => {
  const rxPath = 'prescriptions/rx-001';

  beforeEach(async () => {
    await seed(rxPath, { doctorId: DOCTOR_ID, patientId: PATIENT_ID });
  });

  test('doctor can create prescription with their own doctorId', async () => {
    const { setDoc: sd } = require('firebase/firestore');
    await assertSucceeds(
      sd(doc(asDoctor(), 'prescriptions/rx-new'), {
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
      })
    );
  });

  test('doctor cannot create prescription with a different doctorId', async () => {
    const { setDoc: sd } = require('firebase/firestore');
    await assertFails(
      sd(doc(asDoctor(), 'prescriptions/rx-fake'), {
        doctorId: OTHER_DOCTOR_ID,
        patientId: PATIENT_ID,
      })
    );
  });

  test('patient cannot create a prescription', async () => {
    const { setDoc: sd } = require('firebase/firestore');
    await assertFails(
      sd(doc(asPatient(), 'prescriptions/rx-new'), {
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// /medicalHistory — doctorId-scoped create (isDoctorForPatient)
// ---------------------------------------------------------------------------

describe('/medicalHistory create', () => {
  test('doctor with patient in patients[] can create history entry', async () => {
    const { setDoc: sd } = require('firebase/firestore');
    await seed(`doctors/${DOCTOR_ID}`, { patients: [PATIENT_ID] });
    await assertSucceeds(
      sd(doc(asDoctor(), 'medicalHistory/h-new'), {
        patientId: PATIENT_ID,
        notes: 'New entry.',
      })
    );
  });

  test('doctor WITHOUT patient in patients[] cannot create history entry', async () => {
    const { setDoc: sd } = require('firebase/firestore');
    await seed(`doctors/${DOCTOR_ID}`, { patients: [] });
    await assertFails(
      sd(doc(asDoctor(), 'medicalHistory/h-new'), {
        patientId: PATIENT_ID,
        notes: 'Injected entry.',
      })
    );
  });
});

// ---------------------------------------------------------------------------
// /doctors/{uid}  — public read sanity check (should not regress)
// ---------------------------------------------------------------------------

describe('/doctors/{uid} (public read sanity)', () => {
  const doctorPath = `doctors/${DOCTOR_ID}`;

  beforeEach(async () => {
    await seed(doctorPath, { name: 'Dr. Test', specialty: 'General' });
  });

  test('anyone can read a doctor profile (public listing)', async () => {
    await assertSucceeds(getDoc(doc(asAnon(),    doctorPath)));
    await assertSucceeds(getDoc(doc(asPatient(), doctorPath)));
    await assertSucceeds(getDoc(doc(asDoctor(),  doctorPath)));
  });
});
