/**
 * import_doctors.js
 * -----------------
 * Seeds the Firestore `doctors` collection from tabib_doctors_clean.csv.
 *
 * Usage:
 *   node scripts/import_doctors.js <path/to/tabib_doctors_clean.csv>
 *
 * Requirements (install once in the project root):
 *   npm install csv-parse dotenv firebase-admin
 *
 * The script uses the same service-account credentials already used by
 * the Cloud Functions (reads FIREBASE_* env vars from functions/.env,
 * or falls back to Application Default Credentials for production).
 *
 * Doctors are imported as "seeded" records — they do NOT have Firebase Auth
 * accounts. They are stored under auto-generated Firestore document IDs.
 * Existing seeded doctors are left untouched (idempotent by name+address).
 */

const path    = require('path');
const fs      = require('fs');
const { parse } = require('csv-parse/sync');
const admin   = require('firebase-admin');

// ── Load env (functions/.env has the service account) ────────────────────────
require('dotenv').config({ path: path.join(__dirname, '../functions/.env') });

// ── Firebase Admin init ───────────────────────────────────────────────────────
if (!admin.apps.length) {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        type:                        process.env.FIREBASE_TYPE,
        project_id:                  process.env.FIREBASE_PROJECT_ID,
        private_key_id:              process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key:                 process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email:                process.env.FIREBASE_CLIENT_EMAIL,
        client_id:                   process.env.FIREBASE_CLIENT_ID,
        auth_uri:                    process.env.FIREBASE_AUTH_URI,
        token_uri:                   process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url:        process.env.FIREBASE_CLIENT_X509_CERT_URL,
      }),
    });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS or gcloud default login
    admin.initializeApp();
  }
}

const db = admin.firestore();

// ── Default working hours (all days 09:00–17:00, Fri/Sat off) ────────────────
const DEFAULT_WORKING_HOURS = {
  Sunday:    { open: true,  start: '15:00', end: '20:00' },
  Monday:    { open: true,  start: '15:00', end: '20:00' },
  Tuesday:   { open: true,  start: '15:00', end: '20:00' },
  Wednesday: { open: true,  start: '15:00', end: '20:00' },
  Thursday:  { open: true,  start: '15:00', end: '20:00' },
  Friday:    { open: false, start: '10:00', end: '21:00' },
  Saturday:  { open: true,  start: '10:00', end: '21:00' },
};

// ── Map city_id → city name (from Tabib app data) ────────────────────────────
const CITY_MAP = {
  '1': 'الموصل',
  '2': 'نينوى',
  '3': 'بغداد',
};

// ── Normalise a phone number to Iraqi format ──────────────────────────────────
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // Already starts with 07xx
  if (digits.startsWith('07') && digits.length === 11) return digits;
  // Starts with 009647 or +9647
  if (digits.startsWith('9647') && digits.length === 13) return '0' + digits.slice(2);
  // Starts with 964 without leading 00
  if (digits.startsWith('964') && digits.length === 13) return '0' + digits.slice(3);
  return digits.length >= 10 ? digits : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/import_doctors.js <path/to/tabib_doctors_clean.csv>');
    process.exit(1);
  }

  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  // ── Parse CSV ──────────────────────────────────────────────────────────────
  const raw = fs.readFileSync(absPath, 'utf8');
  const records = parse(raw, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
    bom:              true,   // handle Excel-saved UTF-8 BOM
  });

  console.log(`\n📋 Parsed ${records.length} records from CSV\n`);

  // ── Check for existing seeded doctors (idempotency) ────────────────────────
  const existingSnap = await db.collection('doctors')
    .where('isSeeded', '==', true)
    .get();

  // Key = "name||address" to identify same-doctor-different-location duplicates
  const existingKeys = new Set(
    existingSnap.docs.map(d => `${d.data().name}||${d.data().address ?? ''}`)
  );
  console.log(`ℹ️  ${existingKeys.size} seeded doctors already in Firestore — skipping duplicates\n`);

  // ── Batch write (max 500 ops per batch) ───────────────────────────────────
  let batch      = db.batch();
  let batchCount = 0;
  let imported   = 0;
  let skipped    = 0;
  let noPhone    = 0;
  let noPhoto    = 0;

  for (const row of records) {
    const name    = (row.name    || '').trim();
    const address = (row.address || '').trim();

    if (!name) { skipped++; continue; }

    const key = `${name}||${address}`;
    if (existingKeys.has(key)) { skipped++; continue; }
    existingKeys.add(key); // prevent intra-CSV dupes in the same run

    const phone    = normalizePhone(row.phone);
    const photoURL = (row.photo_url || '').trim() || null;
    const lat      = parseFloat(row.latitude)  || null;
    const lng      = parseFloat(row.longitude) || null;

    if (!phone)    noPhone++;
    if (!photoURL) noPhoto++;

    const docRef = db.collection('doctors').doc(); // auto-ID

    const record = {
      // ── Identity ────────────────────────────────────────────────────────────
      name,
      fullName:        name,
      specialty:       (row.specialty || '').trim()  || null,
      about:           (row.bio       || '').trim()  || null,
      address,
      city:            CITY_MAP[String(row.city_id)] ?? null,

      // ── Contact ─────────────────────────────────────────────────────────────
      phoneNumber:     phone,
      photoURL,

      // ── Location ────────────────────────────────────────────────────────────
      ...(lat && lng ? { location: new admin.firestore.GeoPoint(lat, lng) } : {}),
      latitude:        lat,
      longitude:       lng,

      // ── Defaults for app functionality ──────────────────────────────────────
      consultationFee: 0,
      workingHours:    DEFAULT_WORKING_HOURS,
      averageRating:   0,
      totalRatings:    0,

      // ── Seed metadata ───────────────────────────────────────────────────────
      isSeeded:        true,          // flag to distinguish from real auth accounts
      seedSource:      'tabib_mosul', // audit trail
      role:            'doctor',
      createdAt:       admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:       admin.firestore.FieldValue.serverTimestamp(),
    };

    batch.set(docRef, record);
    batchCount++;
    imported++;

    // Commit every 499 ops (Firestore limit is 500)
    if (batchCount >= 499) {
      await batch.commit();
      process.stdout.write(`  ✅ Committed batch (${imported} so far)…\r`);
      batch      = db.batch();
      batchCount = 0;
    }
  }

  // Flush remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n\n✅ Import complete!`);
  console.log(`   Imported : ${imported}`);
  console.log(`   Skipped  : ${skipped} (already exist or empty name)`);
  console.log(`   No phone : ${noPhone} (stored as null)`);
  console.log(`   No photo : ${noPhoto} (stored as null)`);
  console.log(`\nTotal in Firestore doctors collection: ~${existingKeys.size + imported - skipped}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message);
  process.exit(1);
});
