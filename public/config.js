// MedConnect v5 config - Updated for development debugging
window.__MC_ENV__ = {
  ENV: "development", // set to "development" for debugging
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

// Debug mode helpers
if (window.__MC_ENV__.ENV === "development") {
  console.log("🏥 MedConnect Debug Mode Enabled");
  console.log("Firebase Config:", window.__MC_ENV__.FIREBASE_CONFIG);
  
  // Add firebase config to window for debugging
  window.firebaseConfig = window.__MC_ENV__.FIREBASE_CONFIG;
}
