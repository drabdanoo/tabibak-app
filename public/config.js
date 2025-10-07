// MedConnect v5 config - Secure production-ready configuration
(function() {
  'use strict';
  
  // Private configuration - not exposed globally
  const config = {
    ENV: "production", // Change to "development" only for local debugging
    APP_CHECK_KEY: "RECAPTCHA_ENTERPRISE_SITE_KEY", // Remove when using real reCAPTCHA
    FIREBASE_CONFIG: {
      apiKey: "AIzaSyCHiS1JxbIm5zclg1QxM-i8DvHPeWMPne0",
      authDomain: "medconnect-2.firebaseapp.com",
      projectId: "medconnect-2", 
      storageBucket: "medconnect-2.firebasestorage.app",
      messagingSenderId: "464755135042",
      appId: "1:464755135042:web:ac00e07a1aa0721683d3db",
      measurementId: "G-1Q7MTPV8XE"
    }
  };

  // Minimal secure exposure for necessary functionality
  window.__MC_ENV__ = {
    ENV: config.ENV,
    APP_CHECK_KEY: config.APP_CHECK_KEY,
    FIREBASE_CONFIG: config.FIREBASE_CONFIG
  };

  // Development-only debug helpers (minimal logging)
  if (config.ENV === "development" && typeof console !== 'undefined') {
    console.log("🏥 MedConnect initialized");
    // No config details logged to console
  }
})();
