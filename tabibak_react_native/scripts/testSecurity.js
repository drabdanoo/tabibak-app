/**
 * Firestore Security Rules Testing Script
 * Tests role-based access control for React Native app
 * 
 * Run with: node scripts/testSecurity.js
 */

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

let testEnv;

// Test user IDs
const TEST_USERS = {
  patient1: 'test-patient-1',
  patient2: 'test-patient-2',
  doctor1: 'test-doctor-1',
  doctor2: 'test-doctor-2',
  receptionist1: 'test-receptionist-1',
  anonymous: null
};

// Test data
const TEST_DATA = {
  doctor: {
    name: 'Dr. Test Doctor',
    specialty: 'Cardiology',
    hospital: 'Test Hospital',
    rating: 4.5,
    reviewCount: 100,
    experience: 10,
    fees: 50,
    city: 'Test City',
    listed: true
  },
  patient: {
    name: 'Test Patient',
    email: 'patient@test.com',
    phone: '+1234567890',
    dateOfBirth: '1990-01-01',
    gender: 'male'
  },
  appointment: {
    patientId: TEST_USERS.patient1,
    patientName: 'Test Patient',
    doctorId: TEST_USERS.doctor1,
    doctorName: 'Dr. Test Doctor',
    appointmentDate: new Date().toISOString().split('T')[0],
    appointmentTime: '10:00',
    status: 'pending',
    reason: 'Routine checkup',
    createdAt: admin.firestore.Timestamp.now()
  }
};

console.log('🔐 Starting Firestore Security Rules Tests...\n');

async function initializeTestEnv() {
  console.log('🔧 Initializing test environment...');
  
  try {
    const rulesPath = path.join(__dirname, '..', '..', 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    testEnv = await initializeTestEnvironment({
      projectId: 'medconnect-2',
      firestore: {
        rules,
        host: 'localhost',
        port: 8080
      }
    });
    
    console.log('✅ Test environment initialized\n');
  } catch (error) {
    console.error('❌ Error initializing test environment:', error.message);
    throw error;
  }
}

async function setupTestData() {
  console.log('📝 Setting up test data...');
  
  try {
    const adminDb = testEnv.authenticatedContext('admin', { admin: true }).firestore();
    
    // Create test doctor
    await adminDb.collection('doctors').doc(TEST_USERS.doctor1).set(TEST_DATA.doctor);
    
    // Create test patient
    await adminDb.collection('patients').doc(TEST_USERS.patient1).set(TEST_DATA.patient);
    
    // Create test receptionist
    await adminDb.collection('receptionists').doc(TEST_USERS.receptionist1).set({
      name: 'Test Receptionist',
      doctorId: TEST_USERS.doctor1,
      email: 'receptionist@test.com'
    });
    
    console.log('✅ Test data created\n');
  } catch (error) {
    console.error('❌ Error setting up test data:', error.message);
    throw error;
  }
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    await testEnv.clearFirestore();
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error.message);
  }
}

async function testDoctorListAccess() {
  console.log('📋 Testing Doctor List Access...');
  
  try {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const patientDb = testEnv.authenticatedContext(TEST_USERS.patient1).firestore();
    
    // Test 1: Anonymous users can read doctor profiles
    await assertSucceeds(
      unauthDb.collection('doctors').doc(TEST_USERS.doctor1).get()
    );
    console.log('  ✓ Anonymous users can read doctor profiles');
    
    // Test 2: Patient can read doctor profiles
    await assertSucceeds(
      patientDb.collection('doctors').doc(TEST_USERS.doctor1).get()
    );
    console.log('  ✓ Patient can read doctor profiles');
    
    // Test 3: Anonymous users cannot write to doctors collection
    await assertFails(
      unauthDb.collection('doctors').doc(TEST_USERS.doctor1).update({ rating: 5 })
    );
    console.log('  ✓ Anonymous users cannot modify doctor profiles');
    
    console.log('');
  } catch (error) {
    console.error('  ❌ Error testing doctor list access:', error.message, '\n');
    throw error;
  }
}

async function testAppointmentCreation() {
  console.log('📅 Testing Appointment Creation...');
  
  try {
    const patientDb = testEnv.authenticatedContext(TEST_USERS.patient1).firestore();
    const doctorDb = testEnv.authenticatedContext(TEST_USERS.doctor1).firestore();
    const otherPatientDb = testEnv.authenticatedContext(TEST_USERS.patient2).firestore();
    
    // Test 1: Patient can create appointment for themselves
    const appointmentData = {
      ...TEST_DATA.appointment,
      userId: TEST_USERS.patient1
    };
    await assertSucceeds(
      patientDb.collection('appointments').add(appointmentData)
    );
    console.log('  ✓ Patient can create appointment for themselves');
    
    // Test 2: Patient cannot create appointment for another patient
    const wrongAppointmentData = {
      ...TEST_DATA.appointment,
      patientId: TEST_USERS.patient2,
      userId: TEST_USERS.patient1
    };
    await assertFails(
      patientDb.collection('appointments').add(wrongAppointmentData)
    );
    console.log('  ✓ Patient cannot create appointment for another patient');
    
    // Test 3: Doctor can read their appointments
    await assertSucceeds(
      doctorDb.collection('appointments').where('doctorId', '==', TEST_USERS.doctor1).get()
    );
    console.log('  ✓ Doctor can read their appointments');
    
    // Test 4: Patient can read their own appointments
    await assertSucceeds(
      patientDb.collection('appointments').where('patientId', '==', TEST_USERS.patient1).get()
    );
    console.log('  ✓ Patient can read their own appointments');
    
    // Test 5: Patient cannot read other patient's appointments
    await assertFails(
      patientDb.collection('appointments').where('patientId', '==', TEST_USERS.patient2).get()
    );
    console.log('  ✓ Patient cannot read other patients\' appointments');
    
    console.log('');
  } catch (error) {
    console.error('  ❌ Error testing appointment creation:', error.message, '\n');
    throw error;
  }
}

async function testRoleBasedAccess() {
  console.log('👥 Testing Role-Based Access Control...');
  
  try {
    const patientDb = testEnv.authenticatedContext(TEST_USERS.patient1).firestore();
    const doctorDb = testEnv.authenticatedContext(TEST_USERS.doctor1).firestore();
    const receptionistDb = testEnv.authenticatedContext(TEST_USERS.receptionist1).firestore();
    const otherPatientDb = testEnv.authenticatedContext(TEST_USERS.patient2).firestore();
    
    // Test 1: Patient can read own profile
    await assertSucceeds(
      patientDb.collection('patients').doc(TEST_USERS.patient1).get()
    );
    console.log('  ✓ Patient can read own profile');
    
    // Test 2: Patient cannot read another patient's profile
    await assertFails(
      patientDb.collection('patients').doc(TEST_USERS.patient2).get()
    );
    console.log('  ✓ Patient cannot read another patient\'s profile');
    
    // Test 3: Doctor can read own profile
    await assertSucceeds(
      doctorDb.collection('doctors').doc(TEST_USERS.doctor1).get()
    );
    console.log('  ✓ Doctor can read own profile');
    
    // Test 4: Receptionist can read own profile
    await assertSucceeds(
      receptionistDb.collection('receptionists').doc(TEST_USERS.receptionist1).get()
    );
    console.log('  ✓ Receptionist can read own profile');
    
    // Test 5: Patient can update own profile
    await assertSucceeds(
      patientDb.collection('patients').doc(TEST_USERS.patient1).update({ phone: '+1234567891' })
    );
    console.log('  ✓ Patient can update own profile');
    
    // Test 6: Patient cannot update another patient's profile
    await assertFails(
      patientDb.collection('patients').doc(TEST_USERS.patient2).update({ phone: '+1234567891' })
    );
    console.log('  ✓ Patient cannot update another patient\'s profile');
    
    console.log('');
  } catch (error) {
    console.error('  ❌ Error testing role-based access:', error.message, '\n');
    throw error;
  }
}

async function testReceptionistAppointmentAccess() {
  console.log('🏥 Testing Receptionist Appointment Access...');
  
  try {
    const receptionistDb = testEnv.authenticatedContext(TEST_USERS.receptionist1).firestore();
    const adminDb = testEnv.authenticatedContext('admin', { admin: true }).firestore();
    
    // Create test appointment via admin
    const appointmentRef = await adminDb.collection('appointments').add(TEST_DATA.appointment);
    
    // Test 1: Receptionist can read appointments for their doctor
    await assertSucceeds(
      receptionistDb.collection('appointments').where('doctorId', '==', TEST_USERS.doctor1).get()
    );
    console.log('  ✓ Receptionist can read appointments for their doctor');
    
    // Test 2: Receptionist cannot read appointments for other doctors
    await assertFails(
      receptionistDb.collection('appointments').where('doctorId', '==', TEST_USERS.doctor2).get()
    );
    console.log('  ✓ Receptionist cannot read appointments for other doctors');
    
    // Test 3: Receptionist can update appointment status
    await assertSucceeds(
      receptionistDb.collection('appointments').doc(appointmentRef.id).update({ status: 'confirmed' })
    );
    console.log('  ✓ Receptionist can update appointment status');
    
    console.log('');
  } catch (error) {
    console.error('  ❌ Error testing receptionist appointment access:', error.message, '\n');
    throw error;
  }
}

async function testDataMinimization() {
  console.log('📊 Testing Data Minimization...');
  
  try {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    
    // Test 1: Anonymous users cannot write sensitive data
    await assertFails(
      unauthDb.collection('patients').doc('test-patient').set({
        name: 'Test',
        ssn: '123-45-6789'
      })
    );
    console.log('  ✓ Unauthorized writes are blocked');
    
    // Test 2: Users cannot create documents with arbitrary IDs in protected collections
    await assertFails(
      unauthDb.collection('doctors').doc('fake-doctor').set({
        name: 'Fake Doctor'
      })
    );
    console.log('  ✓ Unauthorized doctor creation is blocked');
    
    console.log('');
  } catch (error) {
    console.error('  ❌ Error testing data minimization:', error.message, '\n');
    throw error;
  }
}

async function testPhoneAuthUserAccess() {
  console.log('📱 Testing Phone Auth User Access...');
  
  try {
    const phoneAuthDb = testEnv.authenticatedContext('phone-user-123').firestore();
    
    // Test 1: Phone auth users can browse doctors
    await assertSucceeds(
      phoneAuthDb.collection('doctors').doc(TEST_USERS.doctor1).get()
    );
    console.log('  ✓ Phone auth users can browse doctors');
    
    // Test 2: Phone auth users can create appointments for themselves
    await assertSucceeds(
      phoneAuthDb.collection('appointments').add({
        ...TEST_DATA.appointment,
        patientId: 'phone-user-123',
        userId: 'phone-user-123'
      })
    );
    console.log('  ✓ Phone auth users can create appointments');
    
    // Test 3: Phone auth users can read their own appointments
    await assertSucceeds(
      phoneAuthDb.collection('appointments').where('patientId', '==', 'phone-user-123').get()
    );
    console.log('  ✓ Phone auth users can read their appointments');
    
    console.log('');
  } catch (error) {
    console.error('  ❌ Error testing phone auth access:', error.message, '\n');
    throw error;
  }
}

async function runAllTests() {
  try {
    await initializeTestEnv();
    await setupTestData();
    
    await testDoctorListAccess();
    await testAppointmentCreation();
    await testRoleBasedAccess();
    await testReceptionistAppointmentAccess();
    await testDataMinimization();
    await testPhoneAuthUserAccess();
    
    await cleanupTestData();
    await testEnv.cleanup();
    
    console.log('\n✅ All security tests completed successfully!\n');
    console.log('📝 Summary:');
    console.log('  - Doctor listings are publicly accessible');
    console.log('  - Patients can create and view their appointments');
    console.log('  - Doctors can view appointments for their patients');
    console.log('  - Receptionists can view appointments for their doctor');
    console.log('  - Unauthorized access is properly blocked');
    console.log('  - Phone auth users have correct permissions');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Security tests failed:', error.message);
    if (testEnv) {
      await testEnv.cleanup();
    }
    process.exit(1);
  }
}

// Run tests
runAllTests();
