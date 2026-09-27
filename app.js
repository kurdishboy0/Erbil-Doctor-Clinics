/* =============================================
   ERBIL DOCTOR FINDER - Application JavaScript
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
  let ratings = {};

  // ==========================================
  // SPECIALTY ICONS & COLORS
  // ==========================================
  const specialtyIcons = {
    'Gynecologist': '👩‍⚕️',
    'Pediatrician': '👶',
    'Dermatologist': '🧴',
    'Internist': '🩺',
    'General Surgeon': '🔪',
    'ENT Specialist': '👂',
    'Orthopedic Surgeon': '🦴',
    'Urologist': '💧',
    'Cardiologist': '❤️',
    'Neurologist': '🧠',
    'Neurosurgeon': '🧠',
    'Plastic Surgeon': '✨',
    'Family Medicine': '👨‍👩‍👧',
    'Family Medicine (Gynecology)': '👩‍⚕️',
    'General Practitioner': '🏥',
    'General Practitioner (Pediatric)': '🏥',
    'Hematologist': '🩸',
    'Oncologist': '🎗️',
    'Rheumatologist': '💪',
    'Endocrinologist': '🧬',
    'Nephrologist': '🫘',
    'Pulmonologist': '🫁',
    'Cardiac Surgeon': '❤️',
    'Psychiatrist': '🧠',
    'Dentist': '🦷',
    'Nutritionist': '🥗',
    'Physiologist': '🏃',
    'Physiotherapist': '🏃',
    'Emergency Medicine': '🚑',
    'Radiologist': '📡',
    'Neurophysiologist': '🧠',
    'Pediatric Surgeon': '👶',
    'Pediatric Nephrologist': '👶',
    'Pediatric Urologist': '👶',
  };

  const specialtyAvatarClass = {
    'Gynecologist': 'avatar-gynecologist',
    'Pediatrician': 'avatar-pediatrician',
    'Dermatologist': 'avatar-dermatologist',
    'Internist': 'avatar-internist',
    'General Surgeon': 'avatar-general-surgeon',
    'ENT Specialist': 'avatar-ent',
    'Orthopedic Surgeon': 'avatar-orthopedic',
    'Urologist': 'avatar-urologist',
    'Cardiologist': 'avatar-cardiologist',
    'Neurologist': 'avatar-neurologist',
    'Neurosurgeon': 'avatar-neurosurgeon',
    'Plastic Surgeon': 'avatar-plastic-surgeon',
    'Family Medicine': 'avatar-family-medicine',
    'Family Medicine (Gynecology)': 'avatar-family-medicine',
    'General Practitioner': 'avatar-general-practitioner',
    'General Practitioner (Pediatric)': 'avatar-general-practitioner',
    'Hematologist': 'avatar-hematologist',
    'Oncologist': 'avatar-oncologist',
    'Rheumatologist': 'avatar-rheumatologist',
    'Endocrinologist': 'avatar-endocrinologist',
    'Nephrologist': 'avatar-nephrologist',
    'Pulmonologist': 'avatar-pulmonologist',
    'Cardiac Surgeon': 'avatar-cardiologist',
    'Psychiatrist': 'avatar-psychiatrist',
    'Dentist': 'avatar-dentist',
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    // Load data
    allDoctors = DOCTORS_DATA.doctors;
    
    // Load saved ratings from localStorage
    loadRatings();
    
    // Populate filters
    populateFilters();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update stats
    updateStats();
    
    // Initial render
    filterAndRender();
    
    // Create specialty chips
    createSpecialtyChips();
  }

  // ==========================================
  // LOAD / SAVE RATINGS
  // ==========================================
  function loadRatings() {
    try {
      const saved = localStorage.getItem('erbil_doctor_ratings');
      if (saved) {
        ratings = JSON.parse(saved);
      }
    } catch(e) {
      ratings = {};
    }
  }

  function saveRatings() {
    try {
      localStorage.setItem('erbil_doctor_ratings', JSON.stringify(ratings));
    } catch(e) {
      // localStorage not available
    }
  }

  function getDoctorRating(doctorId) {
    const key = 'd_' + doctorId;
    if (ratings[key]) {
      return ratings[key];
    }
    return { total: 0, count: 0, userRating: 0 };
  }

  function rateDoctorAction(doctorId, value) {
    const key = 'd_' + doctorId;
    if (!ratings[key]) {
      ratings[key] = { total: 0, count: 0, userRating: 0 };
    }
    
    // If user already rated, adjust
    if (ratings[key].userRating > 0) {
      ratings[key].total -= ratings[key].userRating;
      ratings[key].count -= 1;
    }
    
    ratings[key].total += value;
    ratings[key].count += 1;
    ratings[key].userRating = value;
    
    saveRatings();
    return ratings[key];
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
  }

  // ==========================================
  // CREATE SPECIALTY CHIPS
  // ==========================================
  function createSpecialtyChips() {
    const container = document.getElementById('specialtyChips');
    
    // Popular specialties first
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
    // Search
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
      searchInput.value = '';
      this.style.display = 'none';
      currentSearch = '';
      filterAndRender();
      searchInput.focus();
    });

    // Filters
    document.getElementById('specialtyFilter').addEventListener('change', function() {
      currentSpecialty = this.value;
      // Update chips
      document.querySelectorAll('.chip').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-specialty') === currentSpecialty);
      });
      filterAndRender();
    });

    document.getElementById('areaFilter').addEventListener('change', function() {
      currentArea = this.value;
      filterAndRender();
    });

    document.getElementById('sortFilter').addEventListener('change', function() {
      currentSort = this.value;
      filterAndRender();
    });

    // Reset
    document.getElementById('resetFilters').addEventListener('click', resetAllFilters);

    // Load More
    document.getElementById('loadMoreBtn').addEventListener('click', loadMore);

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('doctorModal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });

    // Keyboard
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });

    // Back to Top
    const backToTop = document.getElementById('backToTop');
    window.addEventListener('scroll', function() {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    });
    backToTop.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ==========================================
  // FILTER & RENDER
  // ==========================================
  function filterAndRender() {
    // Filter
    filteredDoctors = allDoctors.filter(d => {
      if (currentSpecialty && d.specialty !== currentSpecialty) return false;
      if (currentArea && d.area !== currentArea) return false;
      
      if (currentSearch) {
        const search = currentSearch;
        const nameMatch = d.name.toLowerCase().includes(search);
        const specMatch = d.specialty.toLowerCase().includes(search);
        const areaMatch = d.area.toLowerCase().includes(search);
        const clinicMatch = d.clinic.toLowerCase().includes(search);
        const phoneMatch = d.phone.includes(search);
        if (!nameMatch && !specMatch && !areaMatch && !clinicMatch && !phoneMatch) return false;
      }
      
      return true;
    });

    // Sort
    filteredDoctors.sort((a, b) => {
      switch (currentSort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'rating':
          const rA = getDoctorRating(a.id);
          const rB = getDoctorRating(b.id);
          const avgA = rA.count > 0 ? rA.total / rA.count : 0;
          const avgB = rB.count > 0 ? rB.total / rB.count : 0;
          return avgB - avgA;
        case 'area':
          return a.area.localeCompare(b.area) || a.name.localeCompare(b.name);
        case 'specialty':
          return a.specialty.localeCompare(b.specialty) || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    // Reset display
    displayedCount = 0;
    
    // Render
    renderDoctors();
    updateResultsInfo();
    updateActiveFilters();
  }

  function renderDoctors() {
    const grid = document.getElementById('doctorsGrid');
    const noResults = document.getElementById('noResults');
    const loadMoreWrapper = document.getElementById('loadMoreWrapper');

    if (displayedCount === 0) {
      grid.innerHTML = '';
    }

    if (filteredDoctors.length === 0) {
      grid.innerHTML = '';
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

    // Show/hide load more
    loadMoreWrapper.style.display = displayedCount < filteredDoctors.length ? 'block' : 'none';
    
    if (displayedCount < filteredDoctors.length) {
      document.getElementById('loadMoreBtn').textContent = 
        'Load More (' + (filteredDoctors.length - displayedCount) + ' remaining)';
    }
  }

  function loadMore() {
    renderDoctors();
  }

  // ==========================================
  // CREATE DOCTOR CARD
  // ==========================================
  function createDoctorCard(doctor) {
    const card = document.createElement('div');
    card.className = 'doctor-card';
    card.setAttribute('data-id', doctor.id);

    const icon = specialtyIcons[doctor.specialty] || '🏥';
    const avatarClass = specialtyAvatarClass[doctor.specialty] || 'avatar-default';
    const initials = doctor.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    
    const rating = getDoctorRating(doctor.id);
    const avgRating = rating.count > 0 ? (rating.total / rating.count).toFixed(1) : '0.0';
    const fullStars = Math.round(rating.count > 0 ? rating.total / rating.count : 0);

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += '<span class="star ' + (i <= fullStars ? 'filled' : '') + '">★</span>';
    }

    let phoneHtml = '';
    if (doctor.phone) {
      const firstPhone = doctor.phone.split(',')[0].trim();
      phoneHtml = `
        <div class="detail-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <a href="tel:${firstPhone}">${doctor.phone}</a>
        </div>`;
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="doctor-avatar ${avatarClass}" title="${doctor.specialty}">
          ${icon}
        </div>
        <div class="doctor-info">
          <div class="doctor-name">${escapeHtml(doctor.name)}</div>
          <div class="doctor-specialty">${escapeHtml(doctor.specialty)}</div>
        </div>
      </div>
      <div class="card-details">
        <div class="detail-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span>${escapeHtml(doctor.area)}</span>
        </div>
        ${doctor.clinic ? `
        <div class="detail-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>${escapeHtml(doctor.clinic)}</span>
        </div>` : ''}
        ${phoneHtml}
      </div>
      <div class="card-footer">
        <div class="rating-display">
          <div class="stars">${starsHtml}</div>
          <span class="rating-text">${avgRating} (${rating.count})</span>
        </div>
        <button class="view-btn" onclick="event.stopPropagation();">View Details</button>
      </div>
    `;

    // Click card to open modal
    card.addEventListener('click', function() {
      openDoctorModal(doctor);
    });

    // View button also opens modal
    card.querySelector('.view-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      openDoctorModal(doctor);
    });

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

    // Build Google Maps search URL
    const mapQuery = encodeURIComponent(doctor.clinic + ', ' + doctor.area + ', Erbil, Kurdistan Region, Iraq');
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + mapQuery;

    let phoneSection = '';
    if (doctor.phone) {
      const phones = doctor.phone.split(',').map(p => p.trim());
      phoneSection = `
        <div class="info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <div class="info-row-content">
            <div class="info-row-label">Phone</div>
            <div class="info-row-value">
              ${phones.map(p => `<a href="tel:${p}" class="phone-link">📞 ${p}</a>`).join(' ')}
            </div>
          </div>
        </div>`;
    }

    // Rating stars interactive
    let ratingStarsHtml = '';
    for (let i = 1; i <= 5; i++) {
      ratingStarsHtml += `<button class="rating-star-btn ${i <= (rating.userRating || 0) ? 'active' : ''}" 
                           data-value="${i}" data-doctor-id="${doctor.id}">★</button>`;
    }

    body.innerHTML = `
      <div class="modal-header">
        <div class="modal-avatar ${avatarClass}">${icon}</div>
        <h2>${escapeHtml(doctor.name)}</h2>
        <div class="modal-specialty-badge">${escapeHtml(doctor.specialty)}</div>
      </div>
      <div class="modal-content">
        <div class="modal-section">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            Contact & Location
          </h3>
          <div class="info-grid">
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <div class="info-row-content">
                <div class="info-row-label">Area</div>
                <div class="info-row-value">${escapeHtml(doctor.area)}, Erbil</div>
              </div>
            </div>
            ${doctor.clinic ? `
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <div class="info-row-content">
                <div class="info-row-label">Clinic / Pharmacy</div>
                <div class="info-row-value">${escapeHtml(doctor.clinic)}</div>
              </div>
            </div>` : ''}
            ${phoneSection}
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <div class="info-row-content">
                <div class="info-row-label">Find on Map</div>
                <div class="info-row-value">
                  <a href="${mapsUrl}" target="_blank" rel="noopener" class="location-link">
                    📍 Open in Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-section">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Rate This Doctor
          </h3>
          <div class="rating-section">
            <h4>How was your experience?</h4>
            <div class="rating-stars-interactive" id="ratingStars">
              ${ratingStarsHtml}
            </div>
            <div class="rating-avg">
              Average: <strong>${avgRating}</strong> / 5 
              (${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'})
            </div>
          </div>
        </div>

        <div class="modal-section">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            About
          </h3>
          <div class="info-grid">
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              <div class="info-row-content">
                <div class="info-row-label">Specialty</div>
                <div class="info-row-value">${escapeHtml(doctor.specialty)}</div>
              </div>
            </div>
            <div class="info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <div class="info-row-content">
                <div class="info-row-label">Doctor</div>
                <div class="info-row-value">Dr. ${escapeHtml(doctor.name)} is a ${escapeHtml(doctor.specialty.toLowerCase())} 
                  practicing in ${escapeHtml(doctor.area)}, Erbil, Kurdistan Region.
                  ${doctor.clinic ? ' The doctor is available at ' + escapeHtml(doctor.clinic) + '.' : ''}
                  ${doctor.phone ? ' You can reach the clinic by calling.' : ' Contact information is not yet available.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Setup rating interaction
    const starBtns = body.querySelectorAll('.rating-star-btn');
    starBtns.forEach(btn => {
      btn.addEventListener('mouseenter', function() {
        const val = parseInt(this.getAttribute('data-value'));
        starBtns.forEach(b => {
          b.classList.toggle('active', parseInt(b.getAttribute('data-value')) <= val);
        });
      });

      btn.addEventListener('mouseleave', function() {
        const currentRating = getDoctorRating(doctor.id).userRating || 0;
        starBtns.forEach(b => {
          b.classList.toggle('active', parseInt(b.getAttribute('data-value')) <= currentRating);
        });
      });

      btn.addEventListener('click', function() {
        const val = parseInt(this.getAttribute('data-value'));
        const newRating = rateDoctorAction(doctor.id, val);
        const newAvg = (newRating.total / newRating.count).toFixed(1);
        
        // Update display in modal
        starBtns.forEach(b => {
          b.classList.toggle('active', parseInt(b.getAttribute('data-value')) <= val);
        });
        
        body.querySelector('.rating-avg').innerHTML = 
          'Average: <strong>' + newAvg + '</strong> / 5 (' + 
          newRating.count + ' ' + (newRating.count === 1 ? 'rating' : 'ratings') + ')';
        
        // Update the card in the grid
        updateCardRating(doctor.id);
      });
    });

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('doctorModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateCardRating(doctorId) {
    const card = document.querySelector(`.doctor-card[data-id="${doctorId}"]`);
    if (!card) return;
    
    const rating = getDoctorRating(doctorId);
    const avgRating = rating.count > 0 ? (rating.total / rating.count).toFixed(1) : '0.0';
    const fullStars = Math.round(rating.count > 0 ? rating.total / rating.count : 0);
    
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += '<span class="star ' + (i <= fullStars ? 'filled' : '') + '">★</span>';
    }
    
    const ratingDisplay = card.querySelector('.rating-display');
    ratingDisplay.innerHTML = `
      <div class="stars">${starsHtml}</div>
      <span class="rating-text">${avgRating} (${rating.count})</span>
    `;
  }

  // ==========================================
  // UI UPDATES
  // ==========================================
  function updateStats() {
    document.getElementById('totalDoctors').textContent = allDoctors.length;
    document.getElementById('totalAreas').textContent = DOCTORS_DATA.areas.length;
    document.getElementById('totalSpecialties').textContent = DOCTORS_DATA.specialties.length;
    
    // Animate numbers
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
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = current;
    }, 30);
  }

  function updateResultsInfo() {
    const countEl = document.getElementById('resultsCount');
    countEl.textContent = 'Showing ' + Math.min(displayedCount, filteredDoctors.length) + 
                          ' of ' + filteredDoctors.length + ' doctors';
    
    const resetBtn = document.getElementById('resetFilters');
    resetBtn.style.display = (currentSearch || currentSpecialty || currentArea) ? 'inline-flex' : 'none';
  }

  function updateActiveFilters() {
    const container = document.getElementById('activeFilters');
    container.innerHTML = '';
    
    const hasFilters = currentSearch || currentSpecialty || currentArea;
    container.style.display = hasFilters ? 'flex' : 'none';

    if (currentSearch) {
      addFilterTag(container, 'Search: "' + currentSearch + '"', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('clearSearch').style.display = 'none';
        currentSearch = '';
        filterAndRender();
      });
    }
    
    if (currentSpecialty) {
      addFilterTag(container, currentSpecialty, () => {
        document.getElementById('specialtyFilter').value = '';
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        currentSpecialty = '';
        filterAndRender();
      });
    }
    
    if (currentArea) {
      addFilterTag(container, currentArea, () => {
        document.getElementById('areaFilter').value = '';
        currentArea = '';
        filterAndRender();
      });
    }
  }

  function addFilterTag(container, text, onRemove) {
    const tag = document.createElement('span');
    tag.className = 'filter-tag';
    tag.innerHTML = escapeHtml(text) + ' <button title="Remove filter">✕</button>';
    tag.querySelector('button').addEventListener('click', onRemove);
    container.appendChild(tag);
  }

  // ==========================================
  // UTILITIES
  // ==========================================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ==========================================
  // GLOBAL FUNCTIONS
  // ==========================================
  window.resetAllFilters = function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    document.getElementById('specialtyFilter').value = '';
    document.getElementById('areaFilter').value = '';
    document.getElementById('sortFilter').value = 'name';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    
    currentSearch = '';
    currentSpecialty = '';
    currentArea = '';
    currentSort = 'name';
    
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
