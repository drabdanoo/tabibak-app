// Script to create test doctor accounts for login testing
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./service-account-key.json'); // You'll need to download this
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://medconnect-2-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function createTestDoctors() {
  const doctors = [
    {
      name: 'خالد أحمد',
      email: 'khalid@medconnect.com',
      specialty: 'طب قلب',
      consultationFee: 20000,
      tempPassword: 'khalid123',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: 'وعد محمد',
      email: 'waad@medconnect.com', 
      specialty: 'طب أطفال',
      consultationFee: 18000,
      tempPassword: 'waad123',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: 'صفوان علي',
      email: 'safwan@medconnect.com',
      specialty: 'طب عام',
      consultationFee: 15000,
      tempPassword: 'safwan123',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }
  ];

  console.log('Creating test doctors...');
  
  for (const doctor of doctors) {
    try {
      const docRef = await db.collection('doctors').add(doctor);
      console.log(`✓ Created doctor: ${doctor.name} (${doctor.email}) with ID: ${docRef.id}`);
    } catch (error) {
      console.error(`✗ Failed to create ${doctor.name}:`, error);
    }
  }
  
  console.log('\n=== TEST CREDENTIALS ===');
  doctors.forEach(doctor => {
    console.log(`${doctor.name}: ${doctor.email} / ${doctor.tempPassword}`);
  });
  
  console.log('\nDoctors created! You can now test login with these credentials.');
  process.exit(0);
}

createTestDoctors().catch(console.error);