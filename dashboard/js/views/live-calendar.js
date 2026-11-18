// A read-only week of events from the tablet's synced calendar.
(function () {
  'use strict';

  let view;
  let week;
  let requestId = 0;
  let nextRefresh = 0;

  function currentWeek() {
    const start = App.dayStart(new Date());
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    return start;
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function renderEvents(events) {
    const today = new Date();
    view.querySelector('.calendar-days').innerHTML = Array.from({ length: 7 }, (_, index) => {
      const day = App.addDays(week, index);
      const end = App.addDays(day, 1);
      const entries = events.filter(event => event.start < +end && event.end > +day)
        .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
      const label = App.fmt.day(day) + ', ' + day.getDate() + ' ' + App.fmt.month(day);
      return '<section class="calendar-day' + (App.sameDay(day, today) ? ' calendar-day--today' : '') + '" aria-label="' + label + '">' +
        '<h2><span>' + App.fmt.dayShort(day) + '</span><time datetime="' + dateKey(day) + '">' + day.getDate() + '</time></h2>' +
        (entries.length ? '<ol>' + entries.map(event => {
          const time = event.allDay ? 'All day' : event.start < +day ? 'Continues' : App.fmt.hour(new Date(event.start));
          return '<li><span class="calendar-event-time">' + App.esc(time) + '</span><span class="calendar-event-title">' + App.esc(event.title) + '</span></li>';
        }).join('') + '</ol>' : '<p class="calendar-empty">No events</p>') + '</section>';
    }).join('');
  }

  async function refresh() {
    const currentRequest = ++requestId;
    const last = App.addDays(week, 6);
    const range = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    view.querySelector('.calendar-range').textContent = range.format(week) + ' – ' + range.format(last);
    const status = view.querySelector('.calendar-status');
    status.textContent = 'Loading calendar…';
    view.querySelector('.calendar-days').innerHTML = '';
    nextRefresh = Date.now() + 60000;
    try {
      if (location.hostname !== '127.0.0.1' || location.port !== '8765') {
        throw new Error('Open the installed tablet app to see your synced calendar.');
      }
      const response = await fetch('/api/calendar?' + new URLSearchParams({ start: dateKey(week), days: '7' }), { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load the calendar. Tap Refresh to try again.');
      const data = await response.json();
      if (currentRequest !== requestId) return;
      if (data.status !== 'ok' || !Array.isArray(data.events)) {
        const messages = {
          permission_required: 'Allow calendar access from the Today tab to see your events.',
          calendar_missing: 'Open Google Calendar and enable sync for your dashboard calendar.',
          sync_disabled: 'Open Google Calendar and enable sync and visibility for your dashboard calendar.',
          multiple_calendars: 'More than one matching calendar was found. Check your calendar names.',
        };
        throw new Error(messages[data.status] || 'Could not load the calendar. Tap Refresh to try again.');
      }
      renderEvents(data.events);
      status.textContent = '';
    } catch (error) {
      if (currentRequest === requestId) status.textContent = error.message;
    }
  }

  function show(el) {
    view = el;
    if (!week) week = currentWeek();
    if (!el.firstChild) {
      el.innerHTML = '<div class="live-calendar"><header class="calendar-toolbar">' +
        '<div><h1>Calendar</h1><p class="calendar-range"></p></div>' +
        '<nav class="calendar-controls" aria-label="Calendar dates">' +
          '<button type="button" data-calendar="previous" aria-label="Previous week">←</button>' +
          '<button type="button" data-calendar="today">This week</button>' +
          '<button type="button" data-calendar="next" aria-label="Next week">→</button>' +
          '<button type="button" data-calendar="refresh">Refresh</button>' +
        '</nav></header><p class="calendar-status" role="status"></p><div class="calendar-days"></div></div>';
      el.querySelector('.calendar-controls').addEventListener('click', event => {
        const button = event.target.closest('button[data-calendar]');
        if (!button) return;
        const action = button.dataset.calendar;
        if (action === 'previous') week = App.addDays(week, -7);
        if (action === 'next') week = App.addDays(week, 7);
        if (action === 'today') week = currentWeek();
        void refresh();
      });
    }
    void refresh();
  }

  App.register('calendar', { show, resume: show });
  App.on('minute', () => {
    if (App.current === 'calendar' && view && Date.now() >= nextRefresh) void refresh();
  });
})();
