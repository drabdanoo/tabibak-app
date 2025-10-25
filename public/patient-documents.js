// ============================================================================
// PATIENT MEDICAL DOCUMENTS SYSTEM
// View prescriptions, lab orders, and upload medical documents
// ============================================================================

'use strict';

// === State ===
let patientDocuments = [];
let currentDocumentFilter = 'all';

// === Load Patient Documents ===

async function loadPatientDocuments() {
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    
    try {
        console.log('Loading documents for patient:', user.uid);
        
        // Load medical documents
        const documentsSnap = await db.collection('medicalDocuments')
            .where('patientId', '==', user.uid)
            .orderBy('uploadedAt', 'desc')
            .get();
        
        patientDocuments = documentsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('Loaded documents:', patientDocuments.length);
        
        // Load prescriptions
        const prescriptionsSnap = await db.collection('prescriptions')
            .where('patientId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        // Add prescriptions to documents
        prescriptionsSnap.docs.forEach(doc => {
            const prescription = { id: doc.id, ...doc.data() };
            patientDocuments.push({
                id: doc.id,
                type: 'prescription',
                fileName: `وصفة طبية - ${prescription.doctorName || 'طبيب'}`,
                description: `وصفة طبية تحتوي على ${prescription.medications?.length || 0} دواء`,
                uploadedAt: prescription.createdAt,
                doctorId: prescription.doctorId,
                doctorName: prescription.doctorName,
                prescriptionData: prescription
            });
        });
        
        // Load lab orders
        const labOrdersSnap = await db.collection('labOrders')
            .where('patientId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        // Add lab orders to documents
        labOrdersSnap.docs.forEach(doc => {
            const labOrder = { id: doc.id, ...doc.data() };
            patientDocuments.push({
                id: doc.id,
                type: 'lab_order',
                fileName: `طلب تحاليل - ${labOrder.doctorName || 'طبيب'}`,
                description: `طلب تحاليل يحتوي على ${labOrder.tests?.length || 0} فحص`,
                uploadedAt: labOrder.createdAt,
                doctorId: labOrder.doctorId,
                doctorName: labOrder.doctorName,
                labOrderData: labOrder
            });
        });
        
        // Sort by date
        patientDocuments.sort((a, b) => {
            const dateA = a.uploadedAt?.toDate?.() || new Date(0);
            const dateB = b.uploadedAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });
        
        displayPatientDocuments();
        updateDocumentStats();
    } catch (error) {
        console.error('Error loading documents:', error);
        showNotification('خطأ في تحميل المستندات', 'error');
    }
}

function displayPatientDocuments() {
    const container = document.getElementById('documentsGrid');
    if (!container) return;
    
    const filtered = currentDocumentFilter === 'all'
        ? patientDocuments
        : patientDocuments.filter(doc => doc.type === currentDocumentFilter);
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="text-gray-500 text-lg">لا توجد مستندات طبية</p>
                <p class="text-gray-400 text-sm mt-2">ستظهر هنا الوصفات الطبية وطلبات التحاليل من طبيبك</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(doc => createDocumentCard(doc)).join('');
}

function createDocumentCard(doc) {
    const typeIcons = {
        prescription: `<svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>`,
        lab_order: `<svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
        </svg>`,
        report: `<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>`
    };
    
    const typeNames = {
        prescription: 'وصفة طبية',
        lab_order: 'طلب تحاليل',
        report: 'تقرير طبي'
    };
    
    const typeBadges = {
        prescription: 'bg-blue-100 text-blue-800',
        lab_order: 'bg-purple-100 text-purple-800',
        report: 'bg-green-100 text-green-800'
    };
    
    const date = doc.uploadedAt?.toDate?.() 
        ? new Date(doc.uploadedAt.toDate()).toLocaleDateString('ar-IQ')
        : 'غير محدد';
    
    return `
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3 space-x-reverse">
                    ${typeIcons[doc.type] || typeIcons.report}
                    <div>
                        <h3 class="font-bold text-gray-900">${doc.fileName}</h3>
                        <span class="inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${typeBadges[doc.type]}">
                            ${typeNames[doc.type] || 'مستند'}
                        </span>
                    </div>
                </div>
            </div>
            
            <p class="text-sm text-gray-600 mb-4">${doc.description || 'لا يوجد وصف'}</p>
            
            <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>📅 ${date}</span>
                ${doc.doctorName ? `<span>👨‍⚕️ د. ${doc.doctorName}</span>` : ''}
            </div>
            
            <div class="flex space-x-2 space-x-reverse">
                <button onclick="viewDocument('${doc.id}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    عرض
                </button>
                ${doc.type === 'prescription' || doc.type === 'lab_order' ? `
                    <button onclick="printDocument('${doc.id}')" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
                        طباعة
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function filterDocuments(type) {
    currentDocumentFilter = type;
    
    // Update active button
    document.querySelectorAll('[data-document-filter]').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    const activeBtn = document.querySelector(`[data-document-filter="${type}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-blue-500', 'text-white');
    }
    
    displayPatientDocuments();
}

function updateDocumentStats() {
    const prescriptionCount = patientDocuments.filter(d => d.type === 'prescription').length;
    const labOrderCount = patientDocuments.filter(d => d.type === 'lab_order').length;
    const reportCount = patientDocuments.filter(d => d.type === 'report').length;
    
    const prescriptionBadge = document.getElementById('prescriptionCount');
    const labOrderBadge = document.getElementById('labOrderCount');
    const reportBadge = document.getElementById('reportCount');
    
    if (prescriptionBadge) prescriptionBadge.textContent = prescriptionCount;
    if (labOrderBadge) labOrderBadge.textContent = labOrderCount;
    if (reportBadge) reportBadge.textContent = reportCount;
}

// === View Document ===

async function viewDocument(documentId) {
    const doc = patientDocuments.find(d => d.id === documentId);
    if (!doc) {
        showNotification('لم يتم العثور على المستند', 'error');
        return;
    }
    
    if (doc.type === 'prescription') {
        viewPrescription(doc);
    } else if (doc.type === 'lab_order') {
        viewLabOrder(doc);
    } else {
        // For uploaded files, open in new tab
        if (doc.fileUrl) {
            window.open(doc.fileUrl, '_blank');
        } else {
            showNotification('الملف غير متوفر', 'error');
        }
    }
}

function viewPrescription(doc) {
    const prescription = doc.prescriptionData;
    if (!prescription) {
        showNotification('بيانات الوصفة غير متوفرة', 'error');
        return;
    }
    
    const modalContent = document.getElementById('documentViewerContent');
    modalContent.innerHTML = `
        <div class="space-y-6">
            <div class="bg-blue-50 rounded-lg p-4">
                <h3 class="font-bold text-lg text-gray-900 mb-2">وصفة طبية</h3>
                <p class="text-sm text-gray-700">من: د. ${prescription.doctorName || 'غير محدد'}</p>
                <p class="text-sm text-gray-700">التاريخ: ${doc.uploadedAt?.toDate?.() ? new Date(doc.uploadedAt.toDate()).toLocaleDateString('ar-IQ') : 'غير محدد'}</p>
            </div>
            
            <div>
                <h4 class="font-bold text-gray-900 mb-3">الأدوية الموصوفة:</h4>
                <div class="space-y-3">
                    ${prescription.medications?.map((med, index) => `
                        <div class="bg-white border border-gray-200 rounded-lg p-4">
                            <p class="font-bold text-gray-900">${index + 1}. ${med.name}</p>
                            <div class="mt-2 space-y-1 text-sm text-gray-700">
                                <p><strong>الجرعة:</strong> ${med.dosage}</p>
                                <p><strong>عدد المرات:</strong> ${med.frequency}</p>
                                <p><strong>المدة:</strong> ${med.duration}</p>
                                ${med.instructions ? `<p><strong>تعليمات:</strong> ${med.instructions}</p>` : ''}
                            </div>
                        </div>
                    `).join('') || '<p class="text-gray-500">لا توجد أدوية</p>'}
                </div>
            </div>
            
            ${prescription.instructions ? `
                <div class="bg-yellow-50 rounded-lg p-4">
                    <h4 class="font-bold text-gray-900 mb-2">تعليمات عامة:</h4>
                    <p class="text-gray-700">${prescription.instructions}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    showModal('documentViewerModal');
}

function viewLabOrder(doc) {
    const labOrder = doc.labOrderData;
    if (!labOrder) {
        showNotification('بيانات طلب التحاليل غير متوفرة', 'error');
        return;
    }
    
    const modalContent = document.getElementById('documentViewerContent');
    modalContent.innerHTML = `
        <div class="space-y-6">
            <div class="bg-purple-50 rounded-lg p-4">
                <h3 class="font-bold text-lg text-gray-900 mb-2">طلب تحاليل طبية</h3>
                <p class="text-sm text-gray-700">من: د. ${labOrder.doctorName || 'غير محدد'}</p>
                <p class="text-sm text-gray-700">التاريخ: ${doc.uploadedAt?.toDate?.() ? new Date(doc.uploadedAt.toDate()).toLocaleDateString('ar-IQ') : 'غير محدد'}</p>
            </div>
            
            <div>
                <h4 class="font-bold text-gray-900 mb-3">التحاليل المطلوبة:</h4>
                <div class="bg-white border border-gray-200 rounded-lg p-4">
                    <ul class="space-y-2">
                        ${labOrder.tests?.map((test, index) => `
                            <li class="flex items-center space-x-2 space-x-reverse">
                                <span class="text-purple-500">✓</span>
                                <span class="text-gray-700">${index + 1}. ${test}</span>
                            </li>
                        `).join('') || '<p class="text-gray-500">لا توجد تحاليل</p>'}
                    </ul>
                </div>
            </div>
            
            ${labOrder.instructions ? `
                <div class="bg-yellow-50 rounded-lg p-4">
                    <h4 class="font-bold text-gray-900 mb-2">تعليمات:</h4>
                    <p class="text-gray-700">${labOrder.instructions}</p>
                </div>
            ` : ''}
            
            <div class="bg-blue-50 rounded-lg p-4">
                <p class="text-sm text-blue-800">💡 يرجى إحضار النتائج في موعدك القادم مع الطبيب</p>
            </div>
        </div>
    `;
    
    showModal('documentViewerModal');
}

function printDocument(documentId) {
    const doc = patientDocuments.find(d => d.id === documentId);
    if (!doc) return;
    
    if (doc.type === 'prescription') {
        printPrescriptionForPatient(doc.prescriptionData);
    } else if (doc.type === 'lab_order') {
        printLabOrderForPatient(doc.labOrderData);
    }
}

function printPrescriptionForPatient(prescription) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>وصفة طبية</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .medication { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
                .instructions { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>وصفة طبية</h1>
                <h2>د. ${prescription.doctorName}</h2>
                <p>${new Date().toLocaleDateString('ar-IQ')}</p>
            </div>
            
            <h3>الأدوية الموصوفة:</h3>
            ${prescription.medications?.map((med, index) => `
                <div class="medication">
                    <p><strong>${index + 1}. ${med.name}</strong></p>
                    <p>الجرعة: ${med.dosage}</p>
                    <p>عدد المرات: ${med.frequency}</p>
                    <p>المدة: ${med.duration}</p>
                    ${med.instructions ? `<p>تعليمات: ${med.instructions}</p>` : ''}
                </div>
            `).join('') || ''}
            
            ${prescription.instructions ? `
                <div class="instructions">
                    <h4>تعليمات عامة:</h4>
                    <p>${prescription.instructions}</p>
                </div>
            ` : ''}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function printLabOrderForPatient(labOrder) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طلب تحاليل</title>
            <style>
                body { font-family: 'Arial', sans-serif; padding: 40px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .test-item { padding: 10px; border-bottom: 1px solid #ddd; }
                .instructions { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>طلب تحاليل طبية</h1>
                <h2>د. ${labOrder.doctorName}</h2>
                <p>${new Date().toLocaleDateString('ar-IQ')}</p>
            </div>
            
            <h3>التحاليل المطلوبة:</h3>
            ${labOrder.tests?.map((test, index) => `
                <div class="test-item">
                    <p>${index + 1}. ${test}</p>
                </div>
            `).join('') || ''}
            
            ${labOrder.instructions ? `
                <div class="instructions">
                    <h4>تعليمات:</h4>
                    <p>${labOrder.instructions}</p>
                </div>
            ` : ''}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// === Export Functions ===
window.loadPatientDocuments = loadPatientDocuments;
window.filterDocuments = filterDocuments;
window.viewDocument = viewDocument;
window.printDocument = printDocument;
