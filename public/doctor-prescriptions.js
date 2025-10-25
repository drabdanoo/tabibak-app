// ============================================================================
// E-PRESCRIBING & LAB ORDERS SYSTEM
// Electronic prescription and lab order management for doctors
// ============================================================================

'use strict';

// === State ===
let currentPrescription = null;
let currentLabOrder = null;
let commonMedications = [];

// === Common Medications Database ===
const medicationsDatabase = [
    { name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'كل 6 ساعات' },
    { name: 'Ibuprofen 400mg', dosage: '400mg', frequency: 'كل 8 ساعات' },
    { name: 'Amoxicillin 500mg', dosage: '500mg', frequency: '3 مرات يومياً' },
    { name: 'Azithromycin 500mg', dosage: '500mg', frequency: 'مرة واحدة يومياً' },
    { name: 'Omeprazole 20mg', dosage: '20mg', frequency: 'مرة واحدة يومياً' },
    { name: 'Metformin 500mg', dosage: '500mg', frequency: 'مرتين يومياً' },
    { name: 'Atorvastatin 20mg', dosage: '20mg', frequency: 'مرة واحدة مساءً' },
    { name: 'Amlodipine 5mg', dosage: '5mg', frequency: 'مرة واحدة يومياً' },
    { name: 'Losartan 50mg', dosage: '50mg', frequency: 'مرة واحدة يومياً' },
    { name: 'Aspirin 100mg', dosage: '100mg', frequency: 'مرة واحدة يومياً' }
];

// === Common Lab Tests ===
const commonLabTests = [
    'Complete Blood Count (CBC)',
    'Blood Sugar (Fasting)',
    'Blood Sugar (Random)',
    'HbA1c',
    'Lipid Profile',
    'Liver Function Test (LFT)',
    'Kidney Function Test (KFT)',
    'Thyroid Function Test (TSH, T3, T4)',
    'Urine Analysis',
    'Stool Analysis',
    'Chest X-Ray',
    'ECG',
    'Ultrasound'
];

// === Prescription Management ===

function showPrescriptionModal(appointmentId) {
    const appointment = allAppointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
        showNotification('لم يتم العثور على الموعد', 'error');
        return;
    }
    
    // Set appointment details
    document.getElementById('prescriptionPatientName').textContent = appointment.patientName;
    document.getElementById('prescriptionAppointmentDate').textContent = `${appointment.appointmentDate} - ${appointment.appointmentTime}`;
    document.getElementById('prescriptionAppointmentId').value = appointmentId;
    
    // Clear previous medications
    document.getElementById('medicationsList').innerHTML = '';
    
    // Load existing prescription if any
    loadExistingPrescription(appointmentId);
    
    showModal('prescriptionModal');
}

async function loadExistingPrescription(appointmentId) {
    try {
        const prescriptionSnap = await db.collection('prescriptions')
            .where('appointmentId', '==', appointmentId)
            .where('doctorId', '==', currentDoctor.id)
            .limit(1)
            .get();
        
        if (!prescriptionSnap.empty) {
            const prescription = prescriptionSnap.docs[0].data();
            currentPrescription = { id: prescriptionSnap.docs[0].id, ...prescription };
            
            // Display existing medications
            prescription.medications.forEach(med => {
                addMedicationToList(med);
            });
            
            // Set instructions
            document.getElementById('prescriptionInstructions').value = prescription.instructions || '';
        }
    } catch (error) {
        console.error('Error loading prescription:', error);
    }
}

function addMedicationToList(medication = null) {
    const medicationsList = document.getElementById('medicationsList');
    const medicationId = 'med_' + Date.now() + Math.random().toString(36).substr(2, 9);
    
    const medicationHTML = `
        <div class="medication-item bg-gray-50 rounded-lg p-4 mb-3" data-med-id="${medicationId}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">اسم الدواء</label>
                    <input type="text" 
                           class="medication-name w-full border border-gray-300 rounded-lg px-4 py-2" 
                           placeholder="ابحث عن الدواء..."
                           value="${medication ? medication.name : ''}"
                           list="medicationsSuggestions">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">الجرعة</label>
                    <input type="text" 
                           class="medication-dosage w-full border border-gray-300 rounded-lg px-4 py-2" 
                           placeholder="مثال: 500mg"
                           value="${medication ? medication.dosage : ''}">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">عدد المرات</label>
                    <input type="text" 
                           class="medication-frequency w-full border border-gray-300 rounded-lg px-4 py-2" 
                           placeholder="مثال: 3 مرات يومياً"
                           value="${medication ? medication.frequency : ''}">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">المدة</label>
                    <input type="text" 
                           class="medication-duration w-full border border-gray-300 rounded-lg px-4 py-2" 
                           placeholder="مثال: 7 أيام"
                           value="${medication ? medication.duration : ''}">
                </div>
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-2">تعليمات خاصة</label>
                    <input type="text" 
                           class="medication-instructions w-full border border-gray-300 rounded-lg px-4 py-2" 
                           placeholder="مثال: قبل الأكل، مع الماء"
                           value="${medication ? medication.instructions : ''}">
                </div>
            </div>
            <div class="mt-3 flex justify-end">
                <button type="button" onclick="removeMedication('${medicationId}')" 
                        class="text-red-500 hover:text-red-700 text-sm font-medium">
                    <svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    حذف الدواء
                </button>
            </div>
        </div>
    `;
    
    medicationsList.insertAdjacentHTML('beforeend', medicationHTML);
}

function removeMedication(medicationId) {
    const medicationItem = document.querySelector(`[data-med-id="${medicationId}"]`);
    if (medicationItem) {
        medicationItem.remove();
    }
}

async function savePrescription() {
    const appointmentId = document.getElementById('prescriptionAppointmentId').value;
    const instructions = document.getElementById('prescriptionInstructions').value.trim();
    
    // Collect medications
    const medications = [];
    document.querySelectorAll('.medication-item').forEach(item => {
        const name = item.querySelector('.medication-name').value.trim();
        const dosage = item.querySelector('.medication-dosage').value.trim();
        const frequency = item.querySelector('.medication-frequency').value.trim();
        const duration = item.querySelector('.medication-duration').value.trim();
        const medInstructions = item.querySelector('.medication-instructions').value.trim();
        
        if (name && dosage && frequency) {
            medications.push({
                name,
                dosage,
                frequency,
                duration,
                instructions: medInstructions
            });
        }
    });
    
    if (medications.length === 0) {
        showNotification('يرجى إضافة دواء واحد على الأقل', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('savePrescriptionBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';
    
    try {
        const appointment = allAppointments.find(apt => apt.id === appointmentId);
        
        const prescriptionData = {
            appointmentId,
            patientId: appointment.userId || appointment.patientId,
            patientName: appointment.patientName,
            patientPhone: appointment.patientPhone || appointment.userPhone,
            doctorId: currentDoctor.id,
            doctorName: currentDoctor.name,
            medications,
            instructions,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (currentPrescription?.id) {
            // Update existing prescription
            await db.collection('prescriptions').doc(currentPrescription.id).update(prescriptionData);
            showNotification('تم تحديث الوصفة الطبية بنجاح', 'success');
        } else {
            // Create new prescription
            const prescriptionRef = await db.collection('prescriptions').add(prescriptionData);
            
            // Also save as medical document
            await db.collection('medicalDocuments').add({
                patientId: appointment.userId || appointment.patientId,
                doctorId: currentDoctor.id,
                type: 'prescription',
                prescriptionId: prescriptionRef.id,
                fileName: `وصفة طبية - ${appointment.patientName} - ${new Date().toLocaleDateString('ar-IQ')}`,
                description: `وصفة طبية من د. ${currentDoctor.name}`,
                uploadedBy: currentDoctor.id,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('تم حفظ الوصفة الطبية بنجاح', 'success');
        }
        
        closeModal('prescriptionModal');
        currentPrescription = null;
    } catch (error) {
        console.error('Error saving prescription:', error);
        showNotification('خطأ في حفظ الوصفة الطبية', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ الوصفة';
    }
}

async function printPrescription() {
    const appointmentId = document.getElementById('prescriptionAppointmentId').value;
    
    try {
        const prescriptionSnap = await db.collection('prescriptions')
            .where('appointmentId', '==', appointmentId)
            .where('doctorId', '==', currentDoctor.id)
            .limit(1)
            .get();
        
        if (prescriptionSnap.empty) {
            showNotification('يرجى حفظ الوصفة أولاً', 'error');
            return;
        }
        
        const prescription = prescriptionSnap.docs[0].data();
        
        // Generate printable prescription
        const printWindow = window.open('', '_blank');
        printWindow.document.write(generatePrescriptionHTML(prescription));
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error printing prescription:', error);
        showNotification('خطأ في طباعة الوصفة', 'error');
    }
}

function generatePrescriptionHTML(prescription) {
    return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>وصفة طبية</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .doctor-info { margin-bottom: 20px; }
                .patient-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
                .medications { margin: 30px 0; }
                .medication { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
                .instructions { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>وصفة طبية</h1>
                <h2>د. ${prescription.doctorName}</h2>
                <p>${currentDoctor.specialty || 'طبيب عام'}</p>
            </div>
            
            <div class="patient-info">
                <p><strong>اسم المريض:</strong> ${prescription.patientName}</p>
                <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-IQ')}</p>
            </div>
            
            <div class="medications">
                <h3>الأدوية الموصوفة:</h3>
                ${prescription.medications.map((med, index) => `
                    <div class="medication">
                        <p><strong>${index + 1}. ${med.name}</strong></p>
                        <p>الجرعة: ${med.dosage}</p>
                        <p>عدد المرات: ${med.frequency}</p>
                        <p>المدة: ${med.duration}</p>
                        ${med.instructions ? `<p>تعليمات: ${med.instructions}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            
            ${prescription.instructions ? `
                <div class="instructions">
                    <h4>تعليمات عامة:</h4>
                    <p>${prescription.instructions}</p>
                </div>
            ` : ''}
            
            <div class="footer">
                <p>هذه الوصفة صالحة لمدة 30 يوماً من تاريخ الإصدار</p>
                <p>MedConnect - نظام إدارة العيادات الطبية</p>
            </div>
        </body>
        </html>
    `;
}

// === Lab Orders Management ===

function showLabOrderModal(appointmentId) {
    const appointment = allAppointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
        showNotification('لم يتم العثور على الموعد', 'error');
        return;
    }
    
    // Set appointment details
    document.getElementById('labOrderPatientName').textContent = appointment.patientName;
    document.getElementById('labOrderAppointmentDate').textContent = `${appointment.appointmentDate} - ${appointment.appointmentTime}`;
    document.getElementById('labOrderAppointmentId').value = appointmentId;
    
    // Clear previous selections
    document.querySelectorAll('.lab-test-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('customLabTests').value = '';
    document.getElementById('labOrderInstructions').value = '';
    
    // Load existing lab order if any
    loadExistingLabOrder(appointmentId);
    
    showModal('labOrderModal');
}

async function loadExistingLabOrder(appointmentId) {
    try {
        const labOrderSnap = await db.collection('labOrders')
            .where('appointmentId', '==', appointmentId)
            .where('doctorId', '==', currentDoctor.id)
            .limit(1)
            .get();
        
        if (!labOrderSnap.empty) {
            const labOrder = labOrderSnap.docs[0].data();
            currentLabOrder = { id: labOrderSnap.docs[0].id, ...labOrder };
            
            // Check existing tests
            labOrder.tests.forEach(test => {
                const checkbox = document.querySelector(`.lab-test-checkbox[value="${test}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                } else {
                    // Add to custom tests
                    const customTests = document.getElementById('customLabTests');
                    customTests.value += (customTests.value ? '\n' : '') + test;
                }
            });
            
            // Set instructions
            document.getElementById('labOrderInstructions').value = labOrder.instructions || '';
        }
    } catch (error) {
        console.error('Error loading lab order:', error);
    }
}

async function saveLabOrder() {
    const appointmentId = document.getElementById('labOrderAppointmentId').value;
    const instructions = document.getElementById('labOrderInstructions').value.trim();
    
    // Collect selected tests
    const tests = [];
    document.querySelectorAll('.lab-test-checkbox:checked').forEach(cb => {
        tests.push(cb.value);
    });
    
    // Add custom tests
    const customTests = document.getElementById('customLabTests').value.trim();
    if (customTests) {
        customTests.split('\n').forEach(test => {
            const trimmedTest = test.trim();
            if (trimmedTest && !tests.includes(trimmedTest)) {
                tests.push(trimmedTest);
            }
        });
    }
    
    if (tests.length === 0) {
        showNotification('يرجى اختيار فحص واحد على الأقل', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('saveLabOrderBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';
    
    try {
        const appointment = allAppointments.find(apt => apt.id === appointmentId);
        
        const labOrderData = {
            appointmentId,
            patientId: appointment.userId || appointment.patientId,
            patientName: appointment.patientName,
            patientPhone: appointment.patientPhone || appointment.userPhone,
            doctorId: currentDoctor.id,
            doctorName: currentDoctor.name,
            tests,
            instructions,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (currentLabOrder?.id) {
            // Update existing lab order
            await db.collection('labOrders').doc(currentLabOrder.id).update(labOrderData);
            showNotification('تم تحديث طلب التحاليل بنجاح', 'success');
        } else {
            // Create new lab order
            const labOrderRef = await db.collection('labOrders').add(labOrderData);
            
            // Also save as medical document
            await db.collection('medicalDocuments').add({
                patientId: appointment.userId || appointment.patientId,
                doctorId: currentDoctor.id,
                type: 'lab_order',
                labOrderId: labOrderRef.id,
                fileName: `طلب تحاليل - ${appointment.patientName} - ${new Date().toLocaleDateString('ar-IQ')}`,
                description: `طلب تحاليل من د. ${currentDoctor.name}`,
                uploadedBy: currentDoctor.id,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('تم حفظ طلب التحاليل بنجاح', 'success');
        }
        
        closeModal('labOrderModal');
        currentLabOrder = null;
    } catch (error) {
        console.error('Error saving lab order:', error);
        showNotification('خطأ في حفظ طلب التحاليل', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ الطلب';
    }
}

async function printLabOrder() {
    const appointmentId = document.getElementById('labOrderAppointmentId').value;
    
    try {
        const labOrderSnap = await db.collection('labOrders')
            .where('appointmentId', '==', appointmentId)
            .where('doctorId', '==', currentDoctor.id)
            .limit(1)
            .get();
        
        if (labOrderSnap.empty) {
            showNotification('يرجى حفظ طلب التحاليل أولاً', 'error');
            return;
        }
        
        const labOrder = labOrderSnap.docs[0].data();
        
        // Generate printable lab order
        const printWindow = window.open('', '_blank');
        printWindow.document.write(generateLabOrderHTML(labOrder));
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error printing lab order:', error);
        showNotification('خطأ في طباعة طلب التحاليل', 'error');
    }
}

function generateLabOrderHTML(labOrder) {
    return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طلب تحاليل طبية</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .patient-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
                .tests { margin: 30px 0; }
                .test-item { padding: 10px; border-bottom: 1px solid #ddd; }
                .instructions { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>طلب تحاليل طبية</h1>
                <h2>د. ${labOrder.doctorName}</h2>
                <p>${currentDoctor.specialty || 'طبيب عام'}</p>
            </div>
            
            <div class="patient-info">
                <p><strong>اسم المريض:</strong> ${labOrder.patientName}</p>
                <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-IQ')}</p>
            </div>
            
            <div class="tests">
                <h3>التحاليل المطلوبة:</h3>
                ${labOrder.tests.map((test, index) => `
                    <div class="test-item">
                        <p>${index + 1}. ${test}</p>
                    </div>
                `).join('')}
            </div>
            
            ${labOrder.instructions ? `
                <div class="instructions">
                    <h4>تعليمات:</h4>
                    <p>${labOrder.instructions}</p>
                </div>
            ` : ''}
            
            <div class="footer">
                <p>يرجى إحضار النتائج في الموعد القادم</p>
                <p>MedConnect - نظام إدارة العيادات الطبية</p>
            </div>
        </body>
        </html>
    `;
}

// === Initialize Medications Datalist ===
function initializeMedicationsSuggestions() {
    const datalist = document.getElementById('medicationsSuggestions');
    if (!datalist) return;
    
    datalist.innerHTML = medicationsDatabase.map(med => 
        `<option value="${med.name}">`
    ).join('');
}

// === Export Functions ===
window.showPrescriptionModal = showPrescriptionModal;
window.addMedicationToList = addMedicationToList;
window.removeMedication = removeMedication;
window.savePrescription = savePrescription;
window.printPrescription = printPrescription;
window.showLabOrderModal = showLabOrderModal;
window.saveLabOrder = saveLabOrder;
window.printLabOrder = printLabOrder;
window.initializeMedicationsSuggestions = initializeMedicationsSuggestions;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMedicationsSuggestions);
} else {
    initializeMedicationsSuggestions();
}
