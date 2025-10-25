// MedConnect Shared Utility Functions
'use strict';

/**
 * Formats a number as Iraqi Dinars (IQD).
 * @param {number} value The number to format.
 * @returns {string} The formatted currency string.
 */
window.formatIQD = function (value) {
    const n = Number(value);
    if (!isFinite(n)) return '0 د.ع';
    try {
        return new Intl.NumberFormat('ar-IQ', {
            style: 'currency',
            currency: 'IQD',
            maximumFractionDigits: 0
        }).format(Math.round(n));
    } catch (e) {
        return `${Math.round(n).toLocaleString('ar-IQ')} د.ع`;
    }
};

/**
 * Displays a toast notification.
 * @param {string} message The message to display.
 * @param {'info'|'success'|'error'|'warning'} type The type of notification.
 */
window.showNotification = function (message, type = 'info') {
    const notification = document.createElement('div');
    const typeClasses = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-600',
        info: 'bg-gray-800'
    };
    notification.className = `fixed top-5 right-5 z-[10000] px-4 py-3 mb-2 rounded-lg shadow-lg text-white ${typeClasses[type] || typeClasses.info}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity .3s';
        setTimeout(() => notification.remove(), 300);
    }, 3500);
};