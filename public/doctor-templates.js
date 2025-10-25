// ============================================================================
// DOCTOR TEMPLATES MANAGEMENT
// Allows doctors to create and use templates for notes, prescriptions, and instructions
// ============================================================================

'use strict';

// === State ===
let doctorTemplates = [];
let currentTemplateCategory = 'all';

// === Template Management ===

async function loadDoctorTemplates() {
    if (!currentDoctor?.id) return;
    
    try {
        const templatesSnap = await db.collection('doctorTemplates')
            .where('doctorId', '==', currentDoctor.id)
            .orderBy('lastUsed', 'desc')
            .get();
        
        doctorTemplates = templatesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayTemplates();
        updateTemplateSelector();
    } catch (error) {
        console.error('Error loading templates:', error);
        showNotification('خطأ في تحميل القوالب', 'error');
    }
}

function displayTemplates() {
    const container = document.getElementById('templatesGrid');
    if (!container) return;
    
    const filtered = currentTemplateCategory === 'all' 
        ? doctorTemplates 
        : doctorTemplates.filter(t => t.category === currentTemplateCategory);
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p class="text-gray-500 text-lg">لا توجد قوالب</p>
                <button onclick="showCreateTemplateModal()" class="mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg">
                    إنشاء قالب جديد
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(template => createTemplateCard(template)).join('');
}

function createTemplateCard(template) {
    const categoryColors = {
        note: 'bg-blue-100 text-blue-800',
        prescription: 'bg-green-100 text-green-800',
        instruction: 'bg-purple-100 text-purple-800'
    };
    
    const categoryNames = {
        note: 'ملاحظة',
        prescription: 'وصفة طبية',
        instruction: 'تعليمات'
    };
    
    const lastUsed = template.lastUsed 
        ? new Date(template.lastUsed.toDate()).toLocaleDateString('ar-IQ')
        : 'لم يستخدم بعد';
    
    return `
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div class="flex justify-between items-start mb-4">
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-gray-900 mb-2">${template.name}</h3>
                    <span class="inline-block px-3 py-1 rounded-full text-xs font-medium ${categoryColors[template.category]}">
                        ${categoryNames[template.category]}
                    </span>
                </div>
                <div class="flex space-x-2 space-x-reverse">
                    <button onclick="editTemplate('${template.id}')" title="تعديل" class="text-blue-500 hover:text-blue-700 p-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteTemplate('${template.id}')" title="حذف" class="text-red-500 hover:text-red-700 p-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
                <p class="text-gray-700 text-sm whitespace-pre-wrap line-clamp-3">${template.content}</p>
            </div>
            
            <div class="flex justify-between items-center text-sm text-gray-500">
                <span>آخر استخدام: ${lastUsed}</span>
                <button onclick="useTemplate('${template.id}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    استخدام القالب
                </button>
            </div>
        </div>
    `;
}

function filterTemplates(category) {
    currentTemplateCategory = category;
    
    // Update active button
    document.querySelectorAll('[data-template-category]').forEach(btn => {
        btn.classList.remove('bg-green-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    const activeBtn = document.querySelector(`[data-template-category="${category}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-green-500', 'text-white');
    }
    
    displayTemplates();
}

// === Template CRUD Operations ===

function showCreateTemplateModal() {
    document.getElementById('templateModalTitle').textContent = 'إنشاء قالب جديد';
    document.getElementById('templateId').value = '';
    document.getElementById('templateName').value = '';
    document.getElementById('templateCategory').value = 'note';
    document.getElementById('templateContent').value = '';
    showModal('templateModal');
}

async function editTemplate(templateId) {
    const template = doctorTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    document.getElementById('templateModalTitle').textContent = 'تعديل القالب';
    document.getElementById('templateId').value = template.id;
    document.getElementById('templateName').value = template.name;
    document.getElementById('templateCategory').value = template.category;
    document.getElementById('templateContent').value = template.content;
    showModal('templateModal');
}

async function saveTemplate() {
    const templateId = document.getElementById('templateId').value;
    const name = document.getElementById('templateName').value.trim();
    const category = document.getElementById('templateCategory').value;
    const content = document.getElementById('templateContent').value.trim();
    
    if (!name || !content) {
        showNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('saveTemplateBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';
    
    try {
        const templateData = {
            name,
            category,
            content,
            doctorId: currentDoctor.id,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (templateId) {
            // Update existing template
            await db.collection('doctorTemplates').doc(templateId).update(templateData);
            showNotification('تم تحديث القالب بنجاح', 'success');
        } else {
            // Create new template
            templateData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            templateData.lastUsed = null;
            await db.collection('doctorTemplates').add(templateData);
            showNotification('تم إنشاء القالب بنجاح', 'success');
        }
        
        closeModal('templateModal');
        await loadDoctorTemplates();
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('خطأ في حفظ القالب', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ';
    }
}

async function deleteTemplate(templateId) {
    if (!confirm('هل أنت متأكد من حذف هذا القالب؟')) return;
    
    try {
        await db.collection('doctorTemplates').doc(templateId).delete();
        showNotification('تم حذف القالب بنجاح', 'success');
        await loadDoctorTemplates();
    } catch (error) {
        console.error('Error deleting template:', error);
        showNotification('خطأ في حذف القالب', 'error');
    }
}

async function useTemplate(templateId) {
    const template = doctorTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    try {
        // Update last used timestamp
        await db.collection('doctorTemplates').doc(templateId).update({
            lastUsed: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Insert template content based on category
        if (template.category === 'note') {
            // Insert into appointment notes
            const notesField = document.getElementById('completionNotesText') || 
                              document.getElementById('appointmentNotesText');
            if (notesField) {
                notesField.value = template.content;
                showNotification('تم إدراج القالب في الملاحظات', 'success');
            }
        } else if (template.category === 'prescription') {
            // Insert into prescription form
            const prescriptionField = document.getElementById('prescriptionInstructions');
            if (prescriptionField) {
                prescriptionField.value = template.content;
                showNotification('تم إدراج القالب في الوصفة الطبية', 'success');
            }
        } else if (template.category === 'instruction') {
            // Insert into patient instructions
            const instructionsField = document.getElementById('patientInstructions');
            if (instructionsField) {
                instructionsField.value = template.content;
                showNotification('تم إدراج القالب في التعليمات', 'success');
            }
        }
        
        await loadDoctorTemplates(); // Refresh to update last used time
    } catch (error) {
        console.error('Error using template:', error);
        showNotification('خطأ في استخدام القالب', 'error');
    }
}

// === Template Selector (for quick access in forms) ===

function updateTemplateSelector() {
    const selector = document.getElementById('templateSelector');
    if (!selector) return;
    
    // Clear existing options except the first one
    selector.innerHTML = '<option value="">اختر قالب</option>';
    
    // Add templates grouped by category
    const categories = {
        note: 'ملاحظات',
        prescription: 'وصفات طبية',
        instruction: 'تعليمات'
    };
    
    Object.entries(categories).forEach(([category, label]) => {
        const categoryTemplates = doctorTemplates.filter(t => t.category === category);
        if (categoryTemplates.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = label;
            categoryTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                optgroup.appendChild(option);
            });
            selector.appendChild(optgroup);
        }
    });
}

function applyTemplateFromSelector(templateId) {
    if (!templateId) return;
    useTemplate(templateId);
    // Reset selector
    document.getElementById('templateSelector').value = '';
}

// === Export Functions ===
window.loadDoctorTemplates = loadDoctorTemplates;
window.filterTemplates = filterTemplates;
window.showCreateTemplateModal = showCreateTemplateModal;
window.saveTemplate = saveTemplate;
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;
window.useTemplate = useTemplate;
window.applyTemplateFromSelector = applyTemplateFromSelector;
