// MedConnect Universal Debug Utilities
// Master debugging script that provides comprehensive testing and monitoring

class MedConnectDebugger {
    constructor() {
        this.version = '1.0.0';
        this.startTime = Date.now();
        this.isEnabled = this.checkDebugMode();
        this.logs = [];
        this.errors = [];
        this.performance = {};
        
        if (this.isEnabled) {
            this.init();
        }
    }
    
    checkDebugMode() {
        // Enable debug mode if:
        // 1. Running on localhost
        // 2. Debug parameter in URL
        // 3. Development environment
        return (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.search.includes('debug=1') ||
            (window.__MC_ENV__ && window.__MC_ENV__.ENV === 'development')
        );
    }
    
    init() {
        console.log(`%c🏥 MedConnect Debug Suite v${this.version}`, 'color: #4CAF50; font-weight: bold; font-size: 16px;');
        console.log('%cDebug mode enabled', 'color: #2196F3; font-weight: bold;');
        
        this.setupErrorHandling();
        this.setupPerformanceMonitoring();
        this.createDebugInterface();
        this.monitorFirebase();
        this.logSystemInfo();
        
        // Make debug functions available globally
        this.exposeGlobalFunctions();
    }
    
    setupErrorHandling() {
        // Capture JavaScript errors
        window.addEventListener('error', (e) => {
            this.logError('JavaScript Error', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error?.stack
            });
        });
        
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            this.logError('Unhandled Promise Rejection', {
                reason: e.reason,
                promise: e.promise
            });
        });
        
        // Override console methods
        this.interceptConsole();
    }
    
    interceptConsole() {
        const originalMethods = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
        };
        
        ['log', 'error', 'warn', 'info'].forEach(method => {
            console[method] = (...args) => {
                this.addLog(method, args);
                originalMethods[method].apply(console, args);
            };
        });
    }
    
    addLog(level, args) {
        const entry = {
            level,
            message: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '),
            timestamp: new Date().toISOString(),
            stack: new Error().stack
        };
        
        this.logs.push(entry);
        
        // Keep only last 200 logs
        if (this.logs.length > 200) {
            this.logs = this.logs.slice(-200);
        }
    }
    
    logError(type, details) {
        const error = {
            type,
            details,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.errors.push(error);
        console.error(`🚨 ${type}:`, details);
    }
    
    setupPerformanceMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perf = performance.getEntriesByType('navigation')[0];
                this.performance.pageLoad = {
                    domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
                    loadComplete: perf.loadEventEnd - perf.loadEventStart,
                    totalTime: perf.loadEventEnd - perf.fetchStart
                };
                
                console.log('📊 Page Performance:', this.performance.pageLoad);
            }, 100);
        });
        
        // Monitor Firebase connection time
        this.performance.firebase = {
            initStart: Date.now()
        };
    }
    
    monitorFirebase() {
        // Monitor Firebase initialization
        const checkFirebase = () => {
            if (window.firebase) {
                this.performance.firebase.initComplete = Date.now();
                this.performance.firebase.initTime = this.performance.firebase.initComplete - this.performance.firebase.initStart;
                
                console.log(`✅ Firebase loaded in ${this.performance.firebase.initTime}ms`);
                
                // Monitor auth state changes
                if (firebase.auth) {
                    firebase.auth().onAuthStateChanged((user) => {
                        console.log('🔐 Auth state changed:', user ? `User: ${user.uid}` : 'Signed out');
                    });
                }
                
                // Monitor Firestore operations
                this.monitorFirestore();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        
        checkFirebase();
    }
    
    monitorFirestore() {
        if (!firebase.firestore) return;
        
        const db = firebase.firestore();
        
        // Enable offline persistence (with error handling)
        try {
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => console.log('✅ Firestore offline persistence enabled'))
                .catch(err => console.warn('⚠️ Firestore persistence failed:', err.code));
        } catch (err) {
            console.warn('⚠️ Firestore persistence not supported:', err);
        }
    }
    
    createDebugInterface() {
        // Create floating debug button
        const debugBtn = document.createElement('div');
        debugBtn.innerHTML = '🐛';
        debugBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        
        debugBtn.onmouseover = () => {
            debugBtn.style.transform = 'scale(1.1)';
        };
        
        debugBtn.onmouseout = () => {
            debugBtn.style.transform = 'scale(1)';
        };
        
        debugBtn.onclick = () => this.showDebugMenu();
        
        document.body.appendChild(debugBtn);
    }
    
    showDebugMenu() {
        const menu = document.createElement('div');
        menu.id = 'debug-menu';
        menu.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #1a1a1a;
            color: white;
            padding: 20px;
            border-radius: 10px;
            min-width: 300px;
            z-index: 10001;
            box-shadow: 0 8px 40px rgba(0,0,0,0.5);
            font-family: 'Cairo', monospace;
            font-size: 14px;
        `;
        
        menu.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #4CAF50;">🏥 MedConnect Debug</h3>
                <button onclick="document.getElementById('debug-menu').remove()" 
                        style="background: #f44336; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong>Quick Tests:</strong><br>
                <button onclick="window.runQuickTest()" style="margin: 2px; padding: 5px 10px; background: #2196F3; border: none; color: white; border-radius: 3px; cursor: pointer;">Quick Health Check</button>
                <button onclick="window.runFullTest()" style="margin: 2px; padding: 5px 10px; background: #4CAF50; border: none; color: white; border-radius: 3px; cursor: pointer;">Full Test Suite</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong>Portal Tests:</strong><br>
                <button onclick="window.testCurrentPortal()" style="margin: 2px; padding: 5px 10px; background: #FF9800; border: none; color: white; border-radius: 3px; cursor: pointer;">Test This Portal</button>
                <button onclick="window.checkDataConsistency()" style="margin: 2px; padding: 5px 10px; background: #9C27B0; border: none; color: white; border-radius: 3px; cursor: pointer;">Data Check</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong>Firebase:</strong><br>
                <button onclick="window.debugFirebase()" style="margin: 2px; padding: 5px 10px; background: #FF5722; border: none; color: white; border-radius: 3px; cursor: pointer;">Firebase Status</button>
                <button onclick="window.testPhoneAuth('+9647701234567')" style="margin: 2px; padding: 5px 10px; background: #795548; border: none; color: white; border-radius: 3px; cursor: pointer;">Test Auth</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong>Utilities:</strong><br>
                <button onclick="window.exportDebugData()" style="margin: 2px; padding: 5px 10px; background: #607D8B; border: none; color: white; border-radius: 3px; cursor: pointer;">Export Logs</button>
                <button onclick="window.clearDebugData()" style="margin: 2px; padding: 5px 10px; background: #f44336; border: none; color: white; border-radius: 3px; cursor: pointer;">Clear Data</button>
            </div>
            
            <div style="font-size: 12px; color: #888; margin-top: 15px;">
                Errors: ${this.errors.length} | Logs: ${this.logs.length}<br>
                Uptime: ${Math.round((Date.now() - this.startTime) / 1000)}s
            </div>
        `;
        
        // Remove existing menu if any
        const existing = document.getElementById('debug-menu');
        if (existing) existing.remove();
        
        document.body.appendChild(menu);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (document.getElementById('debug-menu')) {
                document.getElementById('debug-menu').remove();
            }
        }, 30000);
    }
    
    logSystemInfo() {
        const info = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
        
        console.log('💻 System Info:', info);
        this.systemInfo = info;
    }
    
    exposeGlobalFunctions() {
        // Quick health check
        window.runQuickTest = () => {
            console.log('🏃‍♂️ Running quick health check...');
            
            const checks = [
                { name: 'Firebase', check: () => !!window.firebase },
                { name: 'Config', check: () => !!window.__MC_ENV__ },
                { name: 'Auth SDK', check: () => !!(firebase && firebase.auth) },
                { name: 'Firestore SDK', check: () => !!(firebase && firebase.firestore) }
            ];
            
            checks.forEach(check => {
                const result = check.check();
                console.log(`${result ? '✅' : '❌'} ${check.name}: ${result ? 'OK' : 'FAIL'}`);
            });
            
            console.log('🏃‍♂️ Quick check complete');
        };
        
        // Full test suite
        window.runFullTest = async () => {
            console.log('🚀 Running full test suite...');
            
            // Run all available tests
            if (window.runAppointmentTests) await window.runAppointmentTests();
            if (window.checkDataConsistency) await window.checkDataConsistency();
            if (window.testCurrentPortal) await window.testCurrentPortal();
            
            console.log('🚀 Full test suite complete');
        };
        
        // Export all debug data
        window.exportDebugData = () => {
            const debugData = {
                version: this.version,
                timestamp: new Date().toISOString(),
                systemInfo: this.systemInfo,
                performance: this.performance,
                logs: this.logs,
                errors: this.errors,
                config: window.__MC_ENV__,
                localStorage: { ...localStorage },
                sessionStorage: { ...sessionStorage }
            };
            
            const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medconnect-debug-export-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('📥 Debug data exported');
        };
        
        // Clear debug data
        window.clearDebugData = () => {
            this.logs = [];
            this.errors = [];
            console.clear();
            console.log('🧹 Debug data cleared');
        };
        
        // Show performance stats
        window.showPerformance = () => {
            console.table(this.performance);
        };
        
        // Show error summary
        window.showErrors = () => {
            if (this.errors.length === 0) {
                console.log('✅ No errors recorded');
            } else {
                console.table(this.errors);
            }
        };
    }
    
    // Utility methods
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    static formatTime(ms) {
        if (ms < 1000) return ms + 'ms';
        return (ms / 1000).toFixed(2) + 's';
    }
}

// Auto-initialize if debug mode is enabled
const mcDebugger = new MedConnectDebugger();

// Make debugger available globally
window.medConnectDebugger = mcDebugger;

// Show debug status
if (mcDebugger.isEnabled) {
    console.log('🛠️ MedConnect Debug Suite is active');
    console.log('💡 Look for the 🐛 button in the bottom-right corner');
    console.log('📋 Available commands: runQuickTest(), runFullTest(), exportDebugData()');
} else {
    console.log('🔒 Debug mode disabled (not on localhost/development)');
}