#!/usr/bin/env node

/**
 * Set Receptionist Claims - Bulk Script
 * Run: node functions/set-receptionist.js <user-uid>
 * Example: node functions/set-receptionist.js abc123def456xyz789
 */

const admin = require('firebase-admin');
const serviceAccount = require('./medconnect-2-firebase-adminsdk-fbsvc-72fcc82703.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'medconnect-2'
});

const uid = process.argv[2];

if (!uid) {
  console.error('❌ Error: User UID is required');
  console.error('Usage: node functions/set-receptionist.js <user-uid>');
  process.exit(1);
}

async function setReceptionistClaim() {
  try {
    console.log(`⏳ Setting receptionist claim for user: ${uid}`);
    
    await admin.auth().setCustomUserClaims(uid, { receptionist: true });
    
    console.log(`✅ SUCCESS! User ${uid} is now a receptionist`);
    console.log(`\nYou can now login to receptionist.html with this user's credentials`);
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

setReceptionistClaim();
