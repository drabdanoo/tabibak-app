// Patient-specific functionality for index.html
import { auth, sendOTP, verifyOTP, showNotification, validateIraqiPhone, normalizePhoneNumber, IRAQI_PHONE_PREFIXES } from './firebase.js';

let confirmationResult = null;

// Enhanced phone formatting with validation
function formatPhoneNumber(event) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    
    // Save country code preference
    const countrySelect = input.parentElement.querySelector('select');
    if (countrySelect) {
        localStorage.setItem('preferred-country-code', countrySelect.value);
    }
    
    // Iraqi mobile format: 07XX XXX XXXX
    if (value.startsWith('07') && value.length <= 11) {
        const prefix = value.substring(0, 3);
        const isValidPrefix = IRAQI_PHONE_PREFIXES.includes(prefix);
        
        if (value.length > 3) {
            value = value.slice(0, 3) + ' ' + value.slice(3);
        }
        if (value.length > 7) {
            value = value.slice(0, 7) + ' ' + value.slice(7);
        }
        
        // Visual feedback
        input.classList.toggle('border-red-300', !isValidPrefix && value.length >= 3);
        input.classList.toggle('border-green-300', isValidPrefix && value.length === 13);
        
        updatePhoneValidation(input, isValidPrefix, value.replace(/\s/g, ''));
    } else {
        input.classList.remove('border-red-300', 'border-green-300');
        clearPhoneValidation(input);
    }
    
    input.value = value;
}

function updatePhoneValidation(input, isValid, cleanValue) {
    let validationDiv = input.parentElement.querySelector('.phone-validation');
    
    if (!validationDiv) {
        validationDiv = document.createElement('div');
        validationDiv.className = 'phone-validation text-xs mt-1';
        input.parentElement.appendChild(validationDiv);
    }
    
    if (cleanValue.length >= 3) {
        if (isValid) {
            if (cleanValue.length === 11) {
                validationDiv.className = 'phone-validation text-xs mt-1 text-green-600';
                validationDiv.textContent = '✓ رقم صحيح';
            } else {
                validationDiv.className = 'phone-validation text-xs mt-1 text-gray-600';
                validationDiv.textContent = `${11 - cleanValue.length} رقم متبقي`;
            }
        } else {
            validationDiv.className = 'phone-validation text-xs mt-1 text-red-600';
            validationDiv.textContent = '✗ بادئة غير صحيحة (077, 078, 079, 075, 076)';
        }
    }
}

function clearPhoneValidation(input) {
    const validationDiv = input.parentElement.querySelector('.phone-validation');
    if (validationDiv) {
        validationDiv.remove();
    }
}

// Send verification code
async function sendVerificationCode() {
    const countryCode = document.getElementById('countryCode').value;
    const phoneInput = document.getElementById('phoneNumber').value;
    
    if (!phoneInput || phoneInput.length < 7) {
        showNotification('يرجى إدخال رقم هاتف صحيح', 'error');
        return;
    }

    if (countryCode === '+964') {
        const cleanPhone = phoneInput.replace(/\D/g, '');
        if (!validateIraqiPhone(cleanPhone)) {
            showNotification('رقم الهاتف العراقي غير صحيح. يجب أن يبدأ بـ 077, 078, 079, 075, أو 076', 'error');
            return;
        }
    }

    const phoneNumber = normalizePhoneNumber(countryCode, phoneInput);
    
    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.textContent = 'جاري الإرسال...';
    sendBtn.disabled = true;

    const result = await sendOTP(phoneNumber);
    
    if (result.success) {
        confirmationResult = result.confirmationResult;
        document.getElementById('phoneStep').classList.add('hidden');
        document.getElementById('codeStep').classList.remove('hidden');
        showNotification('تم إرسال رمز التحقق إلى هاتفك', 'success');
    } else {
        showNotification('خطأ في إرسال الرمز. يرجى المحاولة مرة أخرى', 'error');
    }
    
    sendBtn.textContent = 'إرسال رمز التحقق';
    sendBtn.disabled = false;
}

// Verify code
async function verifyCode() {
    const code = document.getElementById('verificationCode').value;
    
    if (!code || code.length !== 6) {
        showNotification('يرجى إدخال رمز صحيح مكون من ٦ أرقام', 'error');
        return;
    }

    const verifyBtn = document.getElementById('verifyCodeBtn');
    verifyBtn.textContent = 'جاري التحقق...';
    verifyBtn.disabled = true;

    const result = await verifyOTP(confirmationResult, code);
    
    if (result.success) {
        showNotification('تم تسجيل الدخول بنجاح!', 'success');
        closeSignInModal();
        window.location.reload(); // Reload to show dashboard
    } else {
        showNotification('رمز التحقق غير صحيح', 'error');
    }
    
    verifyBtn.textContent = 'تحقق وتسجيل الدخول';
    verifyBtn.disabled = false;
}

// Modal functions
function openSignInModal() {
    document.getElementById('signInModal').classList.remove('hidden');
    resetSignInModal();
}

function closeSignInModal() {
    document.getElementById('signInModal').classList.add('hidden');
    resetSignInModal();
}

function resetSignInModal() {
    document.getElementById('phoneStep').classList.remove('hidden');
    document.getElementById('codeStep').classList.add('hidden');
    document.getElementById('phoneNumber').value = '';
    document.getElementById('verificationCode').value = '';
}

// Load public content
function loadPublicContent() {
    setTimeout(() => {
        const specialtiesGrid = document.getElementById('specialtiesGrid');
        if (specialtiesGrid) {
            specialtiesGrid.innerHTML = `
                <div class="specialty-card bg-blue-50 p-6 rounded-xl text-center cursor-pointer border border-blue-100 hover:border-blue-300 lazy-load">
                    <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-gray-900">طب عام</h3>
                    <p class="text-sm text-gray-600 mt-1">طبيب واحد</p>
                </div>
                <div class="specialty-card bg-green-50 p-6 rounded-xl text-center cursor-pointer border border-green-100 hover:border-green-300 lazy-load">
                    <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5H9m0-5a1.5 1.5 0 011.5-1.5H12"></path>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-gray-900">طب أطفال</h3>
                    <p class="text-sm text-gray-600 mt-1">طبيب واحد</p>
                </div>
                <div class="specialty-card bg-red-50 p-6 rounded-xl text-center cursor-pointer border border-red-100 hover:border-red-300 lazy-load">
                    <div class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-gray-900">طب قلب</h3>
                    <p class="text-sm text-gray-600 mt-1">طبيب واحد</p>
                </div>
                <div class="specialty-card bg-pink-50 p-6 rounded-xl text-center cursor-pointer border border-pink-100 hover:border-pink-300 lazy-load">
                    <div class="w-16 h-16 bg-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-gray-900">طب نساء</h3>
                    <p class="text-sm text-gray-600 mt-1">طبيب واحد</p>
                </div>
                <div class="specialty-card bg-orange-50 p-6 rounded-xl text-center cursor-pointer border border-orange-100 hover:border-orange-300 lazy-load">
                    <div class="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-gray-900">طب عظام</h3>
                    <p class="text-sm text-gray-600 mt-1">طبيب واحد</p>
                </div>
                <div class="specialty-card bg-purple-50 p-6 rounded-xl text-center cursor-pointer border border-purple-100 hover:border-purple-300 lazy-load">
                    <div class="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                    </div>
                    <h3 class="font-semibold text-gray-900">طب عيون</h3>
                    <p class="text-sm text-gray-600 mt-1">طبيب واحد</p>
                </div>
            `;
            setupIntersectionObserver();
        }
    }, 500);

    setTimeout(() => {
        const featuredDoctors = document.getElementById('featuredDoctors');
        if (featuredDoctors) {
            featuredDoctors.innerHTML = `
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow lazy-load">
                    <div class="text-center mb-4">
                        <div class="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900">د. أحمد محمد</h3>
                        <p class="text-blue-600 font-medium">طبيب عام</p>
                        <p class="text-sm text-gray-600 mt-2">خبرة ١٥ سنة في الطب العام</p>
                    </div>
                    <div class="text-center">
                        <div class="flex justify-center items-center mb-3">
                            <span class="text-yellow-400">⭐⭐⭐⭐⭐</span>
                            <span class="text-sm text-gray-600 mr-2">٤.٨ (١٢٠ تقييم)</span>
                        </div>
                        <button onclick="openSignInModal()" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                            احجز موعد
                        </button>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow lazy-load">
                    <div class="text-center mb-4">
                        <div class="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5H9m0-5a1.5 1.5 0 011.5-1.5H12"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900">د. سارة أحمد</h3>
                        <p class="text-green-600 font-medium">طب أطفال</p>
                        <p class="text-sm text-gray-600 mt-2">متخصصة في طب الأطفال والرضع</p>
                    </div>
                    <div class="text-center">
                        <div class="flex justify-center items-center mb-3">
                            <span class="text-yellow-400">⭐⭐⭐⭐⭐</span>
                            <span class="text-sm text-gray-600 mr-2">٤.٩ (٩٥ تقييم)</span>
                        </div>
                        <button onclick="openSignInModal()" class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold">
                            احجز موعد
                        </button>
                    </div>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow lazy-load">
                    <div class="text-center mb-4">
                        <div class="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900">د. عمر حسن</h3>
                        <p class="text-red-600 font-medium">طب قلب</p>
                        <p class="text-sm text-gray-600 mt-2">استشاري أمراض القلب والأوعية الدموية</p>
                    </div>
                    <div class="text-center">
                        <div class="flex justify-center items-center mb-3">
                            <span class="text-yellow-400">⭐⭐⭐⭐⭐</span>
                            <span class="text-sm text-gray-600 mr-2">٤.٧ (٨٨ تقييم)</span>
                        </div>
                        <button onclick="openSignInModal()" class="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-semibold">
                            احجز موعد
                        </button>
                    </div>
                </div>
            `;
            setupIntersectionObserver();
        }
    }, 800);
}

function setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('loaded');
                observer.unobserve(entry.target);
            }
        });
    });

    document.querySelectorAll('.lazy-load').forEach(el => {
        observer.observe(el);
    });
}

// Appointment functions
function bookAppointment(doctorId) {
    const appointmentData = {
        id: Date.now().toString(),
        doctorName: 'د. أحمد محمد',
        specialty: 'طبيب عام',
        date: '2024-12-15',
        time: '10:00',
        clinicName: 'عيادة الشفاء الطبية',
        address: 'شارع الكندي، بغداد'
    };
    
    showNotification('جاري حجز الموعد...', 'info');
    
    setTimeout(() => {
        showAppointmentConfirmation(appointmentData);
        showNotification('تم حجز الموعد بنجاح!', 'success');
    }, 2000);
}

function showAppointmentConfirmation(appointmentData) {
    const modal = document.getElementById('appointmentConfirmModal');
    
    document.getElementById('appointmentNumber').textContent = `#MC-${appointmentData.id.slice(-3).toUpperCase()}`;
    document.getElementById('cardDoctorName').textContent = appointmentData.doctorName;
    document.getElementById('cardSpecialty').textContent = appointmentData.specialty;
    document.getElementById('cardDate').textContent = formatArabicDate(appointmentData.date);
    document.getElementById('cardTime').textContent = formatArabicTime(appointmentData.time);
    document.getElementById('cardClinic').textContent = appointmentData.clinicName;
    document.getElementById('cardAddress').textContent = appointmentData.address;
    
    modal.classList.remove('hidden');
}

function closeAppointmentConfirm() {
    document.getElementById('appointmentConfirmModal').classList.add('hidden');
}

function formatArabicDate(dateStr) {
    const date = new Date(dateStr);
    const arabicMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const day = date.getDate();
    const month = arabicMonths[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
}

function formatArabicTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'م' : 'ص';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    
    return `${displayHour}:${minutes} ${period}`;
}

function handleHeroSearch(event) {
    event.preventDefault();
    const query = document.getElementById('heroSearch').value.trim();
    
    if (query) {
        showNotification(`البحث عن: ${query}`, 'info');
    }
}

function signOut() {
    auth.signOut().then(() => {
        showNotification('تم تسجيل الخروج بنجاح', 'success');
        window.location.reload();
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load public content
    loadPublicContent();
    
    // Setup event listeners
    document.getElementById('signInBtn')?.addEventListener('click', openSignInModal);
    document.getElementById('closeSignInModal')?.addEventListener('click', closeSignInModal);
    document.getElementById('sendCodeBtn')?.addEventListener('click', sendVerificationCode);
    document.getElementById('verifyCodeBtn')?.addEventListener('click', verifyCode);
    document.getElementById('phoneNumber')?.addEventListener('input', formatPhoneNumber);
    document.getElementById('signOutBtn')?.addEventListener('click', signOut);
    document.getElementById('signOutBtn2')?.addEventListener('click', signOut);
    
    // Restore country code preference
    setTimeout(() => {
        const savedCode = localStorage.getItem('preferred-country-code');
        if (savedCode) {
            const countrySelect = document.getElementById('countryCode');
            if (countrySelect && countrySelect.querySelector(`option[value="${savedCode}"]`)) {
                countrySelect.value = savedCode;
            }
        }
    }, 100);
});

// Global functions
window.openSignInModal = openSignInModal;
window.closeSignInModal = closeSignInModal;
window.handleHeroSearch = handleHeroSearch;
window.bookAppointment = bookAppointment;
window.showAppointmentConfirmation = showAppointmentConfirmation;
window.closeAppointmentConfirm = closeAppointmentConfirm;
window.printAppointmentCard = function() {
    const cardContent = document.getElementById('appointmentCard').outerHTML;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>بطاقة الموعد - MedConnect</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Cairo', sans-serif; }
                @media print {
                    body { margin: 0; padding: 20px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body class="bg-gray-50">
            <div class="max-w-md mx-auto">
                ${cardContent}
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};

window.shareAppointment = async function() {
    const appointmentText = `
موعدي الطبي - MedConnect

الطبيب: ${document.getElementById('cardDoctorName').textContent}
التاريخ: ${document.getElementById('cardDate').textContent}
الوقت: ${document.getElementById('cardTime').textContent}
العيادة: ${document.getElementById('cardClinic').textContent}
العنوان: ${document.getElementById('cardAddress').textContent}

رقم الموعد: ${document.getElementById('appointmentNumber').textContent}
    `.trim();

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'موعدي الطبي - MedConnect',
                text: appointmentText
            });
        } catch (error) {
            console.log('Share cancelled');
        }
    } else {
        try {
            await navigator.clipboard.writeText(appointmentText);
            showNotification('تم نسخ تفاصيل الموعد', 'success');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = appointmentText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('تم نسخ تفاصيل الموعد', 'success');
        }
    }
};

window.openMapLocation = function() {
    const address = document.getElementById('cardAddress').textContent;
    const clinicName = document.getElementById('cardClinic').textContent;
    const query = encodeURIComponent(`${clinicName}, ${address}`);
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let mapUrl;
    if (isIOS) {
        mapUrl = `maps://maps.apple.com/?q=${query}`;
    } else if (isAndroid) {
        mapUrl = `geo:0,0?q=${query}`;
    } else {
        mapUrl = `https://www.google.com/maps/search/${query}`;
    }
    
    window.open(mapUrl, '_blank');
};

