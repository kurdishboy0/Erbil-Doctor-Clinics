/* =============================================
   SUPABASE CONFIGURATION
   ============================================= */

const SUPABASE_URL = 'https://hwjsgsfihbmczysptcgm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iSlKHUQ6rvJ8ApTrp5bSJg_gneMV7fV';

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

// Initialize Supabase
let supabaseClient = null;
let firebaseReady = false; // keeping this name for compatibility with app.js

try {
  if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    firebaseReady = true;
    console.log('✅ Supabase initialized');
  } else {
    console.warn('⚠️ Supabase not configured. Auth features disabled.');
  }
} catch (e) {
  console.error('❌ Supabase init error:', e);
}

window.supabaseClient = supabaseClient;
window.ROLES = ROLES;
window.ROLE_LABELS = ROLE_LABELS;
window.ROLE_HIERARCHY = ROLE_HIERARCHY;
window.SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAIL;
window.ADMIN_EMAILS = ADMIN_EMAILS;
window.ADMIN_EMAIL = SUPER_ADMIN_EMAIL; // backward compat
window.firebaseReady = firebaseReady;
