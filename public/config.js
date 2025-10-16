// MedConnect v5 config - Secure production-ready configuration
(function() {
  'use strict';
  
  // Private configuration - not exposed globally
  const config = {
    ENV: "production", // Change to "development" only for local debugging
    APP_CHECK_KEY: "6Ld-uuErAAAAANeZkP_dGaRzkY4et60EQQ940o0T", // reCAPTCHA v3 site key
    FIREBASE_CONFIG: {
      apiKey: "AIzaSyCHiS1JxbIm5zclg1QxM-i8DvHPeWMPne0",
      authDomain: "medconnect-2.firebaseapp.com",
      projectId: "medconnect-2", 
      storageBucket: "medconnect-2.firebasestorage.app",
      messagingSenderId: "464755135042",
      appId: "1:464755135042:web:ac00e07a1aa0721683d3db",
      measurementId: "G-1Q7MTPV8XE"
    },
    // Allowed public doctors on patient page (by email). Keep this list small (<=10) for Firestore 'in' queries.
    // Update this to your real doctor(s). Example prefilled with the doctor used in testing.
    ALLOWED_DOCTOR_EMAILS: [
      "vipsnapchat69@gmail.com",
      "obaidaalluhebe@gmail.com",
      "dr.abdanoo@gmail.com"
    ],
    // Alternatively, allow by Firestore document IDs (more stable than emails). Leave empty if not used.
    ALLOWED_DOCTOR_IDS: [
      // "<doctorDocId>"
    ]
  };

  // Minimal secure exposure for necessary functionality
  window.__MC_ENV__ = {
    ENV: config.ENV,
    APP_CHECK_KEY: config.APP_CHECK_KEY,
    FIREBASE_CONFIG: config.FIREBASE_CONFIG,
    ALLOWED_DOCTOR_EMAILS: config.ALLOWED_DOCTOR_EMAILS,
    ALLOWED_DOCTOR_IDS: config.ALLOWED_DOCTOR_IDS
  };

  // Development-only debug helpers (minimal logging)
  if (config.ENV === "development" && typeof console !== 'undefined') {
    console.log("🏥 MedConnect initialized");
    // No config details logged to console
  }
})();
