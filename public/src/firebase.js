// Firebase initialization and utilities - Compat SDK v10.7.1
// This file uses Firebase Compat SDK to match the version loaded in HTML files

// Note: Firebase is loaded via script tags in HTML files:
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

// Initialize Firebase (assumes firebase is already loaded globally)
let app, auth, db;

function initializeFirebaseServices() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded. Make sure to include Firebase scripts in your HTML.');
        return false;
    }

    try {
        // Initialize Firebase app if not already initialized
        if (!firebase.apps.length) {
            app = firebase.initializeApp(window.firebaseConfig || window.__MC_ENV__?.FIREBASE_CONFIG);
        } else {
            app = firebase.app();
        }

        // Get Firebase services
        auth = firebase.auth();
        db = firebase.firestore();

        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFirebaseServices);
    } else {
        initializeFirebaseServices();
    }
}

// Export Firebase services (for modules that import this file)
export { auth, db };

// Also expose globally for non-module scripts
if (typeof window !== 'undefined') {
    window.firebaseAuth = auth;
    window.firebaseDb = db;
}

// Enhanced phone validation for Iraqi numbers
export const IRAQI_PHONE_PREFIXES = ['077', '078', '079', '075', '076'];

export function validateIraqiPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('07')) {
        return false;
    }
    const prefix = cleanPhone.substring(0, 3);
    return IRAQI_PHONE_PREFIXES.includes(prefix);
}

export function normalizePhoneNumber(countryCode, phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    if (countryCode === '+964') {
        const normalizedPhone = cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone;
        return `+964${normalizedPhone}`;
    }
    
    return `${countryCode}${cleanPhone}`;
}

// OTP Helper Functions (using Compat SDK)
export async function sendOTP(phoneNumber) {
    try {
        if (!auth) {
            throw new Error('Firebase Auth not initialized');
        }

        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => console.log('reCAPTCHA solved'),
                'expired-callback': () => {
                    console.log('reCAPTCHA expired');
                    window.recaptchaVerifier = null;
                }
            });
        }

        const confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);
        return { success: true, confirmationResult };
    } catch (error) {
        console.error('Error sending OTP:', error);
        return { success: false, error: error.message };
    }
}

export async function verifyOTP(confirmationResult, code) {
    try {
        const result = await confirmationResult.confirm(code);
        return { success: true, user: result.user };
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return { success: false, error: error.message };
    }
}

// Notification system
export function showNotification(message, type = 'info', options = {}) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.maxWidth = '400px';
        document.body.appendChild(container);
    }

    const toastId = 'toast_' + Date.now();
    const toast = document.createElement('div');
    
    const bgColors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-600',
        info: 'bg-blue-600'
    };
    
    toast.id = toastId;
    toast.className = `${bgColors[type] || bgColors.info} text-white px-6 py-4 rounded-lg shadow-lg mb-3 flex items-start transition-all duration-300 opacity-0`;
    toast.innerHTML = `
        <div class="flex-1 mr-3">${message}</div>
        <button onclick="window.dismissToast('${toastId}')" class="text-white hover:text-gray-200 flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    const duration = options.duration || (type === 'error' ? 8000 : 4000);
    setTimeout(() => window.dismissToast(toastId), duration);
    
    return toastId;
}

window.dismissToast = function(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
};

// Firestore helper functions (using Compat SDK)
export const firestoreHelpers = {
    // Get server timestamp
    serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp(),
    
    // Get document reference
    doc: (collectionPath, docId) => db.collection(collectionPath).doc(docId),
    
    // Get collection reference
    collection: (collectionPath) => db.collection(collectionPath),
    
    // Query helpers
    where: (field, operator, value) => ({ field, operator, value }),
    
    // Batch operations
    batch: () => db.batch(),
    
    // Transaction
    runTransaction: (updateFunction) => db.runTransaction(updateFunction)
};

// Export for global access
if (typeof window !== 'undefined') {
    window.firebaseHelpers = {
        validateIraqiPhone,
        normalizePhoneNumber,
        sendOTP,
        verifyOTP,
        showNotification,
        firestoreHelpers
    };
}

console.log('✅ Firebase utilities loaded (Compat SDK v10.7.1)');
