// Firebase Configuration for Tabibok App
// Project: medconnect-2

export const firebaseConfig = {
  apiKey: "AIzaSyCHiS1JxbIm5zclg1QxM-i8DvHPeWMPne0",
  authDomain: "medconnect-2.firebaseapp.com",
  projectId: "medconnect-2",
  storageBucket: "medconnect-2.firebasestorage.app",
  messagingSenderId: "464755135042",
  appId: "1:464755135042:web:ac00e07a1aa0721683d3db",
  measurementId: "G-1Q7MTPV8XE"
};

// User Roles
export const USER_ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist'
};

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  DOCTORS: 'doctors',
  PATIENTS: 'patients',
  RECEPTIONISTS: 'receptionists',
  APPOINTMENTS: 'appointments',
  MEDICAL_DOCUMENTS: 'medicalDocuments',
  DOCUMENTS: 'documents',
  USER_TOKENS: 'userTokens',
  CLOSURES: 'closures'
};
