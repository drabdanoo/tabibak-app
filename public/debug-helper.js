// MedConnect Debug Helper
// Add this script to any page for debugging

class MedConnectDebugger {
    constructor() {
        this.logs = [];
        this.errors = [];
        this.isEnabled = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.init();
    }

    init() {
        if (!this.isEnabled) return;
        
        console.log('%c🏥 MedConnect Debug Helper Loaded', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
        
        // Override console methods to capture logs
        this.interceptConsole();
        
        // Global error handler
        window.addEventListener('error', (e) => {
            this.logError('JavaScript Error', e.error || e.message, e.filename, e.lineno);
        });

        // Promise rejection handler
        window.addEventListener('unhandledrejection', (e) => {
            this.logError('Unhandled Promise Rejection', e.reason);
        });

        // Create debug panel
        this.createDebugPanel();
        
        // Firebase monitoring
        this.setupFirebaseMonitoring();
    }

    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            this.addLog('log', args);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            this.addLog('error', args);
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            this.addLog('warn', args);
            originalWarn.apply(console, args);
        };
    }

    addLog(type, args) {
        const timestamp = new Date().toLocaleTimeString();
        this.logs.push({
            type,
            message: args.join(' '),
            timestamp,
            stack: new Error().stack
        });
        
        if (this.logs.length > 100) {
            this.logs.shift(); // Keep only last 100 logs
        }
        
        this.updateDebugPanel();
    }

    logError(type, error, filename = '', lineno = '') {
        const errorInfo = {
            type,
            message: error.toString(),
            filename,
            lineno,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        this.errors.push(errorInfo);
        console.error(`🚨 ${type}:`, errorInfo);
    }

    setupFirebaseMonitoring() {
        // Monitor Firebase auth state
        if (window.firebase && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('✅ Firebase Auth: User signed in', {
                        uid: user.uid,
                        phoneNumber: user.phoneNumber,
                        email: user.email
                    });
                } else {
                    console.log('❌ Firebase Auth: User signed out');
                }
            });
        }
    }

    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 400px;
            background: #1a1a1a;
            color: #fff;
            padding: 10px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            overflow-y: auto;
            display: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        
        const toggle = document.createElement('button');
        toggle.textContent = '🐛 Debug';
        toggle.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #2196F3;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            z-index: 10000;
            font-size: 12px;
        `;
        
        toggle.onclick = () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        };
        
        document.body.appendChild(toggle);
        document.body.appendChild(panel);
        
        this.debugPanel = panel;
        this.updateDebugPanel();
    }

    updateDebugPanel() {
        if (!this.debugPanel) return;
        
        const recentLogs = this.logs.slice(-20); // Show last 20 logs
        
        this.debugPanel.innerHTML = `
            <div style="border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 8px;">
                <strong>🏥 MedConnect Debug Panel</strong>
                <button onclick="debugHelper.clearLogs()" style="float: left; background: #f44336; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;">Clear</button>
            </div>
            <div style="margin-bottom: 8px;">
                <strong>Recent Logs (${this.logs.length}):</strong>
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
                ${recentLogs.map(log => `
                    <div style="margin-bottom: 4px; padding: 2px; background: ${this.getLogColor(log.type)}; border-radius: 2px;">
                        <span style="color: #888; font-size: 10px;">${log.timestamp}</span><br>
                        <span>${log.message}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getLogColor(type) {
        switch (type) {
            case 'error': return '#2d1b1b';
            case 'warn': return '#2d2d1b';
            case 'log': return '#1b2d1b';
            default: return '#1a1a1a';
        }
    }

    clearLogs() {
        this.logs = [];
        this.errors = [];
        this.updateDebugPanel();
        console.clear();
    }

    // Debug utilities
    checkFirebaseConfig() {
        if (!window.__MC_ENV__) {
            console.error('❌ Firebase config not found in window.__MC_ENV__');
            return false;
        }
        
        const config = window.__MC_ENV__.FIREBASE_CONFIG;
        const required = ['apiKey', 'authDomain', 'projectId'];
        
        for (let key of required) {
            if (!config[key] || config[key].includes('<') || config[key].includes('>')) {
                console.error(`❌ Firebase config invalid: ${key} = ${config[key]}`);
                return false;
            }
        }
        
        console.log('✅ Firebase config looks valid');
        return true;
    }

    testFirebaseConnection() {
        if (!firebase || !firebase.app) {
            console.error('❌ Firebase not loaded');
            return;
        }
        
        try {
            const app = firebase.app();
            console.log('✅ Firebase app initialized:', app.name);
            
            // Test Firestore
            const db = firebase.firestore();
            db.collection('test').limit(1).get()
                .then(() => console.log('✅ Firestore connection OK'))
                .catch(err => console.error('❌ Firestore connection failed:', err));
                
        } catch (error) {
            console.error('❌ Firebase test failed:', error);
        }
    }

    simulatePhoneAuth(phoneNumber = '+9647701234567') {
        console.log('📱 Testing phone authentication with:', phoneNumber);
        
        if (!firebase.auth) {
            console.error('❌ Firebase Auth not available');
            return;
        }
        
        // This would normally require reCAPTCHA in production
        console.log('ℹ️  In production, this would trigger SMS OTP to', phoneNumber);
        console.log('ℹ️  For testing, you can use Firebase Auth emulator');
    }

    exportDebugData() {
        const debugData = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            logs: this.logs,
            errors: this.errors,
            firebaseConfig: window.__MC_ENV__,
            localStorage: {...localStorage},
            sessionStorage: {...sessionStorage}
        };
        
        const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `medconnect-debug-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize debug helper
window.debugHelper = new MedConnectDebugger();

// Add global debug functions
window.debugFirebase = () => {
    debugHelper.checkFirebaseConfig();
    debugHelper.testFirebaseConnection();
};

window.testPhoneAuth = (phone) => {
    debugHelper.simulatePhoneAuth(phone);
};

window.exportDebug = () => {
    debugHelper.exportDebugData();
};

// Log page load
console.log(`🏥 MedConnect Page Loaded: ${document.title}`);
console.log('📱 Available debug commands: debugFirebase(), testPhoneAuth(phone), exportDebug()');