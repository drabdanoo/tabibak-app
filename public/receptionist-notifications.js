// ============================================================================
// RECEPTIONIST NOTIFICATION SYSTEM
// Real-time notifications for new appointment bookings
// ============================================================================

let notificationListener = null;
let pendingNotifications = [];
let isNotificationPermissionGranted = false;

// === INITIALIZE NOTIFICATION SYSTEM ===

async function initializeNotifications() {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        isNotificationPermissionGranted = permission === 'granted';
    } else if ('Notification' in window) {
        isNotificationPermissionGranted = Notification.permission === 'granted';
    }
    
    // Start listening for new appointments
    setupRealtimeAppointmentListener();
}

// === REAL-TIME LISTENER ===

function setupRealtimeAppointmentListener() {
    if (!auth.currentUser || !currentReceptionist?.doctorId) return;
    
    // Listen for new appointments with status 'awaiting_confirmation' for this doctor only
    notificationListener = db.collection('appointments')
        .where('doctorId', '==', currentReceptionist.doctorId)
        .where('status', '==', 'awaiting_confirmation')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot(
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const appointment = {
                            id: change.doc.id,
                            ...change.doc.data()
                        };
                        handleNewAppointment(appointment);
                    }
                });
            },
            (error) => {
                console.error('Error listening to appointments:', error);
            }
        );
}

// === HANDLE NEW APPOINTMENT ===

function handleNewAppointment(appointment) {
    // Add to pending notifications
    pendingNotifications.unshift(appointment);
    
    // Update UI
    updateNotificationPanel();
    
    // Send browser notification
    sendBrowserNotification(appointment);
    
    // Play sound
    playNotificationSound();
    
    // Show toast
    showNotification(`📋 حجز جديد من ${appointment.patientName}!`, 'info');
}

// === BROWSER NOTIFICATION ===

function sendBrowserNotification(appointment) {
    if (!isNotificationPermissionGranted) return;
    
    const title = `حجز جديد - ${appointment.patientName}`;
    const options = {
        body: `الدكتور: ${appointment.doctorName}\nالموعد: ${appointment.appointmentDate} - ${appointment.appointmentTime}\nالسبب: ${appointment.reason}`,
        icon: '/medconnect-icon.png',
        badge: '/medconnect-badge.png',
        tag: `appointment-${appointment.id}`,
        requireInteraction: true,
        actions: [
            { action: 'confirm', title: '✓ تأكيد' },
            { action: 'reject', title: '✗ رفض' }
        ]
    };
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
        });
    } else {
        new Notification(title, options);
    }
}

// === PLAY NOTIFICATION SOUND ===

function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
        audio.play().catch(e => console.log('Could not play notification sound:', e));
    } catch (e) {
        console.log('Notification sound not available');
    }
}

// === UPDATE NOTIFICATION PANEL ===

function updateNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;
    
    const count = pendingNotifications.length;
    const badge = document.getElementById('notificationBadge');
    
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
    
    const list = document.getElementById('notificationList');
    if (!list) return;
    
    if (count === 0) {
        list.innerHTML = '<div class="text-center py-8 text-gray-500">لا توجد حجوزات جديدة</div>';
        return;
    }
    
    list.innerHTML = pendingNotifications.map((apt, index) => `
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-3 rounded hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-900">${apt.patientName}</h4>
                    <p class="text-sm text-gray-600 mt-1">
                        <strong>الطبيب:</strong> د. ${apt.doctorName}
                    </p>
                    <p class="text-sm text-gray-600">
                        <strong>الموعد:</strong> ${apt.appointmentDate} - ${apt.appointmentTime}
                    </p>
                    <p class="text-sm text-gray-600">
                        <strong>الهاتف:</strong> ${apt.patientPhone}
                    </p>
                    <p class="text-sm text-gray-600">
                        <strong>السبب:</strong> ${apt.reason}
                    </p>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="confirmAppointmentFromNotification('${apt.id}')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium">
                        ✓ تأكيد
                    </button>
                    <button onclick="rejectAppointmentFromNotification('${apt.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium">
                        ✗ رفض
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// === CONFIRM APPOINTMENT FROM NOTIFICATION ===

async function confirmAppointmentFromNotification(appointmentId) {
    try {
        const apt = pendingNotifications.find(a => a.id === appointmentId);
        if (!apt) return;
        
        // Call the main confirm function to show modal
        selectedConfirmationAppointment = { id: appointmentId, ...apt };
        showConfirmationModal(apt);
        
        // Remove from pending notifications list
        pendingNotifications = pendingNotifications.filter(a => a.id !== appointmentId);
        updateNotificationPanel();
    } catch (error) {
        console.error('Error confirming appointment:', error);
        showNotification('خطأ في تأكيد الحجز', 'error');
    }
}

// === REJECT APPOINTMENT FROM NOTIFICATION ===

async function rejectAppointmentFromNotification(appointmentId) {
    try {
        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            cancelledBy: 'receptionist',
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Remove from pending
        pendingNotifications = pendingNotifications.filter(apt => apt.id !== appointmentId);
        updateNotificationPanel();
        
        showNotification('✗ تم رفض الحجز', 'success');
    } catch (error) {
        console.error('Error rejecting appointment:', error);
        showNotification('خطأ في رفض الحجز', 'error');
    }
}

// === TOGGLE NOTIFICATION PANEL ===

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

// === CLEANUP ===

function stopNotificationListener() {
    if (notificationListener) {
        notificationListener();
        notificationListener = null;
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotifications);
} else {
    initializeNotifications();
}
