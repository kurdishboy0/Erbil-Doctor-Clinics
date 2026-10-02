/* =============================================
   AUTH MODULE - Supabase Authentication & Authorization
   With Super Admin + Admin hierarchy
   ============================================= */

(function() {
  'use strict';

  let currentUser = null;
  let currentUserRole = null;
  let currentUserProfile = null;
  let authStateCallbacks = [];

  // ==========================================
  // AUTH STATE LISTENER
  // ==========================================
  function initAuth() {
    if (!window.firebaseReady || !supabaseClient) {
      updateUIForGuest();
      return;
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        currentUser = session.user;
        await loadUserProfile(session.user);
        updateUIForLoggedIn(session.user);
      } else {
        currentUser = null;
        currentUserRole = null;
        currentUserProfile = null;
        updateUIForGuest();
      }
      authStateCallbacks.forEach(cb => cb(currentUser, currentUserRole));
    });

    // Check existing session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        currentUser = session.user;
        loadUserProfile(session.user).then(() => {
          updateUIForLoggedIn(session.user);
          authStateCallbacks.forEach(cb => cb(currentUser, currentUserRole));
        });
      }
    });
  }

  // ==========================================
  // USER PROFILE MANAGEMENT
  // ==========================================
  async function loadUserProfile(user) {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        currentUserProfile = data;
        currentUserRole = data.role;
      } else {
        // First time login — auto-assign role based on email
        const email = (user.email || '').toLowerCase();
        let role = ROLES.PATIENT;

        if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
          role = ROLES.SUPER_ADMIN;
        } else if (ADMIN_EMAILS.some(e => e.toLowerCase() === email)) {
          role = ROLES.ADMIN;
        }

        currentUserProfile = {
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          role: role,
        };

        await supabaseClient.from('profiles').upsert(currentUserProfile);
        currentUserRole = role;
      }

      // Update last login
      await supabaseClient
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

    } catch (e) {
      console.error('Error loading user profile:', e);
      currentUserRole = ROLES.PATIENT;
    }
  }

  // ==========================================
  // REGISTER
  // ==========================================
  async function register(email, password, displayName) {
    if (!supabaseClient) throw new Error('Supabase not configured');

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName }
      }
    });

    if (error) throw new Error(error.message);

    if (data.user && !data.session) {
      throw new Error('Check your email for a confirmation link!');
    }

    return data.user;
  }

  // ==========================================
  // LOGIN
  // ==========================================
  async function login(email, password) {
    if (!supabaseClient) throw new Error('Supabase not configured');

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw new Error(error.message);
    return data.user;
  }

  // ==========================================
  // GOOGLE SIGN IN
  // ==========================================
  async function googleSignIn() {
    if (!supabaseClient) throw new Error('Supabase not configured');

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });

    if (error) throw new Error(error.message);
  }

  // ==========================================
  // LOGOUT
  // ==========================================
  async function logout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  }

  // ==========================================
  // PASSWORD RESET
  // ==========================================
  async function resetPassword(email) {
    if (!supabaseClient) throw new Error('Supabase not configured');

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (error) throw new Error(error.message);
  }

  // ==========================================
  // AUTHORIZATION CHECKS
  // ==========================================
  function isLoggedIn() { return currentUser !== null; }
  function isSuperAdmin() { return currentUserRole === ROLES.SUPER_ADMIN; }
  function isAdmin() { return currentUserRole === ROLES.ADMIN || currentUserRole === ROLES.SUPER_ADMIN; }
  function isClinicAssistant() { return currentUserRole === ROLES.CLINIC_ASSISTANT; }
  function isPatient() { return currentUserRole === ROLES.PATIENT; }

  // Permission checks
  function canEditDoctors() {
    return [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CLINIC_ASSISTANT].includes(currentUserRole);
  }
  function canDeleteDoctors() {
    return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUserRole);
  }
  function canAddDoctors() {
    return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUserRole);
  }
  function canManageUsers() {
    return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUserRole);
  }
  function canManageAdmins() {
    return currentUserRole === ROLES.SUPER_ADMIN; // Only super admin can promote/demote admins
  }
  function canAccessAdminPanel() {
    return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUserRole);
  }
  function canManageSiteSettings() {
    return currentUserRole === ROLES.SUPER_ADMIN;
  }
  function canExportData() {
    return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(currentUserRole);
  }

  // Check if user can change a target user's role
  function canChangeRole(targetRole, newRole) {
    if (currentUserRole === ROLES.SUPER_ADMIN) return true; // Super admin can do anything
    if (currentUserRole === ROLES.ADMIN) {
      // Admin cannot promote to admin/super_admin or demote other admins/super_admins
      if (targetRole === ROLES.SUPER_ADMIN || targetRole === ROLES.ADMIN) return false;
      if (newRole === ROLES.SUPER_ADMIN || newRole === ROLES.ADMIN) return false;
      return true; // Can change patient <-> clinic_assistant
    }
    return false;
  }

  // ==========================================
  // SUPABASE: RATINGS
  // ==========================================
  async function rateDoctorFirestore(doctorId, value) {
    if (!supabaseClient || !currentUser) return null;

    try {
      const { error: ratingError } = await supabaseClient
        .from('ratings')
        .upsert({
          user_id: currentUser.id,
          doctor_id: doctorId,
          value: value,
        }, { onConflict: 'user_id,doctor_id' });

      if (ratingError) throw ratingError;

      // Recalculate aggregate
      const { data: allRatings, error: aggError } = await supabaseClient
        .from('ratings')
        .select('value')
        .eq('doctor_id', doctorId);

      if (aggError) throw aggError;

      const total = allRatings.reduce((sum, r) => sum + r.value, 0);
      const count = allRatings.length;

      await supabaseClient
        .from('doctor_ratings')
        .upsert({ doctor_id: doctorId, total, count }, { onConflict: 'doctor_id' });

      return { total, count, userRating: value };
    } catch (e) {
      console.error('Error saving rating:', e);
      return null;
    }
  }

  async function getDoctorRatingFirestore(doctorId) {
    if (!supabaseClient) return null;

    try {
      let result = { total: 0, count: 0, userRating: 0 };

      const { data: aggData } = await supabaseClient
        .from('doctor_ratings')
        .select('total, count')
        .eq('doctor_id', doctorId)
        .single();

      if (aggData) {
        result.total = aggData.total;
        result.count = aggData.count;
      }

      if (currentUser) {
        const { data: userRating } = await supabaseClient
          .from('ratings')
          .select('value')
          .eq('user_id', currentUser.id)
          .eq('doctor_id', doctorId)
          .single();

        if (userRating) result.userRating = userRating.value;
      }

      return result;
    } catch (e) {
      console.error('Error getting rating:', e);
      return null;
    }
  }

  // ==========================================
  // SUPABASE: DOCTOR MANAGEMENT
  // ==========================================
  async function addDoctorFirestore(doctorData) {
    if (!canAddDoctors()) throw new Error('Unauthorized');

    const { data, error } = await supabaseClient
      .from('doctors')
      .insert({
        name: doctorData.name,
        specialty: doctorData.specialty,
        area: doctorData.area,
        clinic: doctorData.clinic || '',
        phone: doctorData.phone || '',
        added_by: currentUser.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data.id;
  }

  async function updateDoctorFirestore(doctorId, updates) {
    if (!canEditDoctors()) throw new Error('Unauthorized');

    const { error } = await supabaseClient
      .from('doctors')
      .upsert({
        id: doctorId,
        name: updates.name,
        specialty: updates.specialty,
        area: updates.area,
        clinic: updates.clinic || '',
        phone: updates.phone || '',
        updated_by: currentUser.id,
      });

    if (error) throw new Error(error.message);
  }

  async function deleteDoctorFirestore(doctorId) {
    if (!canDeleteDoctors()) throw new Error('Unauthorized');

    const { error } = await supabaseClient
      .from('doctors')
      .update({ deleted: true, deleted_by: currentUser.id })
      .eq('id', doctorId);

    if (error) throw new Error(error.message);
  }

  // ==========================================
  // SUPABASE: USER MANAGEMENT
  // ==========================================
  async function getAllUsers() {
    if (!canManageUsers()) throw new Error('Unauthorized');

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(u => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      lastLogin: u.last_login ? { toDate: () => new Date(u.last_login) } : null,
      createdAt: u.created_at,
    }));
  }

  async function updateUserRole(userId, newRole) {
    if (!canManageUsers()) throw new Error('Unauthorized');
    if (!Object.values(ROLES).includes(newRole)) throw new Error('Invalid role');

    // Get target user's current role
    const { data: target } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (target && !canChangeRole(target.role, newRole)) {
      throw new Error('You do not have permission to change this user\'s role');
    }

    const { error } = await supabaseClient
      .from('profiles')
      .update({ role: newRole, role_updated_by: currentUser.id })
      .eq('id', userId);

    if (error) throw new Error(error.message);
  }

  // ==========================================
  // UI UPDATES
  // ==========================================
  function updateUIForLoggedIn(user) {
    const authBtn = document.getElementById('authBtn');
    const userMenu = document.getElementById('userMenu');
    const adminLink = document.getElementById('adminLink');

    if (authBtn) authBtn.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'flex';
      const userName = userMenu.querySelector('.user-name');
      const userRole = userMenu.querySelector('.user-role');
      const userAvatar = userMenu.querySelector('.user-avatar-text');

      if (userName) userName.textContent = currentUserProfile?.display_name || user.email;
      if (userRole) userRole.textContent = ROLE_LABELS[currentUserRole] || 'Patient';
      if (userAvatar) userAvatar.textContent = (currentUserProfile?.display_name || user.email)[0].toUpperCase();

      const badge = userMenu.querySelector('.role-badge');
      if (badge) badge.className = 'role-badge role-' + currentUserRole;
    }

    if (adminLink) adminLink.style.display = canAccessAdminPanel() ? 'inline-flex' : 'none';
    closeAuthModal();
  }

  function updateUIForGuest() {
    const authBtn = document.getElementById('authBtn');
    const userMenu = document.getElementById('userMenu');
    const adminLink = document.getElementById('adminLink');

    if (authBtn) authBtn.style.display = 'inline-flex';
    if (userMenu) userMenu.style.display = 'none';
    if (adminLink) adminLink.style.display = 'none';
  }

  // ==========================================
  // AUTH MODAL
  // ==========================================
  function openAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    if (!window.firebaseReady) {
      alert('Authentication is not configured yet. Please set up Supabase first.');
      return;
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthMode(mode);
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('active');
    if (!document.getElementById('doctorModal')?.classList.contains('active')) {
      document.body.style.overflow = '';
    }
    clearAuthErrors();
  }

  function switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const resetForm = document.getElementById('resetForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');

    if (!loginForm) return;
    loginForm.style.display = mode === 'login' ? 'block' : 'none';
    registerForm.style.display = mode === 'register' ? 'block' : 'none';
    resetForm.style.display = mode === 'reset' ? 'block' : 'none';
    if (loginTab) loginTab.classList.toggle('active', mode === 'login');
    if (registerTab) registerTab.classList.toggle('active', mode === 'register');
    clearAuthErrors();
  }

  function showAuthError(formId, message) {
    const el = document.querySelector(`#${formId} .auth-error`);
    if (el) { el.textContent = message; el.style.display = 'block'; }
  }

  function clearAuthErrors() {
    document.querySelectorAll('.auth-error').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
  }

  function showAuthSuccess(formId, message) {
    const el = document.querySelector(`#${formId} .auth-success`);
    if (el) { el.textContent = message; el.style.display = 'block'; }
  }

  // ==========================================
  // EVENT HANDLERS SETUP
  // ==========================================
  function setupAuthEvents() {
    const authBtn = document.getElementById('authBtn');
    if (authBtn) authBtn.addEventListener('click', () => openAuthModal('login'));

    const authModalClose = document.getElementById('authModalClose');
    if (authModalClose) authModalClose.addEventListener('click', closeAuthModal);

    const authModal = document.getElementById('authModal');
    if (authModal) authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    if (loginTab) loginTab.addEventListener('click', () => switchAuthMode('login'));
    if (registerTab) registerTab.addEventListener('click', () => switchAuthMode('register'));

    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); switchAuthMode('reset'); });

    const backToLogin = document.getElementById('backToLoginLink');
    if (backToLogin) backToLogin.addEventListener('click', (e) => { e.preventDefault(); switchAuthMode('login'); });

    // Login form
    const loginFormEl = document.getElementById('loginFormEl');
    if (loginFormEl) {
      loginFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const btn = loginFormEl.querySelector('button[type="submit"]');
        try {
          btn.disabled = true; btn.textContent = 'Signing in...';
          await login(email, password);
        } catch (err) { showAuthError('loginForm', err.message); }
        finally { btn.disabled = false; btn.textContent = 'Sign In'; }
      });
    }

    // Register form
    const registerFormEl = document.getElementById('registerFormEl');
    if (registerFormEl) {
      registerFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirm = document.getElementById('registerConfirmPassword').value;
        const btn = registerFormEl.querySelector('button[type="submit"]');
        if (password !== confirm) { showAuthError('registerForm', 'Passwords do not match'); return; }
        if (password.length < 6) { showAuthError('registerForm', 'Password must be at least 6 characters'); return; }
        try {
          btn.disabled = true; btn.textContent = 'Creating account...';
          await register(email, password, name);
          showAuthSuccess('registerForm', 'Account created successfully!');
        } catch (err) { showAuthError('registerForm', err.message); }
        finally { btn.disabled = false; btn.textContent = 'Create Account'; }
      });
    }

    // Reset form
    const resetFormEl = document.getElementById('resetFormEl');
    if (resetFormEl) {
      resetFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value.trim();
        const btn = resetFormEl.querySelector('button[type="submit"]');
        try {
          btn.disabled = true; btn.textContent = 'Sending...';
          await resetPassword(email);
          showAuthSuccess('resetForm', 'Password reset email sent! Check your inbox.');
        } catch (err) { showAuthError('resetForm', err.message); }
        finally { btn.disabled = false; btn.textContent = 'Send Reset Link'; }
      });
    }

    // Google sign in
    document.querySelectorAll('.google-signin-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { btn.disabled = true; await googleSignIn(); }
        catch (err) { showAuthError('loginForm', err.message); }
        finally { btn.disabled = false; }
      });
    });

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await logout(); });

    // User menu dropdown
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn && userDropdown) {
      userMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); userDropdown.classList.toggle('active'); });
      document.addEventListener('click', () => { userDropdown.classList.remove('active'); });
    }
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  
  // ==========================================
  // SUGGEST EDIT
  // ==========================================
  async function submitSuggestion(doctorId, message) {
    if (!supabaseClient) throw new Error('Supabase not configured');
    if (!currentUser) throw new Error('Please sign in to suggest edits.');
    
    const { error } = await supabaseClient
      .from('suggestions')
      .insert({
        doctor_id: doctorId,
        user_id: currentUser.id,
        message: message,
        status: 'pending'
      });
      
    if (error) throw new Error(error.message);
  }

  window.AuthManager = {
    submitSuggestion,
    init: initAuth,
    setupEvents: setupAuthEvents,
    register, login, googleSignIn, logout, resetPassword,
    isLoggedIn, isSuperAdmin, isAdmin, isClinicAssistant, isPatient,
    canEditDoctors, canManageUsers, canDeleteDoctors, canAddDoctors,
    canManageAdmins, canAccessAdminPanel, canManageSiteSettings, canExportData,
    canChangeRole,
    openAuthModal, closeAuthModal,
    rateDoctorFirestore, getDoctorRatingFirestore,
    addDoctorFirestore, updateDoctorFirestore, deleteDoctorFirestore,
    getAllUsers, updateUserRole,
    getCurrentUser: () => currentUser,
    getCurrentRole: () => currentUserRole,
    getCurrentProfile: () => currentUserProfile,
    onAuthStateChanged: (cb) => authStateCallbacks.push(cb),
  };

})();
