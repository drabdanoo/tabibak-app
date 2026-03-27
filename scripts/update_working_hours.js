/**
 * update_working_hours.js
 * ────────────────────────
 * Reads working_days / off_days / working_hours columns from the CSV and
 * updates the matching Firestore `doctors` docs in place.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS="G:/tabibak-app/.env" \
 *   node scripts/update_working_hours.js "C:/Users/2023/Downloads/tabib_doctors_clean.csv"
 */

const path    = require('path');
const fs      = require('fs');
const { parse } = require('csv-parse/sync');
const admin   = require('firebase-admin');

require('dotenv').config({ path: path.join(__dirname, '../functions/.env') });

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
    admin.initializeApp();
  }
}

const db = admin.firestore();

// ── Arabic day name → English key (capitalized, matching Firestore schema) ────
const DAY_MAP = {
  'السبت':    'Saturday',
  'الاحد':    'Sunday',
  'الأحد':    'Sunday',
  'الاثنين':  'Monday',
  'الثلاثاء': 'Tuesday',
  'الاربعاء': 'Wednesday',
  'الأربعاء': 'Wednesday',
  'الخميس':   'Thursday',
  'الجمعة':   'Friday',
  'الجمعه':   'Friday',
};

const ALL_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Arabic digit → Western digit ──────────────────────────────────────────────
function toWesternDigits(str) {
  return str.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// ── Parse one time token, e.g. "3م" "9ص" "12م" → "HH:MM" ────────────────────
function parseToken(token) {
  token = toWesternDigits(token.replace(/\s+/g, ''));
  const isPM = /م/.test(token);
  const isAM = /ص/.test(token);
  // strip Arabic letters and punctuation, keep digits and dot
  const numStr = token.replace(/[^\d.]/g, '');
  if (!numStr) return null;
  let hour = parseFloat(numStr);
  if (isNaN(hour)) return null;
  if (isPM && hour < 12)  hour += 12;
  if (isAM && hour === 12) hour  = 0;
  return `${String(Math.floor(hour)).padStart(2, '0')}:00`;
}

// ── Parse Arabic hours string → { start, end } or null ────────────────────────
function parseHoursStr(raw) {
  if (!raw) return null;
  raw = toWesternDigits(raw.trim());

  // ── Explicit range: "3م-7م" / "9ص-3م" / "من 3م -6م" / "9ص -7م" ─────────
  // Pattern: digit(s) + [صم] (optional spaces + dash) + digit(s) + [صم]
  const rangeRe = /(\d+(?:\.\d+)?)\s*[صم]\s*[-–—]\s*(\d+(?:\.\d+)?)\s*[صم]/;
  const rangeM  = raw.match(rangeRe);
  if (rangeM) {
    const dashIdx = raw.search(/[-–—]/);
    const part1   = raw.slice(0, dashIdx).trim();
    const part2   = raw.slice(dashIdx + 1).trim();
    const start   = parseToken(part1);
    const end     = parseToken(part2);
    if (start && end) return { start, end };
  }

  // ── Keyword-based approximations ─────────────────────────────────────────
  if (/صباحاً?\s*ومساءً?|صباحا\s*ومساء/.test(raw)) return { start: '09:00', end: '20:00' };
  if (/صباحاً?|صباحا/.test(raw))                    return { start: '09:00', end: '14:00' };
  if (/مساءً?|مساء/.test(raw))                       return { start: '16:00', end: '20:00' };
  if (/عصراً?|عصرا/.test(raw))                       return { start: '15:00', end: '18:00' };
  if (/ظهراً?|ظهرا|ظهر/.test(raw)) {
    // e.g. "من ال1 ظهرا" → start at 13:00
    const single = raw.match(/(\d+)/);
    if (single) {
      let h = parseInt(single[1], 10);
      if (h < 7) h += 12; // afternoon heuristic
      return { start: `${String(h).padStart(2,'0')}:00`, end: `${String(h + 4).padStart(2,'0')}:00` };
    }
    return { start: '13:00', end: '17:00' };
  }

  // ── Single number with AM/PM (no range) ──────────────────────────────────
  const singleRe = /(\d+(?:\.\d+)?)\s*([صم])/;
  const singleM  = raw.match(singleRe);
  if (singleM) {
    const start = parseToken(singleM[0]);
    if (start) {
      // Guess a reasonable 4-hour window
      const [hh] = start.split(':').map(Number);
      const end  = `${String(Math.min(hh + 4, 23)).padStart(2,'0')}:00`;
      return { start, end };
    }
  }

  return null; // Can't parse — keep default
}

// ── Build workingHours object from CSV row ─────────────────────────────────────
function buildWorkingHours(row) {
  const workingDaysRaw = (row.working_days || '').trim();
  const offDaysRaw     = (row.off_days     || '').trim();
  const hoursRaw       = (row.working_hours || '').trim();

  // Parse open / closed day sets
  const openDays   = new Set();
  const closedDays = new Set();

  if (workingDaysRaw) {
    workingDaysRaw.split('/').forEach(d => {
      const eng = DAY_MAP[d.trim()];
      if (eng) openDays.add(eng);
    });
  }

  if (offDaysRaw) {
    offDaysRaw.split('/').forEach(d => {
      const eng = DAY_MAP[d.trim()];
      if (eng) closedDays.add(eng);
    });
  }

  // If we have no day info at all, apply the clinic default:
  //   Friday closed | Saturday 10:00-21:00 | all other days 15:00-20:00
  if (openDays.size === 0 && closedDays.size === 0) {
    const result = {};
    for (const day of ALL_DAYS) {
      if (day === 'Friday') {
        result[day] = { open: false, start: '10:00', end: '21:00' };
      } else if (day === 'Saturday') {
        result[day] = { open: true, start: '10:00', end: '21:00' };
      } else {
        result[day] = { open: true, start: '15:00', end: '20:00' };
      }
    }
    return result;
  }

  const times = parseHoursStr(hoursRaw);
  const start = times?.start || '09:00';
  const end   = times?.end   || '17:00';

  const result = {};
  for (const day of ALL_DAYS) {
    if (openDays.size > 0) {
      // Explicit open-day list → everything not listed is closed
      result[day] = openDays.has(day)
        ? { open: true,  start, end }
        : { open: false, start: '09:00', end: '17:00' };
    } else {
      // Only off_days given → everything not in off-list is open
      result[day] = closedDays.has(day)
        ? { open: false, start: '09:00', end: '17:00' }
        : { open: true,  start, end };
    }
  }
  return result;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/update_working_hours.js <path/to/tabib_doctors_clean.csv>');
    process.exit(1);
  }

  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const raw     = fs.readFileSync(absPath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  console.log(`\n📋 ${records.length} rows in CSV\n`);

  // ── Load all seeded doctors from Firestore ────────────────────────────────
  console.log('⏳ Loading seeded doctors from Firestore…');
  const snap = await db.collection('doctors').where('isSeeded', '==', true).get();

  // Build lookup: "name||address" → doc ref
  const docMap = new Map();
  snap.docs.forEach(d => {
    const data = d.data();
    const key  = `${data.name}||${data.address ?? ''}`;
    docMap.set(key, d.ref);
  });
  console.log(`✅ ${docMap.size} seeded doctors loaded\n`);

  // ── Batch-update working hours ────────────────────────────────────────────
  let batch      = db.batch();
  let batchCount = 0;
  let updated    = 0;
  let skipped    = 0;
  let noMatch    = 0;

  for (const row of records) {
    const name    = (row.name    || '').trim();
    const address = (row.address || '').trim();
    if (!name) { skipped++; continue; }

    const key = `${name}||${address}`;
    const ref = docMap.get(key);
    if (!ref) { noMatch++; continue; }

    const workingHours = buildWorkingHours(row);
    if (!workingHours) { skipped++; continue; } // no day info in CSV row

    batch.update(ref, {
      workingHours,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batchCount++;
    updated++;

    if (batchCount >= 499) {
      await batch.commit();
      process.stdout.write(`  ✅ Committed batch (${updated} so far)…\r`);
      batch      = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  console.log(`\n\n✅ Done!`);
  console.log(`   Updated  : ${updated}`);
  console.log(`   Skipped  : ${skipped} (no day info or empty name)`);
  console.log(`   No match : ${noMatch} (doc not found in Firestore)`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Failed:', err.message);
  process.exit(1);
});
