/* =============================================
   ERBIL DOCTOR FINDER - Application JavaScript
   (with Authentication & Role-Based Access)
   ============================================= */

(function() {
  'use strict';

  // ==========================================
  // STATE
  // ==========================================
  let allDoctors = [];
  let filteredDoctors = [];
  let displayedCount = 0;
  const PAGE_SIZE = 24;
  let currentSearch = '';
  let currentSpecialty = '';
  let currentArea = '';
  let currentSort = 'name';
  let localRatings = {};

  // ==========================================
  // SPECIALTY ICONS & COLORS
  // ==========================================
  const specialtyIcons = {
    'Gynecologist': '👩‍⚕️', 'Pediatrician': '👶', 'Dermatologist': '🧴',
    'Internist': '🩺', 'General Surgeon': '🔪', 'ENT Specialist': '👂',
    'Orthopedic Surgeon': '🦴', 'Urologist': '💧', 'Cardiologist': '❤️',
    'Neurologist': '🧠', 'Neurosurgeon': '🧠', 'Plastic Surgeon': '✨',
    'Family Medicine': '👨‍👩‍👧', 'Family Medicine (Gynecology)': '👩‍⚕️',
    'General Practitioner': '🏥', 'General Practitioner (Pediatric)': '🏥',
    'Hematologist': '🩸', 'Oncologist': '🎗️', 'Rheumatologist': '💪',
    'Endocrinologist': '🧬', 'Nephrologist': '🫘', 'Pulmonologist': '🫁',
    'Cardiac Surgeon': '❤️', 'Psychiatrist': '🧠', 'Dentist': '🦷',
    'Nutritionist': '🥗', 'Physiologist': '🏃', 'Physiotherapist': '🏃',
    'Emergency Medicine': '🚑', 'Radiologist': '📡', 'Neurophysiologist': '🧠',
    'Pediatric Surgeon': '👶', 'Pediatric Nephrologist': '👶', 'Pediatric Urologist': '👶',
  };

  const specialtyAvatarClass = {
    'Gynecologist': 'avatar-gynecologist', 'Pediatrician': 'avatar-pediatrician',
    'Dermatologist': 'avatar-dermatologist', 'Internist': 'avatar-internist',
    'General Surgeon': 'avatar-general-surgeon', 'ENT Specialist': 'avatar-ent',
    'Orthopedic Surgeon': 'avatar-orthopedic', 'Urologist': 'avatar-urologist',
    'Cardiologist': 'avatar-cardiologist', 'Neurologist': 'avatar-neurologist',
    'Neurosurgeon': 'avatar-neurosurgeon', 'Plastic Surgeon': 'avatar-plastic-surgeon',
    'Family Medicine': 'avatar-family-medicine', 'Family Medicine (Gynecology)': 'avatar-family-medicine',
    'General Practitioner': 'avatar-general-practitioner',
    'General Practitioner (Pediatric)': 'avatar-general-practitioner',
    'Hematologist': 'avatar-hematologist', 'Oncologist': 'avatar-oncologist',
    'Rheumatologist': 'avatar-rheumatologist', 'Endocrinologist': 'avatar-endocrinologist',
    'Nephrologist': 'avatar-nephrologist', 'Pulmonologist': 'avatar-pulmonologist',
    'Cardiac Surgeon': 'avatar-cardiologist', 'Psychiatrist': 'avatar-psychiatrist',
    'Dentist': 'avatar-dentist',
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    allDoctors = DOCTORS_DATA.doctors;
    loadLocalRatings();
    populateFilters();
    setupEventListeners();
    updateStats();
    filterAndRender();
    createSpecialtyChips();

    // Initialize Auth
    if (window.AuthManager) {
      AuthManager.setupEvents();
      AuthManager.init();
      AuthManager.onAuthStateChanged(onAuthChanged);
    }
  }

  // ==========================================
  // AUTH STATE CHANGE HANDLER
  // ==========================================
  function onAuthChanged(user, role) {
    // Show/hide admin actions
    const adminActions = document.getElementById('adminActions');
    if (adminActions) {
      adminActions.style.display = (role === ROLES.ADMIN) ? 'flex' : 'none';
    }
    
    // Re-render to update edit buttons on cards
    displayedCount = 0;
    document.getElementById('doctorsGrid').innerHTML = '';
    renderDoctors();
  }

  // ==========================================
  // LOAD / SAVE LOCAL RATINGS (fallback when not logged in)
  // ==========================================
  function loadLocalRatings() {
    try {
      const saved = localStorage.getItem('erbil_doctor_ratings');
      if (saved) localRatings = JSON.parse(saved);
    } catch(e) { localRatings = {}; }
  }

  function saveLocalRatings() {
    try { localStorage.setItem('erbil_doctor_ratings', JSON.stringify(localRatings)); }
    catch(e) {}
  }

  function getDoctorRating(doctorId) {
    const key = 'd_' + doctorId;
    if (localRatings[key]) return localRatings[key];
    return { total: 0, count: 0, userRating: 0 };
  }

  function rateDoctorLocal(doctorId, value) {
    const key = 'd_' + doctorId;
    if (!localRatings[key]) localRatings[key] = { total: 0, count: 0, userRating: 0 };
    if (localRatings[key].userRating > 0) {
      localRatings[key].total -= localRatings[key].userRating;
      localRatings[key].count -= 1;
    }
    localRatings[key].total += value;
    localRatings[key].count += 1;
    localRatings[key].userRating = value;
    saveLocalRatings();
    return localRatings[key];
  }

  // Smart rate function: uses Firestore when logged in, localStorage otherwise
  async function rateDoctor(doctorId, value) {
    if (window.AuthManager && AuthManager.isLoggedIn()) {
      const result = await AuthManager.rateDoctorFirestore(doctorId, value);
      if (result) return result;
    }
    return rateDoctorLocal(doctorId, value);
  }

  async function getSmartRating(doctorId) {
    if (window.AuthManager && AuthManager.isLoggedIn()) {
      const result = await AuthManager.getDoctorRatingFirestore(doctorId);
      if (result) return result;
    }
    return getDoctorRating(doctorId);
  }

  // ==========================================
  // POPULATE FILTERS
  // ==========================================
  function populateFilters() {
    const specSelect = document.getElementById('specialtyFilter');
    const areaSelect = document.getElementById('areaFilter');

    DOCTORS_DATA.specialties.forEach(s => {
      const count = allDoctors.filter(d => d.specialty === s).length;
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s + ' (' + count + ')';
      specSelect.appendChild(opt);
    });

    DOCTORS_DATA.areas.forEach(a => {
      const count = allDoctors.filter(d => d.area === a).length;
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a + ' (' + count + ')';
      areaSelect.appendChild(opt);
    });

    // Populate edit doctor form selects
    const editSpec = document.getElementById('editDoctorSpecialty');
    const editArea = document.getElementById('editDoctorArea');
    if (editSpec) {
      DOCTORS_DATA.specialties.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        editSpec.appendChild(opt);
      });
    }
    if (editArea) {
      DOCTORS_DATA.areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        editArea.appendChild(opt);
      });
    }
  }

  // ==========================================
  // CREATE SPECIALTY CHIPS
  // ==========================================
  function createSpecialtyChips() {
    const container = document.getElementById('specialtyChips');
    const popular = ['Gynecologist', 'Pediatrician', 'Dermatologist', 'Internist',
                     'General Surgeon', 'ENT Specialist', 'Orthopedic Surgeon',
                     'Urologist', 'Cardiologist', 'Family Medicine', 'Neurologist',
                     'Plastic Surgeon'];
    popular.forEach(spec => {
      const count = allDoctors.filter(d => d.specialty === spec).length;
      if (count === 0) return;
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.setAttribute('data-specialty', spec);
      chip.innerHTML = (specialtyIcons[spec] || '🏥') + ' ' + spec +
                       '<span class="chip-count">' + count + '</span>';
      chip.addEventListener('click', function() {
        const isActive = this.classList.contains('active');
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        if (isActive) {
          document.getElementById('specialtyFilter').value = '';
          currentSpecialty = '';
        } else {
          this.classList.add('active');
          document.getElementById('specialtyFilter').value = spec;
          currentSpecialty = spec;
        }
        filterAndRender();
      });
      container.appendChild(chip);
    });
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    let searchTimeout;

    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      clearBtn.style.display = this.value ? 'flex' : 'none';
      searchTimeout = setTimeout(() => {
        currentSearch = this.value.trim().toLowerCase();
        filterAndRender();
      }, 200);
    });

    clearBtn.addEventListener('click', function() {
      searchInput.value = ''; this.style.display = 'none';
      currentSearch = ''; filterAndRender(); searchInput.focus();
    });

    document.getElementById('specialtyFilter').addEventListener('change', function() {
      currentSpecialty = this.value;
      document.querySelectorAll('.chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-specialty') === currentSpecialty);
      });
      filterAndRender();
    });

    document.getElementById('areaFilter').addEventListener('change', function() {
      currentArea = this.value; filterAndRender();
    });

    document.getElementById('sortFilter').addEventListener('change', function() {
      currentSort = this.value; filterAndRender();
    });

    document.getElementById('resetFilters').addEventListener('click', resetAllFilters);
    document.getElementById('loadMoreBtn').addEventListener('click', loadMore);

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('doctorModal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });

    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeModal(); closeEditDoctorModal(); } });

    const backToTop = document.getElementById('backToTop');
    window.addEventListener('scroll', function() {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    });
    backToTop.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Add Doctor button
    const addDoctorBtn = document.getElementById('addDoctorBtn');
    if (addDoctorBtn) {
      addDoctorBtn.addEventListener('click', () => openEditDoctorModal());
    }

    // Edit Doctor modal close
    const editModalClose = document.getElementById('editDoctorModalClose');
    if (editModalClose) editModalClose.addEventListener('click', closeEditDoctorModal);

    const editModal = document.getElementById('editDoctorModal');
    if (editModal) editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditDoctorModal(); });

    // Edit Doctor form submit
    const editDoctorForm = document.getElementById('editDoctorForm');
    if (editDoctorForm) {
      editDoctorForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('editDoctorSubmitBtn');
        const doctorId = document.getElementById('editDoctorId').value;
        
        const doctorData = {
          name: document.getElementById('editDoctorName').value.trim(),
          specialty: document.getElementById('editDoctorSpecialty').value,
          area: document.getElementById('editDoctorArea').value,
          clinic: document.getElementById('editDoctorClinic').value.trim(),
          phone: document.getElementById('editDoctorPhone').value.trim(),
        };
        
        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving...';
          
          if (doctorId) {
            // Edit existing
            await AuthManager.updateDoctorFirestore(doctorId, doctorData);
            // Update local data
            const idx = allDoctors.findIndex(d => String(d.id) === doctorId);
            if (idx !== -1) Object.assign(allDoctors[idx], doctorData);
          } else {
            // Add new
            const newId = allDoctors.length > 0 ? Math.max(...allDoctors.map(d => d.id)) + 1 : 1;
            doctorData.id = newId;
            doctorData.rating = 0;
            doctorData.ratingCount = 0;
            await AuthManager.addDoctorFirestore(doctorData);
            allDoctors.push(doctorData);
          }
          
          closeEditDoctorModal();
          filterAndRender();
          updateStats();
        } catch (err) {
          const errorEl = editDoctorForm.querySelector('.auth-error');
          if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Doctor';
        }
      });
    }
  }

  // ==========================================
  // EDIT DOCTOR MODAL
  // ==========================================
  function openEditDoctorModal(doctor) {
    const modal = document.getElementById('editDoctorModal');
    const title = document.getElementById('editDoctorTitle');
    
    if (doctor) {
      title.textContent = 'Edit Doctor';
      document.getElementById('editDoctorId').value = doctor.id;
      document.getElementById('editDoctorName').value = doctor.name;
      document.getElementById('editDoctorSpecialty').value = doctor.specialty;
      document.getElementById('editDoctorArea').value = doctor.area;
      document.getElementById('editDoctorClinic').value = doctor.clinic || '';
      document.getElementById('editDoctorPhone').value = doctor.phone || '';
    } else {
      title.textContent = 'Add New Doctor';
      document.getElementById('editDoctorId').value = '';
      document.getElementById('editDoctorForm').reset();
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  window.closeEditDoctorModal = function() {
    const modal = document.getElementById('editDoctorModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  // ==========================================
  // FILTER & RENDER
  // ==========================================
  function filterAndRender() {
    filteredDoctors = allDoctors.filter(d => {
      if (currentSpecialty && d.specialty !== currentSpecialty) return false;
      if (currentArea && d.area !== currentArea) return false;
      if (currentSearch) {
        const s = currentSearch;
        if (!d.name.toLowerCase().includes(s) && !d.specialty.toLowerCase().includes(s) &&
            !d.area.toLowerCase().includes(s) && !d.clinic.toLowerCase().includes(s) &&
            !d.phone.includes(s)) return false;
      }
      return true;
    });

    filteredDoctors.sort((a, b) => {
      switch (currentSort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'rating':
          const rA = getDoctorRating(a.id), rB = getDoctorRating(b.id);
          return (rB.count > 0 ? rB.total/rB.count : 0) - (rA.count > 0 ? rA.total/rA.count : 0);
        case 'area': return a.area.localeCompare(b.area) || a.name.localeCompare(b.name);
        case 'specialty': return a.specialty.localeCompare(b.specialty) || a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    displayedCount = 0;
    document.getElementById('doctorsGrid').innerHTML = '';
    renderDoctors();
    updateResultsInfo();
    updateActiveFilters();
  }

  function renderDoctors() {
    const grid = document.getElementById('doctorsGrid');
    const noResults = document.getElementById('noResults');
    const loadMoreWrapper = document.getElementById('loadMoreWrapper');

    if (filteredDoctors.length === 0) {
      noResults.style.display = 'block';
      loadMoreWrapper.style.display = 'none';
      return;
    }
    noResults.style.display = 'none';

    const endIdx = Math.min(displayedCount + PAGE_SIZE, filteredDoctors.length);
    const fragment = document.createDocumentFragment();
    for (let i = displayedCount; i < endIdx; i++) {
      fragment.appendChild(createDoctorCard(filteredDoctors[i]));
    }
    grid.appendChild(fragment);
    displayedCount = endIdx;

    loadMoreWrapper.style.display = displayedCount < filteredDoctors.length ? 'block' : 'none';
    if (displayedCount < filteredDoctors.length) {
      document.getElementById('loadMoreBtn').textContent =
        'Load More (' + (filteredDoctors.length - displayedCount) + ' remaining)';
    }
  }

  function loadMore() { renderDoctors(); }

  // ==========================================
  // CREATE DOCTOR CARD
  // ==========================================
  function createDoctorCard(doctor) {
    const card = document.createElement('div');
    card.className = 'doctor-card';
    card.setAttribute('data-id', doctor.id);

    const icon = specialtyIcons[doctor.specialty] || '🏥';
    const avatarClass = specialtyAvatarClass[doctor.specialty] || 'avatar-default';
    const rating = getDoctorRating(doctor.id);
    const avgRating = rating.count > 0 ? (rating.total / rating.count).toFixed(1) : '0.0';
    const fullStars = Math.round(rating.count > 0 ? rating.total / rating.count : 0);

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) starsHtml += '<span class="star ' + (i <= fullStars ? 'filled' : '') + '">★</span>';

    let phoneHtml = '';
    if (doctor.phone) {
      const firstPhone = doctor.phone.split(',')[0].trim();
      phoneHtml = `<div class="detail-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <a href="tel:${firstPhone}">${escapeHtml(doctor.phone)}</a>
      </div>`;
    }

    // Show edit button for admins/assistants
    const canEdit = window.AuthManager && AuthManager.canEditDoctors();
    const canDelete = window.AuthManager && AuthManager.canDeleteDoctors();

    let editBtnHtml = '';
    if (canEdit) {
      editBtnHtml = `<button class="edit-doctor-btn" title="Edit doctor">✏️</button>`;
    }
    if (canDelete) {
      editBtnHtml += `<button class="delete-doctor-btn" title="Delete doctor">🗑️</button>`;
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="doctor-avatar ${avatarClass}">${icon}</div>
        <div class="doctor-info">
          <div class="doctor-name">${escapeHtml(doctor.name)}</div>
          <div class="doctor-specialty">${escapeHtml(doctor.specialty)}</div>
        </div>
        <div class="card-actions">${editBtnHtml}</div>
      </div>
      <div class="card-details">
        <div class="detail-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${escapeHtml(doctor.area)}</span>
        </div>
        ${doctor.clinic ? `<div class="detail-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>${escapeHtml(doctor.clinic)}</span>
        </div>` : ''}
        ${phoneHtml}
      </div>
      <div class="card-footer">
        <div class="rating-display">
          <div class="stars">${starsHtml}</div>
          <span class="rating-text">${avgRating} (${rating.count})</span>
        </div>
        <button class="view-btn">View Details</button>
      </div>`;

    card.addEventListener('click', () => openDoctorModal(doctor));
    card.querySelector('.view-btn').addEventListener('click', (e) => { e.stopPropagation(); openDoctorModal(doctor); });

    // Edit button
    const editBtn = card.querySelector('.edit-doctor-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditDoctorModal(doctor); });
    }

    // Delete button
    const deleteBtn = card.querySelector('.delete-doctor-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete Dr. ' + doctor.name + '?')) {
          try {
            await AuthManager.deleteDoctorFirestore(doctor.id);
            allDoctors = allDoctors.filter(d => d.id !== doctor.id);
            filterAndRender();
            updateStats();
          } catch (err) {
            alert('Error: ' + err.message);
          }
        }
      });
    }

    return card;
  }

  // ==========================================
  // DOCTOR MODAL
  // ==========================================
  function openDoctorModal(doctor) {
    const modal = document.getElementById('doctorModal');
    const body = document.getElementById('modalBody');
    const icon = specialtyIcons[doctor.specialty] || '🏥';
    const avatarClass = specialtyAvatarClass[doctor.specialty] || 'avatar-default';
    const rating = getDoctorRating(doctor.id);
    const avgRating = rating.count > 0 ? (rating.total / rating.count).toFixed(1) : '0.0';
    const mapQuery = encodeURIComponent(doctor.clinic + ', ' + doctor.area + ', Erbil, Kurdistan Region, Iraq');
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + mapQuery;

    let phoneSection = '';
    if (doctor.phone) {
      const phones = doctor.phone.split(',').map(p => p.trim());
      phoneSection = `<div class="info-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <div class="info-row-content"><div class="info-row-label">Phone</div>
        <div class="info-row-value">${phones.map(p => `<a href="tel:${p}" class="phone-link">📞 ${p}</a>`).join(' ')}</div></div></div>`;
    }

    let ratingStarsHtml = '';
    for (let i = 1; i <= 5; i++) {
      ratingStarsHtml += `<button class="rating-star-btn ${i <= (rating.userRating || 0) ? 'active' : ''}" data-value="${i}" data-doctor-id="${doctor.id}">★</button>`;
    }

    // Login prompt for rating if not logged in
    const ratingLoginPrompt = (!window.AuthManager || !AuthManager.isLoggedIn())
      ? `<p class="rating-login-hint">💡 <a href="#" class="rating-login-link">Sign in</a> to share your rating with other patients</p>` : '';

    body.innerHTML = `
      <div class="modal-header">
        <div class="modal-avatar ${avatarClass}">${icon}</div>
        <h2>${escapeHtml(doctor.name)}</h2>
        <div class="modal-specialty-badge">${escapeHtml(doctor.specialty)}</div>
      </div>
      <div class="modal-content">
        <div class="modal-section">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Contact & Location</h3>
          <div class="info-grid">
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <div class="info-row-content"><div class="info-row-label">Area</div><div class="info-row-value">${escapeHtml(doctor.area)}, Erbil</div></div>
            </div>
            ${doctor.clinic ? `<div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <div class="info-row-content"><div class="info-row-label">Clinic / Pharmacy</div><div class="info-row-value">${escapeHtml(doctor.clinic)}</div></div>
            </div>` : ''}
            ${phoneSection}
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <div class="info-row-content"><div class="info-row-label">Find on Map</div>
              <div class="info-row-value"><a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link">📍 Open in Google Maps</a></div></div>
            </div>
          </div>
        </div>
        <div class="modal-section">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Rate This Doctor</h3>
          <div class="rating-section">
            <h4>How was your experience?</h4>
            <div class="rating-stars-interactive" id="ratingStars">${ratingStarsHtml}</div>
            <div class="rating-avg">Average: <strong>${avgRating}</strong> / 5 (${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'})</div>
            ${ratingLoginPrompt}
          </div>
        </div>
        <div class="modal-section">
          <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> About</h3>
          <div class="info-grid">
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <div class="info-row-content"><div class="info-row-label">Doctor</div>
              <div class="info-row-value">Dr. ${escapeHtml(doctor.name)} is a ${escapeHtml(doctor.specialty.toLowerCase())} practicing in ${escapeHtml(doctor.area)}, Erbil, Kurdistan Region.${doctor.clinic ? ' Available at ' + escapeHtml(doctor.clinic) + '.' : ''}${doctor.phone ? ' You can reach the clinic by calling.' : ' Contact information not yet available.'}</div></div>
            </div>
          </div>
        </div>
      </div>`;

    // Rating interaction
    const starBtns = body.querySelectorAll('.rating-star-btn');
    starBtns.forEach(btn => {
      btn.addEventListener('mouseenter', function() {
        const val = parseInt(this.getAttribute('data-value'));
        starBtns.forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-value')) <= val));
      });
      btn.addEventListener('mouseleave', function() {
        const cr = getDoctorRating(doctor.id).userRating || 0;
        starBtns.forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-value')) <= cr));
      });
      btn.addEventListener('click', async function() {
        const val = parseInt(this.getAttribute('data-value'));
        const newRating = await rateDoctor(doctor.id, val);
        const newAvg = (newRating.total / newRating.count).toFixed(1);
        starBtns.forEach(b => b.classList.toggle('active', parseInt(b.getAttribute('data-value')) <= val));
        body.querySelector('.rating-avg').innerHTML =
          'Average: <strong>' + newAvg + '</strong> / 5 (' + newRating.count + ' ' + (newRating.count === 1 ? 'rating' : 'ratings') + ')';
        updateCardRating(doctor.id);
      });
    });

    // Login link in rating section
    const loginLink = body.querySelector('.rating-login-link');
    if (loginLink) {
      loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
        if (window.AuthManager) AuthManager.openAuthModal('login');
      });
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.getElementById('doctorModal').classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateCardRating(doctorId) {
    const card = document.querySelector(`.doctor-card[data-id="${doctorId}"]`);
    if (!card) return;
    const rating = getDoctorRating(doctorId);
    const avgRating = rating.count > 0 ? (rating.total / rating.count).toFixed(1) : '0.0';
    const fullStars = Math.round(rating.count > 0 ? rating.total / rating.count : 0);
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) starsHtml += '<span class="star ' + (i <= fullStars ? 'filled' : '') + '">★</span>';
    card.querySelector('.rating-display').innerHTML = `<div class="stars">${starsHtml}</div><span class="rating-text">${avgRating} (${rating.count})</span>`;
  }

  // ==========================================
  // UI UPDATES
  // ==========================================
  function updateStats() {
    animateNumber('totalDoctors', allDoctors.length);
    animateNumber('totalAreas', DOCTORS_DATA.areas.length);
    animateNumber('totalSpecialties', DOCTORS_DATA.specialties.length);
  }

  function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    let current = 0;
    const increment = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { current = target; clearInterval(timer); }
      el.textContent = current;
    }, 30);
  }

  function updateResultsInfo() {
    document.getElementById('resultsCount').textContent =
      'Showing ' + Math.min(displayedCount, filteredDoctors.length) + ' of ' + filteredDoctors.length + ' doctors';
    document.getElementById('resetFilters').style.display =
      (currentSearch || currentSpecialty || currentArea) ? 'inline-flex' : 'none';
  }

  function updateActiveFilters() {
    const container = document.getElementById('activeFilters');
    container.innerHTML = '';
    const hasFilters = currentSearch || currentSpecialty || currentArea;
    container.style.display = hasFilters ? 'flex' : 'none';
    if (currentSearch) addFilterTag(container, 'Search: "' + currentSearch + '"', () => {
      document.getElementById('searchInput').value = '';
      document.getElementById('clearSearch').style.display = 'none';
      currentSearch = ''; filterAndRender();
    });
    if (currentSpecialty) addFilterTag(container, currentSpecialty, () => {
      document.getElementById('specialtyFilter').value = '';
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      currentSpecialty = ''; filterAndRender();
    });
    if (currentArea) addFilterTag(container, currentArea, () => {
      document.getElementById('areaFilter').value = '';
      currentArea = ''; filterAndRender();
    });
  }

  function addFilterTag(container, text, onRemove) {
    const tag = document.createElement('span');
    tag.className = 'filter-tag';
    tag.innerHTML = escapeHtml(text) + ' <button title="Remove filter">✕</button>';
    tag.querySelector('button').addEventListener('click', onRemove);
    container.appendChild(tag);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  window.resetAllFilters = function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    document.getElementById('specialtyFilter').value = '';
    document.getElementById('areaFilter').value = '';
    document.getElementById('sortFilter').value = 'name';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    currentSearch = ''; currentSpecialty = ''; currentArea = ''; currentSort = 'name';
    filterAndRender();
  };

  // ==========================================
  // START
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
