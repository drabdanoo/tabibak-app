/**
 * i18n.js — centralised Arabic UI strings
 *
 * Loaded as a plain global (window.STRINGS) so it works with the existing
 * non-module script architecture. Load this file BEFORE any deferred scripts.
 *
 * Usage:  showNotification(STRINGS.errors.loginRequired, 'error');
 *
 * Migration guide: grep a file for Arabic string literals, replace each one
 * with the matching STRINGS.* key below, then remove the raw literal.
 */

window.STRINGS = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    loginRequired:        'يرجى تسجيل الدخول أولاً',
    loginRequiredToBook:  'يرجى تسجيل الدخول أولاً لحجز موعد',
    logoutSuccess:        'تم تسجيل الخروج بنجاح',
    cannotChangePassword: 'لا يمكن تغيير كلمة المرور. يرجى إعادة تسجيل الدخول.',
    passwordMinLength:    'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    passwordChanged:      'تم تغيير كلمة المرور بنجاح. سيتم تسجيل الخروج الآن.',
    otpSent:              '✅ تم إرسال رمز التحقق إلى هاتفك',
    otpResent:            '✅ تم إرسال رمز جديد إلى هاتفك',
    enterOtp:             'يرجى إدخال الرمز المكون من 6 أرقام',
    invalidPhone:         'يرجى إدخال رقم هاتف عراقي صحيح (07XXXXXXXXX)',
    enterEmail:           'يرجى إدخال البريد الإلكتروني',
    resetEmailSent:       'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني بنجاح',
    switchedToPersonal:   'تم التبديل إلى حسابك الشخصي',
    dataLoadFailed:       'تعذر تحميل البيانات. سيتم تسجيل الخروج.',
  },

  // ── Appointments ──────────────────────────────────────────────────────────
  appointments: {
    booked:              '✓ تم تأكيد الحجز بنجاح',
    bookedNoSms:         '✓ تم تأكيد الحجز (لم يتم إرسال SMS)',
    bookedNoSmsUnverified: '✓ تم تأكيد الحجز (لم يتم إرسال SMS - رقم غير متحقق منه)',
    bookedWithSms:       '✓ تم تأكيد الحجز وإرسال SMS',
    rejected:            '✗ تم رفض الحجز',
    cancelled:           'تم إلغاء الموعد بنجاح',
    finished:            'تم إنهاء الموعد وحفظ الملاحظات',
    finishedWithFollowup:'تم إنهاء الموعد بنجاح وإضافة المريض لقائمة المتابعة',
    rescheduled:         '✓ تم إعادة جدولة الموعد بنجاح',
    rescheduleSent:      'تم إرسال طلب إعادة الجدولة بنجاح',
    statusUpdated:       'تم تحديث حالة الموعد بنجاح',
    alreadyBooked:       'هذا الموعد محجوز بالفعل. يرجى اختيار وقت آخر',
    duplicateConfirmed:  'يوجد موعد آخر مؤكد في نفس التاريخ والوقت',
    noPastBooking:       'لا يمكن حجز موعد في الماضي.',
    noPastConfirm:       'لا يمكن تأكيد موعد في الماضي',
    noPastApprove:       'لا يمكن الموافقة على موعد في الماضي',
    noPastReschedule:    'لا يمكن إعادة جدولة لموعد في الماضي',
    selectDateTime:      'يرجى اختيار التاريخ والوقت',
    selectTime:          'يرجى اختيار وقت للموعد',
    selectNewDateTime:   'يرجى اختيار تاريخ ووقت جديدين',
    enterCancelReason:   'يرجى كتابة سبب الإلغاء',
    notFound:            'لم يتم العثور على الموعد',
    notFoundOriginal:    'لم يتم العثور على الموعد الأصلي',
    dataNotFound:        'لم يتم العثور على بيانات الموعد',
    detailsNotFound:     'لم يتم العثور على تفاصيل الموعد',
    loadError:           'Error loading appointments',
    invalidTransition:   'Invalid status transition',
    closedClinic:        'Clinic is closed. Cannot confirm appointments.',
    noExport:            'No appointments to export',
    exported:            'Appointments exported successfully',
  },

  // ── Follow-up ─────────────────────────────────────────────────────────────
  followUp: {
    noPatients:     'لا توجد مرضى للمتابعة حالياً',
    booked:         'تم حجز موعد المتابعة بنجاح',
    fillAllFields:  'يرجى ملء جميع الحقول',
    futureDateOnly: 'يجب أن يكون موعد المتابعة في المستقبل',
    loadError:      'خطأ في تحميل التفاصيل',
    finishError:    'خطأ في إنهاء الموعد: ',
  },

  // ── Doctor ────────────────────────────────────────────────────────────────
  doctor: {
    notFound:           'لم يتم العثور على معلومات الطبيب',
    profileNotFound:    'لم يتم العثور على ملف الطبيب',
    dataLoadFailed:     'تعذر تحميل بيانات الطبيب. سيتم تسجيل الخروج.',
    unavailable:        'لم يعد الطبيب متاحاً للحجز',
    noList:             'لا تتوفر قائمة أطباء حالياً',
    profileUpdated:     'تم حفظ البيانات الشخصية بنجاح',
    avatarUpdated:      'تم تحديث الصورة الشخصية بنجاح',
    clinicSaved:        'تم حفظ إعدادات العيادة بنجاح',
    notFoundForAppt:    'لم يتم العثور على الطبيب لهذا الموعد',
    fillNameSpecialty:  'يرجى ملء الاسم والتخصص',
  },

  // ── Patient ───────────────────────────────────────────────────────────────
  patient: {
    infoMissing:    'معلومات المريض غير متوفرة',
    statusUpdated:  'تم تحديث حالة المريض',
  },

  // ── Notes ─────────────────────────────────────────────────────────────────
  notes: {
    saved:       'تم حفظ الملاحظات بنجاح',
    notesModal:  'Notes modal not found',
  },

  // ── Prescriptions ─────────────────────────────────────────────────────────
  prescriptions: {
    updated:       'تم تحديث الوصفة الطبية بنجاح',
    dataNotFound:  'بيانات الوصفة غير متوفرة',
    addMedicine:   'يرجى إضافة دواء واحد على الأقل',
    saveFirst:     'يرجى حفظ الوصفة أولاً',
  },

  // ── Lab orders ────────────────────────────────────────────────────────────
  lab: {
    dataNotFound:  'بيانات طلب التحاليل غير متوفرة',
    updated:       'تم تحديث طلب التحاليل بنجاح',
    selectOne:     'يرجى اختيار فحص واحد على الأقل',
    saveFirst:     'يرجى حفظ طلب التحاليل أولاً',
  },

  // ── EMR ───────────────────────────────────────────────────────────────────
  emr: {
    unavailable:       'نظام السجل الطبي غير متاح حالياً',
    diagnosisAdded:    'تم إضافة التشخيص بنجاح',
    diagnosisDeleted:  'تم حذف التشخيص',
    enterDiagnosis:    'يرجى إدخال رمز التشخيص والوصف',
    treatmentAdded:    'تم إضافة خطة العلاج بنجاح',
    treatmentDeleted:  'تم حذف خطة العلاج',
    enterTreatment:    'يرجى إدخال الحالة وخطة العلاج',
    vitalsAdded:       'تم إضافة العلامات الحيوية بنجاح',
    vitalsDeleted:     'تم حذف العلامات الحيوية',
    enterOneVital:     'يرجى إدخال قيمة واحدة على الأقل',
    historyUpdated:    'تم تحديث التاريخ الطبي بنجاح',
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  templates: {
    created:         'تم إنشاء القالب بنجاح',
    updated:         'تم تحديث القالب بنجاح',
    deleted:         'تم حذف القالب بنجاح',
    insertedNotes:   'تم إدراج القالب في الملاحظات',
    insertedInstructions: 'تم إدراج القالب في التعليمات',
    insertedPrescription: 'تم إدراج القالب في الوصفة الطبية',
  },

  // ── Family members ────────────────────────────────────────────────────────
  family: {
    added:    'تم إضافة فرد العائلة بنجاح',
    updated:  'تم تحديث بيانات فرد العائلة بنجاح',
    deleted:  'تم حذف فرد العائلة بنجاح',
  },

  // ── Documents / files ─────────────────────────────────────────────────────
  documents: {
    notFound:       'لم يتم العثور على المستند',
    imageOnly:      'الرجاء اختيار ملف صورة فقط',
    unavailable:    'الملف غير متوفر',
  },

  // ── Ratings ───────────────────────────────────────────────────────────────
  ratings: {
    selectOne: 'يرجى اختيار تقييم (نجمة واحدة على الأقل)',
  },

  // ── Generic ───────────────────────────────────────────────────────────────
  generic: {
    fillAllFields:        'يرجى ملء جميع الحقول',
    fillRequiredFields:   'يرجى ملء جميع الحقول المطلوبة',
    rescheduleIncomplete: 'بيانات إعادة الجدولة غير مكتملة',
  },
};
