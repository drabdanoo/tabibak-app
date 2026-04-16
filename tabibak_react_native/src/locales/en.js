/**
 * English (LTR) translation dictionary — Vanbook
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
    patient:             'Client',
    patientDesc:         'Book appointments and manage your schedule',
    doctor:              'Provider',
    doctorDesc:          'Manage your availability and client appointments',
    receptionist:        'Staff',
    receptionistDesc:    'Front desk appointment management',
  },

  // ─── Authentication ────────────────────────────────────────────────────────
  auth: {
    welcome:             'Welcome to Vanbook',
    selectRole:          'Choose your role to continue',
    patient:             'Client',
    doctor:              'Provider',
    receptionist:        'Staff',
    phoneNumber:         'Phone Number',
    phoneHint:           'Enter your phone number',
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
    profileSubtitle:     'A few details to set up your account',
    profileDoctorNote:   'Your name and date of birth are used to identify your account.',
    fullNamePlaceholder: 'Your full name',
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

    invalidPhone:        'Enter a valid phone number',
    invalidOtp:          'Invalid code. Please try again.',
    authError:           'Authentication failed. Please try again.',
    phoneHelper:         '10-digit number, without the leading zero',
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
    fee:             'Service Fee',
    duration:        'Duration',
    cancel:          'Cancel Appointment',
    cancelConfirm:   'Are you sure you want to cancel this appointment?',
    confirmAction:   'Confirm',
    declineAction:   'Decline',
    checkInAction:   'Check In',
    sendToDoctorAction: 'Send to Provider',
    viewEMR:         'View Record',
    writeNotes:      'Write Notes',
    prescription:    'Treatment Plan',
    walkIn:          'Walk-in',
    status: {
      pending:       'Pending',
      confirmed:     'Confirmed',
      waiting:       'Waiting',
      in_progress:   'In Session',
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
    noSlotsSub:            'This date is fully booked or unavailable. Try another day.',
    bookingFor:            'Booking For',
    forMyself:             'For Myself',
    forFamilyMember:       'Family Member',
    familyMemberName:      "Family Member's Full Name",
    familyNamePlaceholder: 'Enter their full name',
    reasonTitle:           'Reason for Visit',
    reasonLabel:           'Describe your concern',
    reasonPlaceholder:     'E.g. routine check-up, follow-up visit…',
    medicalHistoryTitle:   'Additional Information',
    medicalHistorySub:     'Help your provider prepare for the appointment. All information is confidential.',
    allergiesLabel:        'Health Notes',
    allergiesPlaceholder:  'Any relevant health notes for the provider (optional)',
    medicationsLabel:      'Current Treatments',
    medicationsPlaceholder:'List any ongoing treatments — or None',
    conditionsLabel:       'Health Conditions',
    conditionsPlaceholder: 'List any ongoing health conditions — or None',
    additionalNotesTitle:  'Additional Notes',
    notesPlaceholder:      'Any further details or accessibility needs…',
    privacyNote:           'Your information is encrypted and only visible to your assigned provider.',
    confirmBooking:        'Confirm Booking',
    bookingSuccess:        'Appointment Submitted',
    bookingSuccessMsg:     'Your appointment with {{doctor}} on {{date}} at {{time}} has been submitted. You will be notified once confirmed.',
    viewAppointments:      'View Appointments',
    reasonRequired:        'Please describe the reason for your visit.',
    familyNameRequired:    "Please enter the family member's full name.",
  },

  // ─── Providers ─────────────────────────────────────────────────────────────
  doctors: {
    title:           'Providers',
    findDoctor:      'Find a Provider',
    specialty:       'Specialty',
    allSpecialties:  'All',
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
    noResults:       'No providers found for "{{query}}"',

    // ── Provider Profile Screen (client-side public view) ────────────────
    drPrefix:        'Dr.',
    availableNow:    'Available Now',
    unavailableNow:  'Unavailable',
    ratingLabel:     'Rating',
    experienceSuffix: 'yrs exp',
    feeLabel:        'Fee',
    bioTitle:        'About',
    hoursTitle:      'Working Hours',
    eduTitle:        'Education & Qualifications',
    langTitle:       'Languages',
    dayOff:          'Day off',
    showMore:        'Show more',
    showLess:        'Show less',
    bookAppointment: 'Book Appointment',
    chatAction:      'Message',
    unavailableNote: 'This provider is not currently accepting appointments.',
    profileLoadError:'Could not load provider profile.',
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

  // ─── Client (Patient) ──────────────────────────────────────────────────────
  patient: {
    profile:         'My Profile',
    medicalDocuments:'Documents',
    uploadDocument:  'Upload Document',
    noDocuments:     'No documents yet',
    bloodType:       'Blood Type',
    allergies:       'Health Notes',
    medications:     'Current Treatments',
    conditions:      'Health Conditions',

    // ── Client Profile Screen ─────────────────────────────────────────────
    profileScreen: {
      patientLabel:        'Client',
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

  // ─── Provider (Doctor) ─────────────────────────────────────────────────────
  doctor: {
    dashboard:          'Dashboard',
    todaySchedule:      "Today's Schedule",
    pendingRequests:    'Pending Requests',
    stats: {
      today:            "Today's Clients",
      pending:          'Pending',
      completed:        'Completed',
      remaining:        'Remaining',
    },
    patientDetails:     'Client Details',
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
    declineMessage:     "Decline {{patient}}'s request on {{date}}?\n\nThe client will be notified.",
    declineKeep:        'Keep',
    declineConfirm:     'Yes, Decline',

    // Analytics
    analytics: {
      title:             'Revenue & Analytics',
      todayRevenue:      "Today's Revenue",
      weekRevenue:       'This Week',
      feePerVisit:       'Fee / Visit',
      patientsThisWeek:  'Clients This Week',
    },

    // Error messages
    acceptError:        'Could not accept the appointment. Please try again.',
    declineError:       'Could not decline the appointment. Please try again.',
    markDoneError:      'Could not update the appointment. Please try again.',
    loadError:          'Failed to load dashboard. Please try again.',

    // ── Visit Record ──────────────────────────────────────────────────────────
    emr: {
      title:              'Client Record',
      loadError:          'Failed to load record. Please try again.',

      // Tabs
      tabOverview:        'Overview',
      tabEncounters:      'History',
      tabDocuments:       'Documents',

      // Overview — demographics
      demographics:       'Client Info',
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

      // Overview — additional info
      allergies:          'Health Notes',
      medications:        'Current Treatments',
      conditions:         'Health Conditions',
      noAllergies:        'No health notes recorded',
      noMedications:      'No treatments recorded',
      noConditions:       'No health conditions recorded',

      // History
      noEncounters:       'No past visits',
      noEncountersSub:    'Completed appointments will appear here',
      reason:             'Reason',
      clinicalNotes:      'Visit Notes',
      diagnosis:          'Assessment',
      prescriptions:      'Treatment Plan',
      showMore:           'Show more',
      showLess:           'Show less',

      // Documents
      noDocuments:        'No documents',
      noDocumentsSub:     'The client has not uploaded any documents yet',
      docDefaultTitle:    'Document',
      cannotOpen:         'Cannot open this file. No supported app found.',
      openError:          'Could not open the document.',

      // Document categories
      catLab:             'Lab',
      catImaging:         'Imaging',
      catPrescription:    'Treatment',
      catReport:          'Report',
      catGeneral:         'General',
    },
  },

  // ─── Staff (Receptionist) ──────────────────────────────────────────────────
  receptionist: {
    dashboard:       'Dashboard',
    walkInBooking:   'Walk-in Booking',
    registerPatient: 'Register Client',
    allDoctors:      'All Providers',
    searchPatient:   'Search client by name or phone…',
    createPatient:   'Create New Client',
    selectDoctor:    'Select a Provider',
    selectTimeSlot:  'Select Time Slot',
    forceFit:        'Walk-in (no slot)',
    forceFitHint:    'Client will wait in queue',
    bookAppointment: 'Book Appointment',
    noSlots:         'No available slots',

    // ── Walk-In Booking Screen ────────────────────────────────────────────
    walkIn: {
      title:               'Walk-In Booking',
      stepPatient:         'Step 1 — Find Client',
      stepDoctor:          'Step 2 — Assign Provider',

      // Phone search
      phoneLabel:          'Phone Number',
      phonePlaceholder:    'Enter client phone number',
      searching:           'Searching…',
      patientFound:        'Existing client — tap to select',
      patientNotFound:     'No client found — please register below',
      select:              'Select',
      changePatient:       'Change',

      // Fast registration
      fastReg:             'Quick Registration',
      fullName:            'Full Name',
      fullNamePlaceholder: 'Client full name',
      gender:              'Gender',
      male:                'Male',
      female:              'Female',

      // Provider selector
      selectDoctor:        'Select Provider',
      noDoctor:            'No providers available',
      loadDoctorsError:    'Could not load providers.',

      // Submit
      addToQueue:          'Add to Queue (Walk-In)',
      successMsg:          'Client added to the waiting queue.',

      // Validation errors
      nameRequired:        "Please enter the client's full name.",
      genderRequired:      'Please select a gender.',
      doctorRequired:      'Please select a provider.',
      submitError:         'Could not add to queue. Please try again.',
    },

    // ── Appointment Management Screen ─────────────────────────────────────
    apptMgmt: {
      title:                'Appointment Management',
      searchPlaceholder:    'Search client by name or phone…',

      // Status filter chips
      filterAll:            'All',

      // No appointment state
      noAppointments:       'No appointments for this day',
      noAppointmentsSub:    'Select a different date or add a walk-in client.',

      // Load error
      loadError:            'Failed to load appointments. Please try again.',

      // Action buttons
      accept:               'Accept',
      decline:              'Decline',
      checkIn:              'Check-In Client',
      sendToDoctor:         'Send to Provider',

      // Terminal status messages (no action buttons)
      statusInProgress:     'Currently with the provider',
      statusCompleted:      'Visit completed',
      statusCancelled:      'Appointment cancelled',

      // Inline action errors
      acceptError:          'Could not accept the appointment. Please try again.',
      declineError:         'Could not decline the appointment. Please try again.',
      checkInError:         'Could not check in the client. Please try again.',
      sendError:            'Could not send to provider. Please try again.',

      // Detail modal field labels
      dateLabel:            'Date',
      timeLabel:            'Time',
      doctorLabel:          'Provider',
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
    online2:              'Online',
  },

  // ─── Documents ─────────────────────────────────────────────────────────────
  documents: {
    title:           'Documents',
    upload:          'Upload Document',
    noDocuments:     'No documents uploaded yet',
    pdf:             'PDF',
    image:           'Image',
    uploadedOn:      'Uploaded {{date}}',
    open:            'Open',
    delete:          'Delete',
    deleteConfirm:   'Delete this document permanently?',

    // ── Documents Vault (Phase 4) ─────────────────────────────────────────

    // Empty state
    emptyState:      'No documents yet',
    emptyStateSub:   'Upload your files and reports to keep them organized.',

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
    titlePlaceholder:'e.g. Test results',
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
    catPrescription: 'Treatment',
    catReport:       'Report',
    catGeneral:      'General',

    // Document count subtitle
    docCount:        '{{n}} document(s)',

    // ── Viewer modal ────────────────────────────────────────────────────────
    closeViewer:          'Close',
    pdfPreviewUnavailable:'PDF preview is not available in-app.',
    openInBrowser:        'Open in browser',

    // ── Share to provider ───────────────────────────────────────────────────
    shareToDoctor:        'Share with Provider',
    selectDoctor:         'Select a Provider',
    sharedMessage:        '📎 Shared a document',
    sharing:              'Sharing…',
    shareError:           'Could not share the document. Please try again.',
    loadDoctorsError:     'Could not load providers. Please try again.',
    noDoctors:            'No providers found.',

    // ── Consent-Based Access Control ────────────────────────────────────────
    manageAccess:         'Manage Access',
    accessControl:        'Provider Access Control',
    accessControlSub:     'Toggle which providers can view this document.',
    sharedWith:           'Shared with {{n}} provider(s)',
    notShared:            'Not shared with any provider',
    grantAccess:          'Grant access',
    revokeAccess:         'Revoke access',
    accessUpdated:        'Access updated.',
    accessError:          'Could not update access. Please try again.',
    noAppointmentDoctors: 'No providers from your appointments yet.',
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
    clinicClosed:    'No availability on this date.',
    noSlots:         'No available time slots.',
  },
};
