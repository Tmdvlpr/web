/**
 * Main application — registration gate, booking, guest invites.
 */
(function () {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  // --- API helpers ---
  function apiHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'tma ' + tg.initData,
    };
  }

  async function apiGet(path) {
    const res = await fetch(path, { headers: apiHeaders() });
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function apiDelete(path) {
    const res = await fetch(path, {
      method: 'DELETE',
      headers: apiHeaders(),
    });
    return res.json();
  }

  async function apiPatch(path, body) {
    const res = await fetch(path, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // --- State ---
  let currentUserId = tg.initDataUnsafe?.user?.id || null;
  let selectedDate = null;
  let pendingSlot = null;
  let selectedGuests = [];

  // --- DOM refs ---
  const viewRegister = document.getElementById('view-register');
  const mainApp = document.getElementById('main-app');
  const regFirstName = document.getElementById('reg-first-name');
  const regLastName = document.getElementById('reg-last-name');
  const btnRegister = document.getElementById('btn-register');

  const tabs = document.querySelectorAll('.tab');
  const viewSchedule = document.getElementById('view-schedule');
  const viewMyBookings = document.getElementById('view-mybookings');
  const viewGuest = document.getElementById('view-guest');
  const guestBookingsList = document.getElementById('guest-bookings-list');
  const calendarEl = document.getElementById('calendar');
  const timelineEl = document.getElementById('timeline');
  const timelineLabelEl = document.getElementById('timeline-label');
  const myBookingsList = document.getElementById('my-bookings-list');
  const modal = document.getElementById('booking-modal');
  const modalTime = document.getElementById('modal-time');
  const titleInput = document.getElementById('booking-title');
  const descInput = document.getElementById('booking-desc');
  const guestInput = document.getElementById('guest-input');
  const guestChips = document.getElementById('guest-chips');
  const guestDropdown = document.getElementById('guest-dropdown');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const btnConfirm = document.getElementById('btn-confirm-booking');
  const toastEl = document.getElementById('toast');

  // --- Registration gate ---
  async function checkRegistration() {
    const res = await apiGet('/api/my-bookings');
    if (res.error === 'registration_required') {
      showRegistration();
    } else {
      showMainApp();
    }
  }

  function showRegistration() {
    viewRegister.classList.add('active');
    viewRegister.style.display = 'block';
    mainApp.classList.add('hidden');
  }

  function showMainApp() {
    viewRegister.classList.remove('active');
    viewRegister.style.display = 'none';
    mainApp.classList.remove('hidden');
    initApp();
  }

  btnRegister.addEventListener('click', async () => {
    const firstName = regFirstName.value.trim();
    const lastName = regLastName.value.trim();

    regFirstName.style.borderColor = '';
    regLastName.style.borderColor = '';

    if (!firstName) { regFirstName.style.borderColor = '#ff3b30'; regFirstName.focus(); return; }
    if (!lastName) { regLastName.style.borderColor = '#ff3b30'; regLastName.focus(); return; }

    btnRegister.disabled = true;
    btnRegister.textContent = 'Registering...';

    const res = await apiPost('/api/register', { first_name: firstName, last_name: lastName });
    if (res.ok) {
      showToast('Welcome, ' + firstName + '!');
      showMainApp();
    } else {
      showToast(res.error || 'Registration failed', true);
      btnRegister.disabled = false;
      btnRegister.textContent = 'Continue';
    }
  });

  // --- Main app init ---
  let appInitialized = false;

  function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    // Init calendar
    const cal = Calendar.init(calendarEl);

    // Init timeline
    Timeline.init(timelineEl, timelineLabelEl, currentUserId, (start, end) => {
      pendingSlot = { start, end };
      openModal(start, end);
    });

    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const view = tab.dataset.view;
        viewSchedule.classList.toggle('active', view === 'schedule');
        viewMyBookings.classList.toggle('active', view === 'mybookings');
        viewGuest.classList.toggle('active', view === 'guest');

        if (view === 'mybookings') {
          loadMyBookings();
          tg.BackButton.show();
        } else if (view === 'guest') {
          loadGuestBookings();
          tg.BackButton.show();
        } else {
          tg.BackButton.hide();
        }
      });
    });

    tg.BackButton.onClick(() => { tabs[0].click(); });

    // Calendar date selected
    calendarEl.addEventListener('dateSelected', (e) => {
      selectedDate = e.detail;
      loadTimeline(selectedDate);
    });

    // Auto-select today
    selectedDate = cal.getSelected();
    loadTimeline(selectedDate);
  }

  // --- Load timeline ---
  async function loadTimeline(dateStr) {
    timelineLabelEl.textContent = 'Loading...';
    timelineEl.innerHTML = '';

    const [bookingsRes, slotsRes] = await Promise.all([
      apiGet('/api/bookings?date=' + dateStr),
      apiGet('/api/slots?date=' + dateStr),
    ]);

    if (!bookingsRes.ok || !slotsRes.ok) {
      timelineLabelEl.textContent = 'Failed to load schedule';
      return;
    }

    Timeline.render(dateStr, bookingsRes.bookings, slotsRes.slots);
  }

  // --- Load my bookings ---
  async function loadMyBookings() {
    myBookingsList.innerHTML = '<div class="empty-state">Loading...</div>';

    const res = await apiGet('/api/my-bookings');
    if (!res.ok) {
      myBookingsList.innerHTML = '<div class="empty-state">Failed to load bookings</div>';
      return;
    }

    if (res.bookings.length === 0) {
      myBookingsList.innerHTML = '<div class="empty-state">No upcoming bookings</div>';
      return;
    }

    myBookingsList.innerHTML = res.bookings.map(b => {
      const hasExtend = b.extend_options && b.extend_options.length > 0;
      const extendBtnHtml = hasExtend
        ? `<button class="btn-extend" data-id="${b.id}">Extend</button>`
        : '';
      const extendOptsHtml = hasExtend
        ? `<div class="extend-options hidden" data-id="${b.id}">
            ${b.extend_options.map(o =>
              `<button class="btn-extend-option" data-id="${b.id}" data-minutes="${o.minutes}">${o.label} (until ${o.new_end})</button>`
            ).join('')}
           </div>`
        : '';
      return `
        <div class="booking-card" data-id="${b.id}">
          <div class="booking-title">${escapeHtml(b.title)}</div>
          <div class="booking-datetime">${formatBookingDate(b.date)} &middot; ${b.start} – ${b.end}</div>
          <div class="booking-actions">
            ${extendBtnHtml}
            <button class="btn-cancel" data-id="${b.id}">Cancel booking</button>
          </div>
          ${extendOptsHtml}
        </div>
      `;
    }).join('');

    // Extend button toggle
    myBookingsList.querySelectorAll('.btn-extend').forEach(btn => {
      btn.addEventListener('click', () => {
        const opts = myBookingsList.querySelector(`.extend-options[data-id="${btn.dataset.id}"]`);
        if (opts) opts.classList.toggle('hidden');
      });
    });

    // Extend option click
    myBookingsList.querySelectorAll('.btn-extend-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const minutes = parseInt(btn.dataset.minutes);
        btn.disabled = true;
        btn.textContent = 'Extending...';

        const res = await apiPatch('/api/bookings/' + id + '/extend', { minutes });
        if (res.ok) {
          showToast('Extended to ' + res.booking.end);
          tg.HapticFeedback.notificationOccurred('success');
          loadMyBookings();
          if (selectedDate) loadTimeline(selectedDate);
        } else {
          showToast(res.error || 'Failed to extend', true);
          tg.HapticFeedback.notificationOccurred('error');
          btn.disabled = false;
        }
      });
    });

    // Cancel button
    myBookingsList.querySelectorAll('.btn-cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Cancelling...';

        const res = await apiDelete('/api/bookings/' + id);
        if (res.ok) {
          showToast('Booking cancelled');
          loadMyBookings();
          if (selectedDate) loadTimeline(selectedDate);
        } else {
          showToast(res.error || 'Failed to cancel', true);
          btn.disabled = false;
          btn.textContent = 'Cancel booking';
        }
      });
    });
  }

  // --- Load guest bookings ---
  async function loadGuestBookings() {
    guestBookingsList.innerHTML = '<div class="empty-state">Loading...</div>';

    const res = await apiGet('/api/guest-bookings');
    if (!res.ok) {
      guestBookingsList.innerHTML = '<div class="empty-state">Failed to load bookings</div>';
      return;
    }

    if (res.bookings.length === 0) {
      guestBookingsList.innerHTML = '<div class="empty-state">No upcoming meetings as guest</div>';
      return;
    }

    guestBookingsList.innerHTML = res.bookings.map(b => `
      <div class="booking-card" data-id="${b.id}">
        <div class="booking-title">${escapeHtml(b.title)}</div>
        <div class="booking-host">Hosted by ${escapeHtml(b.host)}</div>
        <div class="booking-datetime">${formatBookingDate(b.date)} &middot; ${b.start} – ${b.end}</div>
        <div class="booking-actions">
          <button class="btn-decline" data-id="${b.id}">Decline</button>
        </div>
      </div>
    `).join('');

    guestBookingsList.querySelectorAll('.btn-decline').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Declining...';

        const res = await apiPost('/api/bookings/' + id + '/decline', {});
        if (res.ok) {
          showToast('Attendance declined');
          loadGuestBookings();
        } else {
          showToast(res.error || 'Not supported yet', true);
          btn.disabled = false;
          btn.textContent = 'Decline';
        }
      });
    });
  }

  // --- Booking modal ---
  function openModal(start, end) {
    const dateParts = selectedDate.split('-');
    const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    modalTime.textContent = `${dayName} \u00B7 ${start} \u2013 ${end}`;
    titleInput.value = '';
    descInput.value = '';
    guestInput.value = '';
    selectedGuests = [];
    renderGuestChips();
    btnConfirm.disabled = false;
    btnConfirm.textContent = 'Book';
    modal.classList.remove('hidden');
    setTimeout(() => titleInput.focus(), 100);
  }

  function closeModal() {
    modal.classList.add('hidden');
    guestDropdown.classList.add('hidden');
    pendingSlot = null;
    selectedGuests = [];
  }

  btnCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  btnConfirm.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.style.borderColor = '#ff3b30';
      titleInput.focus();
      return;
    }
    titleInput.style.borderColor = '';

    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Booking...';

    const res = await apiPost('/api/bookings', {
      date: selectedDate,
      start: pendingSlot.start,
      end: pendingSlot.end,
      title: title,
      description: descInput.value.trim() || undefined,
      guests: selectedGuests.map(g => g.username.startsWith('@') ? g.username : '@' + g.username),
    });

    if (res.ok) {
      closeModal();
      const guestCount = selectedGuests.length;
      const msg = guestCount > 0
        ? `Booked! ${guestCount} guest${guestCount > 1 ? 's' : ''} notified.`
        : 'Booked successfully!';
      showToast(msg);
      tg.HapticFeedback.notificationOccurred('success');
      loadTimeline(selectedDate);
    } else {
      showToast(res.error || 'Booking failed', true);
      tg.HapticFeedback.notificationOccurred('error');
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Book';
    }
  });

  // --- Guest autocomplete ---
  let searchTimeout = null;

  guestInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = guestInput.value.trim();
    if (q.length < 2) {
      guestDropdown.classList.add('hidden');
      return;
    }
    searchTimeout = setTimeout(() => searchGuests(q), 300);
  });

  guestInput.addEventListener('blur', () => {
    // delay to allow click on dropdown option
    setTimeout(() => guestDropdown.classList.add('hidden'), 200);
  });

  async function searchGuests(query) {
    const res = await apiGet('/api/users?q=' + encodeURIComponent(query));
    if (!res.ok || !res.users.length) {
      guestDropdown.classList.add('hidden');
      return;
    }

    // filter out already selected (by username or id)
    const selectedUsernames = new Set(selectedGuests.map(g => g.username));
    const selectedIds = new Set(selectedGuests.map(g => g.id));
    const filtered = res.users.filter(u => !selectedIds.has(u.id) && !selectedUsernames.has(u.username));

    if (!filtered.length) {
      guestDropdown.classList.add('hidden');
      return;
    }

    guestDropdown.innerHTML = filtered.map(u => `
      <div class="guest-option" data-id="${u.id}" data-name="${escapeHtml(u.name)}" data-username="${escapeHtml(u.username || '')}">
        ${escapeHtml(u.name)}${u.username ? ' <span style="opacity:0.5">@' + escapeHtml(u.username) + '</span>' : ''}
      </div>
    `).join('');
    guestDropdown.classList.remove('hidden');

    guestDropdown.querySelectorAll('.guest-option').forEach(opt => {
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent blur
        selectedGuests.push({
          id: parseInt(opt.dataset.id),
          name: opt.dataset.name,
          username: opt.dataset.username || '',
        });
        guestInput.value = '';
        guestDropdown.classList.add('hidden');
        renderGuestChips();
      });
    });
  }

  function renderGuestChips() {
    guestChips.innerHTML = selectedGuests.map((g, i) => `
      <span class="guest-chip">
        ${escapeHtml(g.name)}
        <span class="chip-remove" data-idx="${i}">&times;</span>
      </span>
    `).join('');

    guestChips.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedGuests.splice(parseInt(btn.dataset.idx), 1);
        renderGuestChips();
      });
    });
  }

  // --- Toast ---
  let toastTimer;
  function showToast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.classList.add('hidden'); }, 2500);
  }

  // --- Helpers ---
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatBookingDate(dateStr) {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // --- Start ---
  checkRegistration();
})();
