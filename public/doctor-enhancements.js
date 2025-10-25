// ============================================================================
// DOCTOR PORTAL ENHANCEMENTS
// Implements: Revenue tracking, Follow-up list, Doctor notes, Appointment tabs
// ============================================================================

// === REVENUE TRACKING ===

let doctorRevenue = {
    totalRevenue: 0,
    completedAppointments: 0,
    pendingRevenue: 0
};

async function calculateRevenue() {
    if (!currentDoctor?.id) return;
    
    try {
        const completedSnap = await db.collection('appointments')
            .where('doctorId', '==', currentDoctor.id)
            .where('status', '==', 'completed')
            .get();
        
        let total = 0;
        completedSnap.docs.forEach(doc => {
            const data = doc.data();
            const fee = currentDoctor.consultationFee || 15000;
            total += fee;
        });
        
        doctorRevenue.totalRevenue = total;
        doctorRevenue.completedAppointments = completedSnap.size;
        
        updateRevenueDisplay();
    } catch (error) {
        console.error('Error calculating revenue:', error);
    }
}

function updateRevenueDisplay() {
    const revenueElement = document.getElementById('totalRevenueAmount');
    const appointmentsElement = document.getElementById('completedAppointmentsCount');
    
    if (revenueElement) {
        revenueElement.textContent = `${(doctorRevenue.totalRevenue / 1000).toFixed(1)} ألف د.ع`;
    }
    if (appointmentsElement) {
        appointmentsElement.textContent = doctorRevenue.completedAppointments;
    }
}

// === FOLLOW-UP LIST ===

let followUpPatients = [];

window.loadFollowUpPatients = async function loadFollowUpPatients() {
    if (!currentDoctor?.id) return;
    
    try {
        console.log('DEBUG: Loading follow-up patients for doctor:', currentDoctor.id);
        // Get all completed appointments - simplified query to avoid composite index
        const completedSnap = await db.collection('appointments')
            .where('doctorId', '==', currentDoctor.id)
            .where('status', '==', 'completed')
            .get();
        
        console.log('DEBUG: Found completed appointments:', completedSnap.docs.length);
        
        // Sort in memory instead of using orderBy in query
        followUpPatients = completedSnap.docs.map(doc => ({
            appointmentId: doc.id,
            ...doc.data()
        })).sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0));
        
        console.log('DEBUG: Follow-up patients after sort:', followUpPatients.length, followUpPatients);
        console.log('DEBUG: First patient data:', followUpPatients[0]);
        
        displayFollowUpList();
    } catch (error) {
        console.error('Error loading follow-up patients:', error);
    }
}

function displayFollowUpList() {
    const container = document.getElementById('followupListContainer');
    if (!container) {
        console.log('DEBUG: followupListContainer not found!');
        return;
    }
    
    console.log('DEBUG: displayFollowUpList called with', followUpPatients.length, 'patients');
    console.log('DEBUG: followUpPatients array:', followUpPatients);
    
    if (followUpPatients.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">لا توجد مرضى للمتابعة حالياً</p>';
        return;
    }
    
    container.innerHTML = followUpPatients.map(patient => `
        <div class="bg-white rounded-lg p-4 border border-gray-200 mb-3 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div class="flex-1 cursor-pointer" onclick="viewFollowUpDetails('${patient.appointmentId}')">
                    <h4 class="font-bold text-gray-900">${patient.patientName || 'مريض'}</h4>
                    <p class="text-sm text-gray-600">الهاتف: ${patient.patientPhone || patient.userPhone || 'غير متوفر'}</p>
                    <p class="text-sm text-gray-600">آخر زيارة: ${patient.appointmentDate || 'غير محدد'}</p>
                    <p class="text-sm text-gray-600">السبب: ${patient.reason || 'غير محدد'}</p>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="viewFollowUpDetails('${patient.appointmentId}')" class="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700" title="عرض الملاحظات">
                        📋
                    </button>
                    <button onclick="bookFollowUpForPatient('${patient.appointmentId}')" class="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
                        حجز متابعة
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

window.viewFollowUpDetails = async function viewFollowUpDetails(appointmentId) {
    const patient = followUpPatients.find(p => p.appointmentId === appointmentId);
    if (!patient) return;
    
    try {
        console.log('DEBUG: Starting query with doctorId:', currentDoctor.id);
        console.log('DEBUG: Current user:', auth.currentUser?.uid);
        
        // Get all doctor appointments and filter in memory
        const allDoctorAppointments = await db.collection('appointments')
            .where('doctorId', '==', currentDoctor.id)
            .get();
        
        console.log('DEBUG: Query successful, docs count:', allDoctorAppointments.docs.length);
            
        // Filter by patient phone and completed status in memory
        const appointments = allDoctorAppointments.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(apt => apt.patientPhone === patient.patientPhone && apt.status === 'completed');
        
        // Get notes for each appointment
        for (const apt of appointments) {
            // Get notes for this appointment
            const notesDoc = await db.collection('appointmentNotes').doc(apt.id).get();
            apt.doctorNotes = notesDoc.exists ? notesDoc.data().notes : 'لا توجد ملاحظات';
        }
        
        // Sort by date (newest first)
        appointments.sort((a, b) => {
            const dateA = a.updatedAt?.toDate?.() || new Date(0);
            const dateB = b.updatedAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });
        
        // Show modal with ALL visits
        showModal('patientModal');
        document.getElementById('patientDetails').innerHTML = `
            <div class="space-y-6">
                <div class="border-b pb-4">
                    <h3 class="text-xl font-bold text-gray-900">سجل المريض الطبي</h3>
                    <div class="grid grid-cols-2 gap-4 mt-3">
                        <div>
                            <p class="text-sm text-gray-600">اسم المريض</p>
                            <p class="font-bold text-gray-900">${patient.patientName}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-600">الهاتف</p>
                            <p class="font-bold text-gray-900">${patient.patientPhone || patient.userPhone || 'غير متوفر'}</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 mt-2">إجمالي الزيارات: ${appointments.length} زيارة</p>
                </div>
                
                <div class="space-y-4 max-h-96 overflow-y-auto">
                    ${appointments.map((apt, index) => `
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div class="flex justify-between items-start mb-3">
                                <h4 class="font-bold text-gray-900">الزيارة رقم ${appointments.length - index}</h4>
                                <span class="text-sm text-gray-500">${apt.appointmentDate || 'غير محدد'} - ${apt.appointmentTime || 'غير محدد'}</span>
                            </div>
                            <div class="space-y-3">
                                <div>
                                    <p class="text-sm font-medium text-gray-700">سبب الزيارة:</p>
                                    <p class="text-gray-900">${apt.reason || 'غير محدد'}</p>
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-700">ملاحظات وتشخيص الطبيب:</p>
                                    <div class="bg-white p-3 rounded border border-gray-300">
                                        <p class="text-gray-900 whitespace-pre-wrap">${apt.doctorNotes}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="border-t pt-4">
                    <button onclick="closePatientModal()" class="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg">إغلاق</button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading follow-up details:', error);
        console.error('DEBUG: Error code:', error.code);
        console.error('DEBUG: Error message:', error.message);
        console.error('DEBUG: Full error:', JSON.stringify(error, null, 2));
        showNotification('خطأ في تحميل التفاصيل', 'error');
    }
}

async function bookFollowUpForPatient(appointmentId) {
    const patient = followUpPatients.find(p => p.appointmentId === appointmentId);
    if (!patient) return;
    
    showModal('followupBookingModal');
    document.getElementById('followupPatientName').textContent = patient.patientName;
    document.getElementById('followupPatientPhone').textContent = patient.patientPhone;
    document.getElementById('followupPreviousReason').textContent = patient.reason;
    
    document.getElementById('confirmFollowupBooking').onclick = async () => {
        const followupDate = document.getElementById('followupDate').value;
        const followupReason = document.getElementById('followupReason').value;
        
        if (!followupDate || !followupReason) {
            showNotification('يرجى ملء جميع الحقول', 'error');
            return;
        }
        
        // Validate follow-up date is in future
        const selectedDate = new Date(followupDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            showNotification('يجب أن يكون موعد المتابعة في المستقبل', 'error');
            return;
        }
        
        try {
            await db.collection('appointments').add({
                doctorId: currentDoctor.id,
                doctorName: currentDoctor.name,
                doctorSpecialty: currentDoctor.specialty,
                patientName: patient.patientName,
                patientPhone: patient.patientPhone,
                patientAge: patient.patientAge,
                patientGender: patient.patientGender,
                appointmentDate: followupDate,
                appointmentTime: document.getElementById('followupTime').value || '10:00 ص',
                reason: followupReason,
                isFollowUp: true,
                previousAppointmentId: appointmentId,
                status: 'awaiting_confirmation',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('تم حجز موعد المتابعة بنجاح', 'success');
            closeModal('followupBookingModal');
            loadDoctorAppointments();
        } catch (error) {
            console.error('Error booking follow-up:', error);
            showNotification('خطأ في حجز موعد المتابعة', 'error');
        }
    };
}

// === DOCTOR NOTES ===

let appointmentNotes = {};

async function loadAppointmentNotes() {
    if (!currentDoctor?.id) return;
    
    try {
        const notesSnap = await db.collection('appointmentNotes')
            .where('doctorId', '==', currentDoctor.id)
            .get();
        
        notesSnap.docs.forEach(doc => {
            appointmentNotes[doc.data().appointmentId] = doc.data();
        });
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

async function showNotesModal(appointmentId) {
    const appointment = allAppointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    
    const notesModal = document.getElementById('notesModal');
    if (!notesModal) {
        showNotification('Notes modal not found', 'error');
        return;
    }
    
    showModal('notesModal');
    document.getElementById('notesPatientName').textContent = appointment.patientName;
    document.getElementById('notesAppointmentDate').textContent = appointment.appointmentDate;
    document.getElementById('notesAppointmentTime').textContent = appointment.appointmentTime;
    
    const existingNotes = appointmentNotes[appointmentId];
    document.getElementById('appointmentNotesText').value = existingNotes?.notes || '';
    
    // Show warning if notes already exist
    const notesWarning = document.createElement('div');
    if (existingNotes?.notes) {
        notesWarning.className = 'bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded mb-4';
        notesWarning.textContent = 'Warning: Existing notes will be overwritten';
        const notesContainer = document.getElementById('appointmentNotesText').parentElement;
        notesContainer.insertBefore(notesWarning, document.getElementById('appointmentNotesText'));
    }
    
    document.getElementById('saveNotesButton').onclick = async () => {
        const notes = document.getElementById('appointmentNotesText').value.trim();
        
        try {
            const notesRef = db.collection('appointmentNotes').doc(appointmentId);
            await notesRef.set({
                appointmentId,
                doctorId: currentDoctor.id,
                patientName: appointment.patientName,
                notes,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            appointmentNotes[appointmentId] = { notes };
            showNotification('تم حفظ الملاحظات بنجاح', 'success');
            closeModal('notesModal');
        } catch (error) {
            console.error('Error saving notes:', error);
            showNotification('خطأ في حفظ الملاحظات', 'error');
        }
    };
}

// === APPOINTMENT TABS & FILTERING ===

let filteredAppointments = {
    today: [],
    confirmed: [],
    postponed: [],
    all: []
};

function filterAppointmentsByTab(tabName) {
    const today = new Date().toISOString().split('T')[0];
    
    filteredAppointments.today = allAppointments.filter(apt => 
        apt.appointmentDate === today && 
        (apt.status === 'confirmed' || apt.status === 'awaiting_confirmation')
    );
    
    filteredAppointments.confirmed = allAppointments.filter(apt => 
        apt.status === 'confirmed'
    );
    
    filteredAppointments.postponed = allAppointments.filter(apt => 
        apt.status === 'reschedule_requested' || apt.status === 'rescheduled'
    );
    
    filteredAppointments.all = allAppointments;
    
    displayFilteredAppointments(tabName || 'all');
}

function displayFilteredAppointments(tabName) {
    const container = document.getElementById('appointmentsTableBody');
    if (!container) return;
    
    const appointments = filteredAppointments[tabName] || filteredAppointments.all;
    const searchTerm = document.getElementById('appointmentSearchInput')?.value.toLowerCase() || '';
    
    const filtered = appointments.filter(apt => 
        apt.patientName.toLowerCase().includes(searchTerm) ||
        apt.patientPhone.includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">لا توجد مواعيد</td></tr>`;
        return;
    }
    
    container.innerHTML = filtered.map(apt => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-4 py-3">${apt.patientName}</td>
            <td class="px-4 py-3">${apt.patientPhone}</td>
            <td class="px-4 py-3">${apt.appointmentDate}</td>
            <td class="px-4 py-3">${apt.appointmentTime}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${
                    apt.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    apt.status === 'awaiting_confirmation' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                }">
                    ${apt.status === 'confirmed' ? 'مؤكد' : 
                      apt.status === 'awaiting_confirmation' ? 'في الانتظار' : 'مؤجل'}
                </span>
            </td>
            <td class="px-4 py-3">${apt.reason}</td>
            <td class="px-4 py-3">
                <button onclick="showPatientDetails('${apt.id}')" class="text-blue-600 hover:text-blue-800 text-sm">عرض</button>
            </td>
        </tr>
    `).join('');
}

function setupAppointmentTabListeners() {
    const tabs = document.querySelectorAll('[data-appointment-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'text-green-600', 'border-green-600'));
            tab.classList.add('active', 'text-green-600', 'border-green-600');
            filterAppointmentsByTab(tab.dataset.appointmentTab);
        });
    });
    
    const searchInput = document.getElementById('appointmentSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const activeTab = document.querySelector('[data-appointment-tab].active');
            displayFilteredAppointments(activeTab?.dataset.appointmentTab || 'all');
        });
    }
}

// === FINISH APPOINTMENT WITH NOTES ===

async function finishAppointmentWithNotes(appointmentId) {
    const appointment = allAppointments.find(a => a.id === appointmentId);
    if (!appointment) return;
    
    console.log('DEBUG: Finishing appointment:', { appointmentId, appointment });
    console.log('DEBUG: Current doctor:', currentDoctor);
    
    showModal('finishAppointmentModal');
    document.getElementById('finishPatientName').textContent = appointment.patientName;
    document.getElementById('finishAppointmentReason').textContent = appointment.reason;
    
    document.getElementById('confirmFinishButton').onclick = async () => {
        const notes = document.getElementById('finishNotesText').value.trim();
        
        try {
            console.log('DEBUG: Attempting to update appointment status to completed');
            console.log('DEBUG: Appointment doctorId:', appointment.doctorId);
            console.log('DEBUG: Current doctor ID:', currentDoctor.id);
            console.log('DEBUG: Auth UID:', auth.currentUser?.uid);
            
            // Update appointment status to completed
            await db.collection('appointments').doc(appointmentId).update({
                status: 'completed',
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('DEBUG: Appointment status updated successfully');
            
            // Save notes if provided
            if (notes) {
                await db.collection('appointmentNotes').doc(appointmentId).set({
                    appointmentId,
                    doctorId: currentDoctor.id,
                    patientName: appointment.patientName,
                    notes,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
            
            // Wait a bit for Firestore to update, then refresh follow-up list
            setTimeout(async () => {
                await loadFollowUpPatients();
                await calculateRevenue();
                console.log('DEBUG: Follow-up list refreshed after appointment completion');
            }, 1000);
            
            showNotification('تم إنهاء الموعد بنجاح وإضافة المريض لقائمة المتابعة', 'success');
            closeModal('finishAppointmentModal');
            loadDoctorAppointments();
        } catch (error) {
            console.error('Error finishing appointment:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            showNotification('خطأ في إنهاء الموعد: ' + error.message, 'error');
        }
    };
}

// === CONFIRMED APPOINTMENTS DISPLAY ===
// NOTE: This function was removed as we only show "Today's Confirmed Appointments" now
// Keeping it commented in case needed later

/*
function displayConfirmedAppointments() {
    const container = document.getElementById('confirmedAppointmentsGrid');
    if (!container) return;
    
    // Get ALL confirmed appointments (not just today)
    const confirmedApts = allAppointments.filter(apt => 
        apt.status === 'confirmed'
    );
    
    // Sort by date (upcoming first)
    confirmedApts.sort((a, b) => {
        const dateA = new Date(a.appointmentDate || '9999-12-31');
        const dateB = new Date(b.appointmentDate || '9999-12-31');
        return dateA - dateB;
    });
    
    const countElement = document.getElementById('allConfirmedCount');
    if (countElement) {
        countElement.textContent = confirmedApts.length;
    }
    
    if (confirmedApts.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">لا توجد مواعيد مؤكدة ليوم اليوم</div>';
        return;
    }
    
    container.innerHTML = confirmedApts.map(apt => `
        <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200 hover:shadow-lg transition-shadow cursor-pointer" onclick="showPatientDetailsById('${apt.id}')">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold text-gray-900">${apt.patientName}</h4>
                    <p class="text-sm text-gray-600">الهاتف: ${apt.patientPhone}</p>
                </div>
                <span class="bg-purple-600 text-white px-2 py-1 rounded text-xs font-medium">مؤكد</span>
            </div>
            <div class="space-y-1 mb-4 text-sm text-gray-700">
                <p><strong>العمر:</strong> ${apt.patientAge} سنة</p>
                <p><strong>الجنس:</strong> ${apt.patientGender}</p>
                <p><strong>السبب:</strong> ${apt.reason}</p>
                <p><strong>الموعد:</strong> ${apt.appointmentDate} - ${apt.appointmentTime}</p>
            </div>
            <div class="bg-white rounded p-2 text-xs text-gray-600 mb-3">
                <p class="font-medium text-gray-900 mb-1">اضغط لرؤية البيانات الكاملة والسجل الطبي</p>
            </div>
            <button onclick="event.stopPropagation(); showPatientDetailsById('${apt.id}')" class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors text-sm">
                عرض التفاصيل الكاملة
            </button>
        </div>
    `).join('');
}
*/

// === FINISH VISIT DISPLAY ===

function displayFinishVisitAppointments() {
    const container = document.getElementById('finishVisitGrid');
    if (!container) return;
    
    // Get confirmed appointments ready to finish
    const readyToFinish = allAppointments.filter(apt => 
        apt.status === 'confirmed'
    );
    
    // Sort by date (today first, then upcoming)
    const today = new Date().toISOString().split('T')[0];
    readyToFinish.sort((a, b) => {
        const aIsToday = a.appointmentDate === today ? 0 : 1;
        const bIsToday = b.appointmentDate === today ? 0 : 1;
        if (aIsToday !== bIsToday) return aIsToday - bIsToday;
        const dateA = new Date(a.appointmentDate || '9999-12-31');
        const dateB = new Date(b.appointmentDate || '9999-12-31');
        return dateA - dateB;
    });
    
    const countElement = document.getElementById('finishVisitCount');
    if (countElement) {
        countElement.textContent = readyToFinish.length;
    }
    
    if (readyToFinish.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">لا توجد زيارات جاهزة للإنهاء حالياً</div>';
        return;
    }
    
    container.innerHTML = readyToFinish.map(apt => `
        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold text-gray-900">${apt.patientName}</h4>
                    <p class="text-sm text-gray-600">الهاتف: ${apt.patientPhone}</p>
                </div>
                <span class="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">جاهز للإنهاء</span>
            </div>
            <div class="space-y-1 mb-4 text-sm text-gray-700">
                <p><strong>العمر:</strong> ${apt.patientAge} سنة</p>
                <p><strong>الجنس:</strong> ${apt.patientGender}</p>
                <p><strong>السبب:</strong> ${apt.reason}</p>
                <p><strong>الموعد:</strong> ${apt.appointmentDate} - ${apt.appointmentTime}</p>
            </div>
            <button onclick="finishAppointmentWithNotes('${apt.id}')" class="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors">
                ✓ إنهاء الزيارة وإضافة ملاحظات
            </button>
        </div>
    `).join('');
}

// === INITIALIZATION ===

function initializeEnhancements() {
    loadFollowUpPatients();
    calculateRevenue();
    loadAppointmentNotes();
    filterAppointmentsByTab('all');
    setupAppointmentTabListeners();
    // displayConfirmedAppointments(); // Removed - we only show "Today's Confirmed" now
    // displayFinishVisitAppointments(); // Removed - functionality in Today's Confirmed section
}

// Call on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancements);
} else {
    initializeEnhancements();
}
