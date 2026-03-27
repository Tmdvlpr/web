/**
 * Timeline component — renders a vertical schedule 09:00–19:00
 * with booked and free slots.
 */
const Timeline = (() => {
  const START_HOUR = 9;
  const END_HOUR = 19;
  const SLOT_MINUTES = 30;

  let container, labelEl;
  let currentUserId = null;
  let onSlotClick = null;

  function init(el, label, userId, clickHandler) {
    container = el;
    labelEl = label;
    currentUserId = userId;
    onSlotClick = clickHandler;
  }

  function render(dateStr, bookings, freeSlots) {
    const dateParts = dateStr.split('-');
    const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    labelEl.textContent = dayName;

    // build a map of all 30-min slots
    const slots = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MINUTES) {
        const start = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const endH = m + SLOT_MINUTES >= 60 ? h + 1 : h;
        const endM = (m + SLOT_MINUTES) % 60;
        const end = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        slots.push({ start, end, booking: null, free: false });
      }
    }

    // mark booked slots
    for (const b of bookings) {
      for (const slot of slots) {
        if (timeToMin(slot.start) >= timeToMin(b.start) && timeToMin(slot.end) <= timeToMin(b.end)) {
          slot.booking = b;
        }
      }
    }

    // mark free slots
    const freeSet = new Set(freeSlots.map(s => s.start));
    for (const slot of slots) {
      if (!slot.booking && freeSet.has(slot.start)) {
        slot.free = true;
      }
    }

    // render
    let html = '';
    let prevBookingId = null;

    for (const slot of slots) {
      const timeLabel = slot.start;

      if (slot.booking) {
        // only show booking info on the first slot of this booking
        const isFirst = slot.booking.id !== prevBookingId;
        prevBookingId = slot.booking.id;

        const isMine = slot.booking.user_id === currentUserId;
        html += `
          <div class="timeline-row">
            <div class="timeline-time">${timeLabel}</div>
            <div class="timeline-slot booked${isMine ? ' mine' : ''}">
              ${isFirst ? `
                <span class="slot-title">${escapeHtml(slot.booking.title)}</span>
                <span class="slot-user">${escapeHtml(slot.booking.user)}</span>
              ` : ''}
            </div>
          </div>
        `;
      } else if (slot.free) {
        prevBookingId = null;
        html += `
          <div class="timeline-row">
            <div class="timeline-time">${timeLabel}</div>
            <div class="timeline-slot free" data-start="${slot.start}" data-end="${slot.end}">
              + Available
            </div>
          </div>
        `;
      } else {
        prevBookingId = null;
        html += `
          <div class="timeline-row">
            <div class="timeline-time">${timeLabel}</div>
            <div class="timeline-slot" style="opacity:0.3">—</div>
          </div>
        `;
      }
    }

    container.innerHTML = html;

    // attach click handlers to free slots
    container.querySelectorAll('.timeline-slot.free').forEach(el => {
      el.addEventListener('click', () => {
        if (onSlotClick) {
          onSlotClick(el.dataset.start, el.dataset.end);
        }
      });
    });
  }

  function timeToMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return { init, render };
})();
