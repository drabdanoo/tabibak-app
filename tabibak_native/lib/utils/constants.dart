class AppConstants {
  // App Info
  static const String appName = 'طبيبك';
  static const String appVersion = '1.0.0';
  
  // Firestore Collections
  static const String doctorsCollection = 'doctors';
  static const String patientsCollection = 'patients';
  static const String appointmentsCollection = 'appointments';
  static const String receptionistsCollection = 'receptionists';
  static const String medicalDocumentsCollection = 'medicalDocuments';
  static const String ratingsCollection = 'ratings';
  
  // User Roles
  static const String rolePatient = 'patient';
  static const String roleDoctor = 'doctor';
  static const String roleReceptionist = 'receptionist';
  
  // Appointment Status
  static const String statusPending = 'pending';
  static const String statusConfirmed = 'confirmed';
  static const String statusCompleted = 'completed';
  static const String statusCancelled = 'cancelled';
  static const String statusRescheduled = 'rescheduled';
  
  // Shared Preferences Keys
  static const String keyUserRole = 'user_role';
  static const String keyUserId = 'user_id';
  static const String keyUserPhone = 'user_phone';
  static const String keyIsLoggedIn = 'is_logged_in';
  
  // Date Formats
  static const String dateFormat = 'yyyy-MM-dd';
  static const String timeFormat = 'HH:mm';
  static const String dateTimeFormat = 'yyyy-MM-dd HH:mm';
  static const String arabicDateFormat = 'dd/MM/yyyy';
  
  // Validation
  static const int minPasswordLength = 6;
  static const int otpLength = 6;
  static const int otpTimeoutSeconds = 60;
  
  // UI
  static const double defaultPadding = 16.0;
  static const double defaultBorderRadius = 12.0;
  static const double cardElevation = 2.0;
}

class AppStrings {
  // Arabic Strings
  static const String welcome = 'مرحباً';
  static const String login = 'تسجيل الدخول';
  static const String logout = 'تسجيل الخروج';
  static const String register = 'تسجيل جديد';
  static const String phone = 'رقم الهاتف';
  static const String password = 'كلمة المرور';
  static const String email = 'البريد الإلكتروني';
  static const String name = 'الاسم';
  static const String confirm = 'تأكيد';
  static const String cancel = 'إلغاء';
  static const String save = 'حفظ';
  static const String edit = 'تعديل';
  static const String delete = 'حذف';
  static const String search = 'بحث';
  static const String filter = 'تصفية';
  static const String loading = 'جاري التحميل...';
  static const String error = 'خطأ';
  static const String success = 'نجح';
  static const String noData = 'لا توجد بيانات';
  
  // Roles
  static const String patient = 'مريض';
  static const String doctor = 'طبيب';
  static const String receptionist = 'سكرتير';
  
  // Appointment
  static const String appointment = 'موعد';
  static const String appointments = 'المواعيد';
  static const String bookAppointment = 'حجز موعد';
  static const String myAppointments = 'مواعيدي';
  static const String appointmentDetails = 'تفاصيل الموعد';
  
  // Status
  static const String pending = 'قيد الانتظار';
  static const String confirmed = 'مؤكد';
  static const String completed = 'مكتمل';
  static const String cancelled = 'ملغى';
  
  // Errors
  static const String errorGeneral = 'حدث خطأ ما';
  static const String errorNetwork = 'خطأ في الاتصال بالإنترنت';
  static const String errorInvalidPhone = 'رقم الهاتف غير صحيح';
  static const String errorInvalidEmail = 'البريد الإلكتروني غير صحيح';
  static const String errorInvalidPassword = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  static const String errorInvalidOTP = 'رمز التحقق غير صحيح';
}
