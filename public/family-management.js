// ============================================================================
// FAMILY ACCOUNTS MANAGEMENT
// Allows users to manage multiple family members under one account
// ============================================================================

'use strict';

// === State ===
let familyMembers = [];
let currentActiveMember = null; // null means primary user

// === Load Family Members ===

async function loadFamilyMembers() {
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    
    try {
        console.log('Loading family members for user:', user.uid);
        
        const membersSnap = await db.collection('familyMembers')
            .where('primaryUserId', '==', user.uid)
            .orderBy('createdAt', 'asc')
            .get();
        
        familyMembers = membersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('Loaded family members:', familyMembers.length);
        
        displayFamilyMembers();
        updateFamilyMemberSelector();
    } catch (error) {
        console.error('Error loading family members:', error);
        showNotification('خطأ في تحميل أفراد العائلة', 'error');
    }
}

function displayFamilyMembers() {
    const container = document.getElementById('familyMembersGrid');
    if (!container) return;
    
    if (familyMembers.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <p class="text-gray-500 text-lg">لا يوجد أفراد عائلة مضافين</p>
                <p class="text-gray-400 text-sm mt-2">أضف أفراد عائلتك لإدارة مواعيدهم الطبية</p>
                <button onclick="showAddFamilyMemberModal()" class="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg">
                    إضافة فرد من العائلة
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = familyMembers.map(member => createFamilyMemberCard(member)).join('');
}

function createFamilyMemberCard(member) {
    const relationshipNames = {
        spouse: 'الزوج/الزوجة',
        son: 'الابن',
        daughter: 'الابنة',
        father: 'الأب',
        mother: 'الأم',
        brother: 'الأخ',
        sister: 'الأخت',
        grandfather: 'الجد',
        grandmother: 'الجدة',
        other: 'آخر'
    };
    
    const genderIcons = {
        male: `<svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
        </svg>`,
        female: `<svg class="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
        </svg>`
    };
    
    const age = member.dateOfBirth ? calculateAge(member.dateOfBirth) : 'غير محدد';
    const isActive = currentActiveMember?.id === member.id;
    
    return `
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${isActive ? 'ring-2 ring-blue-500' : ''}">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3 space-x-reverse">
                    ${genderIcons[member.gender] || genderIcons.male}
                    <div>
                        <h3 class="font-bold text-gray-900">${member.name}</h3>
                        <span class="text-sm text-gray-600">${relationshipNames[member.relationship] || member.relationship}</span>
                    </div>
                </div>
                ${isActive ? '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">نشط</span>' : ''}
            </div>
            
            <div class="space-y-2 mb-4 text-sm text-gray-700">
                <p><strong>العمر:</strong> ${age} سنة</p>
                <p><strong>الهاتف:</strong> ${member.phone || 'غير محدد'}</p>
                ${member.chronicConditions?.length > 0 ? `<p><strong>أمراض مزمنة:</strong> ${member.chronicConditions.join(', ')}</p>` : ''}
            </div>
            
            <div class="flex space-x-2 space-x-reverse">
                <button onclick="switchToMember('${member.id}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    ${isActive ? 'نشط' : 'تفعيل'}
                </button>
                <button onclick="editFamilyMember('${member.id}')" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
                    تعديل
                </button>
                <button onclick="deleteFamilyMember('${member.id}')" class="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium">
                    حذف
                </button>
            </div>
        </div>
    `;
}

function calculateAge(dateOfBirth) {
    const birthDate = dateOfBirth.toDate ? dateOfBirth.toDate() : new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// === Add/Edit Family Member ===

function showAddFamilyMemberModal() {
    document.getElementById('familyMemberModalTitle').textContent = 'إضافة فرد من العائلة';
    document.getElementById('familyMemberId').value = '';
    document.getElementById('memberName').value = '';
    document.getElementById('memberDateOfBirth').value = '';
    document.getElementById('memberGender').value = 'male';
    document.getElementById('memberRelationship').value = 'son';
    document.getElementById('memberPhone').value = '';
    document.getElementById('memberAllergies').value = '';
    document.getElementById('memberChronicConditions').value = '';
    document.getElementById('memberCurrentMedications').value = '';
    
    showModal('familyMemberModal');
}

async function editFamilyMember(memberId) {
    const member = familyMembers.find(m => m.id === memberId);
    if (!member) return;
    
    document.getElementById('familyMemberModalTitle').textContent = 'تعديل بيانات فرد من العائلة';
    document.getElementById('familyMemberId').value = member.id;
    document.getElementById('memberName').value = member.name;
    
    // Convert Firestore timestamp to date input format
    if (member.dateOfBirth) {
        const date = member.dateOfBirth.toDate ? member.dateOfBirth.toDate() : new Date(member.dateOfBirth);
        document.getElementById('memberDateOfBirth').value = date.toISOString().split('T')[0];
    }
    
    document.getElementById('memberGender').value = member.gender;
    document.getElementById('memberRelationship').value = member.relationship;
    document.getElementById('memberPhone').value = member.phone || '';
    document.getElementById('memberAllergies').value = member.allergies || '';
    document.getElementById('memberChronicConditions').value = member.chronicConditions?.join(', ') || '';
    document.getElementById('memberCurrentMedications').value = member.currentMedications || '';
    
    showModal('familyMemberModal');
}

async function saveFamilyMember() {
    const memberId = document.getElementById('familyMemberId').value;
    const name = document.getElementById('memberName').value.trim();
    const dateOfBirth = document.getElementById('memberDateOfBirth').value;
    const gender = document.getElementById('memberGender').value;
    const relationship = document.getElementById('memberRelationship').value;
    const phone = document.getElementById('memberPhone').value.trim();
    const allergies = document.getElementById('memberAllergies').value.trim();
    const chronicConditionsStr = document.getElementById('memberChronicConditions').value.trim();
    const currentMedications = document.getElementById('memberCurrentMedications').value.trim();
    
    if (!name || !dateOfBirth || !gender || !relationship) {
        showNotification('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('saveFamilyMemberBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الحفظ...';
    
    try {
        const user = auth.currentUser;
        const chronicConditions = chronicConditionsStr ? chronicConditionsStr.split(',').map(c => c.trim()).filter(c => c) : [];
        
        const memberData = {
            primaryUserId: user.uid,
            name,
            dateOfBirth: firebase.firestore.Timestamp.fromDate(new Date(dateOfBirth)),
            gender,
            relationship,
            phone,
            allergies,
            chronicConditions,
            currentMedications,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (memberId) {
            // Update existing member
            await db.collection('familyMembers').doc(memberId).update(memberData);
            showNotification('تم تحديث بيانات فرد العائلة بنجاح', 'success');
        } else {
            // Create new member
            memberData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('familyMembers').add(memberData);
            showNotification('تم إضافة فرد العائلة بنجاح', 'success');
        }
        
        closeModal('familyMemberModal');
        await loadFamilyMembers();
    } catch (error) {
        console.error('Error saving family member:', error);
        showNotification('خطأ في حفظ بيانات فرد العائلة', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ';
    }
}

async function deleteFamilyMember(memberId) {
    if (!confirm('هل أنت متأكد من حذف هذا الفرد من العائلة؟')) return;
    
    try {
        await db.collection('familyMembers').doc(memberId).delete();
        
        // If deleted member was active, switch back to primary user
        if (currentActiveMember?.id === memberId) {
            switchToPrimaryUser();
        }
        
        showNotification('تم حذف فرد العائلة بنجاح', 'success');
        await loadFamilyMembers();
    } catch (error) {
        console.error('Error deleting family member:', error);
        showNotification('خطأ في حذف فرد العائلة', 'error');
    }
}

// === Profile Switching ===

function switchToMember(memberId) {
    const member = familyMembers.find(m => m.id === memberId);
    if (!member) return;
    
    currentActiveMember = member;
    localStorage.setItem('medconnect_active_member', memberId);
    
    updateActiveMemberDisplay();
    displayFamilyMembers();
    
    showNotification(`تم التبديل إلى حساب ${member.name}`, 'success');
}

function switchToPrimaryUser() {
    currentActiveMember = null;
    localStorage.removeItem('medconnect_active_member');
    
    updateActiveMemberDisplay();
    displayFamilyMembers();
    
    showNotification('تم التبديل إلى حسابك الشخصي', 'success');
}

function updateActiveMemberDisplay() {
    const activeMemberBadge = document.getElementById('activeMemberBadge');
    if (!activeMemberBadge) return;
    
    if (currentActiveMember) {
        activeMemberBadge.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                <div class="flex items-center space-x-2 space-x-reverse">
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <span class="text-sm font-medium text-blue-900">الحساب النشط: ${currentActiveMember.name}</span>
                </div>
                <button onclick="switchToPrimaryUser()" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                    العودة لحسابي
                </button>
            </div>
        `;
    } else {
        activeMemberBadge.innerHTML = '';
    }
}

// === Family Member Selector (for booking) ===

function updateFamilyMemberSelector() {
    const selector = document.getElementById('bookingForMemberSelector');
    if (!selector) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    // Get user data
    db.collection('users').doc(user.uid).get().then(doc => {
        if (!doc.exists) return;
        const userData = doc.data();
        
        selector.innerHTML = `
            <option value="">حجز لنفسي (${userData.name})</option>
            ${familyMembers.map(member => `
                <option value="${member.id}">${member.name} (${member.relationship})</option>
            `).join('')}
        `;
    });
}

function getActiveBookingProfile() {
    const selector = document.getElementById('bookingForMemberSelector');
    const selectedMemberId = selector?.value;
    
    if (selectedMemberId) {
        // Booking for family member
        const member = familyMembers.find(m => m.id === selectedMemberId);
        if (member) {
            return {
                isFamilyMember: true,
                memberId: member.id,
                name: member.name,
                phone: member.phone || auth.currentUser.phoneNumber,
                age: calculateAge(member.dateOfBirth),
                gender: member.gender,
                allergies: member.allergies || '',
                chronicConditions: member.chronicConditions || [],
                currentMedications: member.currentMedications || ''
            };
        }
    }
    
    // Booking for primary user
    return {
        isFamilyMember: false,
        memberId: null
    };
}

// === Initialize on Auth State Change ===

function initializeFamilyManagement() {
    const user = auth.currentUser;
    if (!user) return;
    
    // Load family members
    loadFamilyMembers();
    
    // Restore active member from localStorage
    const savedActiveMemberId = localStorage.getItem('medconnect_active_member');
    if (savedActiveMemberId) {
        // Wait for family members to load, then set active
        setTimeout(() => {
            const member = familyMembers.find(m => m.id === savedActiveMemberId);
            if (member) {
                currentActiveMember = member;
                updateActiveMemberDisplay();
                displayFamilyMembers();
            }
        }, 1000);
    }
}

// === Export Functions ===
window.loadFamilyMembers = loadFamilyMembers;
window.showAddFamilyMemberModal = showAddFamilyMemberModal;
window.editFamilyMember = editFamilyMember;
window.saveFamilyMember = saveFamilyMember;
window.deleteFamilyMember = deleteFamilyMember;
window.switchToMember = switchToMember;
window.switchToPrimaryUser = switchToPrimaryUser;
window.getActiveBookingProfile = getActiveBookingProfile;
window.initializeFamilyManagement = initializeFamilyManagement;
