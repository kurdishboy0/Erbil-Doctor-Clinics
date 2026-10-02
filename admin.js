/* =============================================
   ADMIN PANEL - JavaScript
   Super Admin + Admin role-based dashboard
   ============================================= */

(function() {
  'use strict';

  let adminDoctorsPage = 0;
  const ADMIN_PAGE_SIZE = 50;
  let adminDoctorSearchTerm = '';
  let allUsersCache = [];

  function initAdmin() {
    if (!window.firebaseReady) {
      document.getElementById('accessDenied').innerHTML = `
        <div style="font-size:64px;">⚙️</div>
        <h2 style="margin:16px 0 8px;">Supabase Not Configured</h2>
        <p style="color:var(--text-secondary);">Please configure supabase-config.js first.</p>
        <br><a href="index.html" class="btn btn-primary">← Back to Home</a>`;
      return;
    }

    AuthManager.setupEvents();
    AuthManager.init();

    AuthManager.onAuthStateChanged((user, role) => {
      if (user && AuthManager.canAccessAdminPanel()) {
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        setupDashboardForRole(role);
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
  // ROLE-BASED DASHBOARD SETUP
  // ==========================================
  function setupDashboardForRole(role) {
    const isSuperAdmin = role === ROLES.SUPER_ADMIN;
    const title = document.getElementById('adminTitle');
    const subtitle = document.getElementById('adminSubtitle');
    const badge = document.getElementById('adminRoleBadge');
    const settingsTab = document.getElementById('settingsTab');
    const superActions = document.getElementById('superAdminQuickActions');
    const permNote = document.getElementById('userPermissionNote');

    if (isSuperAdmin) {
      title.textContent = '👑 Super Admin Dashboard';
      subtitle.textContent = 'Full control over the entire website — doctors, users, settings & data';
      badge.textContent = '👑 Super Admin';
      badge.className = 'role-badge role-super_admin';
      if (settingsTab) settingsTab.style.display = 'block';
      if (superActions) superActions.style.display = 'block';
      loadSettings();
    } else {
      title.textContent = '⚙️ Admin Panel';
      subtitle.textContent = 'Manage doctors and clinic assistants';
      badge.textContent = '🛡️ Admin';
      badge.className = 'role-badge role-admin';
      if (settingsTab) settingsTab.style.display = 'none';
      if (superActions) superActions.style.display = 'none';
      if (permNote) permNote.style.display = 'block';
    }
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

    // User search
    const userSearch = document.getElementById('userSearchInput');
    if (userSearch) {
      let timeout;
      userSearch.addEventListener('input', function() {
        clearTimeout(timeout);
        timeout = setTimeout(() => filterUsersTable(this.value.trim().toLowerCase()), 300);
      });
    }

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

    // Export buttons
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', () => exportDoctorsCSV());

    const exportUsersBtn = document.getElementById('exportUsersBtn');
    if (exportUsersBtn) exportUsersBtn.addEventListener('click', () => exportUsersCSV());

    const settingsExportDoctors = document.getElementById('settingsExportDoctors');
    if (settingsExportDoctors) settingsExportDoctors.addEventListener('click', () => exportDoctorsCSV());

    const settingsExportRatings = document.getElementById('settingsExportRatings');
    if (settingsExportRatings) settingsExportRatings.addEventListener('click', () => exportRatingsCSV());
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

    // Firestore stats
    try {
      const { data: usersData } = await supabaseClient.from('profiles').select('role');
      if (usersData) {
        document.getElementById('statUsers').textContent = usersData.length;
        const assistants = usersData.filter(u => u.role === ROLES.CLINIC_ASSISTANT).length;
        document.getElementById('statAssistants').textContent = assistants;
      }

      const { data: ratingsData } = await supabaseClient.from('ratings').select('id');
      if (ratingsData) {
        document.getElementById('statRatings').textContent = ratingsData.length;
      }
    } catch (e) {
      console.error('Error loading stats:', e);
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
      allUsersCache = await AuthManager.getAllUsers();
      renderUsersTable(allUsersCache);
      loading.style.display = 'none';
      tableContainer.style.display = 'block';
    } catch (e) {
      loading.innerHTML = '<span style="color:var(--danger);">Error loading users: ' + escapeHtml(e.message) + '</span>';
    }
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
      const tr = document.createElement('tr');
      const lastLogin = user.lastLogin ? user.lastLogin.toDate().toLocaleDateString() : 'Never';
      const isSuperAdmin = AuthManager.isSuperAdmin();
      
      // Build role options based on current user's permissions
      let roleOptions = '';
      const allRoles = [
        { value: ROLES.PATIENT, label: '👤 Patient' },
        { value: ROLES.CLINIC_ASSISTANT, label: '👩‍⚕️ Clinic Assistant' },
        { value: ROLES.ADMIN, label: '🛡️ Admin' },
        { value: ROLES.SUPER_ADMIN, label: '👑 Super Admin' },
      ];

      allRoles.forEach(r => {
        // Show all roles for super admin; only patient & assistant for regular admin
        if (isSuperAdmin || r.value === ROLES.PATIENT || r.value === ROLES.CLINIC_ASSISTANT) {
          const selected = user.role === r.value ? 'selected' : '';
          roleOptions += `<option value="${r.value}" ${selected}>${r.label}</option>`;
        } else if (user.role === r.value) {
          // Show current role as selected but disabled change
          roleOptions += `<option value="${r.value}" selected>${r.label}</option>`;
        }
      });

      const canChange = AuthManager.canChangeRole(user.role, user.role);
      const roleIcon = user.role === ROLES.SUPER_ADMIN ? '👑' : 
                        user.role === ROLES.ADMIN ? '🛡️' :
                        user.role === ROLES.CLINIC_ASSISTANT ? '👩‍⚕️' : '👤';

      tr.innerHTML = `
        <td><strong>${escapeHtml(user.displayName || 'Unknown')}</strong></td>
        <td>${escapeHtml(user.email || '')}</td>
        <td>${lastLogin}</td>
        <td>
          ${canChange ? 
            `<select class="role-select" data-user-id="${user.id}" data-current-role="${user.role}">${roleOptions}</select>` :
            `<span class="role-badge role-${user.role}" style="color:var(--text);">${roleIcon} ${ROLE_LABELS[user.role]}</span>`
          }
        </td>`;
      
      // Role change handler
      const select = tr.querySelector('.role-select');
      if (select) {
        select.addEventListener('change', async function() {
          const userId = this.dataset.userId;
          const newRole = this.value;
          const oldRole = this.dataset.currentRole;
          
          if (newRole === oldRole) return;

          const targetLabel = ROLE_LABELS[newRole];
          if (!confirm(`Change this user's role to "${targetLabel}"?`)) {
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
      }

      tbody.appendChild(tr);
    });
  }

  function filterUsersTable(term) {
    if (!term) {
      renderUsersTable(allUsersCache);
      return;
    }
    const filtered = allUsersCache.filter(u =>
      (u.displayName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term)
    );
    renderUsersTable(filtered);
  }

  // ==========================================
  // DOCTORS MANAGEMENT
  // ==========================================
  function loadAdminDoctors(append = false) {
    const tbody = document.getElementById('adminDoctorsBody');
    let doctors = DOCTORS_DATA.doctors;

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
          ${AuthManager.canDeleteDoctors() ? '<button class="delete-doctor-btn" title="Delete" style="display:inline-flex;">🗑️</button>' : ''}
        </td>`;
      
      tr.querySelector('.edit-doctor-btn').addEventListener('click', () => {
        sessionStorage.setItem('editDoctor', JSON.stringify(d));
        window.location.href = 'index.html#edit-doctor';
      });

      const deleteBtn = tr.querySelector('.delete-doctor-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (confirm('Delete Dr. ' + d.name + '?')) {
            try {
              await AuthManager.deleteDoctorFirestore(d.id);
              tr.remove();
            } catch (e) {
              alert('Error: ' + e.message);
            }
          }
        });
      }

      tbody.appendChild(tr);
    }

    const loadMoreBtn = document.getElementById('loadMoreDoctorsBtn');
    loadMoreBtn.style.display = end < doctors.length ? 'inline-flex' : 'none';
  }

  // ==========================================
  // SETTINGS (Super Admin Only)
  // ==========================================
  function loadSettings() {
    // Admin accounts list
    const accountsList = document.getElementById('adminAccountsList');
    if (accountsList) {
      accountsList.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="role-badge role-super_admin">Super Admin</span>
            <span>${escapeHtml(SUPER_ADMIN_EMAIL)}</span>
          </div>
          ${ADMIN_EMAILS.map(email => `
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="role-badge role-admin" style="color:var(--text);">Admin</span>
              <span>${escapeHtml(email)}</span>
            </div>
          `).join('')}
        </div>
        <p style="font-size:0.75rem; color:var(--text-light); margin-top:8px;">
          ℹ️ To add more admin emails, edit supabase-config.js → ADMIN_EMAILS array
        </p>`;
    }

    // Supabase URL
    const urlEl = document.getElementById('settingsSupabaseUrl');
    if (urlEl) urlEl.textContent = SUPABASE_URL;
  }

  // ==========================================
  // DATA EXPORT (Super Admin Only)
  // ==========================================
  function exportDoctorsCSV() {
    if (!AuthManager.canExportData()) { alert('Unauthorized'); return; }
    
    const doctors = DOCTORS_DATA.doctors;
    let csv = 'ID,Name,Specialty,Area,Clinic,Phone\n';
    doctors.forEach(d => {
      csv += `${d.id},"${(d.name||'').replace(/"/g,'""')}","${(d.specialty||'').replace(/"/g,'""')}","${(d.area||'').replace(/"/g,'""')}","${(d.clinic||'').replace(/"/g,'""')}","${(d.phone||'').replace(/"/g,'""')}"\n`;
    });
    downloadCSV(csv, 'erbil_doctors_export.csv');
  }

  async function exportUsersCSV() {
    if (!AuthManager.canExportData()) { alert('Unauthorized'); return; }
    
    try {
      const users = allUsersCache.length ? allUsersCache : await AuthManager.getAllUsers();
      let csv = 'Name,Email,Role,Last Login\n';
      users.forEach(u => {
        const login = u.lastLogin ? u.lastLogin.toDate().toISOString() : 'Never';
        csv += `"${(u.displayName||'').replace(/"/g,'""')}","${u.email||''}","${u.role||''}","${login}"\n`;
      });
      downloadCSV(csv, 'erbil_users_export.csv');
    } catch (e) {
      alert('Error exporting: ' + e.message);
    }
  }

  async function exportRatingsCSV() {
    if (!AuthManager.canExportData()) { alert('Unauthorized'); return; }
    
    try {
      const { data, error } = await supabaseClient.from('doctor_ratings').select('*');
      if (error) throw error;
      
      let csv = 'Doctor ID,Total Score,Rating Count,Average\n';
      (data || []).forEach(r => {
        const avg = r.count > 0 ? (r.total / r.count).toFixed(2) : '0';
        csv += `${r.doctor_id},${r.total},${r.count},${avg}\n`;
      });
      downloadCSV(csv, 'erbil_ratings_export.csv');
    } catch (e) {
      alert('Error exporting: ' + e.message);
    }
  }

  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
