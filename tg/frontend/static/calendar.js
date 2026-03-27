/**
 * Calendar component — renders a month grid with date selection.
 * Dispatches 'dateSelected' custom event on the #calendar element.
 */
const Calendar = (() => {
  const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let currentMonth, currentYear, selectedDate;
  let container;

  function init(el) {
    container = el;
    const now = new Date();
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();
    selectedDate = formatDate(now);
    render();
    return { getSelected, setSelected };
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getSelected() {
    return selectedDate;
  }

  function setSelected(dateStr) {
    selectedDate = dateStr;
    const parts = dateStr.split('-');
    currentYear = parseInt(parts[0]);
    currentMonth = parseInt(parts[1]) - 1;
    render();
  }

  function render() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // Monday = 0
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    let html = `
      <div class="calendar-header">
        <button id="cal-prev">&lsaquo;</button>
        <span class="month-title">${MONTHS[currentMonth]} ${currentYear}</span>
        <button id="cal-next">&rsaquo;</button>
      </div>
      <div class="calendar-weekdays">
        ${WEEKDAYS.map(d => `<div>${d}</div>`).join('')}
      </div>
      <div class="calendar-grid">
    `;

    // fill blanks before first day
    for (let i = 0; i < startDow; i++) {
      html += `<div class="calendar-day other-month"></div>`;
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      const dateStr = formatDate(dateObj);
      const isPast = dateObj < today;

      let cls = 'calendar-day';
      if (dateStr === todayStr) cls += ' today';
      if (dateStr === selectedDate) cls += ' selected';
      if (isPast) cls += ' disabled';

      html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;

    // event listeners
    container.querySelector('#cal-prev').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      render();
    });

    container.querySelector('#cal-next').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      render();
    });

    container.querySelectorAll('.calendar-day:not(.disabled):not(.other-month)').forEach(el => {
      el.addEventListener('click', () => {
        selectedDate = el.dataset.date;
        render();
        container.dispatchEvent(new CustomEvent('dateSelected', { detail: selectedDate }));
      });
    });
  }

  return { init, formatDate };
})();
