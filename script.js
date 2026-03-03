/* ===== SOMAA Website Scripts ===== */

const API_BASE = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
  // ===== Navbar Scroll Effect =====
  const navbar = document.querySelector('.navbar');
  const handleScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', handleScroll);
  handleScroll();

  // ===== Mobile Navigation =====
  const hamburger = document.querySelector('.nav-hamburger');
  const navLinks = document.querySelector('.nav-links');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ===== Smooth Scroll (only for # anchor links without data-modal) =====
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      if (this.hasAttribute('data-modal')) return; // handled separately
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = navbar.offsetHeight + 20;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ===== Scroll Reveal Animations =====
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ===== Animated Counters =====
  const counters = document.querySelectorAll('[data-count]');
  let countersStarted = false;

  const animateCounter = (el) => {
    const target = parseInt(el.getAttribute('data-count'));
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const duration = 2000;
    const startTime = performance.now();

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
      const current = Math.floor(eased * target);
      el.textContent = prefix + current.toLocaleString() + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = prefix + target.toLocaleString() + suffix;
      }
    };

    requestAnimationFrame(update);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !countersStarted) {
        countersStarted = true;
        counters.forEach(counter => animateCounter(counter));
        counterObserver.disconnect();
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => counterObserver.observe(el));

  // ===== Parallax effect on hero =====
  const heroBg = document.querySelector('.hero-bg img');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      if (scrolled < window.innerHeight) {
        heroBg.style.transform = `translateY(${scrolled * 0.3}px) scale(1.1)`;
      }
    });
  }

  // ===== Active nav link highlight =====
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      if (window.pageYOffset >= sectionTop) {
        current = section.getAttribute('id');
      }
    });

    navAnchors.forEach(a => {
      a.classList.remove('active');
      if (a.getAttribute('href') === '#' + current) {
        a.classList.add('active');
      }
    });
  });


  // =====================================================================
  //  MODAL SYSTEM
  // =====================================================================

  // --- Populate time slots for reservation form ---
  const slotSelect = document.getElementById('r-slot');
  if (slotSelect) {
    for (let h = 11; h <= 23; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 11 && m === 0) continue;  // starts at 11:30
        if (h === 23 && m === 30) continue;  // ends at 23:00
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const val = `${hh}:${mm}`;
        const label = formatTime12(h, m);
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        slotSelect.appendChild(opt);
      }
    }
  }

  // Set min date on date inputs to today
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(inp => {
    inp.setAttribute('min', today);
  });

  // --- Modal Open / Close ---
  function openModal(id) {
    const modal = document.getElementById('modal-' + id);
    if (!modal) return;
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    // Focus first input
    setTimeout(() => {
      const first = modal.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 100);
  }

  function closeModal(id) {
    const modal = document.getElementById('modal-' + id);
    if (!modal) return;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    // Reset form
    const form = modal.querySelector('form');
    if (form) {
      form.reset();
      form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
      form.querySelectorAll('.form-error').forEach(el => el.textContent = '');
    }
    // Reset submit button
    const btn = modal.querySelector('.btn-full');
    if (btn) btn.classList.remove('loading');
  }

  // Open modal on button click
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(btn.getAttribute('data-modal'));
    });
  });

  // Close on X button
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id.replace('modal-', ''));
    });
  });

  // Close on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id.replace('modal-', ''));
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not([hidden])').forEach(overlay => {
        closeModal(overlay.id.replace('modal-', ''));
      });
    }
  });


  // =====================================================================
  //  TOAST NOTIFICATIONS
  // =====================================================================

  let toastTimer = null;

  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.className = 'toast';
    toast.textContent = message;
    toast.classList.add(type);
    // Trigger reflow for animation restart
    void toast.offsetWidth;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  window.showToastGlobal = showToast;


  // =====================================================================
  //  FORM VALIDATION & SUBMISSION
  // =====================================================================

  const PHONE_RE = /^[6-9]\d{9}$/;

  function setError(fieldId, msg) {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-err');
    if (input) input.classList.add('error');
    if (errEl) errEl.textContent = msg;
  }

  function clearErrors(form) {
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // --- Reserve a Table ---
  const formReserve = document.getElementById('form-reserve');
  if (formReserve) {
    formReserve.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(formReserve);
      let valid = true;

      const name = formReserve.querySelector('#r-name').value.trim();
      const phone = formReserve.querySelector('#r-phone').value.trim();
      const email = formReserve.querySelector('#r-email').value.trim();
      const date = formReserve.querySelector('#r-date').value;
      const timeSlot = formReserve.querySelector('#r-slot').value;
      const guests = formReserve.querySelector('#r-guests').value;
      const requests = formReserve.querySelector('#r-requests').value.trim();

      if (!name) { setError('r-name', 'Name is required.'); valid = false; }
      if (!PHONE_RE.test(phone)) { setError('r-phone', 'Valid 10-digit Indian mobile required.'); valid = false; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('r-email', 'Invalid email.'); valid = false; }
      if (!date) { setError('r-date', 'Date is required.'); valid = false; }
      if (!timeSlot) { setError('r-slot', 'Select a time slot.'); valid = false; }
      if (!guests || guests < 1 || guests > 30) { setError('r-guests', 'Enter 1–30 guests.'); valid = false; }

      if (!valid) return;

      const submitBtn = document.getElementById('btn-reserve-submit');
      setLoading(submitBtn, true);

      try {
        const res = await fetch(`${API_BASE}/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, phone,
            email: email || undefined,
            date, time_slot: timeSlot,
            guests: parseInt(guests),
            special_requests: requests || undefined,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          closeModal('reserve');
          showToast('✅ ' + data.message, 'success');
        } else {
          showToast('❌ ' + (data.message || 'Something went wrong.'), 'error');
        }
      } catch (err) {
        showToast('❌ Could not connect to server. Please try again.', 'error');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  // --- Plan Your Party ---
  const formParty = document.getElementById('form-party');
  if (formParty) {
    formParty.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(formParty);
      let valid = true;

      const name = formParty.querySelector('#p-name').value.trim();
      const phone = formParty.querySelector('#p-phone').value.trim();
      const email = formParty.querySelector('#p-email').value.trim();
      const eventType = formParty.querySelector('#p-type').value;
      const date = formParty.querySelector('#p-date').value;
      const guests = formParty.querySelector('#p-guests').value;
      const notes = formParty.querySelector('#p-notes').value.trim();

      if (!name) { setError('p-name', 'Name is required.'); valid = false; }
      if (!PHONE_RE.test(phone)) { setError('p-phone', 'Valid 10-digit Indian mobile required.'); valid = false; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('p-email', 'Invalid email.'); valid = false; }
      if (!eventType) { setError('p-type', 'Select an event type.'); valid = false; }
      if (!date) { setError('p-date', 'Date is required.'); valid = false; }
      if (!guests || guests < 1 || guests > 500) { setError('p-guests', 'Enter 1–500 guests.'); valid = false; }

      if (!valid) return;

      const submitBtn = document.getElementById('btn-party-submit');
      setLoading(submitBtn, true);

      try {
        const res = await fetch(`${API_BASE}/party-bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, phone,
            email: email || undefined,
            event_type: eventType,
            preferred_date: date,
            guest_count: parseInt(guests),
            notes: notes || undefined,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          closeModal('party');
          showToast('✅ ' + data.message, 'success');
        } else {
          showToast('❌ ' + (data.message || 'Something went wrong.'), 'error');
        }
      } catch (err) {
        showToast('❌ Could not connect to server. Please try again.', 'error');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }

  // --- Contact / Inquiry ---
  const formContact = document.getElementById('form-contact');
  if (formContact) {
    formContact.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(formContact);
      let valid = true;

      const name = formContact.querySelector('#c-name').value.trim();
      const phone = formContact.querySelector('#c-phone').value.trim();
      const message = formContact.querySelector('#c-message').value.trim();

      if (!name) { setError('c-name', 'Name is required.'); valid = false; }
      if (phone && !PHONE_RE.test(phone)) { setError('c-phone', 'Valid 10-digit Indian mobile required.'); valid = false; }
      if (!message || message.length < 5) { setError('c-message', 'Message must be at least 5 characters.'); valid = false; }

      if (!valid) return;

      const submitBtn = document.getElementById('btn-contact-submit');
      setLoading(submitBtn, true);

      try {
        const res = await fetch(`${API_BASE}/inquiries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone: phone || undefined,
            message,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          closeModal('contact');
          showToast('✅ ' + data.message, 'success');
        } else {
          showToast('❌ ' + (data.message || 'Something went wrong.'), 'error');
        }
      } catch (err) {
        showToast('❌ Could not connect to server. Please try again.', 'error');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  }
});



// ===== Helpers =====
function formatTime12(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}


// =====================================================================
//  ADMIN PANEL
// =====================================================================

(function initAdmin() {

  const STORAGE_KEY = 'somaa_admin_token';
  const STORAGE_USER = 'somaa_admin_user';

  // ── Helpers ──────────────────────────────────────────────────────────

  function getToken() { return localStorage.getItem(STORAGE_KEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(STORAGE_USER)); } catch { return null; } }

  function saveSession(token, user) {
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER);
  }

  function fmtDate(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function badge(status) {
    const s = (status || '').toLowerCase();
    return `<span class="badge badge-${s}">${status || '–'}</span>`;
  }

  async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    return res.json();
  }

  async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  window.apiPatchGlobal = apiPatch;

  // ── Dashboard open / close ───────────────────────────────────────────

  const dashboard = document.getElementById('admin-dashboard');

  function showDashboard() {
    dashboard.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    const user = getUser();
    if (user) {
      document.getElementById('adminUserBadge').textContent = `${user.name} · ${user.role}`;
    }
    loadStats();
    loadReservations();
    loadParties();
    loadInquiries();
  }

  function hideDashboard() {
    dashboard.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  // ── Admin login button (opens modal or dashboard if logged in) ───────

  document.getElementById('btnAdminLogin').addEventListener('click', () => {
    if (getToken()) {
      showDashboard();
    } else {
      // Use existing openModal mechanism
      const modal = document.getElementById('modal-adminlogin');
      modal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
      setTimeout(() => { document.getElementById('al-email').focus(); }, 100);
    }
  });

  // On page load – if session stored, update button tooltip
  if (getToken()) {
    document.getElementById('btnAdminLogin').title = 'Open Admin Dashboard';
  }

  // ── Login form ───────────────────────────────────────────────────────

  const formLogin = document.getElementById('form-adminlogin');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailEl = document.getElementById('al-email');
      const passwordEl = document.getElementById('al-password');
      const emailErrEl = document.getElementById('al-email-err');
      const pwErrEl = document.getElementById('al-password-err');
      const submitBtn = document.getElementById('btn-adminlogin-submit');

      // Clear errors
      emailErrEl.textContent = '';
      passwordEl.classList.remove('error');
      emailEl.classList.remove('error');

      const email = emailEl.value.trim();
      const password = passwordEl.value;

      let valid = true;
      if (!email) { emailEl.classList.add('error'); emailErrEl.textContent = 'Email is required.'; valid = false; }
      if (!password) { passwordEl.classList.add('error'); pwErrEl.textContent = 'Password is required.'; valid = false; }
      if (!valid) return;

      // Loading state
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          saveSession(data.token, data.user);
          // Close login modal
          document.getElementById('modal-adminlogin').setAttribute('hidden', '');
          document.body.style.overflow = '';
          formLogin.reset();
          // Open dashboard
          showDashboard();
        } else {
          // Show error under password field
          document.getElementById('al-password-err').textContent = data.message || 'Invalid credentials.';
          passwordEl.classList.add('error');
        }
      } catch {
        document.getElementById('al-password-err').textContent = 'Could not connect to server.';
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }

  // ── Logout ───────────────────────────────────────────────────────────

  document.getElementById('adminLogoutBtn').addEventListener('click', () => {
    clearSession();
    hideDashboard();
    document.getElementById('btnAdminLogin').title = 'Admin Login';
  });

  // ── Refresh ──────────────────────────────────────────────────────────

  document.getElementById('adminRefreshBtn').addEventListener('click', () => {
    loadStats();
    loadReservations();
    loadParties();
    loadInquiries();
  });

  // ── Tabs ─────────────────────────────────────────────────────────────

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // ── Stats ────────────────────────────────────────────────────────────

  async function loadStats() {
    try {
      const data = await apiGet('/admin/stats');
      if (!data.success) return;
      const s = data.stats;
      document.getElementById('stat-reservations').textContent = s.reservations.total;
      document.getElementById('stat-pending').textContent = s.reservations.pending;
      document.getElementById('stat-parties').textContent = s.partyBookings.total;
      document.getElementById('stat-inquiries').textContent = s.inquiries.total;
      document.getElementById('stat-today').textContent = s.reservations.today;
    } catch { /* silent */ }
  }

  // ── Reservations ─────────────────────────────────────────────────────

  let allReservations = [];

  async function loadReservations() {
    try {
      const data = await apiGet('/reservations?limit=100');
      allReservations = data.reservations || [];
      renderReservations(allReservations);
    } catch {
      document.getElementById('tbody-reservations').innerHTML =
        '<tr><td colspan="9" class="admin-loading">Failed to load data.</td></tr>';
    }
  }

  function renderReservations(rows) {
    const tbody = document.getElementById('tbody-reservations');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="admin-loading">No reservations found.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.name}</td>
        <td>${r.phone}</td>
        <td>${r.email || '–'}</td>
        <td>${r.date}</td>
        <td>${r.time_slot}</td>
        <td>${r.guests}</td>
        <td>
          <select class="admin-status-select" data-id="${r.id}" data-type="reservations" onchange="updateStatus(this, 'reservations', '${r.id}')">
            <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="confirmed" ${r.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            <option value="completed" ${r.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </td>
        <td>${r.special_requests || '–'}</td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`).join('');
  }

  // Search + filter
  const resSearch = document.getElementById('res-search');
  const resFilter = document.getElementById('res-filter-status');

  function filterReservations() {
    const q = (resSearch.value || '').toLowerCase();
    const status = resFilter.value;
    const filtered = allReservations.filter(r => {
      const matchQ = !q || r.name.toLowerCase().includes(q) || r.phone.includes(q);
      const matchS = !status || r.status === status;
      return matchQ && matchS;
    });
    renderReservations(filtered);
  }

  if (resSearch) resSearch.addEventListener('input', filterReservations);
  if (resFilter) resFilter.addEventListener('change', filterReservations);

  // ── Party Bookings ───────────────────────────────────────────────────

  async function loadParties() {
    try {
      const data = await apiGet('/party-bookings?limit=100');
      const rows = data.bookings || data.partyBookings || data.party_bookings || [];
      const tbody = document.getElementById('tbody-parties');
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="admin-loading">No party bookings yet.</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${r.name}</td>
          <td>${r.phone}</td>
          <td>${r.email || '–'}</td>
          <td>${r.event_type}</td>
          <td>${r.preferred_date}</td>
          <td>${r.guest_count}</td>
          <td>
            <select class="admin-status-select" data-id="${r.id}" data-type="party-bookings" onchange="updateStatus(this, 'party-bookings', '${r.id}')">
              <option value="new" ${r.status === 'new' ? 'selected' : ''}>New</option>
              <option value="contacted" ${r.status === 'contacted' ? 'selected' : ''}>Contacted</option>
              <option value="quoted" ${r.status === 'quoted' ? 'selected' : ''}>Quoted</option>
              <option value="confirmed" ${r.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="closed" ${r.status === 'closed' ? 'selected' : ''}>Closed</option>
            </select>
          </td>
          <td>${badge(r.priority)}</td>
          <td>${r.notes || '–'}</td>
          <td>${fmtDate(r.created_at)}</td>
        </tr>`).join('');
    } catch {
      document.getElementById('tbody-parties').innerHTML =
        '<tr><td colspan="10" class="admin-loading">Failed to load data.</td></tr>';
    }
  }

  // ── Inquiries ────────────────────────────────────────────────────────

  async function loadInquiries() {
    try {
      const data = await apiGet('/inquiries?limit=100');
      const rows = data.inquiries || [];
      const tbody = document.getElementById('tbody-inquiries');
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="admin-loading">No inquiries yet.</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${r.name}</td>
          <td>${r.phone || '–'}</td>
          <td class="msg-cell">${r.message}</td>
          <td>${r.source || 'website'}</td>
          <td>${fmtDate(r.created_at)}</td>
        </tr>`).join('');
    } catch {
      document.getElementById('tbody-inquiries').innerHTML =
        '<tr><td colspan="5" class="admin-loading">Failed to load data.</td></tr>';
    }
  }

  // ── Auto-restore session ─────────────────────────────────────────────
  // If user had a valid session and visits again, they can click the lock button.
  // (Dashboard does not auto-open, to avoid surprising the user.)

})();

// ── Global handlers for inline HTML events ─────────────────────────────
window.updateStatus = async function (selectElement, type, id) {
  const newStatus = selectElement.value;
  selectElement.disabled = true; // prevent double clicks

  try {
    const res = await window.apiPatchGlobal(`/${type}/${id}`, { status: newStatus });
    if (res.success) {
      showToastGlobal(`✅ Status updated to ${newStatus}`, 'success');
      // Update local state if needed, or rely on next refresh
    } else {
      showToastGlobal('❌ ' + (res.message || 'Failed to update status.'), 'error');
      // Revert select on error (simple way: trigger refresh)
      document.getElementById('adminRefreshBtn').click();
    }
  } catch (err) {
    showToastGlobal('❌ Error connecting to server.', 'error');
    document.getElementById('adminRefreshBtn').click();
  } finally {
    selectElement.disabled = false;
  }
};


