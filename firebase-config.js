/* =============================================
   FIREBASE CONFIGURATION
   ============================================= */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ⚠️ ADMIN ACCOUNTS
// These emails auto-assign roles on first registration
const SUPER_ADMIN_EMAIL = 'ahmadhawlery0011@gmail.com';  // Ahmed Haji - Full control
const ADMIN_EMAILS = ['chroazad27@gmail.com'];             // Chro Azad - Admin

// Role Constants (hierarchical: super_admin > admin > clinic_assistant > patient)
const ROLES = {
  PATIENT: 'patient',
  CLINIC_ASSISTANT: 'clinic_assistant',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

const ROLE_LABELS = {
  [ROLES.PATIENT]: 'Patient',
  [ROLES.CLINIC_ASSISTANT]: 'Clinic Assistant',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPER_ADMIN]: 'Super Admin'
};

const ROLE_HIERARCHY = {
  [ROLES.PATIENT]: 0,
  [ROLES.CLINIC_ASSISTANT]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3
};

// Initialize Firebase
let firebaseApp = null;
let db = null;
let auth = null;
let firebaseReady = false;

try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    firebaseReady = true;
    console.log('✅ Firebase initialized');
  } else {
    console.warn('⚠️ Firebase not configured. Auth features disabled.');
  }
} catch (e) {
  console.error('❌ Firebase init error:', e);
}

window.db = db;
window.auth = auth;
window.ROLES = ROLES;
window.ROLE_LABELS = ROLE_LABELS;
window.ROLE_HIERARCHY = ROLE_HIERARCHY;
window.SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAIL;
window.ADMIN_EMAILS = ADMIN_EMAILS;
window.firebaseReady = firebaseReady;
