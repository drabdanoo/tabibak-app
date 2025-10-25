// Admin script to create receptionist profile
// Run: node admin-create-receptionist.js

const admin = require('firebase-admin');

// Initialize with service account (you need to download service account key)
const serviceAccount = require('./path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://medconnect-2.firebaseio.com"
});

const db = admin.firestore();

async function createReceptionist() {
  try {
    const receptionistData = {
      doctorId: "w9Wxz34wZTbmu6isqs0VrEFbQvJ3",
      name: "مستقبل Dr. Bayan", 
      email: "receptionist@clinic.com",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('receptionists')
      .doc('Vzfpsg6rcqQX4dqf03XK7K7RjPe2')
      .set(receptionistData);

    console.log('✅ Receptionist profile created successfully!');
    console.log('Receptionist UID:', 'Vzfpsg6rcqQX4dqf03XK7K7RjPe2');
    console.log('Linked to Doctor:', 'w9Wxz34wZTbmu6isqs0VrEFbQvJ3');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating receptionist:', error);
    process.exit(1);
  }
}

createReceptionist();
