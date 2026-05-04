'use strict';

/**
 * backup_doctor_photos.js
 * -----------------------
 * 1. Reads every doctor in Firestore that has an external photoURL (tabib server)
 * 2. Downloads the image locally to scripts/photo_backup/
 * 3. Uploads it to Firebase Storage at doctors/photos/<docId>.<ext>
 * 4. Updates the Firestore doc with the new Storage URL
 *
 * Usage (from project root):
 *   node scripts/backup_doctor_photos.js
 *
 * Safe to re-run — skips docs whose photoURL already points to Firebase Storage.
 */

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const admin   = require('firebase-admin');

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------

const envPath = path.resolve(__dirname, '../.env');
const serviceAccount = JSON.parse(fs.readFileSync(envPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'medconnect-2.firebasestorage.app',
});

const db      = admin.firestore();
const bucket  = admin.storage().bucket();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BACKUP_DIR = path.resolve(__dirname, 'photo_backup');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function extFromUrl(url) {
  const u = url.split('?')[0];
  const m = u.match(/\.(\w{2,5})$/);
  return m ? `.${m[1].toLowerCase()}` : '.jpg';
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const mod  = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (e) => {
      fs.unlink(destPath, () => {});
      reject(e);
    });
  });
}

async function uploadToStorage(localPath, storagePath, contentType) {
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: { contentType },
    public: true,
  });
  const f = bucket.file(storagePath);
  const [meta] = await f.getMetadata();
  return `https://storage.googleapis.com/${meta.bucket}/${meta.name}`;
}

function contentTypeFromExt(ext) {
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return map[ext] || 'image/jpeg';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching all doctor docs…');
  const snap = await db.collection('doctors').get();
  console.log(`Total docs: ${snap.size}`);

  const toProcess = snap.docs.filter(d => {
    const url = d.data().photoURL || '';
    return url && !url.includes('users.png') && !url.includes('storage.googleapis.com') && !url.includes('firebasestorage');
  });

  console.log(`Docs with external photos to migrate: ${toProcess.length}\n`);

  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const doc      = toProcess[i];
    const data     = doc.data();
    const origUrl  = data.photoURL;
    const ext      = extFromUrl(origUrl);
    const localFile = path.join(BACKUP_DIR, `${doc.id}${ext}`);
    const storagePath = `doctors/photos/${doc.id}${ext}`;

    process.stdout.write(`[${i + 1}/${toProcess.length}] ${data.name.slice(0, 30).padEnd(30)} `);

    try {
      // Download
      await download(origUrl, localFile);

      // Upload to Storage
      const newUrl = await uploadToStorage(localFile, storagePath, contentTypeFromExt(ext));

      // Update Firestore
      await db.collection('doctors').doc(doc.id).update({
        photoURL: newUrl,
        photoURLOriginal: origUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✓  →  ${newUrl.slice(0, 60)}`);
      success++;
    } catch (e) {
      console.log(`✗  ${e.message}`);
      failed++;
      // Keep local file if downloaded, just log the failure
    }

    // Small delay to avoid hammering the source server
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\nDone.  Success: ${success}  Failed: ${failed}  Skipped: ${skipped}`);
  console.log(`Local backup saved to: ${BACKUP_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
