/**
 * English (LTR) translation dictionary — Tabibok Health
 * Canonical source: all new keys go here first, then mirrored to ar.js
 */
export default {
  // ─── Common ────────────────────────────────────────────────────────────────
  common: {
    save:          'Save',
    cancel:        'Cancel',
    confirm:       'Confirm',
    delete:        'Delete',
    edit:          'Edit',
    close:         'Close',
    back:          'Back',
    next:          'Next',
    done:          'Done',
    retry:         'Retry',
    search:        'Search',
    filter:        'Filter',
    all:           'All',
    loading:       'Loading…',
    noResults:     'No results found',
    error:         'Something went wrong. Please try again.',
    networkError:  'Check your internet connection and try again.',
    required:      'This field is required',
    optional:      'Optional',
    yes:           'Yes',
    no:            'No',
    or:            'or',
    and:           'and',
  },

  // ─── Navigation tabs ───────────────────────────────────────────────────────
  nav: {
    home:          'Home',
    appointments:  'Appointments',
    documents:     'Documents',
    profile:       'Profile',
    dashboard:     'Dashboard',
    notifications: 'Notifications',
    settings:      'Settings',
    chat:          'Chat',
  },

  // ─── Role selection ────────────────────────────────────────────────────────
  roles: {
    patient:             'Patient',
    patientDesc:         'Book appointments, view medical records',
    doctor:              'Doctor',
    doctorDesc:          'Manage appointments, patient records',
    receptionist:        'Receptionist',
    receptionistDesc:    'Confirm appointments, manage schedule',
  },

  // ─── Authentication ────────────────────────────────────────────────────────
  auth: {
    welcome:             'Welcome to Tabibok',
    selectRole:          'Choose your role to continue',
    patient:             'Patient',
    doctor:              'Doctor',
    receptionist:        'Receptionist',
    phoneNumber:         'Phone Number',
    phoneHint:           'Enter your Iraqi phone number',
    sendOtp:             'Send Code',
    otpTitle:            'Enter Verification Code',
    otpSubtitle:         'We sent a 6-digit code to {{phone}}',
    otpPlaceholder:      'Code',
    verifyOtp:           'Verify',
    resendOtp:           'Resend code',
    resendIn:            'Resend in {{seconds}}s',
    emailLogin:          'Sign in with Email',
    email:               'Email Address',
    password:            'Password',
    signIn:              'Sign In',
    signOut:             'Sign Out',
    profileSetup:        'Complete Your Profile',
    fullName:            'Full Name',
    dateOfBirth:         'Date of Birth',
    gender:              'Gender',
    male:                'Male',
    female:              'Female',
    completeProfile:     'Continue',
    profileSubtitle:     'A few details so your doctor knows you',
    profileDoctorNote:   'Required by your doctor — name and date of birth help provide accurate care.',
    fullNamePlaceholder: 'As written on your ID',
    dobHint:             'Tap to select your date of birth',
    dobFuture:           'Date of birth cannot be in the future.',
    profileRequired:     'Please fill in all required fields.',
    // Staff email login
    staffLoginSubtitle:  'Sign in with your credentials',
    emailPlaceholder:    'Enter your email',
    passwordPlaceholder: 'Enter your password',
    requiredFields:      'Please enter your email and password.',
    accessDenied:        'This account is not registered as a {{role}}.',
    loginFailed:         'Invalid credentials. Please try again.',
    loginError:          'Something went wrong. Please try again.',

    invalidPhone:        'Enter a valid Iraqi phone number',
    invalidOtp:          'Invalid code. Please try again.',
    authError:           'Authentication failed. Please try again.',
    phoneHelper:         '10-digit Iraqi number, without the leading zero',
    errors: {
      invalidCode:     'Invalid code. Please check and try again.',
      codeExpired:     'Code has expired. Please request a new one.',
      tooManyRequests: 'Too many attempts. Please wait before trying again.',
      sessionExpired:  'Session expired. Please request a new code.',
      webUnsupported:  'Phone sign-in is only available in the mobile app.',
      generic:         'Something went wrong. Please try again.',
    },
  },

  // ─── Appointments ──────────────────────────────────────────────────────────
  appointments: {
    title:           'Appointments',
    upcoming:        'Upcoming',
    past:            'Past',
    book:            'Book Appointment',
    noUpcoming:      'No upcoming appointments',
    noPast:          'No past appointments',
    date:            'Date',
    time:            'Time',
    reason:          'Reason for Visit',
    notes:           'Notes',
    fee:             'Consultation Fee',
    duration:        'Duration',
    cancel:          'Cancel Appointment',
    cancelConfirm:   'Are you sure you want to cancel this appointment?',
    confirmAction:   'Confirm',
    declineAction:   'Decline',
    checkInAction:   'Check In',
    sendToDoctorAction: 'Send to Doctor',
    viewEMR:         'View Medical Record',
    writeNotes:      'Write Notes',
    prescription:    'Prescription',
    walkIn:          'Walk-in',
    status: {
      pending:       'Pending',
      confirmed:     'Confirmed',
      waiting:       'Waiting',
      in_progress:   'With Doctor',
      completed:     'Completed',
      cancelled:     'Cancelled',
      no_show:       'No Show',
    },

    // Booking form
    selectDate:            'Select Date',
    selectTime:            'Select Time',
    today:                 'Today',
    loadingSlots:          'Loading available slots…',
    noSlotsTitle:          'No Slots Available',
    noSlotsSub:            'This date is fully booked or the clinic is closed. Try another day.',
    bookingFor:            'Booking For',
    forMyself:             'For Myself',
    forFamilyMember:       'Family Member',
    familyMemberName:      "Family Member's Full Name",
    familyNamePlaceholder: 'Enter their full name',
    reasonTitle:           'Reason for Visit',
    reasonLabel:           'Describe your symptoms or concern',
    reasonPlaceholder:     'E.g. routine check-up, persistent headache, follow-up on lab results…',
    medicalHistoryTitle:   'Medical History',
    medicalHistorySub:     'Help the doctor prepare for your visit. All information is confidential.',
    allergiesLabel:        'Allergies',
    allergiesPlaceholder:  'E.g. Penicillin, peanuts, latex — or None',
    medicationsLabel:      'Current Medications',
    medicationsPlaceholder:'List all medications you are taking — or None',
    conditionsLabel:       'Chronic Conditions',
    conditionsPlaceholder: 'E.g. Diabetes, hypertension, asthma — or None',
    additionalNotesTitle:  'Additional Notes',
    notesPlaceholder:      'Any further details, preferred language, accessibility needs…',
    privacyNote:           'Your medical information is encrypted and only visible to your treating doctor.',
    confirmBooking:        'Confirm Booking',
    bookingSuccess:        'Appointment Submitted',
    bookingSuccessMsg:     'Your appointment with {{doctor}} on {{date}} at {{time}} has been submitted. You will be notified once confirmed.',
    viewAppointments:      'View Appointments',
    reasonRequired:        'Please describe the reason for your visit.',
    familyNameRequired:    "Please enter the family member's full name.",
  },

  // ─── Doctors ───────────────────────────────────────────────────────────────
  doctors: {
    title:           'Doctors',
    findDoctor:      'Find a Doctor',
    specialty:       'Specialty',
    allSpecialties:  'All Specialties',
    rating:          'Rating',
    experience:      'Experience',
    experienceYears: '{{n}} years',
    fee:             'Fee',
    available:       'Available',
    unavailable:     'Unavailable Today',
    bookNow:         'Book Now',
    viewProfile:     'View Profile',
    workingHours:    'Working Hours',
    education:       'Education',
    languages:       'Languages',
    about:           'About',
    noResults:       'No doctors found for "{{query}}"',

    // ── Doctor Profile Screen (patient-side public view) ──────────────────
    drPrefix:        'Dr.',
    availableNow:    'Available Now',
    unavailableNow:  'Unavailable',
    ratingLabel:     'Rating',
    experienceSuffix: 'yrs exp',
    feeLabel:        'Fee',
    bioTitle:        'About Doctor',
    hoursTitle:      'Working Hours',
    eduTitle:        'Education & Qualifications',
    langTitle:       'Languages',
    dayOff:          'Day off',
    showMore:        'Show more',
    showLess:        'Show less',
    bookAppointment: 'Book Appointment',
    chatAction:      'Message',
    unavailableNote: 'This doctor is not currently accepting appointments.',
    profileLoadError:'Could not load doctor profile.',
    days: {
      monday:    'Monday',
      tuesday:   'Tuesday',
      wednesday: 'Wednesday',
      thursday:  'Thursday',
      friday:    'Friday',
      saturday:  'Saturday',
      sunday:    'Sunday',
    },
  },

  // ─── Patient ───────────────────────────────────────────────────────────────
  patient: {
    profile:         'My Profile',
    medicalDocuments:'Medical Documents',
    uploadDocument:  'Upload Document',
    noDocuments:     'No documents yet',
    bloodType:       'Blood Type',
    allergies:       'Allergies',
    medications:     'Current Medications',
    conditions:      'Chronic Conditions',

    // ── Patient Profile Screen ────────────────────────────────────────────
    profileScreen: {
      patientLabel:        'Patient',
      personalInfo:        'Personal Information',
      fullName:            'Full Name',
      fullNamePlaceholder: 'Enter your full name',
      phone:               'Phone Number',
      gender:              'Gender',
      male:                'Male',
      female:              'Female',
      bloodType:           'Blood Type',
      saveChanges:         'Save Changes',
      saveSuccess:         'Profile updated successfully.',
      saveError:           'Could not save changes. Please try again.',
      logOut:              'Log Out',
      logOutError:         'Could not sign out. Please try again.',
      loadError:           'Could not load your profile.',
      quickActions:        'Quick Actions',
      myAppointments:      'My Appointments',
      myDocuments:         'My Documents',
    },
  },

  // ─── Doctor ────────────────────────────────────────────────────────────────
  doctor: {
    dashboard:          'Dashboard',
    todaySchedule:      "Today's Schedule",
    pendingRequests:    'Pending Requests',
    stats: {
      today:            "Today's Patients",
      pending:          'Pending',
      completed:        'Completed',
      remaining:        'Remaining',
    },
    patientDetails:     'Patient Details',
    visitNotes:         'Visit Notes',
    noSchedule:         'No appointments today',
    noScheduleSub:      'Enjoy the day or check pending requests above.',
    noPending:          'No pending requests',

    // Greetings
    greetingMorning:    'Good morning',
    greetingAfternoon:  'Good afternoon',
    greetingEvening:    'Good evening',
    drPrefix:           'Dr.',

    // Pending carousel empty state
    allCaughtUp:        'All caught up!',
    allCaughtUpSub:     'No pending appointment requests.',

    // Section links
    seeAll:             'See all',

    // Actions
    accept:             'Accept',
    decline:            'Decline',
    markDone:           'Mark Done',
    done:               'Done',
    updating:           'Updating…',
    forFamily:          'For: {{name}}',

    // Decline confirmation alert
    declineTitle:       'Decline Request',
    declineMessage:     "Decline {{patient}}'s request on {{date}}?\n\nThe patient will be notified.",
    declineKeep:        'Keep',
    declineConfirm:     'Yes, Decline',

    // Analytics
    analytics: {
      title:             'Revenue & Analytics',
      todayRevenue:      "Today's Revenue",
      weekRevenue:       'This Week',
      feePerVisit:       'Fee / Visit',
      patientsThisWeek:  'Patients This Week',
    },

    // Error messages
    acceptError:        'Could not accept the appointment. Please try again.',
    declineError:       'Could not decline the appointment. Please try again.',
    markDoneError:      'Could not update the appointment. Please try again.',
    loadError:          'Failed to load dashboard. Please try again.',

    // ── EMR (Electronic Medical Record) ──────────────────────────────────────
    emr: {
      title:              'Medical Record',
      loadError:          'Failed to load medical record. Please try again.',

      // Tabs
      tabOverview:        'Overview',
      tabEncounters:      'Encounters',
      tabDocuments:       'Documents',

      // Overview — demographics
      demographics:       'Patient Info',
      name:               'Name',
      phone:              'Phone',
      email:              'Email',
      age:                'Age',
      ageYears:           '{{n}} years',
      gender:             'Gender',
      genderMale:         'Male',
      genderFemale:       'Female',
      bloodType:          'Blood Type',
      city:               'City',

      // Overview — medical history
      allergies:          'Allergies',
      medications:        'Current Medications',
      conditions:         'Chronic Conditions',
      noAllergies:        'No recorded allergies',
      noMedications:      'No recorded medications',
      noConditions:       'No chronic conditions recorded',

      // Encounters
      noEncounters:       'No past visits',
      noEncountersSub:    'Completed appointments will appear here',
      reason:             'Reason',
      clinicalNotes:      'Clinical Notes',
      diagnosis:          'Diagnosis',
      prescriptions:      'Prescribed Medications',
      showMore:           'Show more',
      showLess:           'Show less',

      // Documents
      noDocuments:        'No documents',
      noDocumentsSub:     'The patient has not uploaded any documents yet',
      docDefaultTitle:    'Document',
      cannotOpen:         'Cannot open this file. No supported app found.',
      openError:          'Could not open the document.',

      // Document categories
      catLab:             'Lab',
      catImaging:         'Imaging',
      catPrescription:    'Prescription',
      catReport:          'Report',
      catGeneral:         'General',
    },
  },

  // ─── Receptionist ──────────────────────────────────────────────────────────
  receptionist: {
    dashboard:       'Dashboard',
    walkInBooking:   'Walk-in Booking',
    registerPatient: 'Register Patient',
    allDoctors:      'All Doctors',
    searchPatient:   'Search patient by name or phone…',
    createPatient:   'Create New Patient',
    selectDoctor:    'Select a Doctor',
    selectTimeSlot:  'Select Time Slot',
    forceFit:        'Walk-in (no slot)',
    forceFitHint:    'Patient will wait in queue',
    bookAppointment: 'Book Appointment',
    noSlots:         'No available slots',

    // ── Walk-In Booking Screen ────────────────────────────────────────────
    walkIn: {
      title:               'Walk-In Booking',
      stepPatient:         'Step 1 — Find Patient',
      stepDoctor:          'Step 2 — Assign Doctor',

      // Phone search
      phoneLabel:          'Phone Number',
      phonePlaceholder:    'Enter patient phone number',
      searching:           'Searching…',
      patientFound:        'Existing patient — tap to select',
      patientNotFound:     'No patient found — please register below',
      select:              'Select',
      changePatient:       'Change',

      // Fast registration
      fastReg:             'Quick Registration',
      fullName:            'Full Name',
      fullNamePlaceholder: 'Patient full name',
      gender:              'Gender',
      male:                'Male',
      female:              'Female',

      // Doctor selector
      selectDoctor:        'Select Doctor',
      noDoctor:            'No doctors available',
      loadDoctorsError:    'Could not load doctors.',

      // Submit
      addToQueue:          'Add to Queue (Walk-In)',
      successMsg:          'Patient added to the waiting queue.',

      // Validation errors
      nameRequired:        'Please enter the patient\'s full name.',
      genderRequired:      'Please select a gender.',
      doctorRequired:      'Please select a doctor.',
      submitError:         'Could not add to queue. Please try again.',
    },

    // ── Appointment Management Screen ─────────────────────────────────────
    apptMgmt: {
      title:                'Appointment Management',
      searchPlaceholder:    'Search patient by name or phone…',

      // Status filter chips
      filterAll:            'All',

      // No appointment state
      noAppointments:       'No appointments for this day',
      noAppointmentsSub:    'Select a different date or add a walk-in patient.',

      // Load error
      loadError:            'Failed to load appointments. Please try again.',

      // Action buttons
      accept:               'Accept',
      decline:              'Decline',
      checkIn:              'Check-In Patient',
      sendToDoctor:         'Send to Doctor',

      // Terminal status messages (no action buttons)
      statusInProgress:     'Currently with the doctor',
      statusCompleted:      'Visit completed',
      statusCancelled:      'Appointment cancelled',

      // Inline action errors
      acceptError:          'Could not accept the appointment. Please try again.',
      declineError:         'Could not decline the appointment. Please try again.',
      checkInError:         'Could not check in the patient. Please try again.',
      sendError:            'Could not send to doctor. Please try again.',

      // Detail modal field labels
      dateLabel:            'Date',
      timeLabel:            'Time',
      doctorLabel:          'Doctor',
      reasonLabel:          'Reason',
      notesLabel:           'Notes',
    },
  },

  // ─── Chat ──────────────────────────────────────────────────────────────────
  chat: {
    title:           'Chat',
    placeholder:     'Type a message…',
    send:            'Send',
    noMessages:      'No messages yet. Say hello!',
    online:          'Online',
    offline:         'Offline',

    // ── Phase 4 keys ─────────────────────────────────────────────────────
    startConversation:    'Start the conversation',
    startConversationSub: 'Send a message to {{name}} to get started.',
    today:                'Today',
    yesterday:            'Yesterday',
    loadError:            'Could not load messages. Please try again.',
    sendError:            'Message failed to send. Tap to retry.',
    noRecipient:          'No recipient specified.',
    online2:              'Online',     // header status line
  },

  // ─── Documents ─────────────────────────────────────────────────────────────
  documents: {
    title:           'Medical Documents',
    upload:          'Upload Document',
    noDocuments:     'No documents uploaded yet',
    pdf:             'PDF',
    image:           'Image',
    uploadedOn:      'Uploaded {{date}}',
    open:            'Open',
    delete:          'Delete',
    deleteConfirm:   'Delete this document permanently?',

    // ── Medical Documents Vault (Phase 4) ─────────────────────────────────

    // Empty state
    emptyState:      'No medical documents yet',
    emptyStateSub:   'Upload your test results, prescriptions, and reports to keep them safe.',

    // FAB / header action
    uploadNew:       'Upload New Document',

    // Upload progress
    uploading:       'Uploading…',
    uploadError:     'Upload failed. Please try again.',

    // List load error
    loadError:       'Could not load documents. Please try again.',

    // Source picker modal
    chooseSource:    'Add Document',
    sourceCamera:    'Camera',
    sourceGallery:   'Gallery',
    permCamera:      'Camera access is required. Please enable it in your device settings.',
    permGallery:     'Photo library access is required. Please enable it in your device settings.',

    // Details form modal
    docDetails:      'Document Details',
    titleLabel:      'Document Title',
    titlePlaceholder:'e.g. Blood test results',
    titleRequired:   'Please enter a document title.',
    categoryLabel:   'Category',
    descLabel:       'Description (optional)',
    descPlaceholder: 'Add a note about this document…',
    uploadConfirm:   'Upload',
    cancel:          'Cancel',
    back:            'Back',

    // Delete confirm modal
    deleteTitle:     'Delete Document',
    deleteMsg:       'Delete "{{title}}"? This action cannot be undone.',
    deleteConfirmBtn:'Delete',
    deleteError:     'Could not delete the document. Please try again.',

    // Open error
    openError:       'Cannot open this file on your device.',

    // Category names
    catAll:          'All',
    catLab:          'Lab',
    catImaging:      'Imaging',
    catPrescription: 'Prescription',
    catReport:       'Report',
    catGeneral:      'General',

    // Document count subtitle
    docCount:        '{{n}} document(s)',

    // ── Viewer modal ────────────────────────────────────────────────────────
    closeViewer:          'Close',
    pdfPreviewUnavailable:'PDF preview is not available in-app.',
    openInBrowser:        'Open in browser',

    // ── Share to doctor ─────────────────────────────────────────────────────
    shareToDoctor:        'Share with Doctor',
    selectDoctor:         'Select a Doctor',
    sharedMessage:        '📎 Shared a medical document',
    sharing:              'Sharing…',
    shareError:           'Could not share the document. Please try again.',
    loadDoctorsError:     'Could not load doctors. Please try again.',
    noDoctors:            'No doctors found.',

    // ── Consent-Based Access Control ────────────────────────────────────────
    manageAccess:         'Manage Access',
    accessControl:        'Doctor Access Control',
    accessControlSub:     'Toggle which doctors can view this document.',
    sharedWith:           'Shared with {{n}} doctor(s)',
    notShared:            'Not shared with any doctor',
    grantAccess:          'Grant access',
    revokeAccess:         'Revoke access',
    accessUpdated:        'Access updated.',
    accessError:          'Could not update access. Please try again.',
    noAppointmentDoctors: 'No doctors from your appointments yet.',
  },

  // ─── Notifications ─────────────────────────────────────────────────────────
  notifications: {
    title:          'Notifications',
    empty:          'No notifications yet',
    emptySub:       'You\'ll see appointment updates and messages here.',
    markAllRead:    'Mark all as read',
    markAllReadDone:'All notifications marked as read.',
    loadError:      'Could not load notifications. Please try again.',

    // Time labels
    justNow:        'Just now',
    minutesAgo:     '{{n}}m ago',
    hoursAgo:       '{{n}}h ago',
    daysAgo:        '{{n}}d ago',

    // Type labels
    typeChat:        'New message',
    typeAppointment: 'Appointment update',
    typeGeneral:     'Notification',
    unread:          'Unread',
  },

  // ─── Errors ────────────────────────────────────────────────────────────────
  errors: {
    generic:         'Something went wrong. Please try again.',
    network:         'Network error. Check your connection.',
    notFound:        'Not found.',
    permissionDenied:'Permission denied.',
    uploadFailed:    'Upload failed. Please try again.',
    bookingFailed:   'Booking failed. Please try again.',
    alreadyBooked:   'You already have an appointment on this date.',
    clinicClosed:    'The clinic is closed on this date.',
    noSlots:         'No available time slots.',
  },
};
