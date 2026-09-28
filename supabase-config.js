/* =============================================
   SUPABASE CONFIGURATION
   =============================================
   
   SETUP INSTRUCTIONS:
   1. Go to https://supabase.com/ and sign up (free)
   2. Click "New Project"
   3. Enter a name (e.g., "erbil-doctor-finder")
   4. Set a strong database password (save it!)
   5. Choose a region close to you → Click "Create new project"
   6. Once created, go to Settings → API
   7. Copy your "Project URL" and "anon public" key below
   
   THEN RUN THE SQL (see setup guide):
   - Go to SQL Editor in Supabase dashboard
   - Run the provided SQL to create tables & policies
   
   ============================================= */

const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // e.g., https://xyzcompany.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // The "anon" "public" key

// ⚠️ SET YOUR ADMIN EMAIL HERE
// The first user who registers with this email will automatically become Admin
const ADMIN_EMAIL = 'admin@example.com';

// Role Constants
const ROLES = {
  PATIENT: 'patient',
  CLINIC_ASSISTANT: 'clinic_assistant',
  ADMIN: 'admin'
};

const ROLE_LABELS = {
  [ROLES.PATIENT]: 'Patient',
  [ROLES.CLINIC_ASSISTANT]: 'Clinic Assistant',
  [ROLES.ADMIN]: 'Admin'
};

// Initialize Supabase
let supabaseClient = null;
let firebaseReady = false; // keeping this name for compatibility with app.js

try {
  if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    firebaseReady = true; // means "backend is ready"
    console.log('✅ Supabase initialized');
  } else {
    console.warn('⚠️ Supabase not configured. Auth features disabled. Update supabase-config.js');
  }
} catch (e) {
  console.error('❌ Supabase init error:', e);
}

window.supabaseClient = supabaseClient;
window.ROLES = ROLES;
window.ROLE_LABELS = ROLE_LABELS;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.firebaseReady = firebaseReady;
