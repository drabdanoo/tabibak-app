// MedConnect Data Consistency Checker
// Verifies Firestore structure, validates data integrity, and checks for common issues

class DataConsistencyChecker {
    constructor() {
        this.db = null;
        this.auth = null;
        this.issues = [];
        this.stats = {
            schedules: 0,
            appointments: 0,
            doctors: 0,
            patients: 0,
            orphanedSlots: 0,
            expiredHolds: 0
        };
    }
    
    async initialize() {
        try {
            if (!firebase) {
                throw new Error('Firebase not loaded');
            }
            
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            console.log('✅ Data Consistency Checker initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize checker:', error);
            return false;
        }
    }
    
    addIssue(type, severity, message, data = null) {
        const issue = {
            type,
            severity, // 'critical', 'warning', 'info'
            message,
            data,
            timestamp: new Date().toISOString()
        };
        this.issues.push(issue);
        
        const icons = {
            'critical': '🚨',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        
        console.log(`${icons[severity]} [${type.toUpperCase()}] ${message}`);
        if (data) console.log('   Data:', data);
    }
    
    // Check 1: Verify required collections exist
    async checkCollectionStructure() {
        console.log('🔍 Checking Firestore collection structure...');
        
        const requiredCollections = [
            'schedules',
            'appointments', 
            'doctors',
            'patients'
        ];
        
        for (const collection of requiredCollections) {
            try {
                const snapshot = await this.db.collection(collection).limit(1).get();
                this.stats[collection] = snapshot.size;
                
                if (snapshot.empty) {
                    this.addIssue(
                        'structure',
                        'warning',
                        `Collection '${collection}' exists but is empty`
                    );
                } else {
                    this.addIssue(
                        'structure',
                        'info',
                        `Collection '${collection}' exists with data`
                    );
                }
            } catch (error) {
                this.addIssue(
                    'structure',
                    'critical',
                    `Cannot access collection '${collection}': ${error.message}`,
                    error
                );
            }
        }
    }
    
    // Check 2: Validate schedule data structure
    async checkScheduleIntegrity() {
        console.log('🔍 Checking schedule data integrity...');
        
        try {
            const schedulesSnapshot = await this.db.collection('schedules').get();
            
            for (const doctorDoc of schedulesSnapshot.docs) {
                const doctorId = doctorDoc.id;
                
                // Get all date subcollections for this doctor
                const dateCollections = await doctorDoc.ref.listCollections();
                
                for (const dateCol of dateCollections) {
                    const dayDoc = await dateCol.doc('day').get();
                    
                    if (dayDoc.exists) {
                        const dayData = dayDoc.data();
                        this.validateScheduleData(doctorId, dateCol.id, dayData);
                    } else {
                        this.addIssue(
                            'schedule',
                            'warning',
                            `Missing day document for doctor ${doctorId} on ${dateCol.id}`
                        );
                    }
                }
            }
        } catch (error) {
            this.addIssue(
                'schedule',
                'critical',
                `Failed to check schedule integrity: ${error.message}`,
                error
            );
        }
    }
    
    validateScheduleData(doctorId, date, dayData) {
        if (!dayData.slots) {
            this.addIssue(
                'schedule',
                'critical',
                `No slots defined for doctor ${doctorId} on ${date}`
            );
            return;
        }
        
        const slots = dayData.slots;
        const now = Date.now();
        let expiredCount = 0;
        
        Object.entries(slots).forEach(([slotId, slot]) => {
            // Check for required fields
            if (typeof slot.available === 'undefined') {
                this.addIssue(
                    'schedule',
                    'warning',
                    `Slot ${slotId} missing 'available' field`,
                    { doctorId, date, slotId, slot }
                );
            }
            
            if (!slot.time) {
                this.addIssue(
                    'schedule',
                    'warning',
                    `Slot ${slotId} missing 'time' field`,
                    { doctorId, date, slotId, slot }
                );
            }
            
            // Check for expired holds
            if (slot.heldUntil && slot.heldUntil < now && !slot.available) {
                expiredCount++;
                this.addIssue(
                    'schedule',
                    'warning',
                    `Slot ${slotId} has expired hold (should be released)`,
                    { doctorId, date, slotId, heldUntil: slot.heldUntil, now }
                );
            }
        });
        
        this.stats.expiredHolds += expiredCount;
        
        if (expiredCount === 0) {
            this.addIssue(
                'schedule',
                'info',
                `Schedule for doctor ${doctorId} on ${date} looks good (${Object.keys(slots).length} slots)`
            );
        }
    }
    
    // Check 3: Validate appointments
    async checkAppointmentIntegrity() {
        console.log('🔍 Checking appointment data integrity...');
        
        try {
            const appointmentsSnapshot = await this.db.collection('appointments').get();
            this.stats.appointments = appointmentsSnapshot.size;
            
            for (const doc of appointmentsSnapshot.docs) {
                const appointment = doc.data();
                this.validateAppointmentData(doc.id, appointment);
            }
            
        } catch (error) {
            this.addIssue(
                'appointments',
                'critical',
                `Failed to check appointment integrity: ${error.message}`,
                error
            );
        }
    }
    
    validateAppointmentData(appointmentId, appointment) {
        const requiredFields = ['patientId', 'doctorId', 'date', 'slotId', 'status'];
        
        for (const field of requiredFields) {
            if (!appointment[field]) {
                this.addIssue(
                    'appointments',
                    'critical',
                    `Appointment ${appointmentId} missing required field: ${field}`,
                    appointment
                );
            }
        }
        
        // Check valid status
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (appointment.status && !validStatuses.includes(appointment.status)) {
            this.addIssue(
                'appointments',
                'warning',
                `Appointment ${appointmentId} has invalid status: ${appointment.status}`,
                appointment
            );
        }
        
        // Check date format (should be YYYY-MM-DD)
        if (appointment.date && !/^\\d{4}-\\d{2}-\\d{2}$/.test(appointment.date)) {
            this.addIssue(
                'appointments',
                'warning',
                `Appointment ${appointmentId} has invalid date format: ${appointment.date}`,
                appointment
            );
        }
    }
    
    // Check 4: Find orphaned appointments (appointments without corresponding slots)
    async checkOrphanedAppointments() {
        console.log('🔍 Checking for orphaned appointments...');
        
        try {
            const appointmentsSnapshot = await this.db.collection('appointments').get();
            
            for (const doc of appointmentsSnapshot.docs) {
                const appointment = doc.data();
                
                if (appointment.doctorId && appointment.date && appointment.slotId) {
                    // Check if corresponding schedule slot exists
                    const scheduleRef = this.db
                        .collection('schedules')
                        .doc(appointment.doctorId)
                        .collection(appointment.date)
                        .doc('day');
                        
                    const scheduleDoc = await scheduleRef.get();
                    
                    if (!scheduleDoc.exists) {
                        this.addIssue(
                            'orphaned',
                            'critical',
                            `Appointment ${doc.id} references non-existent schedule`,
                            appointment
                        );
                        this.stats.orphanedSlots++;
                    } else {
                        const scheduleData = scheduleDoc.data();
                        if (!scheduleData.slots || !scheduleData.slots[appointment.slotId]) {
                            this.addIssue(
                                'orphaned',
                                'critical',
                                `Appointment ${doc.id} references non-existent slot ${appointment.slotId}`,
                                appointment
                            );
                            this.stats.orphanedSlots++;
                        }
                    }
                }
            }
            
        } catch (error) {
            this.addIssue(
                'orphaned',
                'critical',
                `Failed to check orphaned appointments: ${error.message}`,
                error
            );
        }
    }
    
    // Check 5: Verify data relationships
    async checkDataRelationships() {
        console.log('🔍 Checking data relationships...');
        
        try {
            // Check if doctors referenced in schedules exist in doctors collection
            const schedulesSnapshot = await this.db.collection('schedules').get();
            const doctorsSnapshot = await this.db.collection('doctors').get();
            
            const doctorIds = new Set(doctorsSnapshot.docs.map(doc => doc.id));
            
            for (const scheduleDoc of schedulesSnapshot.docs) {
                const doctorId = scheduleDoc.id;
                
                if (!doctorIds.has(doctorId)) {
                    this.addIssue(
                        'relationships',
                        'warning',
                        `Schedule exists for doctor ${doctorId} but no doctor profile found`
                    );
                }
            }
            
            this.stats.doctors = doctorIds.size;
            
        } catch (error) {
            this.addIssue(
                'relationships',
                'critical',
                `Failed to check data relationships: ${error.message}`,
                error
            );
        }
    }
    
    // Check 6: Verify security rules (basic test)
    async checkSecurityRules() {
        console.log('🔍 Checking Firestore security rules...');
        
        try {
            // Try to read without authentication
            const currentUser = this.auth.currentUser;
            
            if (currentUser) {
                this.addIssue(
                    'security',
                    'info',
                    `User is authenticated (${currentUser.uid}) - security rules may allow access`
                );
            } else {
                // Try to access sensitive data without auth
                try {
                    await this.db.collection('appointments').limit(1).get();
                    this.addIssue(
                        'security',
                        'critical',
                        'Appointments collection accessible without authentication!'
                    );
                } catch (error) {
                    this.addIssue(
                        'security',
                        'info',
                        'Appointments collection properly secured (good)'
                    );
                }
            }
            
        } catch (error) {
            this.addIssue(
                'security',
                'warning',
                `Could not verify security rules: ${error.message}`,
                error
            );
        }
    }
    
    // Run all consistency checks
    async runAllChecks() {
        console.log('🔍 Starting MedConnect Data Consistency Check...');
        console.log('=============================================');
        
        const initialized = await this.initialize();
        if (!initialized) {
            console.log('❌ Cannot run checks - initialization failed');
            return;
        }
        
        this.issues = [];
        
        // Run checks in sequence
        await this.checkCollectionStructure();
        await this.checkScheduleIntegrity();
        await this.checkAppointmentIntegrity();
        await this.checkOrphanedAppointments();
        await this.checkDataRelationships();
        await this.checkSecurityRules();
        
        console.log('\\n🏁 Data Consistency Check Completed');
        console.log('=====================================');
        
        this.printSummary();
        return this.getReport();
    }
    
    printSummary() {
        const critical = this.issues.filter(i => i.severity === 'critical').length;
        const warnings = this.issues.filter(i => i.severity === 'warning').length;
        const info = this.issues.filter(i => i.severity === 'info').length;
        
        console.log(`\\n📊 Data Consistency Report:`);
        console.log(`   🚨 Critical Issues: ${critical}`);
        console.log(`   ⚠️  Warnings: ${warnings}`);
        console.log(`   ℹ️  Info: ${info}`);
        console.log(`   Total Issues: ${this.issues.length}`);
        
        console.log(`\\n📈 Database Statistics:`);
        console.log(`   Schedules: ${this.stats.schedules} doctors`);
        console.log(`   Appointments: ${this.stats.appointments} total`);
        console.log(`   Doctors: ${this.stats.doctors} profiles`);
        console.log(`   Orphaned Slots: ${this.stats.orphanedSlots}`);
        console.log(`   Expired Holds: ${this.stats.expiredHolds}`);
        
        if (critical > 0) {
            console.log('\\n🚨 Critical Issues Need Immediate Attention:');
            this.issues
                .filter(i => i.severity === 'critical')
                .forEach(i => console.log(`   - [${i.type.toUpperCase()}] ${i.message}`));
        }
    }
    
    getReport() {
        return {
            timestamp: new Date().toISOString(),
            summary: {
                critical: this.issues.filter(i => i.severity === 'critical').length,
                warnings: this.issues.filter(i => i.severity === 'warning').length,
                info: this.issues.filter(i => i.severity === 'info').length,
                total: this.issues.length
            },
            stats: this.stats,
            issues: this.issues
        };
    }
    
    exportReport() {
        const report = this.getReport();
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `medconnect-consistency-report-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('📥 Consistency report exported');
    }
    
    // Repair functions
    async repairExpiredHolds() {
        console.log('🔧 Repairing expired holds...');
        
        const now = Date.now();
        let repaired = 0;
        
        try {
            const schedulesSnapshot = await this.db.collection('schedules').get();
            
            for (const doctorDoc of schedulesSnapshot.docs) {
                const dateCollections = await doctorDoc.ref.listCollections();
                
                for (const dateCol of dateCollections) {
                    const dayRef = dateCol.doc('day');
                    const dayDoc = await dayRef.get();
                    
                    if (dayDoc.exists) {
                        const dayData = dayDoc.data();
                        const slots = dayData.slots || {};
                        let changed = false;
                        
                        Object.entries(slots).forEach(([slotId, slot]) => {
                            if (slot.heldUntil && slot.heldUntil < now && !slot.available) {
                                slots[slotId].available = true;
                                delete slots[slotId].heldUntil;
                                changed = true;
                                repaired++;
                            }
                        });
                        
                        if (changed) {
                            await dayRef.update({ slots });
                            console.log(`✅ Repaired expired holds for ${doctorDoc.id} on ${dateCol.id}`);
                        }
                    }
                }
            }
            
            console.log(`🔧 Repaired ${repaired} expired holds`);
            
        } catch (error) {
            console.error('❌ Failed to repair expired holds:', error);
        }
    }
}

// Make checker available globally
window.dataChecker = new DataConsistencyChecker();

// Quick functions
window.checkDataConsistency = async function() {
    return await window.dataChecker.runAllChecks();
};

window.repairExpiredHolds = async function() {
    return await window.dataChecker.repairExpiredHolds();
};

window.exportConsistencyReport = function() {
    return window.dataChecker.exportReport();
};

console.log('🔍 MedConnect Data Consistency Checker loaded');
console.log('📋 Run: checkDataConsistency() to check data integrity');
console.log('🔧 Run: repairExpiredHolds() to fix expired slot holds');
console.log('📥 Run: exportConsistencyReport() to export results');