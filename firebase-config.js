/* =============================================
   FIREBASE CONFIGURATION
   =============================================
   
   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com/
   2. Click "Create a project" (or "Add project")
   3. Enter a project name (e.g., "erbil-doctor-finder")
   4. Disable Google Analytics (optional) → Click "Create Project"
   5. Once created, click the Web icon (</>) to add a web app
   6. Enter a nickname → Click "Register app"
   7. Copy the firebaseConfig values and paste them below
   
   ENABLE AUTHENTICATION:
   1. In Firebase Console → Click "Authentication" in left menu
   2. Click "Get started"
   3. Enable "Email/Password" provider
   4. (Optional) Enable "Google" provider
   
   ENABLE FIRESTORE:
   1. In Firebase Console → Click "Firestore Database" in left menu
   2. Click "Create database"
   3. Choose "Start in test mode" (we'll add rules later)
   4. Select a region close to you → Click "Enable"
   
   ============================================= */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ⚠️ SET YOUR ADMIN EMAIL HERE
// The first user who registers with this email will automatically become Admin
const ADMIN_EMAIL = "admin@example.com";

// Role Constants
const ROLES = {
  PATIENT: 'patient',
  CLINIC_ASSISTANT: 'clinic_assistant',
  ADMIN: 'admin'
};

// Role Display Names
const ROLE_LABELS = {
  [ROLES.PATIENT]: 'Patient',
  [ROLES.CLINIC_ASSISTANT]: 'Clinic Assistant',
  [ROLES.ADMIN]: 'Admin'
};

// Initialize Firebase
let firebaseReady = false;
try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    firebase.initializeApp(firebaseConfig);
    window.fbAuth = firebase.auth();
    window.fbDb = firebase.firestore();
    firebaseReady = true;
    console.log('✅ Firebase initialized');
  } else {
    console.warn('⚠️ Firebase not configured. Auth features disabled. Update firebase-config.js');
  }
} catch (e) {
  console.error('❌ Firebase init error:', e);
}

window.ROLES = ROLES;
window.ROLE_LABELS = ROLE_LABELS;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.firebaseReady = firebaseReady;
