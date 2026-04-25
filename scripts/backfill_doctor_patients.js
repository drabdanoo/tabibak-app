/**
 * backfill_doctor_patients.js
 * ---------------------------
 * One-time script: reads every appointment in Firestore and populates the
 * `patients` array on each doctor document so that the Firestore security
 * rule `isDoctorForPatient()` works for pre-existing bookings.
 *
 * Usage (run once from the project root):
 *   node scripts/backfill_doctor_patients.js
 *
 * Requirements:
 *   npm install dotenv firebase-admin   (already installed)
 *
 * Credentials: reads .env at the project root (same JSON blob used by
 * Cloud Functions locally). Falls back to Application Default Credentials
 * if FIREBASE_PRIVATE_KEY is not set.
 *
 * The script is safe to re-run — arrayUnion is idempotent.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Init — reads the service account JSON from .env at the project root,
// or falls back to Application Default Credentials (firebase login).
// ---------------------------------------------------------------------------

const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(envPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Reading all appointments…');

  const snap = await db.collection('appointments').get();
  console.log(`Found ${snap.size} appointment(s).`);

  // Build a map: doctorId → Set<patientId>
  const doctorPatients = new Map();

  for (const doc of snap.docs) {
    const { doctorId, patientId, userId } = doc.data();
    const patient = patientId || userId; // field name varies across bookings

    if (!doctorId || !patient) continue;

    if (!doctorPatients.has(doctorId)) doctorPatients.set(doctorId, new Set());
    doctorPatients.get(doctorId).add(patient);
  }

  console.log(`Found ${doctorPatients.size} doctor(s) with patients to backfill.`);

  // Write in batches of 500 (Firestore batch limit)
  const BATCH_SIZE = 500;
  let written = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const [doctorId, patients] of doctorPatients) {
    const patientArray = Array.from(patients);
    const doctorRef = db.collection('doctors').doc(doctorId);

    batch.update(doctorRef, {
      patients: admin.firestore.FieldValue.arrayUnion(...patientArray),
    });

    opsInBatch++;
    written += patientArray.length;

    if (opsInBatch >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch of ${opsInBatch} doctor updates…`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`Done. Updated ${doctorPatients.size} doctor document(s), covering ${written} patient UID(s).`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
