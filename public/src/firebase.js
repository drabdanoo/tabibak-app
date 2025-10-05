// Firebase initialization and utilities
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(window.firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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

// OTP Helper Functions
export async function sendOTP(phoneNumber) {
    try {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => console.log('reCAPTCHA solved')
            }, auth);
        }

        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
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
        document.body.appendChild(container);
    }

    const toastId = 'toast_' + Date.now();
    const toast = document.createElement('div');
    
    toast.id = toastId;
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="flex items-start">
            <div class="flex-1">${message}</div>
            <button onclick="window.dismissToast('${toastId}')" class="ml-3 text-white hover:text-gray-200">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    const duration = options.duration || (type === 'error' ? 8000 : 4000);
    setTimeout(() => window.dismissToast(toastId), duration);
    
    return toastId;
}

window.dismissToast = function(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
};