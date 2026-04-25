/**
 * Arabic (RTL) translation dictionary — Tabibok Health
 * Iraqi Arabic dialect where natural; formal MSA for medical terms
 */
export default {
  // ─── Common ────────────────────────────────────────────────────────────────
  common: {
    save:          'حفظ',
    cancel:        'إلغاء',
    confirm:       'تأكيد',
    delete:        'حذف',
    edit:          'تعديل',
    close:         'إغلاق',
    back:          'رجوع',
    next:          'التالي',
    done:          'تم',
    retry:         'إعادة المحاولة',
    search:        'بحث',
    filter:        'تصفية',
    all:           'الكل',
    loading:       'جاري التحميل…',
    noResults:     'لا توجد نتائج',
    error:         'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    networkError:  'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.',
    required:      'هذا الحقل مطلوب',
    optional:      'اختياري',
    yes:           'نعم',
    no:            'لا',
    or:            'أو',
    and:           'و',
  },

  // ─── Navigation tabs ───────────────────────────────────────────────────────
  nav: {
    home:          'الرئيسية',
    appointments:  'المواعيد',
    documents:     'الوثائق',
    profile:       'الملف الشخصي',
    dashboard:     'لوحة التحكم',
    notifications: 'الإشعارات',
    settings:      'الإعدادات',
    chat:          'المحادثة',
  },

  // ─── Role selection ────────────────────────────────────────────────────────
  roles: {
    patient:             'مريض',
    patientDesc:         'احجز مواعيد واطّلع على سجلاتك الطبية',
    doctor:              'طبيب',
    doctorDesc:          'أدر المواعيد وسجلات المرضى',
    receptionist:        'موظف استقبال',
    receptionistDesc:    'أكّد المواعيد وأدر الجدول الزمني',
  },

  // ─── Authentication ────────────────────────────────────────────────────────
  auth: {
    welcome:             'أهلاً بك في Vanbook',
    selectRole:          'اختر دورك للمتابعة',
    patient:             'مريض',
    doctor:              'طبيب',
    receptionist:        'موظف استقبال',
    phoneNumber:         'رقم الهاتف',
    phoneHint:           'أدخل رقم هاتفك العراقي',
    sendOtp:             'إرسال الرمز',
    otpTitle:            'أدخل رمز التحقق',
    otpSubtitle:         'أرسلنا رمزاً مكوناً من 6 أرقام إلى {{phone}}',
    otpPlaceholder:      'الرمز',
    verifyOtp:           'تحقق',
    resendOtp:           'إعادة إرسال الرمز',
    resendIn:            'إعادة الإرسال خلال {{seconds}} ث',
    emailLogin:          'تسجيل الدخول بالبريد الإلكتروني',
    email:               'البريد الإلكتروني',
    password:            'كلمة المرور',
    signIn:              'تسجيل الدخول',
    signOut:             'تسجيل الخروج',
    profileSetup:        'أكمل ملفك الشخصي',
    fullName:            'الاسم الكامل',
    dateOfBirth:         'تاريخ الميلاد',
    gender:              'الجنس',
    male:                'ذكر',
    female:              'أنثى',
    completeProfile:     'متابعة',
    profileSubtitle:     'بعض التفاصيل لإتمام إنشاء حسابك',
    profileDoctorNote:   'اسمك وتاريخ ميلادك يُستخدمان للتحقق من هويتك.',
    fullNamePlaceholder: 'كما هو مكتوب في بطاقة هويتك',
    dobHint:             'اضغط لاختيار تاريخ ميلادك',
    dobFuture:           'تاريخ الميلاد لا يمكن أن يكون في المستقبل.',
    profileRequired:     'يرجى تعبئة جميع الحقول المطلوبة.',
    // Staff email login
    staffLoginSubtitle:  'سجّل دخولك ببيانات اعتمادك',
    emailPlaceholder:    'أدخل بريدك الإلكتروني',
    passwordPlaceholder: 'أدخل كلمة المرور',
    requiredFields:      'يرجى إدخال البريد الإلكتروني وكلمة المرور.',
    accessDenied:        'هذا الحساب غير مسجّل كـ {{role}}.',
    loginFailed:         'بيانات اعتماد خاطئة. يرجى المحاولة مرة أخرى.',
    loginError:          'حدث خطأ ما. يرجى المحاولة مرة أخرى.',

    invalidPhone:        'أدخل رقم هاتف عراقي صحيح',
    invalidOtp:          'الرمز غير صحيح. يرجى المحاولة مرة أخرى.',
    authError:           'فشل التحقق. يرجى المحاولة مرة أخرى.',
    phoneHelper:         'رقم عراقي من 10 أرقام، بدون الصفر الأول',
    errors: {
      invalidCode:     'الرمز غير صحيح. تحقق منه وحاول مرة أخرى.',
      codeExpired:     'انتهت صلاحية الرمز. اطلب رمزاً جديداً.',
      tooManyRequests: 'محاولات كثيرة. انتظر قليلاً قبل المحاولة مجدداً.',
      sessionExpired:  'انتهت الجلسة. اطلب رمزاً جديداً.',
      webUnsupported:  'تسجيل الدخول بالهاتف متاح فقط في التطبيق.',
      generic:         'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    },
  },

  // ─── Appointments ──────────────────────────────────────────────────────────
  appointments: {
    title:           'المواعيد',
    upcoming:        'القادمة',
    past:            'السابقة',
    book:            'حجز موعد',
    noUpcoming:      'لا توجد مواعيد قادمة',
    noPast:          'لا توجد مواعيد سابقة',
    date:            'التاريخ',
    time:            'الوقت',
    reason:          'سبب الزيارة',
    notes:           'ملاحظات',
    fee:             'رسوم الاستشارة',
    duration:        'المدة',
    cancel:          'إلغاء الموعد',
    cancelConfirm:   'هل أنت متأكد من إلغاء هذا الموعد؟',
    confirmAction:   'تأكيد',
    declineAction:   'رفض',
    checkInAction:   'تسجيل الحضور',
    sendToDoctorAction: 'إرسال إلى الطبيب',
    viewEMR:         'عرض السجل الطبي',
    writeNotes:      'كتابة ملاحظات',
    prescription:    'وصفة طبية',
    walkIn:          'حضور مباشر',
    status: {
      pending:       'قيد الانتظار',
      confirmed:     'مؤكد',
      waiting:       'في غرفة الانتظار',
      in_progress:   'مع الطبيب',
      completed:     'مكتمل',
      cancelled:     'ملغى',
      no_show:       'لم يحضر',
    },

    // Booking form
    selectDate:            'اختر التاريخ',
    selectTime:            'اختر الوقت',
    today:                 'اليوم',
    loadingSlots:          'جاري تحميل الأوقات المتاحة…',
    noSlotsTitle:          'لا توجد أوقات متاحة',
    noSlotsSub:            'هذا اليوم محجوز بالكامل أو العيادة مغلقة. جرّب يوماً آخر.',
    bookingFor:            'الحجز لصالح',
    forMyself:             'لنفسي',
    forFamilyMember:       'أحد أفراد الأسرة',
    familyMemberName:      'اسم فرد الأسرة كاملاً',
    familyNamePlaceholder: 'أدخل الاسم الكامل',
    reasonTitle:           'سبب الزيارة',
    reasonLabel:           'صف أعراضك أو مخاوفك',
    reasonPlaceholder:     'مثال: فحص دوري، صداع مستمر، متابعة نتائج التحاليل…',
    medicalHistoryTitle:   'التاريخ المرضي',
    medicalHistorySub:     'ساعد الطبيب على الاستعداد لزيارتك. جميع المعلومات سرية.',
    allergiesLabel:        'الحساسية',
    allergiesPlaceholder:  'مثال: البنسلين، الفول السوداني — أو لا يوجد',
    medicationsLabel:      'الأدوية الحالية',
    medicationsPlaceholder:'اذكر جميع الأدوية التي تتناولها — أو لا يوجد',
    conditionsLabel:       'الأمراض المزمنة',
    conditionsPlaceholder: 'مثال: السكري، ارتفاع ضغط الدم، الربو — أو لا يوجد',
    additionalNotesTitle:  'ملاحظات إضافية',
    notesPlaceholder:      'أي تفاصيل أخرى، اللغة المفضلة، احتياجات خاصة…',
    privacyNote:           'معلوماتك الطبية مشفّرة ولا يراها إلا طبيبك المعالج.',
    confirmBooking:        'تأكيد الحجز',
    bookingSuccess:        'تم تقديم الطلب',
    bookingSuccessMsg:     'تم تقديم موعدك مع {{doctor}} بتاريخ {{date}} الساعة {{time}}. ستُبلَّغ فور تأكيد الطبيب.',
    viewAppointments:      'عرض المواعيد',
    reasonRequired:        'يرجى وصف سبب زيارتك.',
    familyNameRequired:    'يرجى إدخال الاسم الكامل لفرد الأسرة.',
  },

  // ─── Doctors ───────────────────────────────────────────────────────────────
  doctors: {
    title:           'الأطباء',
    findDoctor:      'ابحث عن طبيب',
    specialty:       'التخصص',
    allSpecialties:  'جميع التخصصات',
    rating:          'التقييم',
    experience:      'الخبرة',
    experienceYears: '{{n}} سنوات',
    fee:             'الرسوم',
    available:       'متاح',
    unavailable:     'غير متاح اليوم',
    bookNow:         'احجز الآن',
    viewProfile:     'عرض الملف',
    workingHours:    'ساعات العمل',
    education:       'التعليم',
    languages:       'اللغات',
    about:           'نبذة',
    noResults:       'لا يوجد أطباء لـ "{{query}}"',

    // ── شاشة ملف الطبيب (عرض عام من جانب المريض) ────────────────────────
    drPrefix:        'د.',
    availableNow:    'متاح الآن',
    unavailableNow:  'غير متاح',
    ratingLabel:     'التقييم',
    experienceSuffix: 'سنوات خبرة',
    feeLabel:        'الرسوم',
    bioTitle:        'نبذة عن الطبيب',
    hoursTitle:      'ساعات العمل',
    eduTitle:        'التعليم والمؤهلات',
    langTitle:       'اللغات',
    dayOff:          'إجازة',
    showMore:        'عرض المزيد',
    showLess:        'عرض أقل',
    bookAppointment: 'احجز موعداً',
    chatAction:      'مراسلة',
    unavailableNote: 'الطبيب لا يقبل المواعيد حالياً.',
    profileLoadError:'تعذّر تحميل ملف الطبيب.',
    days: {
      monday:    'الاثنين',
      tuesday:   'الثلاثاء',
      wednesday: 'الأربعاء',
      thursday:  'الخميس',
      friday:    'الجمعة',
      saturday:  'السبت',
      sunday:    'الأحد',
    },
  },

  // ─── Patient ───────────────────────────────────────────────────────────────
  patient: {
    profile:         'ملفي الشخصي',
    medicalDocuments:'وثائقي الطبية',
    uploadDocument:  'رفع وثيقة',
    noDocuments:     'لا توجد وثائق بعد',
    bloodType:       'فصيلة الدم',
    allergies:       'الحساسية',
    medications:     'الأدوية الحالية',
    conditions:      'الأمراض المزمنة',

    // ── شاشة الملف الشخصي للمريض ─────────────────────────────────────────
    profileScreen: {
      patientLabel:        'مريض',
      personalInfo:        'المعلومات الشخصية',
      fullName:            'الاسم الكامل',
      fullNamePlaceholder: 'أدخل اسمك الكامل',
      phone:               'رقم الهاتف',
      gender:              'الجنس',
      male:                'ذكر',
      female:              'أنثى',
      bloodType:           'فصيلة الدم',
      saveChanges:         'حفظ التغييرات',
      saveSuccess:         'تم تحديث الملف الشخصي بنجاح.',
      saveError:           'تعذّر حفظ التغييرات. حاول مجدداً.',
      logOut:              'تسجيل الخروج',
      logOutError:         'تعذّر تسجيل الخروج. حاول مجدداً.',
      loadError:           'تعذّر تحميل ملفك الشخصي.',
      quickActions:        'إجراءات سريعة',
      myAppointments:      'مواعيدي',
      myDocuments:         'وثائقي',
    },
  },

  // ─── Doctor ────────────────────────────────────────────────────────────────
  doctor: {
    dashboard:          'لوحة التحكم',
    todaySchedule:      'جدول اليوم',
    pendingRequests:    'الطلبات المعلقة',
    stats: {
      today:            'مرضى اليوم',
      pending:          'معلق',
      completed:        'مكتمل',
      remaining:        'متبقي',
    },
    patientDetails:     'تفاصيل المريض',
    visitNotes:         'ملاحظات الزيارة',
    noSchedule:         'لا توجد مواعيد اليوم',
    noScheduleSub:      'استمتع بيومك أو تحقق من الطلبات المعلقة أعلاه.',
    noPending:          'لا توجد طلبات معلقة',

    // Greetings
    greetingMorning:    'صباح الخير',
    greetingAfternoon:  'مساء الخير',
    greetingEvening:    'مساء الخير',
    drPrefix:           'د.',

    // Pending carousel empty state
    allCaughtUp:        'أنت في الموعد!',
    allCaughtUpSub:     'لا توجد طلبات حجز معلقة.',

    // Section links
    seeAll:             'عرض الكل',

    // Actions
    accept:             'قبول',
    decline:            'رفض',
    markDone:           'تم الانتهاء',
    done:               'تم',
    updating:           'جاري التحديث…',
    forFamily:          'لـ: {{name}}',

    // Decline confirmation alert
    declineTitle:       'رفض الطلب',
    declineMessage:     'هل تريد رفض طلب {{patient}} بتاريخ {{date}}؟\n\nسيتم إشعار المريض.',
    declineKeep:        'إبقاء',
    declineConfirm:     'نعم، رفض',

    // Analytics
    analytics: {
      title:             'الإيرادات والإحصائيات',
      todayRevenue:      'إيرادات اليوم',
      weekRevenue:       'هذا الأسبوع',
      feePerVisit:       'رسوم الزيارة',
      patientsThisWeek:  'المرضى هذا الأسبوع',
    },

    // Error messages
    acceptError:        'تعذّر قبول الموعد. يرجى المحاولة مجدداً.',
    declineError:       'تعذّر رفض الموعد. يرجى المحاولة مجدداً.',
    markDoneError:      'تعذّر تحديث الموعد. يرجى المحاولة مجدداً.',
    loadError:          'فشل تحميل لوحة التحكم. يرجى المحاولة مجدداً.',

    // ── EMR (Electronic Medical Record) ──────────────────────────────────────
    emr: {
      title:              'السجل الطبي',
      loadError:          'تعذّر تحميل السجل الطبي. يرجى المحاولة مجدداً.',

      // Tabs
      tabOverview:        'نظرة عامة',
      tabEncounters:      'الزيارات',
      tabDocuments:       'المستندات',

      // Overview — demographics
      demographics:       'بيانات المريض',
      name:               'الاسم',
      phone:              'الهاتف',
      email:              'البريد الإلكتروني',
      age:                'العمر',
      ageYears:           '{{n}} سنة',
      gender:             'الجنس',
      genderMale:         'ذكر',
      genderFemale:       'أنثى',
      bloodType:          'فصيلة الدم',
      city:               'المدينة',

      // Overview — medical history
      allergies:          'الحساسيات',
      medications:        'الأدوية الحالية',
      conditions:         'الأمراض المزمنة',
      noAllergies:        'لا توجد حساسيات مسجّلة',
      noMedications:      'لا توجد أدوية مسجّلة',
      noConditions:       'لا توجد أمراض مزمنة مسجّلة',

      // Encounters
      noEncounters:       'لا توجد زيارات سابقة',
      noEncountersSub:    'ستظهر الزيارات المكتملة هنا',
      reason:             'السبب',
      clinicalNotes:      'ملاحظات سريرية',
      diagnosis:          'التشخيص',
      prescriptions:      'الأدوية الموصوفة',
      showMore:           'عرض المزيد',
      showLess:           'عرض أقل',

      // Documents
      noDocuments:        'لا توجد مستندات',
      noDocumentsSub:     'لم يرفع المريض أي مستندات بعد',
      docDefaultTitle:    'مستند',
      cannotOpen:         'تعذّر فتح الملف. لا يوجد تطبيق مدعوم.',
      openError:          'تعذّر فتح المستند.',

      // Document categories
      catLab:             'مختبر',
      catImaging:         'تصوير',
      catPrescription:    'وصفة طبية',
      catReport:          'تقرير',
      catGeneral:         'عام',
    },
  },

  // ─── Receptionist ──────────────────────────────────────────────────────────
  receptionist: {
    dashboard:       'لوحة التحكم',
    walkInBooking:   'تسجيل حضور مباشر',
    registerPatient: 'تسجيل مريض',
    allDoctors:      'جميع الأطباء',
    searchPatient:   'ابحث عن المريض بالاسم أو الهاتف…',
    createPatient:   'إنشاء مريض جديد',
    selectDoctor:    'اختر طبيباً',
    selectTimeSlot:  'اختر وقت الموعد',
    forceFit:        'حضور مباشر (بدون موعد)',
    forceFitHint:    'سينتظر المريض في الطابور',
    bookAppointment: 'حجز الموعد',
    noSlots:         'لا توجد أوقات متاحة',

    // ── شاشة تسجيل الحضور المباشر ─────────────────────────────────────────
    walkIn: {
      title:               'تسجيل حضور مباشر',
      stepPatient:         'الخطوة ١ — البحث عن المريض',
      stepDoctor:          'الخطوة ٢ — تحديد الطبيب',

      // البحث برقم الهاتف
      phoneLabel:          'رقم الهاتف',
      phonePlaceholder:    'أدخل رقم هاتف المريض',
      searching:           'جارٍ البحث…',
      patientFound:        'مريض موجود — اضغط للاختيار',
      patientNotFound:     'لم يُعثر على مريض — أدخل البيانات أدناه',
      select:              'اختيار',
      changePatient:       'تغيير',

      // التسجيل السريع
      fastReg:             'تسجيل سريع',
      fullName:            'الاسم الكامل',
      fullNamePlaceholder: 'اسم المريض الكامل',
      gender:              'الجنس',
      male:                'ذكر',
      female:              'أنثى',

      // اختيار الطبيب
      selectDoctor:        'اختر الطبيب',
      noDoctor:            'لا يوجد أطباء متاحون',
      loadDoctorsError:    'تعذّر تحميل قائمة الأطباء.',

      // الإرسال
      addToQueue:          'إضافة للطابور (زيارة مباشرة)',
      successMsg:          'تمّت إضافة المريض إلى طابور الانتظار.',

      // أخطاء التحقق
      nameRequired:        'الرجاء إدخال اسم المريض الكامل.',
      genderRequired:      'الرجاء تحديد جنس المريض.',
      doctorRequired:      'الرجاء اختيار طبيب.',
      submitError:         'تعذّر الإضافة إلى الطابور. حاول مجدداً.',
    },

    // ── شاشة إدارة المواعيد ────────────────────────────────────────────────
    apptMgmt: {
      title:                'إدارة المواعيد',
      searchPlaceholder:    'ابحث عن مريض بالاسم أو الهاتف…',

      // أزرار فلتر الحالة
      filterAll:            'الكل',

      // حالة عدم وجود مواعيد
      noAppointments:       'لا توجد مواعيد لهذا اليوم',
      noAppointmentsSub:    'اختر تاريخاً مختلفاً أو سجّل زيارة مباشرة.',

      // خطأ في التحميل
      loadError:            'تعذّر تحميل المواعيد. حاول مجدداً.',

      // أزرار الإجراءات
      accept:               'قبول',
      decline:              'رفض',
      checkIn:              'تسجيل وصول المريض',
      sendToDoctor:         'إرسال للطبيب',

      // رسائل الحالات النهائية (بدون أزرار إجراءات)
      statusInProgress:     'المريض مع الطبيب الآن',
      statusCompleted:      'تمّت الزيارة',
      statusCancelled:      'الموعد ملغى',

      // أخطاء الإجراءات المضمّنة
      acceptError:          'تعذّر قبول الموعد. حاول مجدداً.',
      declineError:         'تعذّر رفض الموعد. حاول مجدداً.',
      checkInError:         'تعذّر تسجيل وصول المريض. حاول مجدداً.',
      sendError:            'تعذّر الإرسال للطبيب. حاول مجدداً.',

      // تسميات حقول نافذة التفاصيل
      dateLabel:            'التاريخ',
      timeLabel:            'الوقت',
      doctorLabel:          'الطبيب',
      reasonLabel:          'السبب',
      notesLabel:           'ملاحظات',
    },
  },

  // ─── Chat ──────────────────────────────────────────────────────────────────
  chat: {
    title:           'المحادثة',
    placeholder:     'اكتب رسالة…',
    send:            'إرسال',
    noMessages:      'لا رسائل بعد. قل مرحباً!',
    online:          'متصل',
    offline:         'غير متصل',

    // ── مفاتيح المرحلة 4 ──────────────────────────────────────────────────
    startConversation:    'ابدأ المحادثة',
    startConversationSub: 'أرسل رسالة لـ {{name}} للبدء.',
    today:                'اليوم',
    yesterday:            'أمس',
    loadError:            'تعذّر تحميل الرسائل. يرجى المحاولة مجدداً.',
    sendError:            'فشل إرسال الرسالة. اضغط للمحاولة مجدداً.',
    noRecipient:          'لم يتم تحديد المستقبِل.',
    online2:              'متاح الآن',
  },

  // ─── Documents ─────────────────────────────────────────────────────────────
  documents: {
    title:           'الوثائق الطبية',
    upload:          'رفع وثيقة',
    noDocuments:     'لم يتم رفع أي وثائق بعد',
    pdf:             'PDF',
    image:           'صورة',
    uploadedOn:      'رُفعت في {{date}}',
    open:            'فتح',
    delete:          'حذف',
    deleteConfirm:   'حذف هذه الوثيقة نهائياً؟',

    // ── خزنة الوثائق الطبية (المرحلة 4) ─────────────────────────────────

    // الحالة الفارغة
    emptyState:      'لا توجد وثائق طبية بعد',
    emptyStateSub:   'ارفع نتائج التحاليل والروشتات والتقارير لحفظها في مكان آمن.',

    // زر الرفع
    uploadNew:       'رفع وثيقة جديدة',

    // تقدم الرفع
    uploading:       'جاري الرفع…',
    uploadError:     'فشل الرفع. يرجى المحاولة مجدداً.',

    // خطأ تحميل القائمة
    loadError:       'تعذّر تحميل الوثائق. يرجى المحاولة مجدداً.',

    // نافذة اختيار المصدر
    chooseSource:    'إضافة وثيقة',
    sourceCamera:    'الكاميرا',
    sourceGallery:   'المعرض',
    permCamera:      'يجب السماح بالوصول للكاميرا من إعدادات الجهاز.',
    permGallery:     'يجب السماح بالوصول للصور من إعدادات الجهاز.',

    // نافذة تفاصيل الوثيقة
    docDetails:      'تفاصيل الوثيقة',
    titleLabel:      'عنوان الوثيقة',
    titlePlaceholder:'مثال: نتيجة تحليل الدم',
    titleRequired:   'يرجى إدخال عنوان للوثيقة.',
    categoryLabel:   'الفئة',
    descLabel:       'وصف (اختياري)',
    descPlaceholder: 'أضف ملاحظة عن هذه الوثيقة…',
    uploadConfirm:   'رفع',
    cancel:          'إلغاء',
    back:            'رجوع',

    // نافذة تأكيد الحذف
    deleteTitle:     'حذف الوثيقة',
    deleteMsg:       'حذف "{{title}}"؟ لا يمكن التراجع عن هذا الإجراء.',
    deleteConfirmBtn:'حذف',
    deleteError:     'تعذّر حذف الوثيقة. يرجى المحاولة مجدداً.',

    // خطأ الفتح
    openError:       'لا يمكن فتح هذا الملف على جهازك.',

    // أسماء الفئات
    catAll:          'الكل',
    catLab:          'مختبر',
    catImaging:      'أشعة',
    catPrescription: 'روشتة',
    catReport:       'تقرير',
    catGeneral:      'عام',

    // عداد الوثائق
    docCount:        '{{n}} وثيقة',

    // ── نافذة العرض ────────────────────────────────────────────────────────
    closeViewer:          'إغلاق',
    pdfPreviewUnavailable:'معاينة PDF غير متاحة داخل التطبيق.',
    openInBrowser:        'فتح في المتصفح',

    // ── مشاركة مع طبيب ─────────────────────────────────────────────────────
    shareToDoctor:        'مشاركة مع طبيب',
    selectDoctor:         'اختر طبيباً',
    sharedMessage:        '📎 تمت مشاركة وثيقة طبية',
    sharing:              'جاري المشاركة…',
    shareError:           'تعذّرت المشاركة. يرجى المحاولة مجدداً.',
    loadDoctorsError:     'تعذّر تحميل قائمة الأطباء. يرجى المحاولة مجدداً.',
    noDoctors:            'لا يوجد أطباء.',

    // ── نموذج التحكم في الوصول بالموافقة ────────────────────────────────────
    manageAccess:         'إدارة الوصول',
    accessControl:        'التحكم في وصول الأطباء',
    accessControlSub:     'حدّد الأطباء الذين يمكنهم الاطلاع على هذه الوثيقة.',
    sharedWith:           'مشترك مع {{n}} طبيب (أطباء)',
    notShared:            'غير مشترك مع أي طبيب',
    grantAccess:          'منح الوصول',
    revokeAccess:         'سحب الوصول',
    accessUpdated:        'تم تحديث صلاحية الوصول.',
    accessError:          'تعذّر تحديث الوصول. يرجى المحاولة مجدداً.',
    noAppointmentDoctors: 'لا يوجد أطباء من مواعيدك بعد.',
  },

  // ─── الإشعارات ─────────────────────────────────────────────────────────────
  notifications: {
    title:          'الإشعارات',
    empty:          'لا توجد إشعارات بعد',
    emptySub:       'ستظهر هنا تحديثات المواعيد والرسائل.',
    markAllRead:    'تحديد الكل كمقروء',
    markAllReadDone:'تم تحديد جميع الإشعارات كمقروءة.',
    loadError:      'تعذّر تحميل الإشعارات. يرجى المحاولة مجدداً.',

    // تسميات الوقت
    justNow:        'الآن',
    minutesAgo:     'منذ {{n}} د',
    hoursAgo:       'منذ {{n}} س',
    daysAgo:        'منذ {{n}} ي',

    // تسميات النوع
    typeChat:        'رسالة جديدة',
    typeAppointment: 'تحديث موعد',
    typeGeneral:     'إشعار',
    unread:          'غير مقروء',
  },

  // ─── Errors ────────────────────────────────────────────────────────────────
  errors: {
    generic:         'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    network:         'خطأ في الشبكة. تحقق من اتصالك.',
    notFound:        'غير موجود.',
    permissionDenied:'تم رفض الإذن.',
    uploadFailed:    'فشل الرفع. يرجى المحاولة مرة أخرى.',
    bookingFailed:   'فشل الحجز. يرجى المحاولة مرة أخرى.',
    alreadyBooked:   'لديك موعد بالفعل في هذا التاريخ.',
    clinicClosed:    'العيادة مغلقة في هذا التاريخ.',
    noSlots:         'لا توجد أوقات متاحة.',
  },
};
