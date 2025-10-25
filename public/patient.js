// MedConnect Patient Portal Logic
'use strict';

// === Firebase Initialization ===
const firebaseConfig = window.__MC_ENV__?.FIREBASE_CONFIG;

const siteKey = window.__MC_ENV__?.APP_CHECK_KEY;

firebase.initializeApp(firebaseConfig);
// Initialize Firebase app

// Initialize App Check immediately so tokens are attached to initial Firestore requests
try {
    const appCheck = firebase.appCheck();
    if (siteKey) {
        appCheck.activate(siteKey, true);
    }
} catch (e) {
    console.warn('App Check init skipped:', e?.message || e);
}

const auth = firebase.auth();
const db = firebase.firestore();

// No emulator connections in production code.

// Set authentication persistence to 'local' to keep users signed in.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => {
        console.error("Error setting auth persistence:", error);
    });


// === Global State ===
let selectedDoctorId = null;
let selectedTimeSlot = null;
let selectedRescheduleTimeSlot = null;
let confirmationResult = null;
let doctors = {};
let doctorsLoaded = false;
let userAppointments = []; // To store the user's appointments for filtering
let lastVisibleReview = null; // For reviews pagination
let recaptchaVerifier = null;
let recaptchaInitPromise = null;
let activeChatListener = null; // To hold the active chat listener

// === Chat Functions ===
async function openChat(appointmentId) {
    const user = auth.currentUser;
    if (!user) return showNotification('يرجى تسجيل الدخول لبدء المحادثة', 'error');

    const appointment = userAppointments.find(apt => apt.id === appointmentId);
    if (!appointment) return showNotification('لم يتم العثور على الحجز', 'error');

    try {
        // Find the receptionist for the doctor
        const receptionistQuery = await db.collection('receptionists').where('doctorId', '==', appointment.doctorId).limit(1).get();
        if (receptionistQuery.empty) {
            return showNotification('لا يوجد موظف استقبال متاح لهذا الطبيب.', 'error');
        }
        const receptionistId = receptionistQuery.docs[0].id;

        // Look for an existing chat or create a new one
        let chatRef;
        const appointmentRef = db.collection('appointments').doc(appointmentId);
        const aptDoc = await appointmentRef.get();
        const existingChatId = aptDoc.data().chatId;

        if (existingChatId) {
            chatRef = db.collection('chats').doc(existingChatId);
        } else {
            chatRef = db.collection('chats').doc();
            await chatRef.set({
                participants: [user.uid, receptionistId],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: '',
                appointmentId: appointmentId
            });
            await appointmentRef.update({ chatId: chatRef.id });
        }

        showModal('chatModal');
        document.getElementById('chatModalTitle').textContent = `محادثة بخصوص حجز د. ${appointment.doctorName}`;

        // Listen for messages
        if (activeChatListener) activeChatListener(); // Detach old listener
        activeChatListener = chatRef.collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderChatMessages(messages, user.uid);
        });

        // Handle sending messages
        const chatForm = document.getElementById('chatForm');
        chatForm.onsubmit = async (e) => {
            e.preventDefault();
            const messageInput = document.getElementById('chatMessageInput');
            const text = messageInput.value.trim();
            if (text) {
                const messageData = {
                    text: text,
                    senderId: user.uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                await chatRef.collection('messages').add(messageData);
                await chatRef.update({ lastMessage: text, lastMessageTimestamp: messageData.timestamp });
                messageInput.value = '';
            }
        };

    } catch (error) {
        console.error('Error opening chat:', error);
        showNotification('حدث خطأ عند فتح المحادثة', 'error');
    }
}

function closeChatModal() {
    if (activeChatListener) {
        activeChatListener(); // Stop listening to messages
        activeChatListener = null;
    }
    closeModal('chatModal');
}

function renderChatMessages(messages, currentUserId) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = messages.map(msg => {
        const isSender = msg.senderId === currentUserId;
        const time = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString('ar-IQ') : '';
        return `
            <div class="flex ${isSender ? 'justify-end' : 'justify-start'}">
                <div class="${isSender ? 'bg-blue-500 text-white' : 'bg-white'} rounded-lg p-3 max-w-xs shadow-sm">
                    <p>${msg.text}</p>
                    <p class="text-xs ${isSender ? 'text-blue-200' : 'text-gray-500'} mt-1 text-left">${time}</p>
                </div>
            </div>
        `;
    }).join('');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


// === OTP Rate Limiting ===

const OTP_RATE_LIMIT = {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    attempts: JSON.parse(sessionStorage.getItem('medconnect_otp_attempts') || '[]'),
    canSend() {
        const now = Date.now();
        this.attempts = this.attempts.filter(time => now - time < this.windowMs);
        return this.attempts.length < this.maxAttempts;
    },
    recordAttempt() {
        this.attempts.push(Date.now());
        sessionStorage.setItem('medconnect_otp_attempts', JSON.stringify(this.attempts));
    },
    getTimeUntilReset() {
        if (this.attempts.length === 0) return 0;
        const oldestAttempt = Math.min(...this.attempts);
        return Math.max(0, this.windowMs - (Date.now() - oldestAttempt));
    },
    getRemainingAttempts() {
        const now = Date.now();
        this.attempts = this.attempts.filter(time => now - time < this.windowMs);
        return Math.max(0, this.maxAttempts - this.attempts.length);
    }
};

// === Initialization ===
document.addEventListener('DOMContentLoaded', function() {
    // Update connection status
    const statusElement = document.getElementById('connectionStatus');
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_ACTUAL_API_KEY") {
        statusElement.className = 'connection-status connected';
        loadDoctors();
    }

    // Production: do not expose App Check status in the UI.

    // Monitor Firebase Auth state
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('Auth state changed: User is signed in.', user.uid);
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    updateUserInterface({ uid: user.uid, ...doc.data() });
                } else {
                    // This case might happen if user record was deleted but auth session persists.
                    logout();
                }
            });
        } else {
            console.log('Auth state changed: User is signed out.');
            resetUserInterface();
        }
    });
    // Auto-hide connection status
    setTimeout(() => {
        if (statusElement) statusElement.style.display = 'none';
    }, 5000);

    // Search functionality
    let searchTimeout;
    const searchInput = document.getElementById('doctorSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(filterDoctors, 300);
        });
    }

    const specialtyFilter = document.getElementById('specialtyFilter');
    if (specialtyFilter) {
        specialtyFilter.addEventListener('change', filterDoctors);
    }

    // Appointments search
    const appointmentSearchInput = document.getElementById('appointmentSearchInput');
    if (appointmentSearchInput) {
        appointmentSearchInput.addEventListener('input', () => displayUserAppointments());
    }

    // Close modals on outside click
    document.addEventListener('click', function(e) {
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.classList.remove('show');
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Ensure the initial tab is correctly set
    switchTab('doctors');
});

// === Core Functions ===

function sanitizeHtml(text) {
    const temp = document.createElement('div');
    temp.textContent = text;
    return temp.innerHTML;
}

function generateInitials(name) {
    if (!name) return 'د.م';
    const parts = name.split(' ');
    return parts.length >= 2 ? `د.${parts[1].charAt(0)}` : `د.${parts[0].charAt(0)}`;
}

function convertTo12HourFormat(time24h) {
    if (!time24h) return 'غير محدد';
    try {
        const [hours, minutes] = time24h.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'م' : 'ص';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    } catch (e) {
        return time24h;
    }
}

function formatClinicHours(openingTime, closingTime) {
    if (!openingTime || !closingTime) return 'غير محدد';
    const opening = convertTo12HourFormat(openingTime);
    const closing = convertTo12HourFormat(closingTime);
    return `${opening} - ${closing}`;
}

async function loadDoctors() {
    if (doctorsLoaded) return;
    const doctorsGrid = document.getElementById('doctorsGrid');
    if (doctorsGrid) {
        doctorsGrid.innerHTML = `
            <div class="col-span-full flex justify-center items-center py-12">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p class="text-gray-600">جاري تحميل قائمة الأطباء...</p>
                </div>
            </div>`;
    }

    try {
        const allowEmails = window.__MC_ENV__?.ALLOWED_DOCTOR_EMAILS || [];
        const allowIds = window.__MC_ENV__?.ALLOWED_DOCTOR_IDS || [];
        let snapshot;

        if (Array.isArray(allowIds) && allowIds.length > 0) {
            const promises = allowIds.map(id => db.collection('doctors').doc(id).get());
            const docs = (await Promise.all(promises)).filter(d => d.exists && d.data()?.listed === true);
            snapshot = { empty: docs.length === 0, docs };
        } else {
            const baseSnap = await db.collection('doctors').where('listed', '==', true).get();
            let docs = baseSnap.docs;
            if (Array.isArray(allowEmails) && allowEmails.length > 0) {
                const allowedSet = new Set(allowEmails.map(e => String(e).toLowerCase()));
                docs = docs.filter(d => allowedSet.has(String(d.data()?.email || '').toLowerCase()));
            }
            snapshot = { empty: docs.length === 0, docs };
        }

        doctors = {};
        if (!snapshot.empty) {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!data || !data.name || !data.email || !data.specialty) {
                    console.warn('Invalid doctor data, skipping:', doc.id);
                    return;
                }
                const fee = (data.consultationFee || 15000) / 1000;
                doctors[doc.id] = {
                    id: doc.id,
                    name: data.name,
                    specialty: data.specialty,
                    phone: data.phone,
                    email: data.email,
                    fee: `${fee}`,
                    initials: data.initials || generateInitials(data.name),
                    photoURL: data.photoURL || null,
                    experience: data.experience || '5+ سنوات خبرة',
                    rating: data.rating || '4.5',
                    reviews: data.reviews || '50',
                    location: data.location || 'العيادة الطبية',
                    hours: data.hours || '9:00 ص - 5:00 م',
                    education: data.education || 'بكالوريوس طب وجراحة',
                    specializations: data.specializations || [data.specialty],
                    languages: data.languages || ['العربية'],
                    about: data.about || `طبيب متخصص في ${data.specialty} مع خبرة واسعة في المجال الطبي.`,
                    openingTime: data.openingTime,
                    closingTime: data.closingTime,
                    clinicClosed: data.clinicClosed,
                    closureEndDate: data.closureEndDate
                };
            });
        }

        doctorsLoaded = true;
        updateSpecialtyFilter();
        updateDoctorGrid();
        updateSpecialtiesTab();
        updateDoctorSelection();
        updateStatistics();

    } catch (error) {
        console.error('Error loading doctors:', error);
        doctorsLoaded = true;
        updateDoctorGrid(); // Will show empty state
        window.showNotification('لا تتوفر قائمة أطباء حالياً', 'info');
    }
}

function updateDoctorGrid() {
    const doctorsGrid = document.getElementById('doctorsGrid');
    if (!doctorsGrid) return;

    if (Object.keys(doctors).length === 0) {
        doctorsGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">لا يوجد أطباء متاحين حالياً</h3>
                <p class="text-gray-600">يرجى المحاولة مرة أخرى لاحقاً</p>
            </div>`;
        return;
    }

    doctorsGrid.innerHTML = Object.values(doctors).map(doctor => `
        <div class="bg-white rounded-xl shadow-sm border card-hover fade-in">
            <div class="p-6">
                <div class="flex items-center mb-4">
                    <div class="w-16 h-16 doctor-avatar rounded-full flex items-center justify-center ml-4 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600">
                        ${doctor.photoURL ? `<img src="${doctor.photoURL}" alt="${sanitizeHtml(doctor.name)}" class="w-full h-full object-cover">` : `<span class="text-white font-bold text-lg">${doctor.initials}</span>`}
                    </div>
                    <div class="flex-1">
                        <h3 class="text-xl font-bold text-gray-900 mb-1">${sanitizeHtml(doctor.name)}</h3>
                        <p class="text-blue-600 font-medium">${sanitizeHtml(doctor.specialty)}</p>
                    </div>
                </div>
                <div class="space-y-3 mb-6">
                    <div class="flex items-center text-gray-600"><svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span class="text-sm">${sanitizeHtml(doctor.location || 'العيادة الطبية')}</span></div>
                    <div class="flex items-center text-gray-600"><svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span class="text-sm">${sanitizeHtml(formatClinicHours(doctor.openingTime, doctor.closingTime))}</span></div>
                    <div class="flex items-center text-gray-600"><svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path></svg><span class="text-sm font-medium">${sanitizeHtml(doctor.fee)} ألف د.ع</span></div>
                </div>
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="flex items-center ml-2">${[1,2,3,4,5].map(star => `<svg class="w-4 h-4 ${star <= Math.floor(doctor.rating || 4.5) ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`).join('')}</div>
                        <span class="text-sm text-gray-600">(${doctor.reviews || '50'} تقييم)</span>
                    </div>
                    <span class="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-medium">متاح</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="showDoctorProfile('${doctor.id}')" class="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">عرض الملف</button>
                    <button onclick="showBookingModal('${doctor.id}')" class="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 text-sm font-medium">احجز الآن</button>
                </div>
            </div>
        </div>`).join('');
}

function updateSpecialtyFilter() {
    const specialties = [...new Set(Object.values(doctors).map(d => d.specialty))];
    const filter = document.getElementById('specialtyFilter');
    if (!filter) return;
    filter.innerHTML = '<option value="">جميع التخصصات</option>';
    specialties.forEach(spec => {
        const option = document.createElement('option');
        option.value = spec;
        option.textContent = spec;
        filter.appendChild(option);
    });
}

function updateSpecialtiesTab() {
    const specialtiesGrid = document.getElementById('specialtiesGrid');
    if (!specialtiesGrid) return;

    const specialtyCounts = Object.values(doctors).reduce((acc, doctor) => {
        acc[doctor.specialty] = (acc[doctor.specialty] || 0) + 1;
        return acc;
    }, {});

    if (Object.keys(specialtyCounts).length === 0) {
        specialtiesGrid.innerHTML = `<div class="col-span-full text-center py-8 text-gray-500">لا توجد تخصصات متاحة حالياً.</div>`;
        return;
    }

    specialtiesGrid.innerHTML = Object.entries(specialtyCounts).map(([specialty, count]) => `
        <div class="bg-white rounded-xl shadow-sm p-6 card-hover cursor-pointer" onclick="filterBySpecialty('${specialty}')">
            <div class="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1m-1-4h1m-1 4h1"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">${sanitizeHtml(specialty)}</h3>
            <p class="text-gray-600 mb-4">تخصص يعنى بـ...</p>
            <p class="text-sm text-blue-600 font-medium">${count} ${count > 2 ? 'أطباء' : 'أطباء'} متاحين</p>
        </div>
    `).join('');
}

function updateStatistics() {
    const doctorCountEl = document.getElementById('doctorCount');
    if (doctorCountEl) {
        doctorCountEl.textContent = Object.keys(doctors).length;
    }
}

function filterDoctors() {
    const searchTerm = document.getElementById('doctorSearch').value.toLowerCase();
    const selectedSpecialty = document.getElementById('specialtyFilter').value;
    const doctorCards = document.querySelectorAll('#doctorsGrid > div');

    doctorCards.forEach(card => {
        if (!card.querySelector('h3')) return; // Skip loading/empty state
        const doctorName = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const doctorSpecialty = card.querySelector('p.text-blue-600')?.textContent || '';
        const nameMatch = doctorName.includes(searchTerm);
        const specialtyMatch = !selectedSpecialty || doctorSpecialty === selectedSpecialty;
        card.style.display = (nameMatch && specialtyMatch) ? '' : 'none';
    });
}

// === Modal Management ===

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

function showBookingModal(doctorId = null) {
    if (!doctorsLoaded) {
        window.showNotification('جاري تحميل قائمة الأطباء...', 'info');
        loadDoctors().then(() => showBookingModal(doctorId));
        return;
    }

    const doctorSelectionDiv = document.getElementById('doctorSelection').parentElement;
    const user = auth.currentUser;
    if (user) {
        // Fetch the user's profile from Firestore to pre-fill the form
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                document.getElementById('patientName').value = userData.name || '';
                document.getElementById('patientPhone').value = userData.phone || '';
            }
        });
    } 

    if (doctorId && doctors[doctorId]) {
        doctorSelectionDiv.style.display = 'none';
        selectedDoctorId = doctorId;
        updateSelectedDoctorInfo(doctors[doctorId]);
        updateTimeSlots(doctorId);
    } else {
        doctorSelectionDiv.style.display = 'block';
        if (selectedDoctorId && doctors[selectedDoctorId]) {
            updateSelectedDoctorInfo(doctors[selectedDoctorId]);
            updateTimeSlots(selectedDoctorId);
        } else {
            document.getElementById('selectedDoctorName').textContent = 'يرجى اختيار طبيب';
            document.getElementById('selectedDoctorSpecialty').textContent = 'التخصص';
            document.getElementById('selectedDoctorFee').textContent = '0';
            document.getElementById('selectedDoctorInitials').textContent = 'د.م';
        }
    }

    showModal('bookingModal');
}

function closeBookingModal() {
    closeModal('bookingModal');
    document.getElementById('bookingModal').querySelector('form').reset();
    selectedTimeSlot = null;
    document.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
}

async function showDoctorProfile(doctorId) {
    const doctor = doctors[doctorId];
    if (!doctor) {
        window.showNotification('لم يتم العثور على معلومات الطبيب', 'error');
        return;
    }

    // Fetch real clinic hours from Firestore
    let clinicHours = doctor.hours || 'غير محدد';
    try {
        const doctorDoc = await db.collection('doctors').doc(doctorId).get();
        if (doctorDoc.exists) {
            const data = doctorDoc.data();
            const opening = data.openingTime || '08:00';
            const closing = data.closingTime || '15:00';
            clinicHours = formatClinicHours(opening, closing);
        }
    } catch (error) {
        console.error('Error fetching clinic hours:', error);
    }

    const profileContent = document.getElementById('doctorProfileContent');
    profileContent.innerHTML = `
        <div class="text-center mb-8">
            <div class="w-24 h-24 doctor-avatar rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600">${doctor.photoURL ? `<img src="${doctor.photoURL}" alt="${sanitizeHtml(doctor.name)}" class="w-full h-full object-cover">` : `<span class="text-white font-bold text-2xl">${doctor.initials}</span>`}</div>
            <h2 class="text-3xl font-bold text-gray-900 mb-2">${sanitizeHtml(doctor.name)}</h2>
            <p class="text-xl text-blue-600 font-medium mb-2">${sanitizeHtml(doctor.specialty)}</p>
            <p class="text-gray-600 mb-4">${sanitizeHtml(doctor.experience)}</p>
            <div class="flex items-center justify-center mb-4"><span class="text-yellow-500 ml-2">⭐⭐⭐⭐⭐</span><span class="text-gray-600">${doctor.rating} (${doctor.reviews} تقييم)</span></div>
            <div class="bg-green-50 rounded-lg p-4 inline-block"><p class="text-2xl font-bold text-green-600">${sanitizeHtml(doctor.fee)}</p><p class="text-sm text-gray-600">رسوم الاستشارة</p></div>
        </div>
        <div class="grid md:grid-cols-2 gap-8 mb-8">
            <div class="space-y-6">
                <div><h4 class="text-lg font-bold text-gray-900 mb-3">معلومات أساسية</h4><div class="space-y-3"><div class="flex items-start"><svg class="w-5 h-5 text-blue-600 ml-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg><span class="text-gray-700">${sanitizeHtml(doctor.location)}</span></div><div class="flex items-start"><svg class="w-5 h-5 text-blue-600 ml-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span class="text-gray-700">${sanitizeHtml(clinicHours)}</span></div><div class="flex items-start"><svg class="w-5 h-5 text-blue-600 ml-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg><span class="text-gray-700">${doctor.languages.join(', ')}</span></div></div></div>
                <div><h4 class="text-lg font-bold text-gray-900 mb-3">التخصصات</h4><div class="flex flex-wrap gap-2">${doctor.specializations.map(spec => `<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">${spec}</span>`).join('')}</div></div>
            </div>
            <div class="space-y-6">
                <div><h4 class="text-lg font-bold text-gray-900 mb-3">التعليم والمؤهلات</h4><div class="bg-gray-50 rounded-lg p-4"><p class="text-gray-700 whitespace-pre-line">${doctor.education}</p></div></div>
                <div><h4 class="text-lg font-bold text-gray-900 mb-3">نبذة عن الطبيب</h4><p class="text-gray-700 leading-relaxed">${doctor.about}</p></div>
            </div>
        </div>
        <div class="mt-8 pt-6 border-t">
            <h4 class="text-lg font-bold text-gray-900 mb-4">آراء المرضى (${doctor.reviews} تقييم)</h4>
            <div id="doctorReviewsContainer" class="space-y-4 max-h-64 overflow-y-auto"><p class="text-gray-500">جاري تحميل التقييمات...</p></div>
            <div id="loadMoreReviewsContainer" class="text-center mt-4" style="display: none;">
                <button id="loadMoreReviewsBtn" class="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 text-sm font-medium">
                    تحميل المزيد
                </button>
            </div>
        </div>
        <div class="text-center border-t pt-6"><button onclick="closeDoctorProfileModal(); showBookingModal('${doctorId}')" class="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 font-medium text-lg">احجز موعد مع ${doctor.name}</button></div>`;

    showModal('doctorProfileModal');
    loadAndDisplayReviews(doctorId, true); // Load the first page of reviews
}

function closeDoctorProfileModal() {
    closeModal('doctorProfileModal');
}

async function loadAndDisplayReviews(doctorId, isFirstPage = false) {
    const reviewsContainer = document.getElementById('doctorReviewsContainer');
    const loadMoreContainer = document.getElementById('loadMoreReviewsContainer');
    const loadMoreBtn = document.getElementById('loadMoreReviewsBtn');
    if (!reviewsContainer || !loadMoreContainer || !loadMoreBtn) return;

    if (isFirstPage) {
        reviewsContainer.innerHTML = '<p class="text-gray-500">جاري تحميل التقييمات...</p>';
        lastVisibleReview = null;
    }

    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'جاري التحميل...';

    try {
        let query = db.collection('ratings').where('doctorId', '==', doctorId).orderBy('createdAt', 'desc').limit(5);

        if (lastVisibleReview && !isFirstPage) {
            query = query.startAfter(lastVisibleReview);
        }

        const snapshot = await query.get();

        if (isFirstPage) {
            reviewsContainer.innerHTML = ''; // Clear loading message
        }

        if (snapshot.empty) {
            if (isFirstPage) {
                reviewsContainer.innerHTML = '<p class="text-gray-500">لا توجد تقييمات متاحة حالياً.</p>';
            }
            loadMoreContainer.style.display = 'none'; // No more reviews to load
            return;
        }

        snapshot.docs.forEach(doc => {
            const review = doc.data();
            reviewsContainer.innerHTML += `
                <div class="border-b border-gray-200 pb-4">
                    <div class="flex items-center mb-2">${[1,2,3,4,5].map(star => `<svg class="w-4 h-4 ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`).join('')}</div>
                    <p class="text-gray-700 italic">"${sanitizeHtml(review.comment) || 'لا يوجد تعليق'}"</p>
                </div>
            `;
        });

        // Update the last visible document for the next query
        lastVisibleReview = snapshot.docs[snapshot.docs.length - 1];

        // Show or hide the "Load More" button
        if (snapshot.docs.length < 5) {
            loadMoreContainer.style.display = 'none';
        } else {
            loadMoreContainer.style.display = 'block';
            loadMoreBtn.onclick = () => loadAndDisplayReviews(doctorId, false);
        }

    } catch (error) {
        console.error("Error loading reviews:", error);
        reviewsContainer.innerHTML = '<p class="text-red-500">حدث خطأ في تحميل التقييمات.</p>';
    } finally {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'تحميل المزيد';
    }
}

// === Booking and Appointment Logic ===

function updateDoctorSelection() {
    const doctorSelection = document.getElementById('doctorSelection');
    if (!doctorSelection) return;
    doctorSelection.innerHTML = Object.values(doctors).map(doctor => `
        <div class="doctor-option border-2 border-gray-300 rounded-lg p-4 cursor-pointer hover:border-blue-300 transition-colors" onclick="selectDoctor('${doctor.id}', this)">
            <div class="flex items-center">
                <div class="w-12 h-12 doctor-avatar rounded-full flex items-center justify-center ml-3"><span class="text-white font-bold">${doctor.initials}</span></div>
                <div class="flex-1">
                    <h4 class="font-bold text-gray-900">${sanitizeHtml(doctor.name)}</h4>
                    <p class="text-blue-600 text-sm">${sanitizeHtml(doctor.specialty)}</p>
                    <p class="text-gray-500 text-xs">${sanitizeHtml(doctor.fee)} ألف د.ع</p>
                </div>
            </div>
        </div>`).join('');
}

function selectDoctor(doctorId, element) {
    if (!doctors[doctorId]) return;
    selectedDoctorId = doctorId;
    document.querySelectorAll('.doctor-option').forEach(opt => opt.classList.remove('border-blue-500', 'bg-blue-50'));
    element.classList.add('border-blue-500', 'bg-blue-50');
    updateSelectedDoctorInfo(doctors[doctorId]);
    updateTimeSlots(doctorId);
    updateTimeSlots(doctorId);
}

function updateSelectedDoctorInfo(doctor) {
    document.getElementById('selectedDoctorInitials').textContent = doctor.initials;
    document.getElementById('selectedDoctorName').textContent = doctor.name;
    document.getElementById('selectedDoctorSpecialty').textContent = doctor.specialty;
    document.getElementById('selectedDoctorFee').textContent = doctor.fee;
}

function updateTimeSlots(doctorId) {
    const doctor = doctors[doctorId];
    if (!doctor) return;

    const timeSlotsContainer = document.getElementById('timeSlots');
    if (!timeSlotsContainer) return; // Time slots not needed in new flow
}

function generateTimeSlots(openingTime, closingTime) {
    const slots = [];
    const [openHours, openMinutes] = openingTime.split(':').map(Number);
    const [closeHours] = closingTime.split(':').map(Number);
    let currentTime = new Date();
    currentTime.setHours(openHours, openMinutes, 0, 0);
    const closingTimeDate = new Date();
    closingTimeDate.setHours(closeHours, 0, 0, 0);

    while (currentTime < closingTimeDate) {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'م' : 'ص';
        const hours12 = hours % 12 || 12;
        slots.push(`${hours12}:${minutes} ${ampm}`);
        currentTime.setMinutes(currentTime.getMinutes() + 30);
    }
    return slots;
}

function selectTimeSlot(slotElement, time) {
    document.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
    slotElement.classList.add('selected');
    selectedTimeSlot = time;
}

async function submitBooking(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { window.showNotification('يرجى تسجيل الدخول أولاً لحجز موعد', 'error'); closeBookingModal(); showLoginModal(); return; }

    const patientId = document.getElementById('patientSelector').value;
    const isFamilyMember = patientId !== user.uid;

    const chronicConditions = [];
    if (document.getElementById('hypertension').checked) chronicConditions.push('ضغط الدم المرتفع');
    if (document.getElementById('diabetes').checked) chronicConditions.push('السكري');
    if (document.getElementById('heartDisease').checked) chronicConditions.push('أمراض القلب');
    if (document.getElementById('asthma').checked) chronicConditions.push('الربو');
    const otherConditions = document.getElementById('otherConditions').value;
    if (otherConditions) chronicConditions.push(otherConditions);

    const appointmentData = {
        doctorId: selectedDoctorId,
        doctorName: doctors[selectedDoctorId].name,
        doctorSpecialty: doctors[selectedDoctorId].specialty,
        patientName: document.getElementById('patientName').value,
        patientPhone: document.getElementById('patientPhone').value,
        patientAge: parseInt(document.getElementById('patientAge').value),
        patientGender: document.getElementById('patientGender').value,
        appointmentDate: null,
        appointmentTime: null,
        reason: document.getElementById('appointmentReason').value,
        allergies: document.getElementById('allergies').value || '',
        chronicConditions: chronicConditions,
        currentMedications: document.getElementById('currentMedications').value || '',
        userId: user.uid, // The main user who is booking
        patientId: patientId, // The actual patient (can be a family member)
        isFamilyMember: isFamilyMember,
        userPhone: user.phoneNumber,
        status: 'awaiting_confirmation',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        appointmentId: generateAppointmentId()
    };
    console.log('DEBUG: Booking user UID:', user.uid);
    console.log('DEBUG: appointmentData:', JSON.stringify(appointmentData, null, 2));

    const submitBtn = document.getElementById('bookingSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري إرسال الطلب...';

    try {
        // Ensure Auth ID token and App Check token are fresh so server sees request.auth and App Check
        try {
            if (auth && auth.currentUser) {
                // Force-refresh ID token to avoid stale/expired token issues
                await auth.currentUser.getIdToken(/* forceRefresh= */ true);
            }
        } catch (idErr) {
            console.error('ID token refresh error:', idErr);
            window.showNotification('خطأ في المصادقة. يرجى تسجيل الدخول مرة أخرى.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'إرسال طلب الحجز';
            return;
        }

        try {
            const appCheck = firebase.appCheck();
            await appCheck.getToken(/* forceRefresh= */ true);
        } catch (acErr) {
            console.error('App Check token error:', acErr);
            window.showNotification('خطأ في حماية التطبيق (App Check). يرجى إعادة تحميل الصفحة أو التأكد من إعداد App Check.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'إرسال طلب الحجز';
            return;
        }

        // Skip conflict check - receptionist will handle conflicts when confirming
        // since date/time are null at this stage

        console.log('DEBUG: Attempting to add appointment to Firestore...');
        console.log('DEBUG: User UID:', user.uid);
        console.log('DEBUG: Auth token claims:', auth.currentUser?.getIdTokenResult ? 'available' : 'not available');
        
        const docRef = await db.collection('appointments').add(appointmentData);
        console.log('DEBUG: Appointment added successfully with ID:', docRef.id);
        
        await docRef.update({ firestoreId: docRef.id });
        console.log('DEBUG: Appointment updated with firestoreId');

        window.showNotification(`✅ تم إرسال طلب الحجز بنجاح!`, 'success');
        closeBookingModal();
    } catch (error) {
        console.error('Booking error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Full error object:', error);
        window.showNotification('حدث خطأ أثناء إرسال طلب الحجز.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال طلب الحجز';
    }
}

function generateAppointmentId() {
    return `MED${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// === Authentication ===

async function initializeRecaptcha() {
    if (recaptchaVerifier) return recaptchaVerifier;
    if (recaptchaInitPromise) return recaptchaInitPromise;

    recaptchaInitPromise = (async () => {
        try {
            recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible',
                'callback': () => console.log('reCAPTCHA solved'),
                'expired-callback': () => {
                    recaptchaVerifier = null;
                    recaptchaInitPromise = null;
                }
            });
            await recaptchaVerifier.render();
            return recaptchaVerifier;
        } catch (error) {
            console.error('reCAPTCHA initialization failed:', error);
            recaptchaVerifier = null;
            recaptchaInitPromise = null;
            throw error;
        }
    })();
    return recaptchaInitPromise;
}

function showLoginModal() {
    closeRegisterModal();
    showModal('loginModal');
}

function closeLoginModal() {
    closeModal('loginModal');
}

async function handleLogin(event) {
    event.preventDefault();
    const phone = document.getElementById('loginPhone').value;
    if (!validateIraqiPhone(phone)) {
        window.showNotification('يرجى إدخال رقم هاتف عراقي صحيح (07XXXXXXXXX)', 'error');
        return;
    }
    if (!OTP_RATE_LIMIT.canSend()) {
        const minutesLeft = Math.ceil(OTP_RATE_LIMIT.getTimeUntilReset() / 60000);
        window.showNotification(`تم تجاوز حد إرسال الرسائل. يرجى المحاولة مرة أخرى خلال ${minutesLeft} دقيقة`, 'error');
        return;
    }

    const loginBtn = event.target.querySelector('button[type="submit"]');
    loginBtn.disabled = true;
    loginBtn.textContent = 'جاري إرسال رمز التحقق...';

    try {
        const internationalPhone = '+964' + phone.substring(1);
        localStorage.setItem('medconnect_login_phone', phone);
        const appVerifier = await initializeRecaptcha();
        confirmationResult = await auth.signInWithPhoneNumber(internationalPhone, appVerifier);
        OTP_RATE_LIMIT.recordAttempt();
        closeLoginModal();
        showPhoneVerificationModal(phone, true);
        window.showNotification('✅ تم إرسال رمز التحقق إلى هاتفك', 'success');
    } catch (error) {
        console.error('Error during login:', error);
        let errorMessage = 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.';
        if (error.code === 'auth/network-request-failed') {
            errorMessage = 'فشل الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت أو تعطيل أي برامج حماية قد تمنع الاتصال.';
        }
        window.showNotification(errorMessage, 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'تسجيل الدخول';
    }
}

function showRegisterModal() {
    closeLoginModal();
    showModal('registerModal');
}

function closeRegisterModal() {
    closeModal('registerModal');
    document.getElementById('registerModal').querySelector('form').reset();
}

async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('registerName').value;
    const phone = document.getElementById('registerPhone').value;
    if (!validateIraqiPhone(phone)) {
        window.showNotification('يرجى إدخال رقم هاتف عراقي صحيح (07XXXXXXXXX)', 'error');
        return;
    }
    if (!OTP_RATE_LIMIT.canSend()) {
        const minutesLeft = Math.ceil(OTP_RATE_LIMIT.getTimeUntilReset() / 60000);
        window.showNotification(`تم تجاوز حد إرسال الرسائل. يرجى المحاولة مرة أخرى خلال ${minutesLeft} دقيقة`, 'error');
        return;
    }

    const registerBtn = document.getElementById('registerBtn');
    registerBtn.disabled = true;
    registerBtn.textContent = 'جاري إنشاء الحساب...';

    try {
        localStorage.setItem('medconnect_temp_user', JSON.stringify({ name, phone }));
        const internationalPhone = '+964' + phone.substring(1);
        const appVerifier = await initializeRecaptcha();
        confirmationResult = await auth.signInWithPhoneNumber(internationalPhone, appVerifier);
        OTP_RATE_LIMIT.recordAttempt();
        closeRegisterModal();
        showPhoneVerificationModal(phone);
        window.showNotification('✅ تم إرسال رمز التحقق إلى هاتفك', 'success');
    } catch (error) {
        console.error('Error during phone verification:', error);
        const errorMessage = {
            'auth/too-many-requests': 'تم إرسال عدد كبير من الطلبات. يرجى المحاولة لاحقاً',
            'auth/invalid-phone-number': 'رقم الهاتف غير صحيح',
            'auth/quota-exceeded': 'تم تجاوز حد الرسائل اليومي',
        }[error.code] || 'حدث خطأ أثناء إرسال رمز التحقق';
        window.showNotification(errorMessage, 'error');
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'إنشاء الحساب';
    }
}

function showPhoneVerificationModal(phone, isLogin = false) {
    document.getElementById('verificationPhoneNumber').textContent = phone;
    localStorage.setItem('medconnect_is_login', isLogin.toString());
    showModal('phoneVerificationModal');
    startCountdown();
    document.querySelector('.verification-input').focus();
}

function closePhoneVerificationModal() {
    closeModal('phoneVerificationModal');
    document.querySelectorAll('.verification-input').forEach(input => input.value = '');
}

async function handlePhoneVerification(event) {
    event.preventDefault();
    const inputs = document.querySelectorAll('.verification-input');
    let enteredCode = Array.from(inputs).map(input => input.value.trim()).join('').replace(/\D/g, '');

    if (enteredCode.length !== 6) {
        window.showNotification('يرجى إدخال الرمز المكون من 6 أرقام', 'error');
        return;
    }

    const verifyBtn = document.getElementById('verifyBtn');
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'جاري التحقق...';

    try {
        if (!confirmationResult) throw new Error('No confirmation result');
        const result = await confirmationResult.confirm(enteredCode);
        const user = result.user;
        const isLogin = localStorage.getItem('medconnect_is_login') === 'true';

        // Ensure patient claim is set and refresh token
        try {
            console.log('DEBUG: Attempting to ensure patient claim for user:', user.uid);
            const ensureClaimsFn = firebase.functions().httpsCallable('ensurePatientClaim');
            const result = await ensureClaimsFn({});
            console.log('DEBUG: ensurePatientClaim result:', result);
            
            // Force refresh ID token to pick up new claims
            await user.getIdToken(true);
            console.log('DEBUG: ID token refreshed with new claims');
        } catch (claimError) {
            console.error('ERROR: Could not ensure patient claim:', claimError.code, claimError.message);
            console.error('Full error:', claimError);
            // Continue anyway - the onUserCreate trigger should have set it
        }

        if (isLogin) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                // onAuthStateChanged will handle the UI update.
                window.showNotification(`مرحباً ${userDoc.data().name}! تم تسجيل الدخول بنجاح`, 'success');
            } else {
                throw new Error('User not found');
            }
        } else {
            const tempUser = JSON.parse(localStorage.getItem('medconnect_temp_user'));
            if (!tempUser) throw new Error('No temporary user data');
            const newUser = {
                uid: user.uid,
                name: tempUser.name,
                phone: tempUser.phone,
                verified: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(user.uid).set(newUser);
            // onAuthStateChanged will handle the UI update.
            window.showNotification(`مرحباً ${newUser.name}! تم إنشاء حسابك بنجاح`, 'success');
        }
        closePhoneVerificationModal();
    } catch (error) {
        console.error('Error verifying SMS code:', error);
        const message = {
            'auth/invalid-verification-code': 'رمز التحقق غير صحيح.',
            'auth/code-expired': 'انتهت صلاحية الرمز. يرجى طلب رمز جديد.',
        }[error.code] || 'رمز التحقق المدخل غير صحيح';
        window.showNotification(message, 'error');
        inputs.forEach(input => {
            input.value = '';
            input.classList.add('border-red-500');
        });
        inputs[0].focus();
        setTimeout(() => inputs.forEach(input => input.classList.remove('border-red-500')), 3000);
    } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'تأكيد الرمز';
    }
}

function handleKeyDown(event, index) {
    const inputs = document.querySelectorAll('.verification-input');
    if (event.key === 'Backspace' && inputs[index].value === '' && index > 0) {
        inputs[index - 1].focus();
    } else if (!/^\d$/.test(event.key) && event.key !== 'Backspace') {
        event.preventDefault();
    }
}

function moveToNext(currentInput, index) {
    currentInput.value = currentInput.value.replace(/\D/g, '');
    if (currentInput.value.length === 1) {
        const inputs = document.querySelectorAll('.verification-input');
        if (index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    }
}

function startCountdown() {
    let seconds = 60;
    const countdownElement = document.getElementById('countdown');
    const resendBtn = document.getElementById('resendBtn');
    resendBtn.style.pointerEvents = 'none';
    resendBtn.style.opacity = '0.5';
    const interval = setInterval(() => {
        seconds--;
        countdownElement.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(interval);
            resendBtn.style.pointerEvents = 'auto';
            resendBtn.style.opacity = '1';
            resendBtn.innerHTML = 'إعادة الإرسال';
        }
    }, 1000);
}

async function resendVerificationCode() {
    if (!OTP_RATE_LIMIT.canSend()) {
        const minutesLeft = Math.ceil(OTP_RATE_LIMIT.getTimeUntilReset() / 60000);
        window.showNotification(`تم تجاوز حد إرسال الرسائل. يرجى المحاولة مرة أخرى خلال ${minutesLeft} دقيقة`, 'error');
        return;
    }
    const phone = document.getElementById('verificationPhoneNumber').textContent;
    const resendBtn = document.getElementById('resendBtn');
    resendBtn.disabled = true;
    resendBtn.textContent = 'جاري الإرسال...';

    try {
        const internationalPhone = '+964' + phone.substring(1);
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }
        document.getElementById('recaptcha-container').innerHTML = '';
        const appVerifier = await initializeRecaptcha();
        confirmationResult = await auth.signInWithPhoneNumber(internationalPhone, appVerifier);
        OTP_RATE_LIMIT.recordAttempt();
        window.showNotification('✅ تم إرسال رمز جديد إلى هاتفك', 'success');
        startCountdown();
    } catch (error) {
        console.error('Error resending code:', error);
        window.showNotification('حدث خطأ أثناء إعادة الإرسال', 'error');
    } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = 'إعادة الإرسال';
    }
}

function validateIraqiPhone(phone) {
    return /^07[0-9]{9}$/.test(phone);
}

// === User Interface Updates ===

function updateUserInterface(user) {
    const navButtons = document.querySelector('nav .flex.items-center.space-x-4.space-x-reverse');
    navButtons.innerHTML = `
        <div class="flex items-center space-x-3 space-x-reverse">
            <button onclick="showUserAppointments()" class="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">مواعيدي</button>
            <div class="text-right">
                <p class="text-sm font-medium text-gray-900">${user.name}</p>
                <p class="text-xs text-gray-500">${user.phone}</p>
            </div>
            <div class="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center"><span class="text-white font-bold text-sm">${user.name.charAt(0)}</span></div>
            <button onclick="logout()" class="text-gray-600 hover:text-gray-900 transition-colors text-sm">تسجيل الخروج</button>
        </div>`;
}

function resetUserInterface() {
    const navButtons = document.querySelector('nav .flex.items-center.space-x-4.space-x-reverse');
    navButtons.innerHTML = `
        <button onclick="showBookingModal()" class="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 font-medium">
            احجز موعد
        </button>
        <button onclick="showLoginModal()" class="text-gray-600 hover:text-gray-900 transition-colors" aria-label="تسجيل الدخول" title="تسجيل الدخول">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
        </button>`;
}

async function logout() {
    await auth.signOut();
    // onAuthStateChanged will automatically call resetUserInterface.
    window.showNotification('تم تسجيل الخروج بنجاح', 'success');
}

async function showUserAppointments() {
    const user = auth.currentUser;
    if (!user) {
        window.showNotification('يرجى تسجيل الدخول أولاً', 'error');
        return;
    }
    showModal('appointmentsModal');

    try {
        const appointmentsQuery = await db.collection('appointments').where('userId', '==', user.uid).orderBy('createdAt', 'desc').get();
        userAppointments = appointmentsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayUserAppointments();
    } catch (error) {
        console.error('Error fetching appointments:', error);
        let errorMessage = 'حدث خطأ في تحميل المواعيد.';
        // If Firestore provides an index creation link, show it to the developer.
        if (error.code === 'failed-precondition' && error.message.includes('https://console.firebase.google.com')) {
            const urlMatch = error.message.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                errorMessage = `تحتاج قاعدة البيانات إلى فهرس جديد. <a href="${urlMatch[0]}" target="_blank" class="text-blue-500 underline">اضغط هنا لإنشاء الفهرس</a> ثم حاول مرة أخرى.`;
            }
        }
        document.getElementById('appointmentsContent').innerHTML = `<div class="text-center py-8 text-red-500">${errorMessage}</div>`;
    }
}

function displayUserAppointments() {
    const content = document.getElementById('appointmentsContent');
    const searchTerm = document.getElementById('appointmentSearchInput').value.toLowerCase();

    const appointments = userAppointments.filter(apt => {
        if (!searchTerm) return true;
        const doctorName = apt.doctorName?.toLowerCase() || '';
        const specialty = apt.doctorSpecialty?.toLowerCase() || '';
        const reason = apt.reason?.toLowerCase() || '';
        return doctorName.includes(searchTerm) || specialty.includes(searchTerm) || reason.includes(searchTerm);
    });

    if (appointments.length === 0) {
        const message = searchTerm ? 'لا توجد مواعيد تطابق بحثك.' : 'لم تقم بحجز أي مواعيد بعد.';
        content.innerHTML = `<div class="text-center py-8"><h3 class="text-lg font-medium text-gray-900 mb-2">${message}</h3><p class="text-gray-600 mb-4">يمكنك حجز موعد جديد من الصفحة الرئيسية.</p><button onclick="closeAppointmentsModal(); showBookingModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">احجز موعدك الأول</button></div>`;
        return;
    }

    const statusMap = {
        'awaiting_confirmation': { text: 'في انتظار التأكيد', class: 'bg-orange-100 text-orange-800' },
        'confirmed': { text: 'مؤكد', class: 'bg-green-100 text-green-800' },
        'cancelled': { text: 'ملغي', class: 'bg-red-100 text-red-800' },
        'completed': { text: 'مكتمل', class: 'bg-blue-100 text-blue-800' },
    };

    content.innerHTML = appointments.map(apt => {
        const statusInfo = statusMap[apt.status] || { text: apt.status, class: 'bg-gray-100 text-gray-800' };
        const aptDate = new Date(apt.appointmentDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isUpcoming = aptDate >= today && (apt.status === 'awaiting_confirmation' || apt.status === 'confirmed');
        const isCompletedAndNotRated = apt.status === 'completed' && !apt.rated;

        return `
            <div class="bg-white border rounded-xl p-6 mb-4 shadow-sm">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h4 class="text-lg font-bold text-gray-900">${apt.doctorName}</h4>
                        <p class="text-blue-600 font-medium">${apt.doctorSpecialty}</p>
                        <p class="text-sm text-gray-500">رقم الحجز: ${apt.appointmentId}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${statusInfo.class}">${statusInfo.text}</span>
                </div>
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div class="flex items-center text-gray-600"><svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>${apt.appointmentDate}</div>
                    <div class="flex items-center text-gray-600"><svg class="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${apt.appointmentTime}</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3 mb-4"><p class="text-sm text-gray-700"><strong>سبب الزيارة:</strong> ${apt.reason}</p></div>
                <div class="flex space-x-2 space-x-reverse">
                    ${isCompletedAndNotRated ? `<button onclick="showRatingModal('${apt.id}')" class="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg hover:bg-yellow-200 text-sm font-medium">تقييم الزيارة</button>` : ''}
                    ${apt.status === 'completed' ? `<button onclick="bookFollowUp('${apt.id}')" class="bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 text-sm font-medium">حجز مراجعة</button>` : ''}
                    ${isUpcoming ? `<button onclick="showRescheduleModal('${apt.id}')" class="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg hover:bg-yellow-200 text-sm font-medium">إعادة جدولة</button>` : ''}
                    ${isUpcoming ? `<button onclick="showCancellationModal('${apt.id}')" class="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 text-sm font-medium">إلغاء</button>` : ''}
                    <button onclick="showAppointmentDetails('${apt.id}')" class="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 text-sm font-medium">عرض التفاصيل</button>
                </div>
            </div>`;
    }).join('');
}

function showRatingModal(appointmentId) {
    showModal('ratingModal');
    const starContainer = document.getElementById('starRating');
    starContainer.dataset.rating = "0";
    document.getElementById('ratingComment').value = '';
    updateStars(0);

    starContainer.onclick = (e) => {
        const star = e.target.closest('.star');
        if (star) {
            const rating = star.dataset.value;
            starContainer.dataset.rating = rating;
            updateStars(rating);
        }
    };

    document.getElementById('submitRatingBtn').onclick = () => submitRating(appointmentId);
}

function updateStars(rating) {
    document.querySelectorAll('#starRating .star').forEach(star => {
        if (star.dataset.value <= rating) {
            star.classList.remove('text-gray-300');
            star.classList.add('text-yellow-400');
        } else {
            star.classList.remove('text-yellow-400');
            star.classList.add('text-gray-300');
        }
    });
}

function closeRatingModal() {
    closeModal('ratingModal');
}

async function submitRating(appointmentId) {
    const rating = parseInt(document.getElementById('starRating').dataset.rating);
    const comment = document.getElementById('ratingComment').value.trim();

    if (rating === 0) {
        return window.showNotification('يرجى اختيار تقييم (نجمة واحدة على الأقل)', 'error');
    }

    const appointment = userAppointments.find(apt => apt.id === appointmentId);
    if (!appointment) return window.showNotification('لم يتم العثور على الموعد', 'error');

    const submitBtn = document.getElementById('submitRatingBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال...';

    try {
        const ratingData = {
            doctorId: appointment.doctorId,
            patientId: appointment.userId,
            appointmentId: appointmentId,
            rating: rating,
            comment: comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        // The onRatingCreate cloud function will handle updating the doctor's average rating.
        await db.collection('ratings').add(ratingData);
        await db.collection('appointments').doc(appointmentId).update({ rated: true });

        window.showNotification('شكراً لتقييمك!', 'success');
        closeRatingModal();
        showUserAppointments(); // Refresh the list to hide the button
    } catch (error) {
        console.error('Error submitting rating:', error);
        window.showNotification('حدث خطأ أثناء إرسال التقييم', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال التقييم';
    }
}

function showCancellationModal(appointmentId) {
    showModal('cancellationModal');
    document.getElementById('cancellationReason').value = '';
    const confirmBtn = document.getElementById('confirmCancelBtn');
    // Clone and replace the button to remove old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => cancelAppointment(appointmentId);
}

function closeCancellationModal() {
    closeModal('cancellationModal');
}

function closeAppointmentsModal() {
    closeModal('appointmentsModal');
}

async function cancelAppointment(appointmentId) {
    const reason = document.getElementById('cancellationReason').value.trim();
    const confirmBtn = document.getElementById('confirmCancelBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'جاري الإلغاء...';

    try {
        const updatePayload = {
            status: 'cancelled',
            cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
            cancelledBy: 'patient',
            cancellationReason: reason || 'لم يحدد سبب'
        };
        await db.collection('appointments').doc(appointmentId).update(updatePayload);
        window.showNotification('تم إلغاء الموعد بنجاح', 'success');
        closeCancellationModal();
        showUserAppointments(); // Refresh list
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        window.showNotification('حدث خطأ أثناء إلغاء الموعد', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'نعم، إلغاء الموعد';
    }
}

function bookFollowUp(appointmentId) {
    const originalAppointment = userAppointments.find(apt => apt.id === appointmentId);
    if (!originalAppointment) {
        return window.showNotification('لم يتم العثور على الموعد الأصلي', 'error');
    }

    const doctorId = originalAppointment.doctorId;
    if (!doctors[doctorId]) {
        return window.showNotification('لم يعد الطبيب متاحاً للحجز', 'error');
    }

    showBookingModal(doctorId);
}

async function showRescheduleModal(appointmentId) {
    const appointmentDoc = await db.collection('appointments').doc(appointmentId).get();
    if (!appointmentDoc.exists) {
        return window.showNotification('لم يتم العثور على الموعد', 'error');
    }
    const appointment = appointmentDoc.data();
    const doctor = doctors[appointment.doctorId];
    if (!doctor) {
        return window.showNotification('لم يتم العثور على الطبيب لهذا الموعد', 'error');
    }

    showModal('rescheduleModal');

    // Display current appointment info
    document.getElementById('currentAppointmentInfo').textContent = `${appointment.appointmentDate} الساعة ${appointment.appointmentTime}`;

    // Set up date input
    const dateInput = document.getElementById('rescheduleDate');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('rescheduleReason').value = ''; // Clear reason field
    dateInput.setAttribute('min', today);
    dateInput.value = ''; // Clear previous value
    dateInput.onchange = () => {
        // For now, we assume the same time slots are available every day.
        // A more advanced implementation would check the doctor's schedule for the specific date.
        const timeSlotsContainer = document.getElementById('rescheduleTimeSlots');
        const timeSlots = generateTimeSlots(doctor.openingTime, doctor.closingTime);
        timeSlotsContainer.innerHTML = timeSlots.map(time =>
            `<button type="button" class="time-slot p-3 border border-gray-300 rounded-lg hover:border-blue-500" onclick="selectRescheduleTime(this, '${time}')">${time}</button>`
        ).join('');
    };

    // Set up submit button
    document.getElementById('rescheduleSubmitBtn').onclick = () => submitReschedule(appointmentId);
}

function selectRescheduleTime(slotElement, time) {
    document.querySelectorAll('#rescheduleTimeSlots .time-slot').forEach(slot => slot.classList.remove('selected'));
    slotElement.classList.add('selected');
    selectedRescheduleTimeSlot = time;
}

function closeRescheduleModal() {
    closeModal('rescheduleModal');
    selectedRescheduleTimeSlot = null;
}

async function submitReschedule(appointmentId) {
    const newDate = document.getElementById('rescheduleDate').value;
    const reason = document.getElementById('rescheduleReason').value.trim();
    if (!newDate || !selectedRescheduleTimeSlot) {
        return window.showNotification('يرجى اختيار تاريخ ووقت جديدين', 'error');
    }

    const submitBtn = document.getElementById('rescheduleSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال...';

    try {
        const updatePayload = {
            status: 'reschedule_requested',
            rescheduledDate: newDate,
            rescheduledTime: selectedRescheduleTimeSlot,
            rescheduleReason: reason || 'لم يحدد سبب', // Add the reason here
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('appointments').doc(appointmentId).update(updatePayload);

        window.showNotification('تم إرسال طلب إعادة الجدولة بنجاح', 'success');
        closeRescheduleModal();
        showUserAppointments(); // Refresh the list
    } catch (error) {
        console.error('Error submitting reschedule request:', error);
        window.showNotification('حدث خطأ أثناء إرسال الطلب', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إرسال طلب إعادة الجدولة';
    }
}

async function showAppointmentDetails(appointmentId) {
    try {
        const appointmentDoc = await db.collection('appointments').doc(appointmentId).get();
        if (!appointmentDoc.exists) {
            window.showNotification('لم يتم العثور على تفاصيل الموعد', 'error');
            return;
        }
        const appointment = appointmentDoc.data();
        const statusMap = { 'awaiting_confirmation': 'في انتظار التأكيد', 'confirmed': 'مؤكد', 'cancelled': 'ملغي', 'completed': 'مكتمل' };
        const detailsHTML = `
            <div class="bg-white p-6 rounded-lg">
                <h3 class="text-xl font-bold mb-4">تفاصيل الموعد</h3>
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div><strong>رقم الحجز:</strong> ${sanitizeHtml(appointment.appointmentId)}</div>
                    <div><strong>الحالة:</strong> ${statusMap[appointment.status] || 'غير محدد'}</div>
                    <div><strong>اسم الطبيب:</strong> ${sanitizeHtml(appointment.doctorName)}</div>
                    <div><strong>التخصص:</strong> ${sanitizeHtml(appointment.doctorSpecialty)}</div>
                    <div><strong>التاريخ:</strong> ${appointment.appointmentDate}</div>
                    <div><strong>الوقت:</strong> ${appointment.appointmentTime}</div>
                </div>
                <div class="mb-4"><strong>سبب الزيارة:</strong><p class="bg-gray-50 p-3 rounded mt-2">${sanitizeHtml(appointment.reason)}</p></div>
                ${appointment.allergies ? `<div class="mb-4"><strong>الحساسية:</strong><p class="bg-red-50 p-3 rounded mt-2">${sanitizeHtml(appointment.allergies)}</p></div>` : ''}
            </div>`;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4"><div class="flex items-center justify-between mb-6"><h3 class="text-2xl font-bold text-gray-900">تفاصيل الموعد</h3><button onclick="this.closest('.modal').remove(); document.body.style.overflow='auto'" class="text-gray-400 hover:text-gray-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>${detailsHTML}</div>`;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Error loading appointment details:', error);
        window.showNotification('حدث خطأ في تحميل تفاصيل الموعد', 'error');
    }
}

// === Tab Management ===

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
        button.classList.add('text-gray-600');
    });
    document.getElementById(tabName + 'Content').classList.remove('hidden');
    const activeTab = document.getElementById(tabName + 'Tab');
    activeTab.classList.add('active');
    activeTab.classList.remove('text-gray-600');
}

function filterBySpecialty(specialty) {
    document.getElementById('specialtyFilter').value = specialty;
    filterDoctors();
    switchTab('doctors');
}

async function loadFamilyMembers() {
    const familyMembersList = document.getElementById('familyMembersList');
    if (!familyMembersList) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    familyMembersList.innerHTML = `<div class="text-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>`;
    showModal('familyManagerModal');

    const snapshot = await db.collection('users').doc(user.uid).collection('familyMembers').get();
    if (snapshot.empty) {
        familyMembersList.innerHTML = `<p class="text-center text-gray-500">لا يوجد أفراد عائلة مضافون حالياً.</p>`;
        return;
    }

    familyMembersList.innerHTML = snapshot.docs.map(doc => {
        const member = doc.data();
        return `
            <div class="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <div>
                    <p class="font-bold text-gray-800">${sanitizeHtml(member.name)}</p>
                    <p class="text-sm text-gray-600">${sanitizeHtml(member.relationship)} - ${member.age} سنة</p>
                </div>
                <div class="space-x-2 space-x-reverse">
                    <button onclick="editFamilyMember('${doc.id}')" class="text-blue-600 hover:text-blue-800">تعديل</button>
                    <button onclick="deleteFamilyMember('${doc.id}')" class="text-red-600 hover:text-red-800">حذف</button>
                </div>
            </div>
        `;
    }).join('');
}

function closeFamilyManager() {
    closeModal('familyManagerModal');
}

function showAddFamilyMemberModal() {
    document.getElementById('familyMemberForm').reset();
    document.getElementById('familyMemberId').value = '';
    document.getElementById('familyMemberModalTitle').textContent = 'إضافة فرد جديد';
    showModal('familyMemberModal');
}

function closeAddFamilyMemberModal() {
    closeModal('familyMemberModal');
}

async function saveFamilyMember(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const memberId = document.getElementById('familyMemberId').value;
    const memberData = {
        name: document.getElementById('familyName').value,
        age: parseInt(document.getElementById('familyAge').value),
        gender: document.getElementById('familyGender').value,
        relationship: document.getElementById('familyRelationship').value,
    };

    const familyCollection = db.collection('users').doc(user.uid).collection('familyMembers');

    try {
        if (memberId) {
            await familyCollection.doc(memberId).update(memberData);
            window.showNotification('تم تحديث بيانات فرد العائلة بنجاح', 'success');
        } else {
            await familyCollection.add(memberData);
            window.showNotification('تمت إضافة فرد العائلة بنجاح', 'success');
        }
        closeAddFamilyMemberModal();
        showFamilyManager(); // Refresh the list
    } catch (error) {
        console.error('Error saving family member:', error);
        window.showNotification('حدث خطأ أثناء حفظ البيانات', 'error');
    }
}

async function editFamilyMember(memberId) {
    const user = auth.currentUser;
    if (!user) return;

    const doc = await db.collection('users').doc(user.uid).collection('familyMembers').doc(memberId).get();
    if (!doc.exists) return;

    const member = doc.data();
    document.getElementById('familyMemberId').value = doc.id;
    document.getElementById('familyName').value = member.name;
    document.getElementById('familyAge').value = member.age;
    document.getElementById('familyGender').value = member.gender;
    document.getElementById('familyRelationship').value = member.relationship;
    document.getElementById('familyMemberModalTitle').textContent = 'تعديل بيانات فرد العائلة';
    showModal('familyMemberModal');
}

async function deleteFamilyMember(memberId) {
    if (!confirm('هل أنت متأكد من حذف هذا الفرد من العائلة؟')) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('users').doc(user.uid).collection('familyMembers').doc(memberId).delete();
        window.showNotification('تم حذف فرد العائلة بنجاح', 'success');
        showFamilyManager(); // Refresh the list
    } catch (error) {
        console.error('Error deleting family member:', error);
        window.showNotification('حدث خطأ أثناء الحذف', 'error');
    }
}

async function handlePatientSelection(patientId) {
    const user = auth.currentUser;
    if (!user) return;

    if (patientId === user.uid) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('patientName').value = userData.name || '';
            document.getElementById('patientPhone').value = userData.phone || '';
            document.getElementById('patientAge').value = ''; // Age is not stored for the main user
            document.getElementById('patientGender').value = '';
        }
    } else {
        const memberDoc = await db.collection('users').doc(user.uid).collection('familyMembers').doc(patientId).get();
        if (memberDoc.exists) {
            const memberData = memberDoc.data();
            document.getElementById('patientName').value = memberData.name || '';
            document.getElementById('patientPhone').value = user.phoneNumber || ''; // Use main user's phone
            document.getElementById('patientAge').value = memberData.age || '';
            document.getElementById('patientGender').value = memberData.gender || '';
        }
    }
}