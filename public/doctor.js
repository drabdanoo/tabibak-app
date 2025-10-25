// MedConnect Doctor Portal Logic
'use strict';

// === State ===
let currentDoctor = null;
let allAppointments = [];
let revenueChart = null;
let visitsChart = null;
let isInitialLoad = true;
const isTestMode = new URLSearchParams(location.search).get('test') === '1';
let appointmentsPagination = { page: 1, pageSize: 50, total: 0 };
let appointmentsListener = null;

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
        console.log('App Check debug mode enabled for localhost');
    }
    const siteKey = window.__MC_ENV__?.APP_CHECK_KEY;
    if (appCheck && siteKey) {
        appCheck.activate(siteKey, true);
        //== App Check Token Debugging ==
        appCheck.getToken(/* forceRefresh= */ false)
            .then((tokenResponse) => {
                console.log('App Check token:', tokenResponse.token);
            })
            .catch((error) => {
                console.error('Failed to get App Check token:', error);
            });
        //== End App Check Token Debugging ==
        console.log('App Check initialized successfully');
    }
} catch (e) {
    console.warn('App Check not initialized:', e?.message || e);
}

// === Event Listeners and Page Init ===
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    try {
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (_) {}

    // Wire up forms and buttons
    document.getElementById('doctorLoginForm')?.addEventListener('submit', handleDoctorLogin);
    document.getElementById('logoutButton')?.addEventListener('click', () => window.logout && window.logout());
    document.getElementById('clinicClosed')?.addEventListener('change', toggleClosureDate);
    document.getElementById('pendingSearchInput')?.addEventListener('input', filterPendingAppointments);
    document.getElementById('passwordForm')?.addEventListener('submit', (e) => { e.preventDefault(); changePassword(); });
    document.getElementById('changePasswordButton')?.addEventListener('click', changePassword);
    document.getElementById('saveProfileButton')?.addEventListener('click', updateProfile);
    document.getElementById('saveClinicSettingsButton')?.addEventListener('click', saveClinicSettings);
    document.getElementById('photoInput')?.addEventListener('change', handlePhotoUpload);

    // Auth state listener
    auth.onAuthStateChanged(handleAuthStateChange);

    // Close modals on outside click
    document.getElementById('patientModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'patientModal') closePatientModal();
    });
    document.getElementById('followupModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'followupModal') closeFollowupModal();
    });
});

async function handleAuthStateChange(user) {
    if (user) {
        await user.getIdToken(true); // Force refresh for custom claims
        try {
            await loadDoctorProfileByUID(user.uid, user.email);
            await loadDoctorAppointments();
            showDashboard(true);
        } catch (e) {
            console.error('Error loading doctor data:', e);
            showNotification('تعذر تحميل بيانات الطبيب. سيتم تسجيل الخروج.', 'error');
            await auth.signOut();
        }
    } else {
        showDashboard(false);
        if (isTestMode) initializeTestMode();
    }
    isInitialLoad = false;
}

function showDashboard(isShown) {
    document.getElementById('doctorLogin').style.display = isShown ? 'none' : 'block';
    document.getElementById('doctorDashboard').style.display = isShown ? 'block' : 'none';
    document.getElementById('logoutButton').style.display = isShown ? 'flex' : 'none';
}

function toggleClosureDate() {
    const isChecked = document.getElementById('clinicClosed').checked;
    document.getElementById('closureDateContainer').style.display = isChecked ? 'block' : 'none';
}

// === UI Update Functions ===

function setCurrentDate() {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = today.toLocaleDateString('ar-IQ-u-ca-gregory', options);
}

function showTab(tabName) {
    ['dashboard', 'profile', 'analytics', 'patients', 'templates'].forEach(name => {
        document.getElementById(`${name}Content`).classList.add('hidden');
        const tabButton = document.getElementById(`${name}Tab`);
        tabButton.classList.remove('tab-active', 'text-green-600', 'border-green-600');
        tabButton.classList.add('text-gray-500');
    });

    document.getElementById(`${tabName}Content`).classList.remove('hidden');
    const activeTab = document.getElementById(`${tabName}Tab`);
    activeTab.classList.add('tab-active', 'text-green-600', 'border-green-600');
    activeTab.classList.remove('text-gray-500');

    if (tabName === 'analytics') loadAnalytics();
    else if (tabName === 'patients') {
        loadRegularPatients();
        // Also load follow-up patients when switching to patients tab
        if (window.loadFollowUpPatients) {
            window.loadFollowUpPatients();
        }
    }
    else if (tabName === 'profile') loadDoctorProfile();
    else if (tabName === 'templates' && window.loadDoctorTemplates) {
        window.loadDoctorTemplates();
    }
}

// === Authentication ===

async function handleDoctorLogin(e) {
    e.preventDefault();
    const email = document.getElementById('doctorEmail').value;
    const password = document.getElementById('doctorPassword').value;
    const loginButton = document.getElementById('loginButton');

    loginButton.disabled = true;
    loginButton.textContent = 'جاري تسجيل الدخول...';

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error('Login error:', error.code, error.message);
        const message = {
            'auth/user-not-found': 'هذا البريد غير موجود أو لم يتم تفعيله.',
            'auth/wrong-password': 'كلمة المرور غير صحيحة.',
            'auth/invalid-login-credentials': 'كلمة المرور غير صحيحة.',
            'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
            'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً.',
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
        // Clean up listeners and resources
        if (appointmentsListener) appointmentsListener();
        if (doctorProfileUnsubscribe) doctorProfileUnsubscribe();
        if (revenueChart) revenueChart.destroy();
        if (visitsChart) visitsChart.destroy();
        
        await auth.signOut();
        // onAuthStateChanged will handle UI reset
        currentDoctor = null;
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

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    const changePasswordButton = document.getElementById('changePasswordButton');

    if (!currentPassword || !newPassword || !confirmPassword) {
        return showNotification('يرجى ملء جميع الحقول', 'error');
    }
    if (newPassword !== confirmPassword) {
        return showNotification('كلمة المرور الجديدة غير متطابقة', 'error');
    }
    if (newPassword.length < 6) {
        return showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
        return showNotification('لا يمكن تغيير كلمة المرور. يرجى إعادة تسجيل الدخول.', 'error');
    }

    changePasswordButton.disabled = true;
    changePasswordButton.textContent = 'جارٍ التحديث...';

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);

        showNotification('تم تغيير كلمة المرور بنجاح. سيتم تسجيل الخروج الآن.', 'success');
        
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        setTimeout(() => auth.signOut(), 2000);

    } catch (error) {
        console.error('Error changing password:', error);
        const message = {
            'auth/wrong-password': 'كلمة المرور الحالية غير صحيحة.',
            'auth/invalid-login-credentials': 'كلمة المرور الحالية غير صحيحة.',
            'auth/weak-password': 'كلمة المرور الجديدة ضعيفة جداً.',
        }[error.code] || 'خطأ في تغيير كلمة المرور.';
        showNotification(message, 'error');
    } finally {
        changePasswordButton.disabled = false;
        changePasswordButton.textContent = 'تغيير كلمة المرور';
    }
}

function showForgotPasswordModal(event) {
    event.preventDefault();
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        document.getElementById('resetEmail').value = '';
        modal.style.display = 'flex';
    }
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handlePasswordReset(event) {
    event.preventDefault();
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) {
        return showNotification('يرجى إدخال البريد الإلكتروني', 'error');
    }

    const sendBtn = document.getElementById('sendResetLinkBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'جاري الإرسال...';

    try {
        await auth.sendPasswordResetEmail(email);
        showNotification('تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني بنجاح', 'success');
        closeForgotPasswordModal();
    } catch (error) {
        console.error('Password reset error:', error);
        showNotification('فشل إرسال الرابط. تأكد من أن البريد الإلكتروني صحيح ومسجل.', 'error');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'إرسال الرابط';
    }
}

// === Data Loading and Processing ===

let doctorProfileUnsubscribe = null;

async function loadDoctorProfileByUID(uid, email) {
    console.log('Loading doctor profile for UID:', uid);
    
    // Unsubscribe from previous listener if exists
    if (doctorProfileUnsubscribe) {
        doctorProfileUnsubscribe();
    }
    
    // Set up real-time listener for doctor profile
    doctorProfileUnsubscribe = db.collection('doctors').doc(uid).onSnapshot(
        (doctorDoc) => {
            if (doctorDoc.exists) {
                currentDoctor = { id: doctorDoc.id, email, ...doctorDoc.data() };
                document.getElementById('doctorWelcome').textContent = `مرحباً د. ${currentDoctor.name || ''}`;
                loadDoctorProfile();
                console.log('Doctor profile updated:', currentDoctor.name);
            } else {
                console.error('Doctor profile not found');
                showNotification('لم يتم العثور على ملف الطبيب', 'error');
            }
        },
        (error) => {
            console.error('Error listening to doctor profile:', error);
        }
    );
}

function loadDoctorProfile() {
    if (!currentDoctor) return;

    document.getElementById('doctorNameInput').value = currentDoctor.name || '';
    document.getElementById('doctorSpecialtyInput').value = currentDoctor.specialty || '';
    document.getElementById('doctorEmailInput').value = currentDoctor.email || '';
    document.getElementById('consultationFeeInput').value = currentDoctor.consultationFee || '';
    document.getElementById('openingTime').value = currentDoctor.openingTime || '08:00';
    document.getElementById('closingTime').value = currentDoctor.closingTime || '15:00';

    const clinicClosedCheckbox = document.getElementById('clinicClosed');
    clinicClosedCheckbox.checked = currentDoctor.clinicClosed || false;
    toggleClosureDate();
    if (currentDoctor.closureEndDate) {
        document.getElementById('closureEndDate').value = currentDoctor.closureEndDate;
    }

    const photoContainer = document.getElementById('profilePhotoContainer');
    if (currentDoctor.photoURL) {
        photoContainer.innerHTML = `<img src="${currentDoctor.photoURL}" alt="Profile Photo" class="w-full h-full object-cover">`;
    } else {
        photoContainer.innerHTML = `
            <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>`;
    }
}

async function loadDoctorAppointments() {
    if (!currentDoctor?.id) return;
    try {
        // Set up real-time listener for appointments
        if (appointmentsListener) appointmentsListener();
        
        appointmentsListener = db.collection('appointments')
            .where('doctorId', '==', currentDoctor.id)
            .limit(appointmentsPagination.pageSize * 5)
            .onSnapshot(
                (snapshot) => {
                    allAppointments = snapshot.docs.map(normalizeAppointment);
                    displayAppointments();
                    updateStats();
                    calculateRevenue();
                    calculateRevenueAnalytics();
                    // displayConfirmedAppointments(); // Removed - we only show "Today's Confirmed" now
                    // displayFinishVisitAppointments(); // Removed - functionality in Today's Confirmed section
                },
                (error) => {
                    console.error('Real-time listener error:', error);
                    showNotification('Error loading appointments', 'error');
                }
            );
    } catch (error) {
        console.error('Error loading appointments:', error);
        showNotification('خطأ في تحميل المواعيد', 'error');
    }
}

function normalizeAppointment(docSnap) {
    const data = docSnap.data() || {};
    let dateStr = '';
    if (typeof data.appointmentDate === 'string') {
        dateStr = data.appointmentDate;
    } else if (data.appointmentDate?.toDate) {
        dateStr = data.appointmentDate.toDate().toISOString().split('T')[0];
    }
    return {
        id: docSnap.id,
        userId: data.userId || data.patientId || '',
        patientId: data.patientId || '',
        patientName: data.patientName || 'مريض',
        patientAge: data.patientAge || '-',
        patientGender: data.patientGender || '-',
        patientPhone: data.patientPhone || data.userPhone || '-',
        userPhone: data.userPhone || data.patientPhone || '-',
        appointmentDate: dateStr,
        appointmentTime: data.appointmentTime || '',
        status: data.status || 'awaiting_confirmation',
        queueStatus: data.queueStatus || null,
        reason: data.reason || '',
        rescheduledDate: data.rescheduledDate,
        rescheduleReason: data.rescheduleReason,
        rescheduledTime: data.rescheduledTime,
        allergies: data.allergies || '',
        currentMedications: data.currentMedications || '',
        doctorName: data.doctorName || (currentDoctor?.name ? `د. ${currentDoctor.name}` : ''),
        isFamilyMember: data.isFamilyMember || false
    };
}

// === Profile and Settings Updates ===

async function updateProfile() {
    if (!currentDoctor?.id) {
        console.error('No currentDoctor.id found');
        showNotification('خطأ: لم يتم العثور على معرف الطبيب', 'error');
        return;
    }
    
    const name = document.getElementById('doctorNameInput').value.trim();
    const specialty = document.getElementById('doctorSpecialtyInput').value.trim();
    const fee = parseFloat(document.getElementById('consultationFeeInput').value) || 15000;
    
    console.log('Updating profile:', { doctorId: currentDoctor.id, name, specialty, fee });
    
    if (!name || !specialty) {
        showNotification('يرجى ملء الاسم والتخصص', 'error');
        return;
    }
    
    try {
        const updateData = {
            name,
            specialty,
            consultationFee: fee,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('Attempting to update doctor document:', currentDoctor.id);
        await db.collection('doctors').doc(currentDoctor.id).update(updateData);
        
        Object.assign(currentDoctor, updateData);
        document.getElementById('doctorWelcome').textContent = `مرحباً د. ${name}`;
        showNotification('تم حفظ البيانات الشخصية بنجاح', 'success');
        calculateRevenue();
        console.log('Profile updated successfully');
    } catch (error) {
        console.error('Error updating profile:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        showNotification(`خطأ في حفظ التغييرات: ${error.message}`, 'error');
    }
}

async function saveClinicSettings() {
    if (!currentDoctor?.id) return;
    const updateData = {
        openingTime: document.getElementById('openingTime').value || '08:00',
        closingTime: document.getElementById('closingTime').value || '15:00',
        clinicClosed: document.getElementById('clinicClosed').checked,
        closureEndDate: document.getElementById('clinicClosed').checked ? (document.getElementById('closureEndDate').value || null) : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('doctors').doc(currentDoctor.id).update(updateData);
        Object.assign(currentDoctor, updateData);
        showNotification('تم حفظ إعدادات العيادة بنجاح', 'success');
    } catch (error) {
        console.error('Error saving clinic settings:', error);
        showNotification('خطأ في حفظ إعدادات العيادة', 'error');
    }
}

async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        return showNotification('الرجاء اختيار ملف صورة فقط', 'error');
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return showNotification('حجم الصورة يجب أن يكون أقل من 5 ميجابايت', 'error');
    }

    const user = auth.currentUser;
    if (!user) return showNotification('يجب تسجيل الدخول أولاً', 'error');

    const uploadButton = document.querySelector('button[title="تغيير الصورة"]');
    const originalHTML = uploadButton.innerHTML;
    uploadButton.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';
    uploadButton.disabled = true;

    try {
        const storageRef = firebase.storage().ref();
        const photoRef = storageRef.child(`doctorPhotos/${user.uid}/profile.jpg`);
        const snapshot = await photoRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        await db.collection('doctors').doc(user.uid).update({ photoURL: downloadURL });
        currentDoctor.photoURL = downloadURL;

        document.getElementById('profilePhotoContainer').innerHTML = `<img src="${downloadURL}" alt="Profile Photo" class="w-full h-full object-cover">`;
        showNotification('تم تحديث الصورة الشخصية بنجاح', 'success');
    } catch (error) {
        console.error('Error uploading photo:', error);
        showNotification('حدث خطأ أثناء رفع الصورة.', 'error');
    } finally {
        uploadButton.innerHTML = originalHTML;
        uploadButton.disabled = false;
        event.target.value = '';
    }
}

// === Helper Functions ===

function isValidFutureDate(dateStr) {
    if (!dateStr) return false;
    const selectedDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
}

function hasTimeConflict(appointmentDate, appointmentTime, excludeAppointmentId = null) {
    if (!appointmentDate || !appointmentTime) return false;
    
    // Check if any other confirmed appointment exists at same date/time
    const conflict = allAppointments.find(apt => {
        // Skip the appointment being updated
        if (excludeAppointmentId && apt.id === excludeAppointmentId) return false;
        
        // Only check confirmed appointments
        if (apt.status !== 'confirmed') return false;
        
        // Check if same date and time
        return apt.appointmentDate === appointmentDate && apt.appointmentTime === appointmentTime;
    });
    
    return !!conflict;
}

// === Export Functions ===

function exportAppointmentsToCSV() {
    if (allAppointments.length === 0) {
        showNotification('No appointments to export', 'error');
        return;
    }
    
    const headers = ['Patient Name', 'Phone', 'Date', 'Time', 'Status', 'Reason'];
    const rows = allAppointments.map(apt => [
        apt.patientName,
        apt.patientPhone,
        apt.appointmentDate,
        apt.appointmentTime,
        apt.status,
        apt.reason
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => '"' + (cell || '') + '"').join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'appointments_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Appointments exported successfully', 'success');
}

// === Search and Filter Functions ===

function filterPendingAppointments() {
    const searchTerm = document.getElementById('pendingSearchInput')?.value.toLowerCase() || '';
    const pendingRequests = allAppointments.filter(apt => 
        (apt.status === 'awaiting_confirmation' || apt.status === 'reschedule_requested')
    );
    
    if (!searchTerm) {
        displayRequestGrid('pendingRequestsGrid', pendingRequests, createRequestCard, 'لا توجد طلبات جديدة');
        return;
    }
    
    const filtered = pendingRequests.filter(apt =>
        apt.patientName.toLowerCase().includes(searchTerm) ||
        apt.patientPhone.includes(searchTerm)
    );
    
    displayRequestGrid('pendingRequestsGrid', filtered, createRequestCard, 'لم يتم العثور على نتائج');
}

// === Appointment Display and Management ===

function displayAppointments() {
    const today = new Date().toISOString().split('T')[0];
    const pendingRequests = allAppointments.filter(apt => 
        apt.status === 'awaiting_confirmation' || 
        apt.status === 'reschedule_requested'
    );
    const todayConfirmed = allAppointments.filter(apt => apt.status === 'confirmed' && apt.appointmentDate === today);

    displayRequestGrid('pendingRequestsGrid', pendingRequests, createRequestCard, 'لا توجد طلبات جديدة');
    displayRequestGrid('todayAppointmentsGrid', todayConfirmed, createConfirmedCard, 'لا توجد مواعيد مؤكدة لليوم');

    // New Queue Logic
    const checkedInPatients = allAppointments.filter(apt => apt.queueStatus === 'checked-in' && apt.appointmentDate === today);
    const inConsultationPatients = allAppointments.filter(apt => apt.queueStatus === 'in-consultation' && apt.appointmentDate === today);

    displayQueueGrid('waitingRoomGrid', checkedInPatients, createDoctorQueueCard, 'لا يوجد مرضى في غرفة الانتظار');
    displayQueueGrid('finishVisitGrid', inConsultationPatients, createDoctorQueueCard, 'لا يوجد مرضى في العيادة حالياً');


    document.getElementById('pendingCount').textContent = pendingRequests.length;
    document.getElementById('todayCount').textContent = todayConfirmed.length;
}

function displayQueueGrid(gridId, items, cardCreator, emptyMessage) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500">${emptyMessage}</div>`;
        return;
    }

    items.forEach(item => grid.appendChild(cardCreator(item)));
}

function createDoctorQueueCard(appointment) {
    const card = document.createElement('div');
    card.className = 'bg-white border-l-4 rounded-lg p-4 shadow-sm';

    let actionButton = '';
    if (appointment.queueStatus === 'checked-in') {
        card.classList.add('border-blue-500');
        actionButton = `<button onclick="updateQueueStatus('${appointment.id}', 'in-consultation')" class="mt-3 w-full bg-green-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-600">بدء الكشف</button>`;
    } else if (appointment.queueStatus === 'in-consultation') {
        card.classList.add('border-green-500');
        actionButton = `<button onclick="updateAppointmentStatus('${appointment.id}', 'completed')" class="mt-3 w-full bg-blue-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600">إنهاء الزيارة</button>`;
    }

    card.innerHTML = `
        <h3 class="font-bold text-gray-900">${appointment.patientName}</h3>
        <p class="text-sm text-gray-600">الوقت: ${appointment.appointmentTime}</p>
        <p class="text-sm text-gray-600">السبب: ${appointment.reason.substring(0, 50)}...</p>
        ${actionButton}
    `;
    return card;
}


function displayRequestGrid(gridId, items, cardCreator, emptyMessage) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <h3 class="text-lg font-medium text-gray-700">${emptyMessage}</h3>
            </div>`;
        return;
    }

    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    items.forEach(item => gridContainer.appendChild(cardCreator(item)));
    grid.appendChild(gridContainer);
}

function createRequestCard(appointment) {
    const card = document.createElement('div');
    card.className = 'bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 hover-scale cursor-pointer';
    card.onclick = () => showPatientDetails(appointment);

    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div>
                <h3 class="text-lg font-bold text-gray-900">${appointment.patientName}</h3>
                <p class="text-sm text-gray-600">العمر: ${appointment.patientAge} سنة - ${appointment.patientGender}</p>
            </div>
            <span class="px-2 py-1 text-xs font-semibold rounded-full ${appointment.status === 'reschedule_requested' ? 'bg-purple-100 text-purple-800' : 'bg-yellow-100 text-yellow-800'}">
                ${appointment.status === 'reschedule_requested' ? 'طلب إعادة جدولة' : 'طلب جديد'}
            </span>
        </div>
        <div class="space-y-2 text-sm text-gray-600 mb-4">
            ${appointment.status === 'reschedule_requested' ? `
                <div class="flex items-center text-gray-500">
                    <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span class="line-through">${appointment.appointmentDate} - ${appointment.appointmentTime}</span>
                </div>
                <div class="flex items-center text-purple-700 font-bold bg-purple-50 p-2 rounded-md">
                    <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                    <span>${appointment.rescheduledDate} - ${appointment.rescheduledTime}</span>
                </div>
            ` : `
                <div class="flex items-center"><svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>${appointment.appointmentDate} - ${appointment.appointmentTime}</div>
            `}
            ${appointment.rescheduleReason ? `<div class="flex items-start text-sm text-gray-700 mt-2"><svg class="w-4 h-4 ml-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg><span><strong>سبب التعديل:</strong> ${appointment.rescheduleReason}</span></div>` : ''}
            <div class="flex items-center"><svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>${appointment.patientPhone}</div>
        </div>
        ${appointment.reason ? `<div class="bg-white rounded-lg p-3 mb-4"><p class="text-sm text-gray-700"><span class="font-medium">سبب الزيارة:</span> ${appointment.reason}</p></div>` : ''}
        <div class="flex justify-between items-center">
            <button onclick="event.stopPropagation(); showPatientDetailsById('${appointment.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">عرض التفاصيل</button>
            ${appointment.status === 'reschedule_requested' ? `
                <div class="flex space-x-2 space-x-reverse">
                    <button onclick="event.stopPropagation(); approveReschedule('${appointment.id}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">الموافقة</button>
                    <button onclick="event.stopPropagation(); denyReschedule('${appointment.id}')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">الرفض</button>
                </div>
            ` : `
                <div class="flex space-x-2 space-x-reverse">
                    <button onclick="event.stopPropagation(); updateAppointmentStatus('${appointment.id}', 'confirmed')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">تأكيد</button>
                    <button onclick="event.stopPropagation(); updateAppointmentStatus('${appointment.id}', 'cancelled')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium">رفض</button>
                </div>
            `}
        </div>`;
    return card;
}

function createConfirmedCard(appointment) {
    const card = document.createElement('div');
    card.className = 'bg-green-50 border-l-4 border-green-400 rounded-lg p-4 hover-scale cursor-pointer';
    card.onclick = () => showPatientDetails(appointment);

    card.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <div>
                <h3 class="text-lg font-bold text-gray-900">${appointment.patientName}</h3>
                <p class="text-sm text-gray-600">العمر: ${appointment.patientAge} سنة - ${appointment.patientGender}</p>
            </div>
            <span class="bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold rounded-full">مؤكد</span>
        </div>
        <div class="space-y-2 text-sm text-gray-600 mb-4">
            <div class="flex items-center"><svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span class="font-medium">${appointment.appointmentTime}</span></div>
            <div class="flex items-center"><svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>${appointment.patientPhone}</div>
        </div>
        ${appointment.reason ? `<div class="bg-white rounded-lg p-3 mb-4"><p class="text-sm text-gray-700"><span class="font-medium">سبب الزيارة:</span> ${appointment.reason}</p></div>` : ''}
        <div class="flex justify-between items-center">
            <button onclick="event.stopPropagation(); showPatientDetailsById('${appointment.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">عرض التفاصيل</button>
            <button onclick="event.stopPropagation(); updateAppointmentStatus('${appointment.id}', 'completed')" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">تم الانتهاء</button>
        </div>`;
    return card;
}

async function updateAppointmentStatus(appointmentId, newStatus) {
    if (newStatus === 'completed') {
        // Show the notes modal first
        showCompletionNotesModal(appointmentId);
        return;
    }
    
    // Check for time conflicts when confirming
    if (newStatus === 'confirmed') {
        const appointment = allAppointments.find(apt => apt.id === appointmentId);
        if (appointment && hasTimeConflict(appointment.appointmentDate, appointment.appointmentTime, appointmentId)) {
            return window.showNotification('عذراً، يوجد موعد آخر مؤكد في نفس التاريخ والوقت', 'error');
        }
        // Check if clinic is closed
        if (currentDoctor.clinicClosed) {
            const closureDate = currentDoctor.closureEndDate;
            const appointmentDate = appointment.appointmentDate;
            if (!closureDate || appointmentDate <= closureDate) {
                return window.showNotification('Clinic is closed. Cannot confirm appointments.', 'error');
            }
        }
    }

    // Validate status transition
    const validTransitions = {
        'awaiting_confirmation': ['confirmed', 'cancelled'],
        'confirmed': ['completed', 'cancelled'],
        'reschedule_requested': ['confirmed', 'cancelled']
    };
    
    const currentStatus = allAppointments.find(apt => apt.id === appointmentId)?.status;
    if (currentStatus && !validTransitions[currentStatus]?.includes(newStatus)) {
        return window.showNotification('Invalid status transition', 'error');
    }

    try {
        // When a doctor confirms, a Cloud Function can be triggered
        // to send an SMS to the patient.
        // Example Cloud Function trigger:
        // functions.firestore.document('appointments/{aptId}')
        //  .onUpdate((change, context) => { ... send SMS ... });

        const updatePayload = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('appointments').doc(appointmentId).update(updatePayload);
        const idx = allAppointments.findIndex(apt => apt.id === appointmentId);
        if (idx !== -1) allAppointments[idx].status = newStatus;
        window.showNotification('تم تحديث حالة الموعد بنجاح', 'success');
        displayAppointments();
        updateStats();
        calculateRevenue();
        closePatientModal();
    } catch (error) {
        console.error('Error updating appointment:', error);
        window.showNotification('خطأ في تحديث الموعد', 'error');
    }
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

async function approveReschedule(appointmentId) {
    const appointment = allAppointments.find(apt => apt.id === appointmentId);
    if (!appointment || !appointment.rescheduledDate || !appointment.rescheduledTime) {
        return window.showNotification('بيانات إعادة الجدولة غير مكتملة', 'error');
    }
    
    // Validate rescheduled date is in future
    if (!isValidFutureDate(appointment.rescheduledDate)) {
        return window.showNotification('لا يمكن الموافقة على موعد في الماضي', 'error');
    }
    
    // Check for time conflicts with rescheduled date/time
    if (hasTimeConflict(appointment.rescheduledDate, appointment.rescheduledTime, appointmentId)) {
        return window.showNotification('يوجد موعد آخر مؤكد في نفس التاريخ والوقت', 'error');
    }

    try {
        const updatePayload = {
            status: 'confirmed',
            appointmentDate: appointment.rescheduledDate,
            appointmentTime: appointment.rescheduledTime,
            rescheduledDate: firebase.firestore.FieldValue.delete(),
            rescheduledTime: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('appointments').doc(appointmentId).update(updatePayload);
        window.showNotification('تمت الموافقة على إعادة جدولة الموعد', 'success');
        loadDoctorAppointments();
    } catch (error) {
        console.error('Error approving reschedule:', error);
        window.showNotification('خطأ في الموافقة على الطلب', 'error');
    }
}

async function denyReschedule(appointmentId) {
    try {
        const updatePayload = {
            status: 'confirmed', // Revert status to confirmed
            rescheduledDate: firebase.firestore.FieldValue.delete(),
            rescheduledTime: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('appointments').doc(appointmentId).update(updatePayload);
        window.showNotification('تم رفض طلب إعادة الجدولة', 'success');
        loadDoctorAppointments();
    } catch (error) {
        console.error('Error denying reschedule:', error);
        window.showNotification('خطأ في رفض الطلب', 'error');
    }
}

// === Modals (Patient Details, Follow-up) ===

function showPatientDetailsById(appointmentId) {
    const appointment = allAppointments.find(a => a.id === appointmentId);
    if (appointment) {
        showPatientDetails(appointment);
    } else {
        window.showNotification('لم يتم العثور على بيانات الموعد', 'error');
    }
}

function showPatientDetails(appointment) {
    const details = document.getElementById('patientDetails');
    details.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h4 class="font-semibold text-gray-900 mb-3">معلومات المريض</h4>
                <div class="space-y-3">
                    <p><strong>الاسم:</strong> ${appointment.patientName}</p>
                    <p><strong>الهاتف:</strong> ${appointment.patientPhone}</p>
                    <p><strong>العمر:</strong> ${appointment.patientAge} سنة</p>
                    <p><strong>الجنس:</strong> ${appointment.patientGender}</p>
                </div>
            </div>
            <div>
                <h4 class="font-semibold text-gray-900 mb-3">معلومات الموعد</h4>
                <div class="space-y-3">
                    <p><strong>التاريخ:</strong> ${formatGregorianDate(appointment.appointmentDate)}</p>
                    <p><strong>الوقت:</strong> ${appointment.appointmentTime}</p>
                    <p><strong>رقم الحجز:</strong> ${appointment.id.slice(0, 8).toUpperCase()}</p>
                    <p><strong>الحالة:</strong> <span class="px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(appointment.status)}">${getStatusText(appointment.status)}</span></p>
                </div>
            </div>
        </div>
        <div class="mt-6 pt-6 border-t border-gray-200">
            <h4 class="font-semibold text-gray-900 mb-3">المعلومات الطبية</h4>
            <div class="space-y-2">
                <p><strong>سبب الزيارة:</strong> ${appointment.reason || 'غير محدد'}</p>
                <p><strong>الحساسية:</strong> ${appointment.allergies || 'لا توجد'}</p>
                <p><strong>الأدوية الحالية:</strong> ${appointment.currentMedications || 'لا توجد'}</p>
                <p><strong>ملاحظات الطبيب:</strong> ${appointment.doctorNotes || 'لا توجد'}</p>
            </div>
        </div>
        <div class="mt-6 pt-6 border-t border-gray-200">
            <h4 class="font-semibold text-gray-900 mb-3">الإجراءات الطبية</h4>
            <div class="flex flex-wrap gap-3 mb-4">
                <button onclick="showPatientEMRModal('${appointment.userId || appointment.patientId}', '${appointment.patientPhone || appointment.userPhone}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    السجل الطبي
                </button>
                <button onclick="showPrescriptionModal('${appointment.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    وصفة طبية
                </button>
                <button onclick="showLabOrderModal('${appointment.id}')" class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                    </svg>
                    طلب تحاليل
                </button>
            </div>
        </div>
        <div class="mt-6 flex justify-end space-x-4 space-x-reverse">
            ${appointment.status === 'awaiting_confirmation' ? `<button onclick="updateAppointmentStatus('${appointment.id}', 'confirmed')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">تأكيد الحجز</button>` : ''}
            ${appointment.status === 'confirmed' ? `<button onclick="finishAppointmentWithNotes('${appointment.id}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold">✓ إنهاء الزيارة وإضافة ملاحظات</button>` : ''}
            ${appointment.status === 'reschedule_requested' ? `<button onclick="approveReschedule('${appointment.id}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg">الموافقة على التعديل</button>` : ''}
            ${appointment.status !== 'cancelled' && appointment.status !== 'completed' ? `<button onclick="updateAppointmentStatus('${appointment.id}', 'cancelled')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">إلغاء الموعد</button>` : ''}
            <button onclick="closePatientModal()" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">إغلاق</button>
        </div>`;
    
    showModal('patientModal');
}

function showDoctorCancellationModal(appointmentId) {
    const modal = document.getElementById('doctorCancellationModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('doctorCancellationReason').value = '';
    document.getElementById('confirmDoctorCancelBtn').onclick = () => confirmDoctorCancellation(appointmentId);
}

function closeDoctorCancellationModal() {
    const modal = document.getElementById('doctorCancellationModal');
    if (modal) modal.style.display = 'none';
}

async function confirmDoctorCancellation(appointmentId) {
    const reason = document.getElementById('doctorCancellationReason').value.trim();
    if (!reason) {
        return window.showNotification('يرجى كتابة سبب الإلغاء', 'error');
    }

    const confirmBtn = document.getElementById('confirmDoctorCancelBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'جاري الإلغاء...';

    try {
        const updatePayload = {
            status: 'cancelled',
            cancelledBy: 'doctor',
            cancellationReason: reason,
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('appointments').doc(appointmentId).update(updatePayload);
        window.showNotification('تم إلغاء الموعد بنجاح', 'success');
        closeDoctorCancellationModal();
        loadDoctorAppointments(); // Refresh the lists
    } catch (error) {
        console.error('Error cancelling appointment by doctor:', error);
        window.showNotification('خطأ في إلغاء الموعد', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'تأكيد الإلغاء';
    }
}

function showCompletionNotesModal(appointmentId) {
    const modal = document.getElementById('completionNotesModal');
    if (!modal) return; // Should create this modal in HTML
    modal.style.display = 'flex';
    document.getElementById('completionNotesText').value = '';
    document.getElementById('saveCompletionNotesBtn').onclick = () => saveCompletionNotes(appointmentId);
    loadTemplates(); // Populate template selector
}

function closeCompletionNotesModal() {
    const modal = document.getElementById('completionNotesModal');
    if (modal) modal.style.display = 'none';
}

async function saveCompletionNotes(appointmentId) {
    const notes = document.getElementById('completionNotesText').value.trim();
    const saveBtn = document.getElementById('saveCompletionNotesBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'جارٍ الحفظ...';

    try {
        const updatePayload = {
            status: 'completed',
            queueStatus: 'completed',
            doctorNotes: notes,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('appointments').doc(appointmentId).update(updatePayload);

        const idx = allAppointments.findIndex(apt => apt.id === appointmentId);
        if (idx !== -1) Object.assign(allAppointments[idx], updatePayload);

        window.showNotification('تم إنهاء الموعد وحفظ الملاحظات', 'success');
        closeCompletionNotesModal();
        displayAppointments();
        updateStats();
        calculateRevenue();
    } catch (error) {
        console.error('Error saving completion notes:', error);
        window.showNotification('خطأ في حفظ الملاحظات', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ وإنهاء الموعد';
    }
}

function showPatientFollowup(patientName, visitCount) {
    const details = document.getElementById('followupDetails');
    const patientAppointments = allAppointments
        .filter(apt => apt.patientName === patientName)
        .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));

    if (patientAppointments.length === 0) return;
    const latestAppointment = patientAppointments[0];

    details.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1 bg-blue-50 rounded-lg p-6">
                <h4 class="font-semibold text-gray-900 mb-4">ملخص المريض</h4>
                <div class="space-y-3">
                    <p><strong>الاسم:</strong> ${latestAppointment.patientName}</p>
                    <p><strong>الهاتف:</strong> ${latestAppointment.patientPhone}</p>
                    <p><strong>إجمالي الزيارات:</strong> ${visitCount} زيارة</p>
                </div>
                <div class="mt-6 space-y-3">
                    <button onclick="callPatient('${latestAppointment.patientPhone}')" class="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg flex items-center justify-center">اتصال</button>
                    <button onclick="scheduleFollowup('${latestAppointment.patientName}')" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center">جدولة متابعة</button>
                </div>
            </div>
            <div class="lg:col-span-2">
                <h4 class="font-semibold text-gray-900 mb-4">سجل الزيارات</h4>
                <div class="space-y-4 max-h-96 overflow-y-auto">
                    ${patientAppointments.map(apt => `
                        <div class="border border-gray-200 rounded-lg p-4">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <p class="font-medium text-gray-900">${apt.appointmentDate} - ${apt.appointmentTime}</p>
                                </div>
                                <span class="px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(apt.status)}">${getStatusText(apt.status)}</span>
                            </div>
                            <p class="text-sm text-gray-700"><strong>سبب الزيارة:</strong> ${apt.reason || 'غير محدد'}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        <div class="mt-6 flex justify-end">
            <button onclick="closeFollowupModal()" class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg">إغلاق</button>
        </div>`;

    showModal('followupModal');
}

// === Analytics and Stats ===

function filterDashboardAppointments(filter) {
    // Apply filter based on clicked stat
    const today = new Date().toISOString().split('T')[0];
    let filteredAppointments = [];
    
    switch(filter) {
        case 'today':
            filteredAppointments = allAppointments.filter(apt => apt.appointmentDate === today);
            break;
        case 'pending':
            filteredAppointments = allAppointments.filter(apt => apt.status === 'awaiting_confirmation');
            break;
        case 'confirmed':
            filteredAppointments = allAppointments.filter(apt => apt.status === 'confirmed');
            break;
        default:
            filteredAppointments = allAppointments;
    }
    
    // Display filtered appointments in dashboard
    displayFilteredAppointments(filteredAppointments, filter);
}

function displayFilteredAppointments(appointments, filterType) {
    const container = document.getElementById('appointmentsGrid');
    if (!container) return;
    
    const filterLabels = {
        'today': 'مواعيد اليوم',
        'pending': 'المواعيد في الانتظار',
        'confirmed': 'المواعيد المؤكدة'
    };
    
    if (appointments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 col-span-full">
                <p class="text-gray-500">لا توجد ${filterLabels[filterType] || 'مواعيد'}</p>
            </div>`;
        return;
    }
    
    container.innerHTML = appointments.map(apt => `
        <div class="bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow" onclick="showPatientDetails('${apt.id}')">
            <h3 class="font-bold text-gray-900">${apt.patientName}</h3>
            <p class="text-sm text-gray-600">التاريخ: ${apt.appointmentDate || 'غير محدد'}</p>
            <p class="text-sm text-gray-600">الوقت: ${apt.appointmentTime || 'غير محدد'}</p>
            <p class="text-sm text-gray-600">السبب: ${apt.reason || 'غير محدد'}</p>
            <span class="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(apt.status)}">
                ${getStatusText(apt.status)}
            </span>
        </div>
    `).join('');
}

function updateStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const todayCount = allAppointments.filter(apt => apt.appointmentDate === today).length;
        const pendingCount = allAppointments.filter(apt => apt.status === 'awaiting_confirmation').length;
        const confirmedCount = allAppointments.filter(apt => apt.status === 'confirmed').length;
        
        // Update only existing dashboard stats
        const todayEl = document.getElementById('todayAppointments');
        const pendingEl = document.getElementById('pendingAppointments');
        const confirmedEl = document.getElementById('confirmedAppointments');
        
        if (todayEl) todayEl.textContent = todayCount;
        if (pendingEl) pendingEl.textContent = pendingCount;
        if (confirmedEl) confirmedEl.textContent = confirmedCount;
        
        console.log('DEBUG updateStats:', { todayCount, pendingCount, confirmedCount });
    } catch (error) {
        console.error('Error in updateStats:', error);
    }
}

function calculateRevenue() {
    try {
        const now = new Date();
        const ym = now.toISOString().slice(0, 7);
        const fee = Number(currentDoctor?.consultationFee) || 0;
        const completedThisMonth = allAppointments.filter(a => a.appointmentDate?.startsWith(ym) && a.status === 'completed').length;
        const total = completedThisMonth * fee;

        // Only update analytics tab revenue (monthlyRevenue was removed from dashboard)
        const thisMonthRevenueEl = document.getElementById('thisMonthRevenue');
        if (thisMonthRevenueEl) thisMonthRevenueEl.textContent = formatIQD(total);
        
        console.log('DEBUG calculateRevenue:', { fee, completedThisMonth, total, ym });
    } catch (error) {
        console.error('Error in calculateRevenue:', error);
    }
}

function loadAnalytics() {
    calculateRevenueAnalytics();
    createRevenueChart();
    createVisitsChart();
}

function calculateRevenueAnalytics() {
    const fee = Number(currentDoctor?.consultationFee) || 0;
    const completed = allAppointments.filter(apt => apt.status === 'completed');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const getRevenue = (filterFn) => completed.filter(filterFn).length * fee;

    const thisMonthRevenue = getRevenue(apt => {
        const d = new Date(apt.appointmentDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastMonthRevenue = getRevenue(apt => {
        const d = new Date(apt.appointmentDate);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const thisYearRevenue = getRevenue(apt => new Date(apt.appointmentDate).getFullYear() === currentYear);
    const averageMonthlyRevenue = (currentMonth + 1) > 0 ? Math.round(thisYearRevenue / (currentMonth + 1)) : 0;

    document.getElementById('thisMonthRevenue').textContent = formatIQD(thisMonthRevenue);
    document.getElementById('lastMonthRevenue').textContent = formatIQD(lastMonthRevenue);
    document.getElementById('thisYearRevenue').textContent = formatIQD(thisYearRevenue);
    document.getElementById('averageMonthlyRevenue').textContent = formatIQD(averageMonthlyRevenue);
}

function createChart(chartId, chartInstance, type, label, data, labels, isCurrency = false) {
    const ctx = document.getElementById(chartId).getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const options = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: isCurrency ? (value) => formatIQD(value) : (value) => (Number.isInteger(value) ? value : null)
                }
            }
        }
    };

    const datasetOptions = {
        'line': { borderColor: 'rgb(34, 197, 94)', backgroundColor: 'rgba(34, 197, 94, 0.1)', tension: 0.4, fill: true },
        'bar': { backgroundColor: 'rgba(59, 130, 246, 0.8)', borderColor: 'rgb(59, 130, 246)', borderWidth: 1 }
    };

    return new Chart(ctx, {
        type,
        data: { labels, datasets: [{ label, data, ...datasetOptions[type] }] },
        options
    });
}

function createRevenueChart() {
    const fee = Number(currentDoctor?.consultationFee) || 0;
    const { data, labels } = getMonthlyChartData(apt => apt.status === 'completed', value => value * fee);
    revenueChart = createChart('revenueChart', revenueChart, 'line', 'الإيرادات', data, labels, true);
}

function createVisitsChart() {
    const { data, labels } = getMonthlyChartData(apt => apt.status === 'completed');
    visitsChart = createChart('visitsChart', visitsChart, 'bar', 'الزيارات', data, labels);
}

function getMonthlyChartData(filterFn, transformFn = val => val) {
    const monthlyAgg = Array(12).fill(0);
    const labels = [];
    const relevantAppointments = allAppointments.filter(filterFn);

    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const month = d.getMonth();
        const year = d.getFullYear();
        labels.push(d.toLocaleDateString('ar-IQ-u-ca-gregory', { month: 'short', year: 'numeric' }));

        const count = relevantAppointments.filter(apt => {
            const aptDate = new Date(apt.appointmentDate);
            return aptDate.getMonth() === month && aptDate.getFullYear() === year;
        }).length;

        monthlyAgg[11 - i] = transformFn(count);
    }
    return { data: monthlyAgg, labels };
}

// === Patient Management ===

function loadRegularPatients() {
    const patientVisits = {};
    allAppointments
        .filter(apt => apt.status === 'completed')
        .forEach(apt => {
            const phone = apt.patientPhone;
            if (!patientVisits[phone]) {
                patientVisits[phone] = { count: 0, lastVisit: 0, patient: apt };
            }
            patientVisits[phone].count++;
            patientVisits[phone].lastVisit = Math.max(patientVisits[phone].lastVisit, new Date(apt.appointmentDate).getTime());
        });

    const regularPatients = Object.values(patientVisits)
        .filter(p => p.count >= 3)
        .sort((a, b) => b.lastVisit - a.lastVisit);

    displayRegularPatients(regularPatients);
}

function displayRegularPatients(patients) {
    const grid = document.getElementById('regularPatientsGrid');
    grid.innerHTML = '';

    if (patients.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500">لا يوجد مرضى بزيارات متكررة حتى الآن.</div>`;
        return;
    }

    patients.forEach(({ patient, count }) => {
        const lastVisitDate = new Date(patient.lastVisit).toLocaleDateString('ar-IQ-u-ca-gregory');
        const card = document.createElement('div');
        card.className = 'bg-white border border-gray-200 rounded-lg p-6 hover-scale cursor-pointer';
        card.onclick = () => {
            console.log('Card clicked for patient:', patient.patientName);
            if (window.viewFollowUpDetails) {
                // Find the most recent appointment ID for this patient
                const patientAppointment = followUpPatients.find(p => p.patientName === patient.patientName);
                const appointmentId = patientAppointment ? patientAppointment.appointmentId : patient.patientName;
                console.log('Using appointmentId:', appointmentId);
                window.viewFollowUpDetails(appointmentId);
            } else {
                console.error('viewFollowUpDetails function not found');
                // Fallback to old function
                showPatientFollowup(patient.patientName, count);
            }
        };
        card.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                    <div class="mr-3">
                        <h3 class="font-semibold text-gray-900">${patient.patientName}</h3>
                        <p class="text-sm text-gray-600">${patient.patientAge} سنة - ${patient.patientGender}</p>
                    </div>
                </div>
                <span class="bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold rounded-full">${count} زيارات</span>
            </div>
            <div class="space-y-2 text-sm text-gray-600">
                <p><strong>الهاتف:</strong> ${patient.patientPhone}</p>
                <p><strong>آخر زيارة:</strong> ${lastVisitDate}</p>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                <button onclick="event.stopPropagation(); 
                    if (window.viewFollowUpDetails) {
                        const patientAppointment = followUpPatients.find(p => p.patientName === '${patient.patientName}');
                        const appointmentId = patientAppointment ? patientAppointment.appointmentId : '${patient.patientName}';
                        window.viewFollowUpDetails(appointmentId);
                    } else {
                        showPatientFollowup('${patient.patientName}', ${count});
                    }" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">عرض سجل المتابعة</button>
            </div>`;
        grid.appendChild(card);
    });
}

// === Helper Functions ===

function getStatusClass(status) {
    return {
        'awaiting_confirmation': 'bg-yellow-100 text-yellow-800',
        'confirmed': 'bg-green-100 text-green-800',
        'completed': 'bg-blue-100 text-blue-800',
        'cancelled': 'bg-red-100 text-red-800',
    'reschedule_requested': 'bg-purple-100 text-purple-800',
    }[status] || 'bg-gray-100 text-gray-800';
}

function getStatusText(status) {
    return {
        'awaiting_confirmation': 'في انتظار التأكيد',
        'confirmed': 'مؤكد',
        'completed': 'مكتمل',
        'cancelled': 'ملغي',
    'reschedule_requested': 'طلب إعادة جدولة',
    }[status] || 'غير محدد';
}

function formatGregorianDate(dateInput) {
    if (!dateInput) return 'غير محدد';
    try {
        const d = new Date(dateInput);
        return d.toLocaleDateString('ar-IQ-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    } catch (e) {
        return dateInput;
    }
}

function callPatient(phoneNumber) {
    window.open(`tel:${phoneNumber}`, '_self');
}

function scheduleFollowup(patientName) {
    showNotification(`سيتم إضافة ميزة جدولة المواعيد قريباً للمريض: ${patientName}`, 'info');
}

function initializeTestMode() {
    // Placeholder for test mode initialization if needed
    console.log("Test mode is active.");
}

// === MODAL CONTROL FUNCTIONS ===

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function closePatientModal() {
    closeModal('patientModal');
}

function closeFollowupModal() {
    closeModal('followupModal');
}

function closeForgotPasswordModal() {
    closeModal('forgotPasswordModal');
}

function showForgotPasswordModal(event) {
    if (event) event.preventDefault();
    showModal('forgotPasswordModal');
}

function closeCompletionNotesModal() {
    closeModal('completionNotesModal');
}

// === EMR Modal Function ===
window.showPatientEMRModal = async function(patientId, patientPhone) {
    if (!patientId && !patientPhone) {
        showNotification('معلومات المريض غير متوفرة', 'error');
        return;
    }
    
    // Check if doctor-emr.js is loaded
    if (typeof window.openEMRModal === 'function') {
        await window.openEMRModal(patientId, patientPhone);
    } else {
        showNotification('نظام السجل الطبي غير متاح حالياً', 'error');
        console.error('doctor-emr.js not loaded');
    }
}