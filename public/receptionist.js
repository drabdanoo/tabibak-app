// MedConnect Receptionist Portal Logic
'use strict';

// === State ===
let currentReceptionist = null;
let allAppointments = [];

// === Firebase Initialization ===
const firebaseConfig = window.__MC_ENV__?.FIREBASE_CONFIG;
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Initialize App Check
try {
    const appCheck = firebase.appCheck();
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const siteKey = window.__MC_ENV__?.APP_CHECK_KEY;
    if (appCheck && siteKey) {
        appCheck.activate(siteKey, true);
    }
} catch (e) {
    console.warn('App Check not initialized:', e?.message || e);
}

// === Error Suppression ===
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('listener indicated an asynchronous response')) {
        event.preventDefault();
    }
}, true);

// === Audio Context Enabler ===
let audioContextEnabled = false;
document.addEventListener('click', () => {
    if (!audioContextEnabled) {
        initAudioContext();
        audioContextEnabled = true;
    }
}, { once: true });

// === Event Listeners ===
document.addEventListener('DOMContentLoaded', () => {
    try {
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (_) {}

    // Initialize audio context for notifications
    initAudioContext();

    document.getElementById('receptionistLoginForm')?.addEventListener('submit', handleReceptionistLogin);
    document.getElementById('logoutButton')?.addEventListener('click', () => window.logout && window.logout());
    document.getElementById('appointmentSearch')?.addEventListener('input', filterAppointments);
    
    auth.onAuthStateChanged(handleAuthStateChange);
});

async function handleAuthStateChange(user) {
    if (user) {
        await user.getIdToken(true);
        try {
            await loadReceptionistProfile(user.uid, user.email);
            await loadAllAppointments();
            showDashboard(true);
        } catch (e) {
            console.error('Error loading receptionist data:', e);
            showNotification('تعذر تحميل البيانات. سيتم تسجيل الخروج.', 'error');
            await auth.signOut();
        }
    } else {
        showDashboard(false);
    }
}

function showDashboard(isShown) {
    document.getElementById('receptionistLogin').style.display = isShown ? 'none' : 'block';
    document.getElementById('receptionistDashboard').style.display = isShown ? 'block' : 'none';
    document.getElementById('logoutButton').style.display = isShown ? 'block' : 'none';
}

// === Authentication ===

async function handleReceptionistLogin(e) {
    e.preventDefault();
    const email = document.getElementById('receptionistEmail').value;
    const password = document.getElementById('receptionistPassword').value;
    const loginButton = document.getElementById('loginButton');

    loginButton.disabled = true;
    loginButton.textContent = 'جاري تسجيل الدخول...';

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error('Login error:', error.code, error.message);
        const message = {
            'auth/user-not-found': 'هذا البريد غير موجود.',
            'auth/wrong-password': 'كلمة المرور غير صحيحة.',
            'auth/invalid-login-credentials': 'كلمة المرور غير صحيحة.',
        }[error.code] || `خطأ في تسجيل الدخول: ${error.message}`;
        showNotification(message, 'error');
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'تسجيل الدخول';
    }
}

window.logout = async function logout() {
    const btn = document.getElementById('logoutButton');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'جارٍ تسجيل الخروج...';
    }
    try {
        // Clean up listeners
        if (appointmentsListener) appointmentsListener();
        if (typeof stopNotificationListener === 'function') stopNotificationListener();
        
        await auth.signOut();
        currentReceptionist = null;
        allAppointments = [];
        showNotification('تم تسجيل الخروج', 'success');
    } catch (e) {
        console.error('Logout error:', e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'تسجيل الخروج';
        }
    }
};

// === Data Loading ===

async function loadReceptionistProfile(uid, email) {
    const receptionistDoc = await db.collection('receptionists').doc(uid).get();
    if (receptionistDoc.exists) {
        currentReceptionist = { id: receptionistDoc.id, email, doctorId: receptionistDoc.data().doctorId, ...receptionistDoc.data() };
        document.getElementById('receptionistWelcome').textContent = `مرحباً ${currentReceptionist.name || 'بك'} - للدكتور`;
    } else {
        throw new Error('Receptionist profile not found.');
    }
}

let appointmentsListener = null;

async function loadAllAppointments() {
    try {
        if (!currentReceptionist?.doctorId) {
            showNotification('خطأ: لم يتم تعيين دكتور لهذا الاستقبال', 'error');
            return;
        }
        
        // Remove old listener if exists
        if (appointmentsListener) appointmentsListener();
        
        // Set up real-time listener for appointments
        appointmentsListener = db.collection('appointments')
            .where('doctorId', '==', currentReceptionist.doctorId)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .onSnapshot(snap => {
                const newAppointments = snap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Check for new pending appointments
                const newPending = newAppointments.filter(apt => apt.status === 'awaiting_confirmation');
                const oldPending = allAppointments.filter(apt => apt.status === 'awaiting_confirmation');
                
                if (newPending.length > oldPending.length) {
                    const newApt = newPending.find(apt => !oldPending.find(o => o.id === apt.id));
                    if (newApt) {
                        playNotificationSound();
                        showNotification(`🔔 حجز جديد من ${newApt.patientName}!`, 'info');
                    }
                }
                
                allAppointments = newAppointments;
                displayAppointments();
                updateStats();
            }, error => {
                console.error('Error listening to appointments:', error);
                showNotification('خطأ في تحميل الحجوزات', 'error');
            });
    } catch (error) {
        console.error('Error loading appointments:', error);
        showNotification('خطأ في تحميل الحجوزات', 'error');
    }
}

let audioContext = null;

function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('AudioContext not available');
        }
    }
}

// Note: playNotificationSound() is defined in receptionist-notifications.js
// This function is called from loadAllAppointments() when new pending appointments arrive

// === Filter Appointments ===

function filterAppointments() {
    const searchTerm = document.getElementById('appointmentSearch')?.value.toLowerCase() || '';
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;
    
    if (!searchTerm) {
        displayAppointments();
        return;
    }
    
    const filtered = allAppointments.filter(apt => 
        apt.patientName.toLowerCase().includes(searchTerm) ||
        apt.patientPhone.toLowerCase().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">لم يتم العثور على نتائج</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(apt => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900">${apt.patientName}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${apt.patientPhone}</td>
            <td class="px-6 py-4 text-sm text-gray-600">د. ${apt.doctorName}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${apt.appointmentDate} - ${apt.appointmentTime}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(apt.status)}">
                    ${getStatusText(apt.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-sm">
                ${apt.status === 'awaiting_confirmation' ? `
                    <button onclick="confirmAppointment('${apt.id}')" class="text-green-600 hover:text-green-800 font-medium mr-3">تأكيد</button>
                    <button onclick="rejectAppointment('${apt.id}')" class="text-red-600 hover:text-red-800 font-medium">رفض</button>
                ` : `
                    <span class="text-gray-500">-</span>
                `}
            </td>
        </tr>
    `).join('');
}

// === Display Appointments ===

function displayAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    if (allAppointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">لا توجد حجوزات</td></tr>';
        return;
    }

    tbody.innerHTML = allAppointments.map(apt => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-6 py-4 text-sm text-gray-900">${apt.patientName}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${apt.patientPhone}</td>
            <td class="px-6 py-4 text-sm text-gray-600">د. ${apt.doctorName}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${apt.appointmentDate} - ${apt.appointmentTime}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(apt.status)}">
                    ${getStatusText(apt.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-sm">
                ${apt.status === 'awaiting_confirmation' ? `<button onclick="confirmAppointment('${apt.id}')" class="text-green-600 hover:text-green-800 font-medium mr-3">تأكيد</button><button onclick="rejectAppointment('${apt.id}')" class="text-red-600 hover:text-red-800 font-medium">رفض</button>` : apt.status === 'confirmed' ? `<button onclick="rescheduleAppointment('${apt.id}')" class="text-blue-600 hover:text-blue-800 font-medium">إعادة جدولة</button>` : `<span class="text-gray-500">-</span>`}
            </td>
        </tr>
    `).join('');

    displayQueue();
}

function displayQueue() {
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = allAppointments.filter(apt => apt.appointmentDate === today && apt.status !== 'cancelled');

    const columns = {
        confirmed: document.getElementById('confirmedColumn'),
        checkedIn: document.getElementById('checkedInColumn'),
        inConsultation: document.getElementById('inConsultationColumn'),
        completed: document.getElementById('completedColumn'),
    };

    // Clear columns
    for (const col in columns) {
        if (columns[col]) columns[col].innerHTML = '';
    }

    const counts = { confirmed: 0, checkedIn: 0, inConsultation: 0, completed: 0 };

    todayAppointments.forEach(apt => {
        const queueStatus = apt.queueStatus || (apt.status === 'confirmed' ? 'confirmed' : null);
        if (!queueStatus) return;

        const card = createQueueCard(apt, queueStatus);
        switch (queueStatus) {
            case 'confirmed':
                columns.confirmed.appendChild(card);
                counts.confirmed++;
                break;
            case 'checked-in':
                columns.checkedIn.appendChild(card);
                counts.checkedIn++;
                break;
            case 'in-consultation':
                columns.inConsultation.appendChild(card);
                counts.inConsultation++;
                break;
            case 'completed':
                columns.completed.appendChild(card);
                counts.completed++;
                break;
        }
    });

    // Update badge counts
    document.getElementById('confirmedColumnBadge').textContent = counts.confirmed;
    document.getElementById('checkedInColumnBadge').textContent = counts.checkedIn;
    document.getElementById('inConsultationColumnBadge').textContent = counts.inConsultation;
    document.getElementById('completedColumnBadge').textContent = counts.completed;

    // Show empty message if a column is empty
    for (const col in columns) {
        if (columns[col] && columns[col].children.length === 0) {
            columns[col].innerHTML = `<p class="text-center text-sm text-gray-500 py-4">لا يوجد مرضى في هذه المرحلة.</p>`;
        }
    }
}

function createQueueCard(appointment, queueStatus) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg p-3 shadow-sm border-r-4 border-blue-500';
    card.setAttribute('data-id', appointment.id);

    let actionButton = '';
    if (queueStatus === 'confirmed') {
        card.style.borderColor = '#FBBF24'; // Yellow
        actionButton = `<button onclick="updateQueueStatus('${appointment.id}', 'checked-in')" class="w-full mt-3 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600">تسجيل الوصول</button>`;
    } else if (queueStatus === 'checked-in') {
        card.style.borderColor = '#3B82F6'; // Blue
        actionButton = `<p class="text-center text-sm text-gray-600 mt-3">في انتظار الطبيب</p>`;
    } else if (queueStatus === 'in-consultation') {
        card.style.borderColor = '#10B981'; // Green
        actionButton = `<p class="text-center text-sm text-green-700 font-bold mt-3">مع الطبيب الآن</p>`;
    } else if (queueStatus === 'completed') {
        card.style.borderColor = '#8B5CF6'; // Purple
        actionButton = `<p class="text-center text-sm text-purple-700 font-bold mt-3">انتهت الزيارة</p>`;
    }

    card.innerHTML = `
        <p class="font-bold text-gray-800">${appointment.patientName}</p>
        <p class="text-sm text-gray-600">الساعة: ${appointment.appointmentTime}</p>
        ${actionButton}
    `;

    return card;
}

async function updateQueueStatus(appointmentId, newStatus) {
    try {
        await db.collection('appointments').doc(appointmentId).update({ 
            queueStatus: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('تم تحديث حالة المريض', 'success');
        // The real-time listener will automatically update the UI
    } catch (error) {
        console.error('Error updating queue status:', error);
        showNotification('خطأ في تحديث الحالة', 'error');
    }
}


// === Update Stats ===

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    
    const todayAppointments = allAppointments.filter(apt => apt.appointmentDate === today);
    const pending = allAppointments.filter(apt => apt.status === 'awaiting_confirmation').length;
    const confirmed = todayAppointments.filter(apt => apt.status === 'confirmed').length;
    const cancelled = todayAppointments.filter(apt => apt.status === 'cancelled').length;
    const total = todayAppointments.length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('confirmedCount').textContent = confirmed;
    document.getElementById('cancelledCount').textContent = cancelled;
    document.getElementById('totalCount').textContent = total;
}

// === Appointment Actions ===

let selectedConfirmationAppointment = null;

async function confirmAppointment(appointmentId) {
    try {
        const apt = allAppointments.find(a => a.id === appointmentId);
        if (!apt) return;
        
        selectedConfirmationAppointment = { id: appointmentId, ...apt };
        showConfirmationModal(apt);
    } catch (error) {
        console.error('Error confirming appointment:', error);
        showNotification('خطأ في تأكيد الحجز', 'error');
    }
}

function showConfirmationModal(appointment) {
    const modal = document.createElement('div');
    modal.id = 'confirmationModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-xl font-bold text-gray-900 mb-4">تأكيد الحجز وتحديد الموعد</h3>
            
            <div class="mb-4">
                <p class="text-sm text-gray-600 mb-2"><strong>المريض:</strong> ${appointment.patientName}</p>
                <p class="text-sm text-gray-600 mb-4"><strong>السبب:</strong> ${appointment.reason}</p>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">اختر التاريخ</label>
                    <input type="date" id="confirmDate" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">اختر الوقت</label>
                    <input type="time" id="confirmTime" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 space-x-reverse mt-6 pt-4 border-t">
                <button onclick="closeConfirmationModal()" class="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">إلغاء</button>
                <button onclick="submitConfirmation()" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">تأكيد</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('confirmDate').setAttribute('min', today);
}

function closeConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) modal.remove();
    selectedConfirmationAppointment = null;
}

async function submitConfirmation() {
    if (!selectedConfirmationAppointment) return;
    
    const date = document.getElementById('confirmDate').value;
    const time = document.getElementById('confirmTime').value;
    
    if (!date || !time) {
        showNotification('يرجى اختيار التاريخ والوقت', 'error');
        return;
    }
    
    // Validate date is not in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showNotification('لا يمكن تأكيد موعد في الماضي', 'error');
        return;
    }
    
    // Validate time format (HH:MM)
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        showNotification('صيغة الوقت غير صحيحة', 'error');
        return;
    }
    
    // If today, validate time is not in the past
    if (selectedDate.getTime() === today.getTime()) {
        const [hours, minutes] = time.split(':').map(Number);
        const selectedTime = new Date();
        selectedTime.setHours(hours, minutes, 0, 0);
        const now = new Date();
        
        if (selectedTime < now) {
            showNotification('لا يمكن تأكيد موعد في الماضي', 'error');
            return;
        }
    }
    
    try {
        const appointmentRef = db.collection('appointments').doc(selectedConfirmationAppointment.id);
        
        await appointmentRef.update({
            status: 'confirmed',
            queueStatus: 'confirmed', // Set initial queue status
            appointmentDate: date,
            appointmentTime: time,
            confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Send SMS notification to patient
        try {
            const sendSMS = firebase.functions().httpsCallable('sendAppointmentConfirmationSMS');
            
            // Format phone number to international format for Iraqi users
            let phoneNumber = selectedConfirmationAppointment.patientPhone || '';
            console.log('DEBUG 1 - Raw phone from appointment:', phoneNumber, 'Type:', typeof phoneNumber);
            
            phoneNumber = phoneNumber.trim();
            
            // Validate phone number format
            if (!phoneNumber || phoneNumber.length < 10) {
                console.warn('DEBUG - Invalid phone number length:', phoneNumber.length);
                throw new Error('Phone number is invalid or too short');
            }
            console.log('DEBUG 2 - After trim:', phoneNumber);
            
            // Remove spaces and dashes
            phoneNumber = phoneNumber.replace(/[\s\-]/g, '');
            console.log('DEBUG 3 - After removing spaces/dashes:', phoneNumber);
            
            // Iraqi phone number formatting
            // Users typically enter: 0771767XXXX or 771767XXXX
            // We need to convert to: +9647717676XXXX
            
            console.log('DEBUG 4 - Checking format...');
            console.log('  Starts with +964?', phoneNumber.startsWith('+964'));
            console.log('  Starts with 0?', phoneNumber.startsWith('0'));
            console.log('  Starts with 964?', phoneNumber.startsWith('964'));
            console.log('  Starts with 7?', phoneNumber.startsWith('7'));
            
            if (phoneNumber.startsWith('+964')) {
                console.log('DEBUG 5a - Already formatted');
                // Already in correct format
                // Do nothing
            } else if (phoneNumber.startsWith('0')) {
                console.log('DEBUG 5b - Converting from 0 format');
                // Format: 0771767XXXX -> +9647717676XXXX
                phoneNumber = '+964' + phoneNumber.substring(1);
            } else if (phoneNumber.startsWith('964')) {
                console.log('DEBUG 5c - Converting from 964 format');
                // Format: 964771767XXXX -> +964771767XXXX
                phoneNumber = '+' + phoneNumber;
            } else if (phoneNumber.startsWith('7')) {
                console.log('DEBUG 5d - Converting from 7 format');
                // Format: 771767XXXX -> +964771767XXXX (Iraqi mobile starts with 7)
                phoneNumber = '+964' + phoneNumber;
            } else {
                console.log('DEBUG 5e - Fallback format');
                // Fallback: assume it's just the number without country code
                phoneNumber = '+964' + phoneNumber;
            }
            
            console.log('DEBUG 6 - Final formatted phone:', phoneNumber);
            
            const smsData = {
                patientPhone: phoneNumber,
                patientName: selectedConfirmationAppointment.patientName,
                doctorName: selectedConfirmationAppointment.doctorName,
                appointmentDate: date,
                appointmentTime: time
            };
            console.log('DEBUG 7 - SMS data being sent:', JSON.stringify(smsData, null, 2));
            
            await sendSMS(smsData);
            showNotification('✓ تم تأكيد الحجز وإرسال SMS', 'success');
        } catch (smsError) {
            console.warn('SMS notification failed:', smsError);
            // SMS failed but appointment is confirmed, show success anyway
            if (smsError.message.includes('unverified')) {
                showNotification('✓ تم تأكيد الحجز (لم يتم إرسال SMS - رقم غير متحقق منه)', 'info');
            } else {
                showNotification('✓ تم تأكيد الحجز (لم يتم إرسال SMS)', 'info');
            }
        }
        
        // Don't show duplicate success message
        // showNotification('✓ تم تأكيد الحجز بنجاح', 'success');
        closeConfirmationModal();
        loadAllAppointments();
    } catch (error) {
        console.error('Error submitting confirmation:', error);
        showNotification('خطأ في تأكيد الحجز', 'error');
    }
}

async function rejectAppointment(appointmentId) {
    try {
        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            cancelledBy: 'receptionist',
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('✗ تم رفض الحجز', 'success');
        loadAllAppointments();
    } catch (error) {
        console.error('Error rejecting appointment:', error);
        showNotification('خطأ في رفض الحجز', 'error');
    }
}

async function rescheduleAppointment(appointmentId) {
    try {
        const apt = allAppointments.find(a => a.id === appointmentId);
        if (!apt) return;
        
        selectedConfirmationAppointment = { id: appointmentId, ...apt };
        showRescheduleModal(apt);
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        showNotification('خطأ في إعادة جدولة الموعد', 'error');
    }
}

function showRescheduleModal(appointment) {
    const modal = document.createElement('div');
    modal.id = 'rescheduleModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-xl font-bold text-gray-900 mb-4">إعادة جدولة الموعد</h3>
            
            <div class="mb-4">
                <p class="text-sm text-gray-600 mb-2"><strong>المريض:</strong> ${appointment.patientName}</p>
                <p class="text-sm text-gray-600 mb-4"><strong>الموعد الحالي:</strong> ${appointment.appointmentDate} - ${appointment.appointmentTime}</p>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">التاريخ الجديد</label>
                    <input type="date" id="rescheduleDate" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">الوقت الجديد</label>
                    <input type="time" id="rescheduleTime" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                </div>
            </div>
            
            <div class="flex justify-end space-x-4 space-x-reverse mt-6 pt-4 border-t">
                <button onclick="closeRescheduleModal()" class="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">إلغاء</button>
                <button onclick="submitReschedule()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">تأكيد</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('rescheduleDate').setAttribute('min', today);
}

function closeRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) modal.remove();
    selectedConfirmationAppointment = null;
}

async function submitReschedule() {
    if (!selectedConfirmationAppointment) return;
    
    const date = document.getElementById('rescheduleDate').value;
    const time = document.getElementById('rescheduleTime').value;
    
    if (!date || !time) {
        showNotification('يرجى اختيار التاريخ والوقت', 'error');
        return;
    }
    
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showNotification('لا يمكن إعادة جدولة لموعد في الماضي', 'error');
        return;
    }
    
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        showNotification('صيغة الوقت غير صحيحة', 'error');
        return;
    }
    
    try {
        await db.collection('appointments').doc(selectedConfirmationAppointment.id).update({
            appointmentDate: date,
            appointmentTime: time,
            rescheduledAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('✓ تم إعادة جدولة الموعد بنجاح', 'success');
        closeRescheduleModal();
        loadAllAppointments();
    } catch (error) {
        console.error('Error submitting reschedule:', error);
        showNotification('خطأ في إعادة جدولة الموعد', 'error');
    }
}

// === Helper Functions ===

function getStatusClass(status) {
    return {
        'awaiting_confirmation': 'bg-yellow-100 text-yellow-800',
        'confirmed': 'bg-green-100 text-green-800',
        'completed': 'bg-blue-100 text-blue-800',
        'cancelled': 'bg-red-100 text-red-800',
    }[status] || 'bg-gray-100 text-gray-800';
}

function getStatusText(status) {
    return {
        'awaiting_confirmation': 'في الانتظار',
        'confirmed': 'مؤكد',
        'completed': 'مكتمل',
        'cancelled': 'ملغي',
    }[status] || 'غير محدد';
}

function exportAppointmentsToCSV() {
    if (allAppointments.length === 0) {
        showNotification('No appointments to export', 'error');
        return;
    }
    
    const headers = ['Patient Name', 'Phone', 'Doctor', 'Date', 'Time', 'Status', 'Reason'];
    const rows = allAppointments.map(apt => [
        apt.patientName,
        apt.patientPhone,
        apt.doctorName,
        apt.appointmentDate,
        apt.appointmentTime,
        apt.status,
        apt.reason
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => '"' + (cell || '') + '"').join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointments_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Appointments exported successfully', 'success');
}

function createQueueCardForAppointment(appointment) {
    const card = document.createElement('div');
    card.className = 'bg-gray-100 rounded-lg p-4 shadow-sm cursor-pointer';
    card.setAttribute('draggable', true);
    card.setAttribute('data-id', appointment.id);

    card.innerHTML = `
        <p class="font-bold text-gray-800">${appointment.patientName}</p>
        <p class="text-sm text-gray-600">${appointment.appointmentTime}</p>
        <div class="mt-4 flex justify-between items-center">
            <button onclick="updateQueueStatus('${appointment.id}', 'in_consultation')" class="text-xs bg-green-500 text-white px-2 py-1 rounded">بدء</button>
            <button onclick="updateQueueStatus('${appointment.id}', 'checked_out')" class="text-xs bg-blue-500 text-white px-2 py-1 rounded">إنهاء</button>
        </div>
    `;

    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', appointment.id);
        e.target.classList.add('opacity-50');
    });

    card.addEventListener('dragend', (e) => {
        e.target.classList.remove('opacity-50');
    });

    return card;
}

async function updateQueueStatus(appointmentId, newStatus) {
    try {
        await db.collection('appointments').doc(appointmentId).update({ queueStatus: newStatus });
        showNotification('تم تحديث حالة المريض', 'success');
        // The real-time listener will automatically update the UI
    } catch (error) {
        console.error('Error updating queue status:', error);
        showNotification('خطأ في تحديث الحالة', 'error');
    }
}

// Add drag and drop event listeners to the columns
['confirmedColumn', 'checkedInColumn', 'inConsultationColumn', 'completedColumn'].forEach(columnId => {
    const column = document.getElementById(columnId);
    if (!column) {
        console.warn(`Column ${columnId} not found in DOM`);
        return;
    }
    column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('bg-gray-200');
    });
    column.addEventListener('dragleave', (e) => {
        column.classList.remove('bg-gray-200');
    });
    column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('bg-gray-200');
        const appointmentId = e.dataTransfer.getData('text/plain');
        const newStatus = columnId.replace('Column', '');
        updateQueueStatus(appointmentId, newStatus);
    });
});

function exportAppointmentsToCSV() {
    if (allAppointments.length === 0) {
        showNotification('No appointments to export', 'error');
        return;
    }
    
    const headers = ['Patient Name', 'Phone', 'Doctor', 'Date', 'Time', 'Status', 'Reason'];
    const rows = allAppointments.map(apt => [
        apt.patientName,
        apt.patientPhone,
        apt.doctorName,
        apt.appointmentDate,
        apt.appointmentTime,
        apt.status,
        apt.reason
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => '"' + (cell || '') + '"').join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointments_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Appointments exported successfully', 'success');
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `p-4 rounded-lg shadow-lg text-white ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        'bg-blue-500'
    }`;
    notification.textContent = message;

    container.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
}

// === Tab Management ===
function showTab(tabName) {
    // Hide all tab contents
    document.getElementById('queueContent').classList.add('hidden');
    document.getElementById('appointmentsContent').classList.add('hidden');
    
    // Show selected tab content
    document.getElementById(tabName + 'Content').classList.remove('hidden');
    
    // Update tab button styles
    document.getElementById('queueTab').classList.remove('text-blue-600', 'border-b-2', 'border-blue-600', 'tab-active');
    document.getElementById('appointmentsTab').classList.remove('text-blue-600', 'border-b-2', 'border-blue-600', 'tab-active');
    
    document.getElementById('queueTab').classList.add('text-gray-500');
    document.getElementById('appointmentsTab').classList.add('text-gray-500');
    
    // Activate selected tab
    const activeTab = document.getElementById(tabName + 'Tab');
    activeTab.classList.remove('text-gray-500');
    activeTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600', 'tab-active');
}
