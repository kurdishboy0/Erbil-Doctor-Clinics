/* =============================================
   AUTH MODULE - Firebase Authentication & Authorization
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
    if (!window.firebaseReady || !auth) {
      updateUIForGuest();
      return;
    }

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        await loadUserProfile(user);
        updateUIForLoggedIn(user);
      } else {
        currentUser = null;
        currentUserRole = null;
        currentUserProfile = null;
        updateUIForGuest();
      }
      authStateCallbacks.forEach(cb => cb(currentUser, currentUserRole));
    });
  }

  // ==========================================
  // USER PROFILE MANAGEMENT
  // ==========================================
  async function loadUserProfile(user) {
    try {
      const docRef = db.collection('profiles').doc(user.uid);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        currentUserProfile = docSnap.data();
        currentUserRole = currentUserProfile.role;
      } else {
        // First time login — auto-assign role based on email
        const email = (user.email || '').toLowerCase();
        let role = ROLES.PATIENT;

        if (email === window.SUPER_ADMIN_EMAIL.toLowerCase()) {
          role = ROLES.SUPER_ADMIN;
        } else if (window.ADMIN_EMAILS.some(e => e.toLowerCase() === email)) {
          role = ROLES.ADMIN;
        }

        currentUserProfile = {
          email: user.email,
          display_name: user.displayName || user.email.split('@')[0],
          role: role,
          created_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        await docRef.set(currentUserProfile);
        currentUserRole = role;
      }

      // Update last login
      await docRef.update({ last_login: firebase.firestore.FieldValue.serverTimestamp() });

    } catch (e) {
      console.error('Error loading user profile:', e);
      currentUserRole = ROLES.PATIENT;
    }
  }

  // ==========================================
  // REGISTER
  // ==========================================
  async function register(email, password, displayName) {
    if (!auth) throw new Error('Firebase not configured');

    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    await userCredential.user.updateProfile({ displayName });
    return userCredential.user;
  }

  // ==========================================
  // LOGIN
  // ==========================================
  async function login(email, password) {
    if (!auth) throw new Error('Firebase not configured');
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  }

  // ==========================================
  // GOOGLE SIGN IN
  // ==========================================
  async function googleSignIn() {
    if (!auth) throw new Error('Firebase not configured');
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  }

  // ==========================================
  // LOGOUT
  // ==========================================
  async function logout() {
    if (!auth) return;
    await auth.signOut();
  }

  // ==========================================
  // PASSWORD RESET
  // ==========================================
  async function resetPassword(email) {
    if (!auth) throw new Error('Firebase not configured');
    await auth.sendPasswordResetEmail(email);
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
    return currentUserRole === ROLES.SUPER_ADMIN; 
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

  function canChangeRole(targetRole, newRole) {
    if (currentUserRole === ROLES.SUPER_ADMIN) return true;
    if (currentUserRole === ROLES.ADMIN) {
      if (targetRole === ROLES.SUPER_ADMIN || targetRole === ROLES.ADMIN) return false;
      if (newRole === ROLES.SUPER_ADMIN || newRole === ROLES.ADMIN) return false;
      return true;
    }
    return false;
  }

  // ==========================================
  // FIREBASE: RATINGS
  // ==========================================
  async function rateDoctorFirestore(doctorId, value) {
    if (!db || !currentUser) return null;

    try {
      // 1. Save user rating
      const ratingRef = db.collection('ratings').doc(`${currentUser.uid}_${doctorId}`);
      await ratingRef.set({
        user_id: currentUser.uid,
        doctor_id: doctorId.toString(),
        value: value,
        updated_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2. Recalculate aggregate using a transaction to ensure accuracy
      const docRatingRef = db.collection('doctor_ratings').doc(doctorId.toString());
      
      const allRatingsSnapshot = await db.collection('ratings')
        .where('doctor_id', '==', doctorId.toString())
        .get();
        
      let total = 0;
      let count = allRatingsSnapshot.size;
      allRatingsSnapshot.forEach(doc => {
        total += doc.data().value;
      });

      await docRatingRef.set({ total, count });

      return { total, count, userRating: value };
    } catch (e) {
      console.error('Error saving rating:', e);
      return null;
    }
  }

  async function getDoctorRatingFirestore(doctorId) {
    if (!db) return null;

    try {
      let result = { total: 0, count: 0, userRating: 0 };

      // Get aggregate
      const docRatingRef = db.collection('doctor_ratings').doc(doctorId.toString());
      const aggSnap = await docRatingRef.get();
      if (aggSnap.exists) {
        result.total = aggSnap.data().total;
        result.count = aggSnap.data().count;
      }

      // Get current user rating
      if (currentUser) {
        const ratingRef = db.collection('ratings').doc(`${currentUser.uid}_${doctorId}`);
        const ratingSnap = await ratingRef.get();
        if (ratingSnap.exists) {
          result.userRating = ratingSnap.data().value;
        }
      }

      return result;
    } catch (e) {
      console.error('Error getting rating:', e);
      return null;
    }
  }

  // ==========================================
  // FIREBASE: DOCTOR MANAGEMENT
  // ==========================================
  async function addDoctorFirestore(doctorData) {
    if (!canAddDoctors()) throw new Error('Unauthorized');

    const docRef = await db.collection('doctors').add({
      name: doctorData.name,
      specialty: doctorData.specialty,
      area: doctorData.area,
      clinic: doctorData.clinic || '',
      phone: doctorData.phone || '',
      added_by: currentUser.uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    return docRef.id;
  }

  async function updateDoctorFirestore(doctorId, updates) {
    if (!canEditDoctors()) throw new Error('Unauthorized');

    await db.collection('doctors').doc(doctorId.toString()).set({
      name: updates.name,
      specialty: updates.specialty,
      area: updates.area,
      clinic: updates.clinic || '',
      phone: updates.phone || '',
      updated_by: currentUser.uid,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function deleteDoctorFirestore(doctorId) {
    if (!canDeleteDoctors()) throw new Error('Unauthorized');

    await db.collection('doctors').doc(doctorId.toString()).set({
      deleted: true,
      deleted_by: currentUser.uid,
      deleted_at: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // ==========================================
  // FIREBASE: USER MANAGEMENT
  // ==========================================
  async function getAllUsers() {
    if (!canManageUsers()) throw new Error('Unauthorized');

    const snapshot = await db.collection('profiles')
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        displayName: data.display_name,
        role: data.role,
        lastLogin: data.last_login ? data.last_login.toDate() : null,
      };
    });
  }

  async function updateUserRole(userId, newRole) {
    if (!canManageUsers()) throw new Error('Unauthorized');
    if (!Object.values(ROLES).includes(newRole)) throw new Error('Invalid role');

    const docRef = db.collection('profiles').doc(userId);
    const targetSnap = await docRef.get();
    
    if (targetSnap.exists) {
      const targetData = targetSnap.data();
      if (!canChangeRole(targetData.role, newRole)) {
        throw new Error('You do not have permission to change this user\'s role');
      }
    }

    await docRef.update({
      role: newRole,
      role_updated_by: currentUser.uid
    });
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
      alert('Authentication is not configured yet. Please set up Firebase first.');
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
  window.AuthManager = {
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
