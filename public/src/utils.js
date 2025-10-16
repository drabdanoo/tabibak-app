// MedConnect Utilities
// Centralized utility functions for consistent behavior across the application

// ==================== CONFIGURATION ====================
const CONFIG = {
    DEFAULT_CONSULTATION_FEE: 15000,
    CURRENCY: 'IQD',
    CURRENCY_SYMBOL: 'د.ع',
    OTP_RESEND_DELAY: 60, // seconds
    RETRY_DELAY: 2000, // milliseconds
    FIRESTORE_BATCH_SIZE: 100,
    SLOT_HOLD_DURATION: 2 * 60 * 1000, // 2 minutes
    MAX_OTP_ATTEMPTS: 3,
    OTP_RATE_LIMIT_WINDOW: 15 * 60 * 1000 // 15 minutes
};

// ==================== DATE UTILITIES ====================
const DateUtils = {
    toISODate(date) {
        try {
            return new Date(date).toISOString().split('T')[0];
        } catch (e) {
            console.error('Error converting to ISO date:', e);
            return '';
        }
    },
    
    toArabicDate(date) {
        try {
            return new Date(date).toLocaleDateString('ar-IQ-u-ca-gregory', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            console.error('Error converting to Arabic date:', e);
            return date || '';
        }
    },
    
    toArabicDateTime(date) {
        try {
            return new Date(date).toLocaleDateString('ar-IQ-u-ca-gregory', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
        } catch (e) {
            console.error('Error converting to Arabic datetime:', e);
            return date || '';
        }
    },
    
    formatGregorianDate(dateInput) {
        try {
            if (!dateInput) return 'غير محدد';
            const d = new Date(dateInput);
            if (Number.isNaN(d.getTime())) {
                return dateInput;
            }
            return d.toLocaleDateString('ar-IQ-u-ca-gregory', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateInput || 'غير محدد';
        }
    },
    
    isValidDate(date) {
        const d = new Date(date);
        return d instanceof Date && !isNaN(d.getTime());
    },
    
    isPastDate(date) {
        const d = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d < today;
    }
};

// ==================== CURRENCY UTILITIES ====================
const CurrencyUtils = {
    formatIQD(value) {
        const n = Number(value);
        if (!isFinite(n)) return `0 ${CONFIG.CURRENCY_SYMBOL}`;
        try {
            return new Intl.NumberFormat('ar-IQ', {
                style: 'currency',
                currency: CONFIG.CURRENCY,
                maximumFractionDigits: 0
            }).format(Math.round(n));
        } catch (e) {
            return `${Math.round(n).toLocaleString('ar-IQ')} ${CONFIG.CURRENCY_SYMBOL}`;
        }
    }
};

// ==================== ERROR MESSAGES ====================
const ERROR_MESSAGES = {
    NETWORK_ERROR: 'مشكلة في الاتصال بالإنترنت',
    AUTH_FAILED: 'فشل تسجيل الدخول',
    PERMISSION_DENIED: 'ليس لديك صلاحية للوصول',
    INVALID_CREDENTIALS: 'بيانات الدخول غير صحيحة',
    USER_NOT_FOUND: 'المستخدم غير موجود',
    PHONE_INVALID: 'رقم الهاتف غير صحيح',
    OTP_INVALID: 'رمز التحقق غير صحيح',
    OTP_EXPIRED: 'انتهت صلاحية رمز التحقق',
    RATE_LIMIT: 'محاولات كثيرة، يرجى المحاولة لاحقاً',
    GENERIC_ERROR: 'حدث خطأ غير متوقع'
};

// ==================== MODAL UTILITIES ====================
const ModalUtils = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('show');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },
    
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('show');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    },
    
    closeAll() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        });
        document.body.style.overflow = 'auto';
    }
};

// ==================== LOGGER ====================
const Logger = {
    isDev: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    
    log(...args) {
        if (this.isDev) console.log(...args);
    },
    
    error(...args) {
        console.error(...args); // Always log errors
    },
    
    warn(...args) {
        if (this.isDev) console.warn(...args);
    },
    
    info(...args) {
        if (this.isDev) console.info(...args);
    }
};

// ==================== OTP RATE LIMITER ====================
const OTPRateLimiter = {
    maxAttempts: CONFIG.MAX_OTP_ATTEMPTS,
    windowMs: CONFIG.OTP_RATE_LIMIT_WINDOW,
    attempts: [],
    
    canSend() {
        const now = Date.now();
        this.attempts = this.attempts.filter(t => now - t < this.windowMs);
        return this.attempts.length < this.maxAttempts;
    },
    
    recordAttempt() {
        this.attempts.push(Date.now());
    },
    
    getRemainingTime() {
        if (this.attempts.length === 0) return 0;
        const oldestAttempt = Math.min(...this.attempts);
        const timeElapsed = Date.now() - oldestAttempt;
        return Math.max(0, this.windowMs - timeElapsed);
    },
    
    reset() {
        this.attempts = [];
    }
};

// ==================== NOTIFICATION SYSTEM ====================
const NotificationSystem = {
    show(message, type = 'info', duration = 4000) {
        const id = 'notification-container-' + Date.now();
        const container = document.createElement('div');
        container.id = id;
        container.className = 'fixed top-4 right-4 z-[9999] pointer-events-none max-w-md';
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            warning: 'bg-yellow-600',
            info: 'bg-blue-600'
        };
        
        const icons = {
            success: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
            error: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
            warning: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>`,
            info: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`
        };
        
        container.innerHTML = `
            <div class="${colors[type] || colors.info} text-white px-4 py-3 rounded-lg shadow-lg pointer-events-auto transform transition-all duration-300 opacity-0 translate-x-full">
                <div class="flex items-start">
                    <svg class="w-5 h-5 ml-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        ${icons[type] || icons.info}
                    </svg>
                    <div class="flex-1">
                        <p class="text-sm font-medium whitespace-pre-line">${message}</p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="mr-2 text-white hover:text-gray-200 focus:outline-none">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Trigger animation
        setTimeout(() => {
            const notification = container.querySelector('div');
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Auto remove
        setTimeout(() => {
            const notification = container.querySelector('div');
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => container.remove(), 300);
        }, duration);
    }
};

// ==================== STORAGE UTILITIES (with encryption awareness) ====================
const StorageUtils = {
    set(key, value, useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        try {
            storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            Logger.error('Storage set error:', e);
            return false;
        }
    },
    
    get(key, useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        try {
            const item = storage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            Logger.error('Storage get error:', e);
            return null;
        }
    },
    
    remove(key, useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        try {
            storage.removeItem(key);
            return true;
        } catch (e) {
            Logger.error('Storage remove error:', e);
            return false;
        }
    },
    
    clear(useSession = false) {
        const storage = useSession ? sessionStorage : localStorage;
        try {
            storage.clear();
            return true;
        } catch (e) {
            Logger.error('Storage clear error:', e);
            return false;
        }
    }
};

// ==================== DEBOUNCE UTILITY ====================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== RETRY UTILITY ====================
async function retryOperation(operation, maxRetries = 3, delay = CONFIG.RETRY_DELAY) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            if (error.code !== 'unavailable' && error.code !== 'network-request-failed') {
                throw error;
            }
            Logger.warn(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// ==================== VALIDATION UTILITIES ====================
const ValidationUtils = {
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    isValidIraqiPhone(phone) {
        const iraqiPhoneRegex = /^07[0-9]{9}$/;
        return iraqiPhoneRegex.test(phone);
    },
    
    isValidOTP(otp) {
        return /^\d{6}$/.test(otp);
    },
    
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input.replace(/[<>'"]/g, '');
    },
    
    sanitizePhone(phone) {
        return phone.replace(/\D/g, '');
    }
};

// ==================== EXPORT ====================
if (typeof window !== 'undefined') {
    window.MedConnectUtils = {
        CONFIG,
        DateUtils,
        CurrencyUtils,
        ERROR_MESSAGES,
        ModalUtils,
        Logger,
        OTPRateLimiter,
        NotificationSystem,
        StorageUtils,
        debounce,
        retryOperation,
        ValidationUtils
    };
    
    // Legacy support
    window.formatIQD = CurrencyUtils.formatIQD;
    window.showNotification = NotificationSystem.show;
    window.formatGregorianDate = DateUtils.formatGregorianDate;
}
