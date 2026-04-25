'use strict';

/**
 * import_tabib_doctors.js
 * -----------------------
 * Imports doctors scraped from tabib.iq into Firestore.
 *
 * Usage (from project root):
 *   node scripts/import_tabib_doctors.js [path/to/tabib_doctors.csv]
 *
 * Default CSV path: C:\Users\2023\Downloads\tabib_doctors.csv
 *
 * Idempotent: doc ID is a SHA-1 hash of name+address so re-runs skip
 * documents that already exist (set with merge:false and exists check,
 * or just use setDoc — Firestore set() is idempotent for the same ID).
 *
 * Each doctor document gets:
 *   - All scraped fields (name, specialty, location, phone, photoURL,
 *     latitude, longitude, cityId, about)
 *   - App-required fields with sensible defaults (fee, rating, hours …)
 *   - isScraped: true  source: 'tabib'  listed: true
 *   - patients: []  (required by isDoctorForPatient() security rule)
 */

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { parse } = require('csv-parse/sync');
const admin   = require('firebase-admin');

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------

const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(envPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp(); // Application Default Credentials
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CITY_NAMES = { '1': 'الموصل' };

function docId(name, address) {
  return crypto
    .createHash('sha1')
    .update(`${name}||${address}`)
    .digest('hex')
    .slice(0, 20);
}

function initials(name) {
  if (!name) return 'د';
  const parts = name.trim().split(/\s+/);
  // "د.X" where X is the first letter of the second word (family name), or first word
  const base = parts.length >= 2 ? parts[1].charAt(0) : parts[0].charAt(0);
  return `د.${base}`;
}

// The bio column often contains working-hours info; fall through to default.
function parseHours(bio) {
  if (!bio) return '9:00 ص - 5:00 م';
  // If bio contains time-like patterns keep it as hours hint, else use default
  if (/[0-9].*[مص]|صباح|مساء|يوميا|دوام/i.test(bio)) return bio.trim();
  return '9:00 ص - 5:00 م';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2] || 'C:/Users/2023/Downloads/tabib_doctors.csv';

  console.log(`Reading: ${csvPath}`);
  const raw = fs.readFileSync(csvPath);

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,            // strips UTF-8 BOM
    trim: true,
    relax_column_count: true,
  });

  console.log(`Parsed ${rows.length} rows.`);

  const BATCH_SIZE = 499; // stay under the 500-write Firestore limit
  let batch = db.batch();
  let opsInBatch = 0;
  let totalWritten = 0;
  let skipped = 0;

  for (const row of rows) {
    const name    = (row.name    || '').trim();
    const address = (row.address || '').trim();

    if (!name) { skipped++; continue; }

    const id = docId(name, address);
    const ref = db.collection('doctors').doc(id);

    const specialty = (row.specialty || '').trim();
    const phone     = (row.phone     || '').trim().split(',')[0].trim(); // take first number
    const photoURL  = (row.photo_url || '').trim();
    const bio       = (row.bio       || '').trim();
    const cityId    = parseInt(row.city_id, 10) || 1;
    const lat       = parseFloat(row.latitude)  || null;
    const lng       = parseFloat(row.longitude) || null;

    const data = {
      // --- Scraped fields ---
      name,
      specialty,
      location:   address || 'الموصل',
      phone,
      photoURL,
      about:      bio || `طبيب متخصص في ${specialty} مع خبرة واسعة في المجال الطبي.`,
      cityId,
      city:       CITY_NAMES[String(cityId)] || 'الموصل',
      latitude:   lat,
      longitude:  lng,

      // --- App-required fields (defaults) ---
      initials:       initials(name),
      // fee and consultationFee are intentionally omitted — set them in
      // Firestore per doctor once confirmed; the UI falls back gracefully.
      rating:         '4.5',
      reviews:        '0',
      experience:     '5+ سنوات خبرة',
      education:      'بكالوريوس طب وجراحة',
      hours:          parseHours(bio),
      languages:      ['العربية'],
      specializations: specialty ? [specialty] : [],
      openingTime:    '09:00',
      closingTime:    '17:00',
      clinicClosed:   false,
      listed:         true,
      patients:       [],   // required by isDoctorForPatient() rule

      // --- Provenance ---
      isScraped:   true,
      source:      'tabib',
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    };

    // set() with merge:false is idempotent for the same deterministic ID.
    // On re-run it overwrites, which is fine for scraped catalog data.
    batch.set(ref, data);
    opsInBatch++;
    totalWritten++;

    if (opsInBatch >= BATCH_SIZE) {
      await batch.commit();
      process.stdout.write(`  Committed batch… (${totalWritten} so far)\n`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`\nDone. Wrote ${totalWritten} doctor(s), skipped ${skipped} empty row(s).`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
