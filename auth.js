/* =============================================
   AUTH MODULE - Authentication & Authorization
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
    if (!window.firebaseReady) {
      updateUIForGuest();
      return;
    }

    fbAuth.onAuthStateChanged(async (user) => {
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
      // Notify callbacks
      authStateCallbacks.forEach(cb => cb(currentUser, currentUserRole));
    });
  }

  // ==========================================
  // USER PROFILE MANAGEMENT
  // ==========================================
  async function loadUserProfile(user) {
    try {
      const doc = await fbDb.collection('users').doc(user.uid).get();
      if (doc.exists) {
        currentUserProfile = doc.data();
        currentUserRole = currentUserProfile.role;
      } else {
        // First time login - create profile
        const role = (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) 
          ? ROLES.ADMIN 
          : ROLES.PATIENT;
        
        currentUserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          role: role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        await fbDb.collection('users').doc(user.uid).set(currentUserProfile);
        currentUserRole = role;
      }
      
      // Update last login
      await fbDb.collection('users').doc(user.uid).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error('Error loading user profile:', e);
      currentUserRole = ROLES.PATIENT;
    }
  }

  // ==========================================
  // REGISTER
  // ==========================================
  async function register(email, password, displayName) {
    if (!window.firebaseReady) throw new Error('Firebase not configured');
    
    try {
      const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
      if (displayName) {
        await cred.user.updateProfile({ displayName: displayName });
      }
      return cred.user;
    } catch (e) {
      throw formatAuthError(e);
    }
  }

  // ==========================================
  // LOGIN
  // ==========================================
  async function login(email, password) {
    if (!window.firebaseReady) throw new Error('Firebase not configured');
    
    try {
      const cred = await fbAuth.signInWithEmailAndPassword(email, password);
      return cred.user;
    } catch (e) {
      throw formatAuthError(e);
    }
  }

  // ==========================================
  // GOOGLE SIGN IN
  // ==========================================
  async function googleSignIn() {
    if (!window.firebaseReady) throw new Error('Firebase not configured');
    
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await fbAuth.signInWithPopup(provider);
      return cred.user;
    } catch (e) {
      throw formatAuthError(e);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================
  async function logout() {
    if (!window.firebaseReady) return;
    await fbAuth.signOut();
  }

  // ==========================================
  // PASSWORD RESET
  // ==========================================
  async function resetPassword(email) {
    if (!window.firebaseReady) throw new Error('Firebase not configured');
    
    try {
      await fbAuth.sendPasswordResetEmail(email);
    } catch (e) {
      throw formatAuthError(e);
    }
  }

  // ==========================================
  // AUTHORIZATION CHECKS
  // ==========================================
  function isLoggedIn() {
    return currentUser !== null;
  }

  function isAdmin() {
    return currentUserRole === ROLES.ADMIN;
  }

  function isClinicAssistant() {
    return currentUserRole === ROLES.CLINIC_ASSISTANT;
  }

  function isPatient() {
    return currentUserRole === ROLES.PATIENT;
  }

  function canEditDoctors() {
    return currentUserRole === ROLES.ADMIN || currentUserRole === ROLES.CLINIC_ASSISTANT;
  }

  function canManageUsers() {
    return currentUserRole === ROLES.ADMIN;
  }

  function canDeleteDoctors() {
    return currentUserRole === ROLES.ADMIN;
  }

  function canAddDoctors() {
    return currentUserRole === ROLES.ADMIN;
  }

  // ==========================================
  // FIRESTORE: RATINGS
  // ==========================================
  async function rateDoctorFirestore(doctorId, value) {
    if (!window.firebaseReady || !currentUser) return null;
    
    const ratingRef = fbDb.collection('ratings').doc(`${currentUser.uid}_${doctorId}`);
    const doctorRatingRef = fbDb.collection('doctorRatings').doc(String(doctorId));
    
    try {
      // Get existing rating
      const existingDoc = await ratingRef.get();
      const oldValue = existingDoc.exists ? existingDoc.data().value : 0;
      
      // Save individual rating
      await ratingRef.set({
        userId: currentUser.uid,
        doctorId: doctorId,
        value: value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update aggregate rating
      const aggDoc = await doctorRatingRef.get();
      if (aggDoc.exists) {
        const data = aggDoc.data();
        let newTotal = data.total - oldValue + value;
        let newCount = existingDoc.exists ? data.count : data.count + 1;
        await doctorRatingRef.update({ total: newTotal, count: newCount });
        return { total: newTotal, count: newCount, userRating: value };
      } else {
        await doctorRatingRef.set({ total: value, count: 1 });
        return { total: value, count: 1, userRating: value };
      }
    } catch (e) {
      console.error('Error saving rating:', e);
      return null;
    }
  }

  async function getDoctorRatingFirestore(doctorId) {
    if (!window.firebaseReady) return null;
    
    try {
      const aggDoc = await fbDb.collection('doctorRatings').doc(String(doctorId)).get();
      let result = { total: 0, count: 0, userRating: 0 };
      
      if (aggDoc.exists) {
        result.total = aggDoc.data().total;
        result.count = aggDoc.data().count;
      }
      
      // Get user's own rating
      if (currentUser) {
        const userRatingDoc = await fbDb.collection('ratings')
          .doc(`${currentUser.uid}_${doctorId}`).get();
        if (userRatingDoc.exists) {
          result.userRating = userRatingDoc.data().value;
        }
      }
      
      return result;
    } catch (e) {
      console.error('Error getting rating:', e);
      return null;
    }
  }

  // ==========================================
  // FIRESTORE: DOCTOR MANAGEMENT
  // ==========================================
  async function addDoctorFirestore(doctorData) {
    if (!canAddDoctors()) throw new Error('Unauthorized');
    
    const ref = await fbDb.collection('doctors').add({
      ...doctorData,
      addedBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  async function updateDoctorFirestore(doctorId, updates) {
    if (!canEditDoctors()) throw new Error('Unauthorized');
    
    await fbDb.collection('doctors').doc(String(doctorId)).set({
      ...updates,
      updatedBy: currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function deleteDoctorFirestore(doctorId) {
    if (!canDeleteDoctors()) throw new Error('Unauthorized');
    
    await fbDb.collection('doctors').doc(String(doctorId)).update({
      deleted: true,
      deletedBy: currentUser.uid,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // ==========================================
  // FIRESTORE: USER MANAGEMENT (Admin only)
  // ==========================================
  async function getAllUsers() {
    if (!canManageUsers()) throw new Error('Unauthorized');
    
    const snapshot = await fbDb.collection('users').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function updateUserRole(userId, newRole) {
    if (!canManageUsers()) throw new Error('Unauthorized');
    if (!Object.values(ROLES).includes(newRole)) throw new Error('Invalid role');
    
    await fbDb.collection('users').doc(userId).update({
      role: newRole,
      roleUpdatedBy: currentUser.uid,
      roleUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
      
      if (userName) userName.textContent = currentUserProfile?.displayName || user.email;
      if (userRole) userRole.textContent = ROLE_LABELS[currentUserRole] || 'Patient';
      if (userAvatar) userAvatar.textContent = (currentUserProfile?.displayName || user.email)[0].toUpperCase();
      
      // Role-based badge color
      const badge = userMenu.querySelector('.role-badge');
      if (badge) {
        badge.className = 'role-badge role-' + currentUserRole;
      }
    }
    
    // Show admin link for admins
    if (adminLink) {
      adminLink.style.display = (currentUserRole === ROLES.ADMIN) ? 'inline-flex' : 'none';
    }
    
    // Show edit buttons for assistants/admins
    document.querySelectorAll('.edit-doctor-btn').forEach(btn => {
      btn.style.display = canEditDoctors() ? 'inline-flex' : 'none';
    });

    // Close auth modal if open
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
    const errorEl = document.querySelector(`#${formId} .auth-error`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  function clearAuthErrors() {
    document.querySelectorAll('.auth-error').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });
  }

  function showAuthSuccess(formId, message) {
    const successEl = document.querySelector(`#${formId} .auth-success`);
    if (successEl) {
      successEl.textContent = message;
      successEl.style.display = 'block';
    }
  }

  // ==========================================
  // EVENT HANDLERS SETUP
  // ==========================================
  function setupAuthEvents() {
    // Auth button
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', () => openAuthModal('login'));
    }
    
    // Close auth modal
    const authModalClose = document.getElementById('authModalClose');
    if (authModalClose) {
      authModalClose.addEventListener('click', closeAuthModal);
    }
    
    const authModal = document.getElementById('authModal');
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
      });
    }
    
    // Tab switching
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    if (loginTab) loginTab.addEventListener('click', () => switchAuthMode('login'));
    if (registerTab) registerTab.addEventListener('click', () => switchAuthMode('register'));
    
    // Forgot password link
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthMode('reset');
      });
    }
    
    // Back to login from reset
    const backToLogin = document.getElementById('backToLoginLink');
    if (backToLogin) {
      backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchAuthMode('login');
      });
    }

    // Login form submit
    const loginFormEl = document.getElementById('loginFormEl');
    if (loginFormEl) {
      loginFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const submitBtn = loginFormEl.querySelector('button[type="submit"]');
        
        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Signing in...';
          await login(email, password);
        } catch (err) {
          showAuthError('loginForm', err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }
      });
    }

    // Register form submit
    const registerFormEl = document.getElementById('registerFormEl');
    if (registerFormEl) {
      registerFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const submitBtn = registerFormEl.querySelector('button[type="submit"]');
        
        if (password !== confirmPassword) {
          showAuthError('registerForm', 'Passwords do not match');
          return;
        }
        if (password.length < 6) {
          showAuthError('registerForm', 'Password must be at least 6 characters');
          return;
        }
        
        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating account...';
          await register(email, password, name);
        } catch (err) {
          showAuthError('registerForm', err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
        }
      });
    }

    // Reset password form
    const resetFormEl = document.getElementById('resetFormEl');
    if (resetFormEl) {
      resetFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value.trim();
        const submitBtn = resetFormEl.querySelector('button[type="submit"]');
        
        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sending...';
          await resetPassword(email);
          showAuthSuccess('resetForm', 'Password reset email sent! Check your inbox.');
        } catch (err) {
          showAuthError('resetForm', err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Reset Link';
        }
      });
    }

    // Google sign in buttons
    document.querySelectorAll('.google-signin-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          btn.disabled = true;
          await googleSignIn();
        } catch (err) {
          showAuthError('loginForm', err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await logout();
      });
    }

    // User menu dropdown toggle
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn && userDropdown) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('active');
      });
      document.addEventListener('click', () => {
        userDropdown.classList.remove('active');
      });
    }
  }

  // ==========================================
  // ERROR FORMATTING
  // ==========================================
  function formatAuthError(error) {
    const messages = {
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'An account with this email already exists',
      'auth/weak-password': 'Password must be at least 6 characters',
      'auth/invalid-email': 'Please enter a valid email address',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/popup-closed-by-user': 'Sign-in popup was closed',
      'auth/invalid-credential': 'Invalid email or password',
    };
    
    return new Error(messages[error.code] || error.message || 'An error occurred');
  }

  // ==========================================
  // PUBLIC API
  // ==========================================
  window.AuthManager = {
    init: initAuth,
    setupEvents: setupAuthEvents,
    register,
    login,
    googleSignIn,
    logout,
    resetPassword,
    isLoggedIn,
    isAdmin,
    isClinicAssistant,
    isPatient,
    canEditDoctors,
    canManageUsers,
    canDeleteDoctors,
    canAddDoctors,
    openAuthModal,
    closeAuthModal,
    rateDoctorFirestore,
    getDoctorRatingFirestore,
    addDoctorFirestore,
    updateDoctorFirestore,
    deleteDoctorFirestore,
    getAllUsers,
    updateUserRole,
    getCurrentUser: () => currentUser,
    getCurrentRole: () => currentUserRole,
    getCurrentProfile: () => currentUserProfile,
    onAuthStateChanged: (cb) => authStateCallbacks.push(cb),
  };

})();
