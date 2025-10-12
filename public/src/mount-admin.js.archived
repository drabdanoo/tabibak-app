// Admin dashboard functionality
import { auth, showNotification } from './firebase.js';

function mountAdminApp() {
    const app = document.getElementById('adminApp');
    
    app.innerHTML = `
        <!-- Navigation -->
        <nav class="bg-white shadow-sm">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center ml-3">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                            </svg>
                        </div>
                        <h1 class="text-xl font-bold text-gray-900">MedConnect - الإدارة</h1>
                    </div>
                    <div class="flex items-center space-x-4 space-x-reverse">
                        <span class="text-purple-600 font-semibold">مدير النظام</span>
                        <button onclick="signOut()" class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
                            تسجيل الخروج
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Admin Dashboard -->
        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="bg-white rounded-2xl shadow-xl p-8">
                <h2 class="text-3xl font-bold text-gray-900 mb-8">لوحة تحكم الإدارة</h2>
                
                <!-- System Stats -->
                <div class="grid md:grid-cols-4 gap-6 mb-8">
                    <div class="bg-blue-50 p-6 rounded-xl border border-blue-200">
                        <div class="text-center">
                            <div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                            </div>
                            <p class="text-2xl font-bold text-gray-900">١٥</p>
                            <p class="text-blue-600 font-medium">إجمالي الأطباء</p>
                        </div>
                    </div>
                    
                    <div class="bg-green-50 p-6 rounded-xl border border-green-200">
                        <div class="text-center">
                            <div class="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                            </div>
                            <p class="text-2xl font-bold text-gray-900">٣٤٢</p>
                            <p class="text-green-600 font-medium">إجمالي المرضى</p>
                        </div>
                    </div>
                    
                    <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-200">
                        <div class="text-center">
                            <div class="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                            </div>
                            <p class="text-2xl font-bold text-gray-900">٨٧</p>
                            <p class="text-yellow-600 font-medium">مواعيد اليوم</p>
                        </div>
                    </div>
                    
                    <div class="bg-purple-50 p-6 rounded-xl border border-purple-200">
                        <div class="text-center">
                            <div class="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                </svg>
                            </div>
                            <p class="text-2xl font-bold text-gray-900">٩٨.٥٪</p>
                            <p class="text-purple-600 font-medium">معدل الحضور</p>
                        </div>
                    </div>
                </div>

                <!-- Management Actions -->
                <div class="grid md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">إدارة الأطباء</h3>
                        <div class="space-y-3">
                            <button class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                                إضافة طبيب جديد
                            </button>
                            <button class="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors">
                                عرض جميع الأطباء
                            </button>
                        </div>
                    </div>
                    
                    <div class="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">إدارة المواعيد</h3>
                        <div class="space-y-3">
                            <button class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                                عرض المواعيد
                            </button>
                            <button class="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors">
                                إحصائيات المواعيد
                            </button>
                        </div>
                    </div>
                    
                    <div class="bg-white border border-gray-200 rounded-xl p-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-4">التقارير</h3>
                        <div class="space-y-3">
                            <button class="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors">
                                تقرير شهري
                            </button>
                            <button class="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors">
                                تصدير البيانات
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div>
                    <h3 class="text-xl font-bold text-gray-900 mb-4">النشاط الأخير</h3>
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="space-y-3">
                            <div class="flex justify-between items-center py-2 border-b border-gray-200">
                                <span class="text-gray-700">تم تسجيل مريض جديد: أحمد علي محمد</span>
                                <span class="text-sm text-gray-500">منذ ٥ دقائق</span>
                            </div>
                            <div class="flex justify-between items-center py-2 border-b border-gray-200">
                                <span class="text-gray-700">تم حجز موعد مع د. سارة أحمد</span>
                                <span class="text-sm text-gray-500">منذ ١٠ دقائق</span>
                            </div>
                            <div class="flex justify-between items-center py-2">
                                <span class="text-gray-700">تم إلغاء موعد مع د. عمر حسن</span>
                                <span class="text-sm text-gray-500">منذ ١٥ دقيقة</span>
                            </div>
                        </div>
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
        mountAdminApp();
    } else {
        // Show login form or redirect
        window.location.href = '/index.html';
    }
});

// Make signOut globally available
window.signOut = signOut;