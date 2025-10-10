#!/usr/bin/env node
/**
 * Production-safe doctors seeding script using Firebase Admin SDK.
 *
 * Usage:
 *   node scripts/seed-doctors.mjs --file seed/doctors.json [--dry-run]
 *
 * Auth:
 *   Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path, or
 *   set SERVICE_ACCOUNT_JSON env var with the JSON string.
 */

import fs from 'fs';
import path from 'path';
import url from 'url';
import admin from 'firebase-admin';

// Resolve __dirname in ESM
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { file: 'seed/doctors.json', dryRun: false, project: undefined };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file' && args[i + 1]) { options.file = args[++i]; }
    else if (a === '--dry-run') { options.dryRun = true; }
    else if (a === '--project' && args[i + 1]) { options.project = args[++i]; }
  }
  return options;
}

function loadServiceAccount() {
  if (process.env.SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
  }
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && fs.existsSync(gac)) {
    return JSON.parse(fs.readFileSync(gac, 'utf8'));
  }
  return null; // applicationDefault may still work in some environments
}

function initAdmin(projectId) {
  const svc = loadServiceAccount();
  if (svc) {
    admin.initializeApp({ credential: admin.credential.cert(svc), projectId });
  } else {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
  }
}

function readJson(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  return JSON.parse(raw);
}

async function upsertDoctor(firestore, auth, doctor, dryRun) {
  const { email } = doctor;
  if (!email) throw new Error('Doctor entry missing required field: email');

  // Normalize minimal defaults
  const normalized = {
    name: doctor.name || '',
    specialty: doctor.specialty || '',
    phone: doctor.phone || '',
    email: email.toLowerCase(),
    fee: doctor.fee ?? '15',
    consultationFee: doctor.consultationFee ?? (parseInt(doctor.fee || '15', 10) * 1000),
    accountStatus: doctor.accountStatus || 'active',
    experience: doctor.experience || '5+ سنوات خبرة',
    rating: doctor.rating || '4.5',
    reviews: doctor.reviews || '25',
    location: doctor.location || 'العيادة الطبية',
    hours: doctor.hours || '9:00 ص - 5:00 م',
    education: doctor.education || 'بكالوريوس طب وجراحة',
    about: doctor.about || (doctor.specialty ? `طبيب متخصص في ${doctor.specialty} مع خبرة واسعة في المجال الطبي.` : ''),
    languages: Array.isArray(doctor.languages) ? doctor.languages : (doctor.languages ? [doctor.languages] : ['العربية']),
    specializations: Array.isArray(doctor.specializations) ? doctor.specializations : (doctor.specializations ? [doctor.specializations] : [doctor.specialty].filter(Boolean)),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const col = firestore.collection('doctors');

  // Check existing by email
  const existingSnap = await col.where('email', '==', normalized.email).limit(1).get();
  if (!existingSnap.empty) {
    const docRef = existingSnap.docs[0].ref;
    if (dryRun) {
      return { action: 'update (dry-run)', id: docRef.id };
    }
    await docRef.set(normalized, { merge: true });
    return { action: 'update', id: docRef.id };
  }

  // Create auth user if not exists
  let userRecord = null;
  try {
    userRecord = await auth.getUserByEmail(normalized.email);
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') {
      if (!dryRun) {
        userRecord = await auth.createUser({
          email: normalized.email,
          password: doctor.password || Math.random().toString(36).slice(-10),
          displayName: normalized.name,
          emailVerified: false,
          disabled: false,
        });
      }
    } else {
      throw e;
    }
  }

  const writeData = {
    ...normalized,
    ...(userRecord ? { userId: userRecord.uid } : {}),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (dryRun) {
    return { action: 'create (dry-run)' };
  }
  await col.add(writeData);
  return { action: 'create' };
}

async function main() {
  const { file, dryRun, project } = parseArgs();
  initAdmin(project || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT);
  const firestore = admin.firestore();
  const auth = admin.auth();

  const data = readJson(file);
  if (!Array.isArray(data)) {
    throw new Error('Seed file must be a JSON array of doctor objects');
  }

  console.log(`Processing ${data.length} doctors${dryRun ? ' (dry-run)' : ''}...`);
  let created = 0, updated = 0;
  for (const doctor of data) {
    const res = await upsertDoctor(firestore, auth, doctor, dryRun);
    if (res.action.startsWith('create')) created++; else if (res.action.startsWith('update')) updated++;
    console.log(`${res.action.toUpperCase()} — ${doctor.name} <${doctor.email}> ${res.id ? `(id: ${res.id})` : ''}`);
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


