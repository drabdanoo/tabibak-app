// ============================================================================
// ENHANCED EMR (ELECTRONIC MEDICAL RECORD) SYSTEM
// Comprehensive patient medical history, diagnoses, treatment plans, and vital signs
// ============================================================================

'use strict';

// === State ===
let currentPatientEMR = null;
let currentPatientId = null;

// === Common ICD-10 Diagnoses (Arabic) ===
const commonDiagnoses = [
    { code: 'E11', name: 'داء السكري من النوع الثاني' },
    { code: 'I10', name: 'ارتفاع ضغط الدم الأساسي' },
    { code: 'J06.9', name: 'التهاب الجهاز التنفسي العلوي الحاد' },
    { code: 'K21.9', name: 'ارتجاع المريء المعدي' },
    { code: 'M79.3', name: 'ألم عضلي' },
    { code: 'R50.9', name: 'حمى غير محددة' },
    { code: 'J00', name: 'التهاب الأنف الحاد (الزكام)' },
    { code: 'K59.0', name: 'إمساك' },
    { code: 'R51', name: 'صداع' },
    { code: 'J20.9', name: 'التهاب الشعب الهوائية الحاد' }
];

// === Load Patient EMR ===

async function loadPatientEMR(patientId, patientPhone) {
    currentPatientId = patientId;
    
    try {
        console.log('Loading EMR for patient:', patientId);
        
        // Try to find by patient ID first, then by phone
        let emrQuery = db.collection('medicalHistory')
            .where('patientId', '==', patientId)
            .limit(1);
        
        let emrSnap = await emrQuery.get();
        
        // If not found by ID and phone is available, try by phone
        if (emrSnap.empty && patientPhone) {
            emrQuery = db.collection('medicalHistory')
                .where('patientPhone', '==', patientPhone)
                .limit(1);
            emrSnap = await emrQuery.get();
        }
        
        if (!emrSnap.empty) {
            currentPatientEMR = {
                id: emrSnap.docs[0].id,
                ...emrSnap.docs[0].data()
            };
        } else {
            // Create new EMR if doesn't exist
            currentPatientEMR = {
                patientId,
                patientPhone: patientPhone || '',
                diagnoses: [],
                treatmentPlans: [],
                vitalSigns: [],
                allergies: [],
                chronicConditions: [],
                surgeries: [],
                familyHistory: '',
                socialHistory: '',
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }
        
        displayPatientEMR();
    } catch (error) {
        console.error('Error loading patient EMR:', error);
        showNotification('خطأ في تحميل السجل الطبي', 'error');
    }
}

function displayPatientEMR() {
    if (!currentPatientEMR) return;
    
    // Display diagnoses
    displayDiagnoses();
    
    // Display treatment plans
    displayTreatmentPlans();
    
    // Display vital signs
    displayVitalSigns();
    
    // Display medical history
    displayMedicalHistory();
}

// === Diagnoses Management ===

function displayDiagnoses() {
    const container = document.getElementById('diagnosesContainer');
    if (!container) return;
    
    const diagnoses = currentPatientEMR?.diagnoses || [];
    
    if (diagnoses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>لا توجد تشخيصات مسجلة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = diagnoses.map((diagnosis, index) => `
        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center space-x-2 space-x-reverse mb-2">
                        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-mono">${diagnosis.code}</span>
                        <h4 class="font-bold text-gray-900">${diagnosis.description}</h4>
                    </div>
                    <p class="text-sm text-gray-600">
                        <strong>التاريخ:</strong> ${diagnosis.date ? new Date(diagnosis.date.toDate()).toLocaleDateString('ar-IQ') : 'غير محدد'}
                    </p>
                    ${diagnosis.notes ? `<p class="text-sm text-gray-700 mt-2">${diagnosis.notes}</p>` : ''}
                    ${diagnosis.status ? `<span class="inline-block mt-2 px-2 py-1 text-xs rounded-full ${diagnosis.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${diagnosis.status === 'active' ? 'نشط' : 'محلول'}</span>` : ''}
                </div>
                <button onclick="removeDiagnosis(${index})" class="text-red-500 hover:text-red-700 ml-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function showAddDiagnosisModal() {
    document.getElementById('diagnosisCode').value = '';
    document.getElementById('diagnosisDescription').value = '';
    document.getElementById('diagnosisDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('diagnosisStatus').value = 'active';
    document.getElementById('diagnosisNotes').value = '';
    
    // Populate common diagnoses datalist
    const datalist = document.getElementById('commonDiagnoses');
    datalist.innerHTML = commonDiagnoses.map(d => 
        `<option value="${d.code} - ${d.name}">`
    ).join('');
    
    showModal('addDiagnosisModal');
}

async function addDiagnosis() {
    const code = document.getElementById('diagnosisCode').value.trim();
    const description = document.getElementById('diagnosisDescription').value.trim();
    const date = document.getElementById('diagnosisDate').value;
    const status = document.getElementById('diagnosisStatus').value;
    const notes = document.getElementById('diagnosisNotes').value.trim();
    
    if (!code || !description) {
        showNotification('يرجى إدخال رمز التشخيص والوصف', 'error');
        return;
    }
    
    const diagnosis = {
        code,
        description,
        date: firebase.firestore.Timestamp.fromDate(new Date(date)),
        status,
        notes,
        addedBy: currentDoctor.id,
        addedAt: firebase.firestore.Timestamp.now()
    };
    
    if (!currentPatientEMR.diagnoses) {
        currentPatientEMR.diagnoses = [];
    }
    
    currentPatientEMR.diagnoses.push(diagnosis);
    
    await savePatientEMR();
    displayDiagnoses();
    closeModal('addDiagnosisModal');
    showNotification('تم إضافة التشخيص بنجاح', 'success');
}

async function removeDiagnosis(index) {
    if (!confirm('هل أنت متأكد من حذف هذا التشخيص؟')) return;
    
    currentPatientEMR.diagnoses.splice(index, 1);
    await savePatientEMR();
    displayDiagnoses();
    showNotification('تم حذف التشخيص', 'success');
}

// === Treatment Plans Management ===

function displayTreatmentPlans() {
    const container = document.getElementById('treatmentPlansContainer');
    if (!container) return;
    
    const plans = currentPatientEMR?.treatmentPlans || [];
    
    if (plans.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>لا توجد خطط علاجية مسجلة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = plans.map((plan, index) => `
        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-900 mb-2">${plan.condition}</h4>
                    <div class="bg-gray-50 rounded p-3 mb-2">
                        <p class="text-sm text-gray-700 whitespace-pre-wrap">${plan.plan}</p>
                    </div>
                    <div class="flex items-center space-x-4 space-x-reverse text-sm text-gray-600">
                        <span><strong>البداية:</strong> ${plan.startDate ? new Date(plan.startDate.toDate()).toLocaleDateString('ar-IQ') : 'غير محدد'}</span>
                        ${plan.endDate ? `<span><strong>النهاية:</strong> ${new Date(plan.endDate.toDate()).toLocaleDateString('ar-IQ')}</span>` : ''}
                        ${plan.status ? `<span class="px-2 py-1 rounded-full ${plan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${plan.status === 'active' ? 'نشط' : 'مكتمل'}</span>` : ''}
                    </div>
                </div>
                <button onclick="removeTreatmentPlan(${index})" class="text-red-500 hover:text-red-700 ml-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function showAddTreatmentPlanModal() {
    document.getElementById('treatmentCondition').value = '';
    document.getElementById('treatmentPlan').value = '';
    document.getElementById('treatmentStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('treatmentEndDate').value = '';
    document.getElementById('treatmentStatus').value = 'active';
    
    showModal('addTreatmentPlanModal');
}

async function addTreatmentPlan() {
    const condition = document.getElementById('treatmentCondition').value.trim();
    const plan = document.getElementById('treatmentPlan').value.trim();
    const startDate = document.getElementById('treatmentStartDate').value;
    const endDate = document.getElementById('treatmentEndDate').value;
    const status = document.getElementById('treatmentStatus').value;
    
    if (!condition || !plan) {
        showNotification('يرجى إدخال الحالة وخطة العلاج', 'error');
        return;
    }
    
    const treatmentPlan = {
        condition,
        plan,
        startDate: firebase.firestore.Timestamp.fromDate(new Date(startDate)),
        endDate: endDate ? firebase.firestore.Timestamp.fromDate(new Date(endDate)) : null,
        status,
        addedBy: currentDoctor.id,
        addedAt: firebase.firestore.Timestamp.now()
    };
    
    if (!currentPatientEMR.treatmentPlans) {
        currentPatientEMR.treatmentPlans = [];
    }
    
    currentPatientEMR.treatmentPlans.push(treatmentPlan);
    
    await savePatientEMR();
    displayTreatmentPlans();
    closeModal('addTreatmentPlanModal');
    showNotification('تم إضافة خطة العلاج بنجاح', 'success');
}

async function removeTreatmentPlan(index) {
    if (!confirm('هل أنت متأكد من حذف خطة العلاج؟')) return;
    
    currentPatientEMR.treatmentPlans.splice(index, 1);
    await savePatientEMR();
    displayTreatmentPlans();
    showNotification('تم حذف خطة العلاج', 'success');
}

// === Vital Signs Management ===

function displayVitalSigns() {
    const container = document.getElementById('vitalSignsContainer');
    if (!container) return;
    
    const vitalSigns = currentPatientEMR?.vitalSigns || [];
    
    if (vitalSigns.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>لا توجد علامات حيوية مسجلة</p>
            </div>
        `;
        return;
    }
    
    // Sort by date descending
    const sortedVitals = [...vitalSigns].sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        return dateB - dateA;
    });
    
    container.innerHTML = sortedVitals.map((vital, index) => `
        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-600 mb-3">
                        ${vital.date ? new Date(vital.date.toDate()).toLocaleDateString('ar-IQ') : 'غير محدد'}
                    </p>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                        ${vital.bloodPressure ? `<div><span class="text-xs text-gray-500">ضغط الدم</span><p class="font-bold text-gray-900">${vital.bloodPressure}</p></div>` : ''}
                        ${vital.heartRate ? `<div><span class="text-xs text-gray-500">نبض القلب</span><p class="font-bold text-gray-900">${vital.heartRate} bpm</p></div>` : ''}
                        ${vital.temperature ? `<div><span class="text-xs text-gray-500">درجة الحرارة</span><p class="font-bold text-gray-900">${vital.temperature}°C</p></div>` : ''}
                        ${vital.weight ? `<div><span class="text-xs text-gray-500">الوزن</span><p class="font-bold text-gray-900">${vital.weight} kg</p></div>` : ''}
                        ${vital.height ? `<div><span class="text-xs text-gray-500">الطول</span><p class="font-bold text-gray-900">${vital.height} cm</p></div>` : ''}
                        ${vital.oxygenSaturation ? `<div><span class="text-xs text-gray-500">تشبع الأكسجين</span><p class="font-bold text-gray-900">${vital.oxygenSaturation}%</p></div>` : ''}
                    </div>
                    ${vital.notes ? `<p class="text-sm text-gray-700 mt-3">${vital.notes}</p>` : ''}
                </div>
                <button onclick="removeVitalSigns(${index})" class="text-red-500 hover:text-red-700 ml-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function showAddVitalSignsModal() {
    document.getElementById('vitalSignsDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('bloodPressure').value = '';
    document.getElementById('heartRate').value = '';
    document.getElementById('temperature').value = '';
    document.getElementById('weight').value = '';
    document.getElementById('height').value = '';
    document.getElementById('oxygenSaturation').value = '';
    document.getElementById('vitalSignsNotes').value = '';
    
    showModal('addVitalSignsModal');
}

async function addVitalSigns() {
    const date = document.getElementById('vitalSignsDate').value;
    const bloodPressure = document.getElementById('bloodPressure').value.trim();
    const heartRate = document.getElementById('heartRate').value.trim();
    const temperature = document.getElementById('temperature').value.trim();
    const weight = document.getElementById('weight').value.trim();
    const height = document.getElementById('height').value.trim();
    const oxygenSaturation = document.getElementById('oxygenSaturation').value.trim();
    const notes = document.getElementById('vitalSignsNotes').value.trim();
    
    if (!bloodPressure && !heartRate && !temperature && !weight && !height && !oxygenSaturation) {
        showNotification('يرجى إدخال قيمة واحدة على الأقل', 'error');
        return;
    }
    
    const vitalSigns = {
        date: firebase.firestore.Timestamp.fromDate(new Date(date)),
        bloodPressure,
        heartRate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        oxygenSaturation: oxygenSaturation ? parseInt(oxygenSaturation) : null,
        notes,
        recordedBy: currentDoctor.id,
        recordedAt: firebase.firestore.Timestamp.now()
    };
    
    if (!currentPatientEMR.vitalSigns) {
        currentPatientEMR.vitalSigns = [];
    }
    
    currentPatientEMR.vitalSigns.push(vitalSigns);
    
    await savePatientEMR();
    displayVitalSigns();
    closeModal('addVitalSignsModal');
    showNotification('تم إضافة العلامات الحيوية بنجاح', 'success');
}

async function removeVitalSigns(index) {
    if (!confirm('هل أنت متأكد من حذف هذه العلامات الحيوية؟')) return;
    
    currentPatientEMR.vitalSigns.splice(index, 1);
    await savePatientEMR();
    displayVitalSigns();
    showNotification('تم حذف العلامات الحيوية', 'success');
}

// === Medical History Management ===

function displayMedicalHistory() {
    // Display allergies
    const allergiesContainer = document.getElementById('allergiesDisplay');
    if (allergiesContainer && currentPatientEMR) {
        const allergies = currentPatientEMR.allergies || [];
        allergiesContainer.textContent = allergies.length > 0 ? allergies.join(', ') : 'لا توجد';
    }
    
    // Display chronic conditions
    const chronicContainer = document.getElementById('chronicConditionsDisplay');
    if (chronicContainer && currentPatientEMR) {
        const conditions = currentPatientEMR.chronicConditions || [];
        chronicContainer.textContent = conditions.length > 0 ? conditions.join(', ') : 'لا توجد';
    }
    
    // Display surgeries
    const surgeriesContainer = document.getElementById('surgeriesDisplay');
    if (surgeriesContainer && currentPatientEMR) {
        const surgeries = currentPatientEMR.surgeries || [];
        if (surgeries.length > 0) {
            surgeriesContainer.innerHTML = surgeries.map(s => 
                `<div class="mb-2"><strong>${s.procedure}</strong> - ${s.date ? new Date(s.date.toDate()).toLocaleDateString('ar-IQ') : 'غير محدد'}${s.notes ? `: ${s.notes}` : ''}</div>`
            ).join('');
        } else {
            surgeriesContainer.textContent = 'لا توجد';
        }
    }
    
    // Display family history
    const familyHistoryDisplay = document.getElementById('familyHistoryDisplay');
    if (familyHistoryDisplay && currentPatientEMR) {
        familyHistoryDisplay.textContent = currentPatientEMR.familyHistory || 'لا توجد';
    }
    
    // Display social history
    const socialHistoryDisplay = document.getElementById('socialHistoryDisplay');
    if (socialHistoryDisplay && currentPatientEMR) {
        socialHistoryDisplay.textContent = currentPatientEMR.socialHistory || 'لا توجد';
    }
}

async function updateMedicalHistory() {
    const allergies = document.getElementById('allergiesInput').value.trim();
    const chronicConditions = document.getElementById('chronicConditionsInput').value.trim();
    const familyHistory = document.getElementById('familyHistoryInput').value.trim();
    const socialHistory = document.getElementById('socialHistoryInput').value.trim();
    
    currentPatientEMR.allergies = allergies ? allergies.split(',').map(a => a.trim()).filter(a => a) : [];
    currentPatientEMR.chronicConditions = chronicConditions ? chronicConditions.split(',').map(c => c.trim()).filter(c => c) : [];
    currentPatientEMR.familyHistory = familyHistory;
    currentPatientEMR.socialHistory = socialHistory;
    
    await savePatientEMR();
    displayMedicalHistory();
    showNotification('تم تحديث التاريخ الطبي بنجاح', 'success');
}

// === Save EMR ===

async function savePatientEMR() {
    if (!currentPatientEMR || !currentPatientId) return;
    
    try {
        currentPatientEMR.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        currentPatientEMR.lastUpdatedBy = currentDoctor.id;
        
        if (currentPatientEMR.id) {
            // Update existing EMR
            await db.collection('medicalHistory').doc(currentPatientEMR.id).update(currentPatientEMR);
        } else {
            // Create new EMR
            currentPatientEMR.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('medicalHistory').add(currentPatientEMR);
            currentPatientEMR.id = docRef.id;
        }
    } catch (error) {
        console.error('Error saving EMR:', error);
        showNotification('خطأ في حفظ السجل الطبي', 'error');
        throw error;
    }
}

// === Open EMR Modal ===
async function openEMRModal(patientId, patientPhone) {
    try {
        await loadPatientEMR(patientId, patientPhone);
        displayPatientEMR();
        showModal('emrModal');
    } catch (error) {
        console.error('Error opening EMR modal:', error);
        showNotification('خطأ في فتح السجل الطبي', 'error');
    }
}

// === Export Functions ===
window.openEMRModal = openEMRModal;
window.loadPatientEMR = loadPatientEMR;
window.showAddDiagnosisModal = showAddDiagnosisModal;
window.addDiagnosis = addDiagnosis;
window.removeDiagnosis = removeDiagnosis;
window.showAddTreatmentPlanModal = showAddTreatmentPlanModal;
window.addTreatmentPlan = addTreatmentPlan;
window.removeTreatmentPlan = removeTreatmentPlan;
window.showAddVitalSignsModal = showAddVitalSignsModal;
window.addVitalSigns = addVitalSigns;
window.removeVitalSigns = removeVitalSigns;
window.updateMedicalHistory = updateMedicalHistory;
