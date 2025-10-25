#!/usr/bin/env node

/**
 * Complete Receptionist Setup Script
 * This script:
 * 1. Creates a receptionist user account (if email/password provided)
 * 2. Sets the receptionist custom claim
 * 3. Creates the receptionist document in Firestore
 * 
 * Usage Option 1 (Create new user):
 *   node functions/setup-receptionist.js --email <email> --password <password> --name <name> --doctor-uid <doctor-uid>
 * 
 * Usage Option 2 (Use existing user):
 *   node functions/setup-receptionist.js --uid <user-uid> --name <name> --doctor-uid <doctor-uid>
 * 
 * Examples:
 *   node functions/setup-receptionist.js --email receptionist@clinic.com --password SecurePass123 --name "Sara Ahmed" --doctor-uid abc123
 *   node functions/setup-receptionist.js --uid xyz789 --name "Sara Ahmed" --doctor-uid abc123
 */

const admin = require('firebase-admin');
const serviceAccount = require('./medconnect-2-firebase-adminsdk-fbsvc-72fcc82703.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'medconnect-2'
});

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const email = getArg('--email');
const password = getArg('--password');
const uid = getArg('--uid');
const name = getArg('--name') || 'Receptionist';
const doctorId = getArg('--doctor-uid');

async function setupReceptionist() {
  try {
    let userId = uid;
    
    // Step 1: Create user if email/password provided
    if (email && password && !uid) {
      console.log(`\n📝 Creating new user account for: ${email}`);
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        emailVerified: true,
        displayName: name
      });
      userId = userRecord.uid;
      console.log(`✅ User created with UID: ${userId}`);
    } else if (!userId) {
      console.error('\n❌ Error: Either --uid OR (--email AND --password) must be provided');
      console.error('\nUsage Option 1 (Create new user):');
      console.error('  node functions/setup-receptionist.js --email <email> --password <password> --name <name> --doctor-uid <doctor-uid>');
      console.error('\nUsage Option 2 (Use existing user):');
      console.error('  node functions/setup-receptionist.js --uid <user-uid> --name <name> --doctor-uid <doctor-uid>');
      process.exit(1);
    }
    
    if (!doctorId) {
      console.error('\n❌ Error: --doctor-uid is required');
      process.exit(1);
    }
    
    // Step 2: Set receptionist custom claim
    console.log(`\n🔐 Setting receptionist custom claim for user: ${userId}`);
    await admin.auth().setCustomUserClaims(userId, { receptionist: true });
    console.log(`✅ Receptionist claim set successfully`);
    
    // Step 3: Get user details
    const user = await admin.auth().getUser(userId);
    
    // Step 4: Create receptionist document in Firestore
    console.log(`\n📄 Creating receptionist document in Firestore`);
    await db.collection('receptionists').doc(userId).set({
      uid: userId,
      name: name,
      email: user.email || null,
      phone: user.phoneNumber || null,
      doctorId: doctorId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Receptionist document created`);
    
    // Success summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ RECEPTIONIST SETUP COMPLETE!`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n👤 User Details:`);
    console.log(`   UID: ${userId}`);
    console.log(`   Email: ${user.email || 'N/A'}`);
    console.log(`   Name: ${name}`);
    console.log(`   Doctor ID: ${doctorId}`);
    console.log(`\n🔑 Login Credentials:`);
    if (email && password) {
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log(`   Use existing credentials for UID: ${userId}`);
    }
    console.log(`\n🌐 Login URL: https://medconnect-2.web.app/receptionist.html`);
    console.log(`\n✨ The receptionist can now login and access the dashboard!\n`);
    
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

setupReceptionist();
