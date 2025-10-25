#!/usr/bin/env node

/**
 * Create Receptionist Document in Firestore
 * Run: node functions/create-receptionist-doc.js <user-uid> <receptionist-name> <doctor-uid>
 * Example: node functions/create-receptionist-doc.js abc123def456xyz789 "Ahmed Ali" doctor123uid
 */

const admin = require('firebase-admin');
const serviceAccount = require('./medconnect-2-firebase-adminsdk-fbsvc-72fcc82703.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'medconnect-2'
});

const db = admin.firestore();
const uid = process.argv[2];
const name = process.argv[3] || 'Receptionist';
const doctorId = process.argv[4];

if (!uid || !doctorId) {
  console.error('❌ Error: User UID and Doctor UID are required');
  console.error('Usage: node functions/create-receptionist-doc.js <user-uid> <receptionist-name> <doctor-uid>');
  process.exit(1);
}

async function createReceptionistDoc() {
  try {
    console.log(`⏳ Creating receptionist document for user: ${uid}`);
    
    // Get user email from Firebase Auth
    const user = await admin.auth().getUser(uid);
    
    // Create receptionist document
    await db.collection('receptionists').doc(uid).set({
      uid: uid,
      name: name,
      email: user.email || null,
      phone: user.phoneNumber || null,
      doctorId: doctorId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ SUCCESS! Receptionist document created for ${name}`);
    console.log(`\nYou can now login to receptionist.html with this user's credentials`);
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

createReceptionistDoc();
