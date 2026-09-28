/* =============================================
   ADMIN PANEL - JavaScript
   ============================================= */

(function() {
  'use strict';

  let adminDoctorsPage = 0;
  const ADMIN_PAGE_SIZE = 50;
  let adminDoctorSearchTerm = '';

  function initAdmin() {
    if (!window.firebaseReady) {
      document.getElementById('accessDenied').innerHTML = `
        <div style="font-size:64px;">⚙️</div>
        <h2 style="margin:16px 0 8px;">Firebase Not Configured</h2>
        <p style="color:var(--text-secondary);">Please configure firebase-config.js first.</p>
        <br><a href="index.html" class="btn btn-primary">← Back to Home</a>`;
      return;
    }

    AuthManager.setupEvents();
    AuthManager.init();

    AuthManager.onAuthStateChanged((user, role) => {
      if (user && role === ROLES.ADMIN) {
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        loadOverview();
        loadUsers();
        loadAdminDoctors();
      } else {
        document.getElementById('accessDenied').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
      }
    });

    setupAdminEvents();
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function setupAdminEvents() {
    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        document.getElementById('panel-' + this.dataset.tab).classList.add('active');
      });
    });

    // Refresh users
    const refreshBtn = document.getElementById('refreshUsersBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);

    // Doctor search
    const searchInput = document.getElementById('adminDoctorSearch');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          adminDoctorSearchTerm = this.value.trim().toLowerCase();
          adminDoctorsPage = 0;
          loadAdminDoctors();
        }, 300);
      });
    }

    // Add doctor button
    const addBtn = document.getElementById('adminAddDoctorBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        // Redirect to main page where the add modal exists
        window.location.href = 'index.html#add-doctor';
      });
    }

    // Load more doctors
    const loadMoreBtn = document.getElementById('loadMoreDoctorsBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        adminDoctorsPage++;
        loadAdminDoctors(true);
      });
    }
  }

  // ==========================================
  // OVERVIEW / STATS
  // ==========================================
  async function loadOverview() {
    const doctors = DOCTORS_DATA.doctors;
    document.getElementById('statDoctors').textContent = doctors.length;
    document.getElementById('statAreas').textContent = DOCTORS_DATA.areas.length;
    document.getElementById('statSpecialties').textContent = DOCTORS_DATA.specialties.length;

    // Specialty breakdown
    const breakdown = {};
    doctors.forEach(d => {
      breakdown[d.specialty] = (breakdown[d.specialty] || 0) + 1;
    });
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    
    const container = document.getElementById('specialtyBreakdown');
    container.innerHTML = `
      <table class="user-table">
        <thead><tr><th>Specialty</th><th>Count</th><th>Percentage</th></tr></thead>
        <tbody>
          ${sorted.map(([spec, count]) => `
            <tr>
              <td>${escapeHtml(spec)}</td>
              <td><strong>${count}</strong></td>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:100px;height:8px;background:var(--border-light);border-radius:4px;overflow:hidden;">
                    <div style="width:${(count/doctors.length*100).toFixed(0)}%;height:100%;background:var(--primary);border-radius:4px;"></div>
                  </div>
                  <span style="font-size:0.8rem;color:var(--text-light);">${(count/doctors.length*100).toFixed(1)}%</span>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    // Load Firestore stats
    try {
      const usersSnap = await fbDb.collection('users').get();
      document.getElementById('statUsers').textContent = usersSnap.size;
      
      const assistants = usersSnap.docs.filter(d => d.data().role === ROLES.CLINIC_ASSISTANT).length;
      document.getElementById('statAssistants').textContent = assistants;

      const ratingsSnap = await fbDb.collection('ratings').get();
      document.getElementById('statRatings').textContent = ratingsSnap.size;
    } catch (e) {
      console.error('Error loading Firestore stats:', e);
    }
  }

  // ==========================================
  // USERS MANAGEMENT
  // ==========================================
  async function loadUsers() {
    const loading = document.getElementById('usersLoading');
    const tableContainer = document.getElementById('usersTableContainer');
    const tbody = document.getElementById('usersTableBody');
    
    loading.style.display = 'block';
    tableContainer.style.display = 'none';

    try {
      const users = await AuthManager.getAllUsers();
      tbody.innerHTML = '';

      users.forEach(user => {
        const tr = document.createElement('tr');
        const lastLogin = user.lastLogin ? 
          (user.lastLogin.toDate ? user.lastLogin.toDate().toLocaleDateString() : 'N/A') : 'N/A';
        
        tr.innerHTML = `
          <td><strong>${escapeHtml(user.displayName || 'Unknown')}</strong></td>
          <td>${escapeHtml(user.email || '')}</td>
          <td>${lastLogin}</td>
          <td>
            <select class="role-select" data-user-id="${user.id}" data-current-role="${user.role}">
              <option value="${ROLES.PATIENT}" ${user.role === ROLES.PATIENT ? 'selected' : ''}>👤 Patient</option>
              <option value="${ROLES.CLINIC_ASSISTANT}" ${user.role === ROLES.CLINIC_ASSISTANT ? 'selected' : ''}>👩‍⚕️ Clinic Assistant</option>
              <option value="${ROLES.ADMIN}" ${user.role === ROLES.ADMIN ? 'selected' : ''}>🛡️ Admin</option>
            </select>
          </td>`;
        
        // Role change handler
        const select = tr.querySelector('.role-select');
        select.addEventListener('change', async function() {
          const userId = this.dataset.userId;
          const newRole = this.value;
          const oldRole = this.dataset.currentRole;
          
          if (newRole === oldRole) return;
          
          if (!confirm(`Change role to "${ROLE_LABELS[newRole]}"?`)) {
            this.value = oldRole;
            return;
          }
          
          try {
            await AuthManager.updateUserRole(userId, newRole);
            this.dataset.currentRole = newRole;
            this.style.borderColor = 'var(--secondary)';
            setTimeout(() => { this.style.borderColor = ''; }, 2000);
          } catch (e) {
            alert('Error: ' + e.message);
            this.value = oldRole;
          }
        });

        tbody.appendChild(tr);
      });

      loading.style.display = 'none';
      tableContainer.style.display = 'block';
    } catch (e) {
      loading.innerHTML = '<span style="color:var(--danger);">Error loading users: ' + escapeHtml(e.message) + '</span>';
    }
  }

  // ==========================================
  // DOCTORS MANAGEMENT
  // ==========================================
  function loadAdminDoctors(append = false) {
    const tbody = document.getElementById('adminDoctorsBody');
    let doctors = DOCTORS_DATA.doctors;

    // Filter
    if (adminDoctorSearchTerm) {
      doctors = doctors.filter(d =>
        d.name.toLowerCase().includes(adminDoctorSearchTerm) ||
        d.specialty.toLowerCase().includes(adminDoctorSearchTerm) ||
        d.area.toLowerCase().includes(adminDoctorSearchTerm) ||
        d.clinic.toLowerCase().includes(adminDoctorSearchTerm)
      );
    }

    const start = append ? adminDoctorsPage * ADMIN_PAGE_SIZE : 0;
    const end = Math.min(start + ADMIN_PAGE_SIZE, doctors.length);
    
    if (!append) {
      tbody.innerHTML = '';
      adminDoctorsPage = 0;
    }

    for (let i = start; i < end; i++) {
      const d = doctors[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.id}</td>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td>${escapeHtml(d.specialty)}</td>
        <td>${escapeHtml(d.area)}</td>
        <td>${escapeHtml(d.clinic || '-')}</td>
        <td>${escapeHtml(d.phone || '-')}</td>
        <td>
          <button class="edit-doctor-btn" title="Edit" style="display:inline-flex;">✏️</button>
          <button class="delete-doctor-btn" title="Delete" style="display:inline-flex;">🗑️</button>
        </td>`;
      
      // Edit click -> go to main page
      tr.querySelector('.edit-doctor-btn').addEventListener('click', () => {
        // Store doctor data in sessionStorage for cross-page communication
        sessionStorage.setItem('editDoctor', JSON.stringify(d));
        window.location.href = 'index.html#edit-doctor';
      });

      // Delete
      tr.querySelector('.delete-doctor-btn').addEventListener('click', async () => {
        if (confirm('Delete Dr. ' + d.name + '?')) {
          try {
            await AuthManager.deleteDoctorFirestore(d.id);
            tr.remove();
          } catch (e) {
            alert('Error: ' + e.message);
          }
        }
      });

      tbody.appendChild(tr);
    }

    // Show/hide load more
    const loadMoreBtn = document.getElementById('loadMoreDoctorsBtn');
    loadMoreBtn.style.display = end < doctors.length ? 'inline-flex' : 'none';
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ==========================================
  // INIT
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
  } else {
    initAdmin();
  }

})();
