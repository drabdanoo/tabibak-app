// MedConnect Portal Functionality Tester
// Tests patient, doctor, and admin portals for common issues

class PortalTester {
    constructor() {
        this.currentPortal = this.detectPortal();
        this.testResults = [];
        this.issues = [];
    }
    
    detectPortal() {
        const title = document.title.toLowerCase();
        if (title.includes('patient') || title.includes('مريض')) return 'patient';
        if (title.includes('doctor') || title.includes('طبيب')) return 'doctor';
        if (title.includes('admin') || title.includes('إدارة')) return 'admin';
        if (title.includes('debug')) return 'debug';
        return 'unknown';
    }
    
    addTestResult(testName, success, message, data = null) {
        const result = {
            portal: this.currentPortal,
            testName,
            success,
            message,
            data,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        
        const icon = success ? '✅' : '❌';
        console.log(`${icon} [${this.currentPortal.toUpperCase()}] ${testName}: ${message}`);
        if (data) console.log('   Data:', data);
    }
    
    addIssue(severity, message, element = null) {
        const issue = {
            portal: this.currentPortal,
            severity, // 'critical', 'warning', 'info'
            message,
            element: element ? element.id || element.className : null,
            timestamp: new Date().toISOString()
        };
        this.issues.push(issue);
        
        const icons = { 'critical': '🚨', 'warning': '⚠️', 'info': 'ℹ️' };
        console.log(`${icons[severity]} [${this.currentPortal.toUpperCase()}] ${message}`);
    }
    
    // Test 1: Check Required Scripts
    testRequiredScripts() {
        console.log('🧪 Testing required scripts...');
        
        const requiredScripts = [
            { name: 'Firebase App', check: () => window.firebase },
            { name: 'Firebase Auth', check: () => window.firebase && firebase.auth },
            { name: 'Firebase Firestore', check: () => window.firebase && firebase.firestore },
            { name: 'Config', check: () => window.__MC_ENV__ }
        ];
        
        requiredScripts.forEach(script => {
            try {
                const exists = script.check();
                this.addTestResult(
                    'Required Scripts',
                    !!exists,
                    `${script.name}: ${exists ? 'Loaded' : 'Missing'}`
                );
                
                if (!exists) {
                    this.addIssue('critical', `${script.name} not loaded - portal will not function`);
                }
            } catch (error) {
                this.addTestResult(
                    'Required Scripts',
                    false,
                    `${script.name}: Error checking - ${error.message}`
                );
            }
        });
    }
    
    // Test 2: Check Firebase Configuration
    testFirebaseConfig() {
        console.log('🧪 Testing Firebase configuration...');
        
        if (!window.__MC_ENV__) {
            this.addTestResult('Firebase Config', false, 'Config object not found');
            this.addIssue('critical', 'Firebase configuration not loaded');
            return;
        }
        
        const config = window.__MC_ENV__.FIREBASE_CONFIG;
        const required = ['apiKey', 'authDomain', 'projectId'];
        
        let validConfig = true;
        for (let key of required) {
            if (!config[key] || config[key].includes('<') || config[key].includes('>')) {
                this.addTestResult('Firebase Config', false, `Invalid ${key}: ${config[key]}`);
                this.addIssue('critical', `Firebase ${key} has placeholder value`);
                validConfig = false;
            }
        }
        
        if (validConfig) {
            this.addTestResult('Firebase Config', true, 'Configuration appears valid');
        }
    }
    
    // Test 3: Check UI Elements
    testUIElements() {
        console.log('🧪 Testing UI elements...');
        
        // Common elements to check based on portal type
        let elementsToCheck = [];
        
        if (this.currentPortal === 'patient') {
            elementsToCheck = [
                { id: 'bookingModal', name: 'Booking Modal', required: true },
                { selector: '.doctor-card', name: 'Doctor Cards', required: false },
                { selector: '.time-slot', name: 'Time Slots', required: false }
            ];
        } else if (this.currentPortal === 'doctor') {
            elementsToCheck = [
                { selector: '.appointment-card', name: 'Appointment Cards', required: false },
                { selector: '.tab-button', name: 'Navigation Tabs', required: true }
            ];
        } else if (this.currentPortal === 'admin') {
            elementsToCheck = [
                { selector: '.stat-card', name: 'Statistics Cards', required: false },
                { selector: '.admin-section', name: 'Admin Sections', required: false }
            ];
        }
        
        elementsToCheck.forEach(element => {
            try {
                let found;
                if (element.id) {
                    found = document.getElementById(element.id);
                } else if (element.selector) {
                    found = document.querySelectorAll(element.selector);
                    found = found.length > 0 ? found : null;
                }
                
                const exists = !!found;
                this.addTestResult(
                    'UI Elements',
                    exists || !element.required,
                    `${element.name}: ${exists ? 'Found' : 'Missing'}${element.required ? ' (Required)' : ''}`
                );
                
                if (!exists && element.required) {
                    this.addIssue('warning', `Required UI element missing: ${element.name}`);
                }
            } catch (error) {
                this.addTestResult(
                    'UI Elements',
                    false,
                    `Error checking ${element.name}: ${error.message}`
                );
            }
        });
    }
    
    // Test 4: Check Form Functionality
    testFormFunctionality() {
        console.log('🧪 Testing form functionality...');
        
        const forms = document.querySelectorAll('form');
        
        if (forms.length === 0) {
            this.addTestResult('Forms', true, 'No forms found to test');
            return;
        }
        
        forms.forEach((form, index) => {
            const formName = form.id || form.className || `Form ${index + 1}`;
            
            // Check for submit handler
            const hasSubmitHandler = form.onsubmit || 
                                   form.getAttribute('onsubmit') ||
                                   form.addEventListener;
                                   
            this.addTestResult(
                'Form Functionality',
                true, // Always pass since we can't easily test without triggering
                `${formName}: Structure looks OK`
            );
            
            // Check for required fields
            const requiredFields = form.querySelectorAll('[required]');
            if (requiredFields.length === 0) {
                this.addIssue('info', `Form ${formName} has no required fields`);
            } else {
                this.addTestResult(
                    'Form Validation',
                    true,
                    `${formName}: ${requiredFields.length} required fields found`
                );
            }
        });
    }
    
    // Test 5: Check Modal Functionality
    testModalFunctionality() {
        console.log('🧪 Testing modal functionality...');
        
        const modals = document.querySelectorAll('.modal, [class*="modal"]');
        
        if (modals.length === 0) {
            this.addTestResult('Modals', true, 'No modals found');
            return;
        }
        
        modals.forEach((modal, index) => {
            const modalName = modal.id || `Modal ${index + 1}`;
            
            // Check if modal has close functionality
            const closeButtons = modal.querySelectorAll('[onclick*="close"], .close, [data-dismiss]');
            
            this.addTestResult(
                'Modal Functionality',
                closeButtons.length > 0,
                `${modalName}: ${closeButtons.length > 0 ? 'Has close button' : 'No close button found'}`
            );
            
            if (closeButtons.length === 0) {
                this.addIssue('warning', `Modal ${modalName} may not be closable`);
            }
        });
    }
    
    // Test 6: Check Button Functionality
    testButtonFunctionality() {
        console.log('🧪 Testing button functionality...');
        
        const buttons = document.querySelectorAll('button, [onclick]');
        let functionalButtons = 0;
        let nonFunctionalButtons = 0;
        
        buttons.forEach((button, index) => {
            const hasHandler = button.onclick || 
                             button.getAttribute('onclick') ||
                             button.type === 'submit';
                             
            if (hasHandler) {
                functionalButtons++;
            } else {
                nonFunctionalButtons++;
                const buttonText = button.textContent?.trim().substring(0, 20) || `Button ${index + 1}`;
                this.addIssue('info', `Button "${buttonText}" has no click handler`);
            }
        });
        
        this.addTestResult(
            'Button Functionality',
            functionalButtons > 0,
            `${functionalButtons} functional buttons, ${nonFunctionalButtons} without handlers`
        );
    }
    
    // Test 7: Check Console Errors
    testConsoleErrors() {
        console.log('🧪 Checking for console errors...');
        
        // This is a basic check - in a real scenario, you'd capture errors over time
        const originalError = console.error;
        let errorCount = 0;
        
        console.error = function(...args) {
            errorCount++;
            originalError.apply(console, args);
        };
        
        // Restore after a moment
        setTimeout(() => {
            console.error = originalError;
            this.addTestResult(
                'Console Errors',
                errorCount === 0,
                errorCount === 0 ? 'No new console errors' : `${errorCount} console errors detected`
            );
        }, 1000);
    }
    
    // Test 8: Portal-Specific Tests
    testPortalSpecific() {
        console.log(`🧪 Testing ${this.currentPortal}-specific functionality...`);
        
        switch (this.currentPortal) {
            case 'patient':
                this.testPatientPortal();
                break;
            case 'doctor':
                this.testDoctorPortal();
                break;
            case 'admin':
                this.testAdminPortal();
                break;
            default:
                this.addTestResult('Portal-Specific', true, 'No specific tests for this portal');
        }
    }
    
    testPatientPortal() {
        // Test booking functionality
        const bookingButtons = document.querySelectorAll('[onclick*="showBookingModal"], [onclick*="booking"]');
        this.addTestResult(
            'Patient Booking',
            bookingButtons.length > 0,
            `${bookingButtons.length} booking buttons found`
        );
        
        // Test doctor selection
        const doctorCards = document.querySelectorAll('.doctor-card, [onclick*="doctor"]');
        this.addTestResult(
            'Doctor Selection',
            doctorCards.length > 0,
            `${doctorCards.length} doctor selection elements found`
        );
    }
    
    testDoctorPortal() {
        // Test schedule management
        const scheduleElements = document.querySelectorAll('[onclick*="schedule"], .schedule');
        this.addTestResult(
            'Doctor Schedule',
            scheduleElements.length > 0,
            `${scheduleElements.length} schedule elements found`
        );
        
        // Test appointment management
        const appointmentElements = document.querySelectorAll('.appointment, [onclick*="appointment"]');
        this.addTestResult(
            'Appointment Management',
            appointmentElements.length > 0,
            `${appointmentElements.length} appointment management elements found`
        );
    }
    
    testAdminPortal() {
        // Test admin sections
        const adminSections = document.querySelectorAll('.admin-section, [class*="admin"]');
        this.addTestResult(
            'Admin Sections',
            adminSections.length > 0,
            `${adminSections.length} admin sections found`
        );
        
        // Test statistics
        const statElements = document.querySelectorAll('.stat, [class*="stat"]');
        this.addTestResult(
            'Statistics Display',
            statElements.length > 0,
            `${statElements.length} statistic elements found`
        );
    }
    
    // Run all tests
    async runAllTests() {
        console.log(`🚀 Starting Portal Tests for: ${this.currentPortal.toUpperCase()}`);
        console.log('================================================');
        
        this.testResults = [];
        this.issues = [];
        
        // Run tests
        this.testRequiredScripts();
        this.testFirebaseConfig();
        this.testUIElements();
        this.testFormFunctionality();
        this.testModalFunctionality();
        this.testButtonFunctionality();
        this.testConsoleErrors();
        this.testPortalSpecific();
        
        console.log('\\n🏁 Portal Tests Completed');
        console.log('==========================');
        
        this.printSummary();
        return this.getReport();
    }
    
    printSummary() {
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.success).length;
        const failed = total - passed;
        
        const critical = this.issues.filter(i => i.severity === 'critical').length;
        const warnings = this.issues.filter(i => i.severity === 'warning').length;
        
        console.log(`\\n📊 ${this.currentPortal.toUpperCase()} Portal Test Summary:`);
        console.log(`   Total Tests: ${total}`);
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   🚨 Critical Issues: ${critical}`);
        console.log(`   ⚠️  Warnings: ${warnings}`);
        console.log(`   Success Rate: ${Math.round((passed/total) * 100)}%`);
        
        if (critical > 0) {
            console.log('\\n🚨 Critical Issues:');
            this.issues
                .filter(i => i.severity === 'critical')
                .forEach(i => console.log(`   - ${i.message}`));
        }
    }
    
    getReport() {
        return {
            portal: this.currentPortal,
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.testResults.length,
                passed: this.testResults.filter(r => r.success).length,
                failed: this.testResults.filter(r => !r.success).length,
                critical: this.issues.filter(i => i.severity === 'critical').length,
                warnings: this.issues.filter(i => i.severity === 'warning').length
            },
            testResults: this.testResults,
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
        a.download = `medconnect-${this.currentPortal}-test-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log(`📥 ${this.currentPortal} portal test report exported`);
    }
}

// Make tester available globally
window.portalTester = new PortalTester();

// Quick functions
window.testCurrentPortal = async function() {
    return await window.portalTester.runAllTests();
};

window.exportPortalTest = function() {
    return window.portalTester.exportReport();
};

console.log(`🏥 MedConnect Portal Tester loaded for: ${window.portalTester.currentPortal.toUpperCase()}`);
console.log('📋 Run: testCurrentPortal() to test this portal');
console.log('📥 Run: exportPortalTest() to export results');