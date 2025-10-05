// Doctor dashboard functionality
import { auth, showNotification } from './firebase.js';

function mountDoctorApp() {
    const app = document.getElementById('doctorApp');
    
    app.innerHTML = `
        <!-- Navigation -->
        <nav class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-gradient-to-br from-green-600 to-teal-600 rounded-xl flex items-center justify-center ml-3">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                        </div>
                        <h1 class="text-xl font-bold text-gray-900">MedConnect - الأطباء</h1>
                    </div>
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <span class="text-green-600 font-semibold">د. أحمد محمد</span>
                        <button onclick="signOut()" class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                            تسجيل الخروج
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Doctor Dashboard -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="bg-white rounded-2xl shadow-xl p-8">
                <h2 class="text-3xl font-bold text-gray-900 mb-8">لوحة تحكم الطبيب</h2>
                
                <!-- Stats Cards -->
                <div class="grid md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-blue-50 p-6 rounded-xl border border-blue-200">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center ml-4">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-gray-900">١٢</p>
                                <p class="text-blue-600 font-medium">مواعيد اليوم</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-green-50 p-6 rounded-xl border border-green-200">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center ml-4">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-gray-900">٨٥</p>
                                <p class="text-green-600 font-medium">إجمالي المرضى</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-200">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center ml-4">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                            <div>
                                <p class="text-2xl font-bold text-gray-900">٣</p>
                                <p class="text-yellow-600 font-medium">في الانتظار</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Today's Appointments -->
                <div class="mb-8">
                    <h3 class="text-xl font-bold text-gray-900 mb-4">مواعيد اليوم</h3>
                    <div class="space-y-4">
                        <div class="bg-gray-50 p-4 rounded-lg border">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h4 class="font-semibold text-gray-900">أحمد علي محمد</h4>
                                    <p class="text-sm text-gray-600">٠٧٧١٢٣٤٥٦٧٨</p>
                                </div>
                                <div class="text-right">
                                    <p class="font-semibold text-blue-600">٩:٠٠ ص</p>
                                    <span class="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">مؤكد</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-gray-50 p-4 rounded-lg border">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h4 class="font-semibold text-gray-900">فاطمة حسن أحمد</h4>
                                    <p class="text-sm text-gray-600">٠٧٨٩٨٧٦٥٤٣</p>
                                </div>
                                <div class="text-right">
                                    <p class="font-semibold text-blue-600">٩:٣٠ ص</p>
                                    <span class="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">في الانتظار</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-gray-50 p-4 rounded-lg border">
                            <div class="flex justify-between items-center">
                                <div>
                                    <h4 class="font-semibold text-gray-900">محمد عبدالله سالم</h4>
                                    <p class="text-sm text-gray-600">٠٧٩١١٢٢٣٣٤</p>
                                </div>
                                <div class="text-right">
                                    <p class="font-semibold text-blue-600">١٠:٠٠ ص</p>
                                    <span class="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">مؤكد</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Schedule Management -->
                <div>
                    <h3 class="text-xl font-bold text-gray-900 mb-4">إدارة الجدول</h3>
                    <div class="grid md:grid-cols-2 gap-6">
                        <button class="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors text-center">
                            <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <p class="font-semibold">تحديث المواعيد المتاحة</p>
                        </button>
                        
                        <button class="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors text-center">
                            <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p class="font-semibold">تقارير المرضى</p>
                        </button>
                    </div>
                </div>
            </div>
        </main>
    `;
}

function signOut() {
    auth.signOut().then(() => {
        showNotification('تم تسجيل الخروج بنجاح', 'success');
        window.location.href = '/index.html';
    });
}

// Check authentication and mount app
auth.onAuthStateChanged(user => {
    if (user) {
        mountDoctorApp();
    } else {
        // Show login form or redirect
        window.location.href = '/index.html';
    }
});

// Make signOut globally available
window.signOut = signOut;