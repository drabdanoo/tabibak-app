// MedConnect Appointment System Test Suite
// Run this in browser console or include as a script

class AppointmentSystemTester {
    constructor() {
        this.db = null;
        this.auth = null;
        this.functions = null;
        this.testResults = [];
    }
    
    async initialize() {
        try {
            // Wait for centralized Firebase initialization
            console.log('⏳ Waiting for Firebase to be ready...');
            
            if (!window.MEDCONNECT_UTILS) {
                throw new Error('Firebase initialization script not loaded. Please load firebase-init.js first');
            }
            
            // Wait for Firebase to be ready
            const firebase = await window.MEDCONNECT_UTILS.waitForFirebase();
            
            if (!firebase.initialized) {
                throw new Error('Firebase initialization failed: ' + (firebase.error || 'Unknown error'));
            }
            
            // Use the centralized Firebase services
            this.db = firebase.db;
            this.auth = firebase.auth;
            this.functions = firebase.functions;
            
            console.log('✅ Appointment System Tester initialized with centralized Firebase');
            console.log('📱 Persistence enabled:', firebase.persistenceEnabled);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize tester:', error);
            console.error('💡 Make sure firebase-init.js is loaded before this script');
            return false;
        }
    }
    
    addTestResult(testName, success, message, data = null) {
        const result = {
            testName,
            success,
            message,
            data,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        
        const icon = success ? '✅' : '❌';
        console.log(`${icon} ${testName}: ${message}`);
        if (data) console.log('   Data:', data);
    }
    
    // Test 1: Check Firestore Collections Structure
    async testFirestoreStructure() {
        console.log('🧪 Testing Firestore structure...');
        
        try {
            // Test schedules collection
            const schedulesRef = this.db.collection('schedules');
            const schedulesSnapshot = await schedulesRef.limit(1).get();
            
            this.addTestResult(
                'Firestore Schedules Collection',
                true,
                `Schedules collection accessible, ${schedulesSnapshot.size} documents found`
            );
            
            // Test appointments collection
            const appointmentsRef = this.db.collection('appointments');
            const appointmentsSnapshot = await appointmentsRef.limit(1).get();
            
            this.addTestResult(
                'Firestore Appointments Collection', 
                true,
                `Appointments collection accessible, ${appointmentsSnapshot.size} documents found`
            );
            
            // Test doctors collection (if exists)
            const doctorsRef = this.db.collection('doctors');
            const doctorsSnapshot = await doctorsRef.limit(1).get();
            
            this.addTestResult(
                'Firestore Doctors Collection',
                true,
                `Doctors collection accessible, ${doctorsSnapshot.size} documents found`
            );
            
        } catch (error) {
            this.addTestResult(
                'Firestore Structure Test',
                false,
                `Failed to access Firestore: ${error.message}`,
                error
            );
        }
    }
    
    // Test 2: Create Sample Doctor Schedule
    async testCreateDoctorSchedule() {
        console.log('🧪 Testing doctor schedule creation...');
        
        try {
            const testDoctorId = 'test-doctor-123';
            const testDate = '2024-10-03';
            
            // Create sample schedule structure
            const sampleSchedule = {
                slots: {
                    'slot-09-00': {
                        time: '09:00',
                        available: true,
                        duration: 30
                    },
                    'slot-09-30': {
                        time: '09:30',
                        available: true,
                        duration: 30
                    },
                    'slot-10-00': {
                        time: '10:00',
                        available: false,
                        heldUntil: Date.now() + 10000 // 10 seconds for testing
                    },
                    'slot-10-30': {
                        time: '10:30',
                        available: true,
                        duration: 30
                    }
                },
                doctorId: testDoctorId,
                date: testDate,
                createdAt: new Date().toISOString()
            };
            
            const scheduleRef = this.db
                .collection('schedules')
                .doc(testDoctorId)
                .collection(testDate)
                .doc('day');
                
            await scheduleRef.set(sampleSchedule);
            
            this.addTestResult(
                'Create Doctor Schedule',
                true,
                `Sample schedule created for doctor ${testDoctorId} on ${testDate}`,
                sampleSchedule
            );
            
            // Verify the schedule was created
            const verifySnap = await scheduleRef.get();
            if (verifySnap.exists) {
                this.addTestResult(
                    'Verify Schedule Creation',
                    true,
                    'Schedule successfully written and readable',
                    verifySnap.data()
                );
            } else {
                throw new Error('Schedule not found after creation');
            }
            
        } catch (error) {
            this.addTestResult(
                'Create Doctor Schedule',
                false,
                `Failed to create schedule: ${error.message}`,
                error
            );
        }
    }
    
    // Test 3: Test Slot Reservation Function
    async testSlotReservation() {
        console.log('🧪 Testing slot reservation...');
        
        try {
            // Check if user is authenticated
            const currentUser = this.auth.currentUser;
            if (!currentUser) {
                this.addTestResult(
                    'Slot Reservation Auth Check',
                    false,
                    'User not authenticated - cannot test slot reservation'
                );
                return;
            }
            
            const reserveSlot = this.functions.httpsCallable('reserveSlot');
            
            const testData = {
                doctorId: 'test-doctor-123',
                date: '2024-10-03',
                slotId: 'slot-09-00',
                payload: {
                    patientName: 'Test Patient',
                    reason: 'Testing appointment booking'
                }
            };
            
            try {
                const result = await reserveSlot(testData);
                
                this.addTestResult(
                    'Slot Reservation Function',
                    true,
                    'Slot reservation function executed successfully',
                    result.data
                );
                
            } catch (funcError) {
                // This might fail if the function doesn't exist or schedule doesn't exist
                this.addTestResult(
                    'Slot Reservation Function', 
                    false,
                    `Function call failed: ${funcError.message}`,
                    funcError
                );
            }
            
        } catch (error) {
            this.addTestResult(
                'Slot Reservation Test',
                false,
                `Reservation test failed: ${error.message}`,
                error
            );
        }
    }
    
    // Test 4: Test Appointment Creation (Direct Firestore)
    async testDirectAppointmentCreation() {
        console.log('🧪 Testing direct appointment creation...');
        
        try {
            const testAppointment = {
                id: 'test-appointment-' + Date.now(),
                patientId: 'test-patient-123',
                doctorId: 'test-doctor-123',
                date: '2024-10-03',
                slotId: 'slot-09-30',
                status: 'confirmed',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                patientName: 'Test Patient',
                doctorName: 'Dr. Test',
                reason: 'Test appointment'
            };
            
            const appointmentRef = this.db.collection('appointments').doc(testAppointment.id);
            await appointmentRef.set(testAppointment);
            
            this.addTestResult(
                'Direct Appointment Creation',
                true,
                `Test appointment created with ID: ${testAppointment.id}`,
                testAppointment
            );
            
            // Verify appointment was created
            const verifySnap = await appointmentRef.get();
            if (verifySnap.exists) {
                this.addTestResult(
                    'Verify Appointment Creation',
                    true,
                    'Appointment successfully written and readable',
                    verifySnap.data()
                );
            } else {
                throw new Error('Appointment not found after creation');
            }
            
        } catch (error) {
            this.addTestResult(
                'Direct Appointment Creation',
                false,
                `Failed to create appointment: ${error.message}`,
                error
            );
        }
    }
    
    // Test 5: Test Real-time Updates
    async testRealtimeUpdates() {
        console.log('🧪 Testing real-time updates...');
        
        try {
            let updateReceived = false;
            const testDocId = 'test-realtime-' + Date.now();
            
            // Set up listener
            const unsubscribe = this.db
                .collection('appointments')
                .doc(testDocId)
                .onSnapshot((doc) => {
                    if (doc.exists) {
                        updateReceived = true;
                        console.log('📡 Real-time update received:', doc.data());
                    }
                });
            
            // Create document
            await this.db.collection('appointments').doc(testDocId).set({
                test: true,
                timestamp: Date.now()
            });
            
            // Wait a moment for the update
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            unsubscribe();
            
            this.addTestResult(
                'Real-time Updates',
                updateReceived,
                updateReceived ? 'Real-time updates working correctly' : 'Real-time updates not received'
            );
            
            // Clean up test document
            await this.db.collection('appointments').doc(testDocId).delete();
            
        } catch (error) {
            this.addTestResult(
                'Real-time Updates',
                false,
                `Real-time test failed: ${error.message}`,
                error
            );
        }
    }
    
    // Test 6: Test Phone Number Validation
    testPhoneValidation() {
        console.log('🧪 Testing phone number validation...');
        
        const testNumbers = [
            { phone: '+9647701234567', expected: true, note: 'Valid Iraqi mobile (077)' },
            { phone: '+9647801234567', expected: true, note: 'Valid Iraqi mobile (078)' },
            { phone: '+9647901234567', expected: true, note: 'Valid Iraqi mobile (079)' },
            { phone: '+9647501234567', expected: true, note: 'Valid Iraqi mobile (075)' },
            { phone: '+9647601234567', expected: true, note: 'Valid Iraqi mobile (076)' },
            { phone: '07701234567', expected: true, note: 'Valid local format' },
            { phone: '+9647001234567', expected: false, note: 'Invalid prefix (070)' },
            { phone: '0770123456', expected: false, note: 'Too short' },
            { phone: '+1234567890', expected: false, note: 'Wrong country' },
            { phone: '12345', expected: false, note: 'Invalid format' }
        ];
        
        const IRAQI_PREFIXES = ['077', '078', '079', '075', '076'];
        
        function validateIraqiPhone(phone) {
            const cleanPhone = phone.replace(/\\D/g, '');
            
            // Check for +964 prefix
            if (phone.startsWith('+964')) {
                const localPart = cleanPhone.substring(3);
                if (localPart.length === 10) {
                    const prefix = localPart.substring(0, 3);
                    return IRAQI_PREFIXES.includes(prefix);
                }
            }
            
            // Check local format
            if (cleanPhone.length === 11 && cleanPhone.startsWith('07')) {
                const prefix = cleanPhone.substring(0, 3);
                return IRAQI_PREFIXES.includes(prefix);
            }
            
            return false;
        }
        
        let passedTests = 0;
        let totalTests = testNumbers.length;
        
        testNumbers.forEach(test => {
            const result = validateIraqiPhone(test.phone);
            const passed = result === test.expected;
            
            if (passed) passedTests++;
            
            console.log(`   ${passed ? '✅' : '❌'} ${test.phone} - ${test.note} (Expected: ${test.expected}, Got: ${result})`);
        });
        
        this.addTestResult(
            'Phone Number Validation',
            passedTests === totalTests,
            `${passedTests}/${totalTests} validation tests passed`,
            { passedTests, totalTests, testNumbers }
        );
    }
    
    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting MedConnect Appointment System Tests...');
        console.log('================================================');
        
        const initialized = await this.initialize();
        if (!initialized) {
            console.log('❌ Cannot run tests - initialization failed');
            return;
        }
        
        // Run tests in sequence
        await this.testFirestoreStructure();
        await this.testCreateDoctorSchedule();
        await this.testDirectAppointmentCreation();
        await this.testRealtimeUpdates();
        this.testPhoneValidation();
        await this.testSlotReservation(); // This might fail if not authenticated
        
        console.log('\\n🏁 Test Suite Completed');
        console.log('================================================');
        
        this.printSummary();
        return this.testResults;
    }
    
    printSummary() {
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.success).length;
        const failed = total - passed;
        
        console.log(`\\n📊 Test Summary:`);
        console.log(`   Total Tests: ${total}`);
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   Success Rate: ${Math.round((passed/total) * 100)}%`);
        
        if (failed > 0) {
            console.log('\\n❌ Failed Tests:');
            this.testResults
                .filter(r => !r.success)
                .forEach(r => console.log(`   - ${r.testName}: ${r.message}`));
        }
    }
    
    exportResults() {
        const exportData = {
            timestamp: new Date().toISOString(),
            testSuite: 'MedConnect Appointment System',
            results: this.testResults,
            summary: {
                total: this.testResults.length,
                passed: this.testResults.filter(r => r.success).length,
                failed: this.testResults.filter(r => !r.success).length
            }
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `medconnect-appointment-tests-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('📥 Test results exported');
    }
}

// Make tester available globally
window.appointmentTester = new AppointmentSystemTester();

// Quick test function
window.runAppointmentTests = async function() {
    return await window.appointmentTester.runAllTests();
};

// Export results function
window.exportAppointmentTests = function() {
    return window.appointmentTester.exportResults();
};

console.log('🏥 MedConnect Appointment System Tester loaded');
console.log('📋 Run: runAppointmentTests() to start testing');
console.log('📥 Run: exportAppointmentTests() to export results');