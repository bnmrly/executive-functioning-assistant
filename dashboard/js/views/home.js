// Today combines the device clock with the local forecast for Chorlton, Manchester.
(function () {
  'use strict';

  const chorlton = { latitude: 53.44, longitude: -2.27 };
  const forecastDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const forecastInterval = 30 * 60 * 1000;
  const retryInterval = 5 * 60 * 1000;
  // The first matching tip wins. Edit this text to suit Beth.
  const weatherTips = {
    Thunderstorms: 'Check for thunder warnings',
    Snow: 'Wear warm shoes',
    Rain: 'Take a raincoat',
    Drizzle: 'Take an umbrella',
    Cold: 'Wear a warm layer',
    Hot: 'Take a water bottle',
  };
  let view;
  let forecast;
  let nextRefresh = 0;

  function renderClock(now) {
    view.querySelector('.h-clock').innerHTML =
      '<div class="h-time num">' + App.fmt.time(now, false) + '<span class="h-ampm">' + App.fmt.ampm(now) + '</span></div>' +
      '<div class="h-date"><b>' + App.fmt.day(now) + '</b> ' + App.fmt.month(now) + ' ' + now.getDate() + '</div>';
  }

  function condition(code, isDay) {
    if (code === 0) return [isDay ? 'sun' : 'moon', 'Clear'];
    if (code === 1 || code === 2) return ['partly', 'Partly cloudy'];
    if (code === 3) return ['cloud', 'Overcast'];
    if (code === 45 || code === 48) return ['cloud', 'Fog'];
    if (code >= 95) return ['rain', 'Thunderstorms'];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['cloud', 'Snow'];
    if (code >= 51 && code <= 57) return ['rain', 'Drizzle'];
    if (code >= 61 && code <= 82) return ['rain', 'Rain'];
    return ['cloud', 'Conditions unavailable'];
  }

  function forecastSlot(label, conditions, temperature) {
    const [icon, description] = conditions;
    return '<div class="h-wx-hour" aria-label="' + description + '">' + label +
      '<span>' + App.icon(icon, 36) + '<b>' + (Number.isFinite(temperature) ? Math.round(temperature) + '°' : '—') + '</b></span></div>';
  }

  function forecastTip(hourly, date, after, current) {
    const conditions = new Set();

    function include(code, temperature) {
      conditions.add(condition(code, true)[1]);
      if (Number.isFinite(temperature) && temperature <= 7) conditions.add('Cold');
      if (Number.isFinite(temperature) && temperature >= 25) conditions.add('Hot');
    }

    if (current) include(current.weather_code, current.temperature_2m);
    hourly.time.forEach((time, index) => {
      if (!time.startsWith(date) || time < after) return;
      const hour = Number(time.slice(11, 13));
      if (!after && (hour < 8 || hour > 20)) return;
      include(hourly.weather_code[index], hourly.temperature_2m[index]);
    });

    return Object.keys(weatherTips).find(key => conditions.has(key));
  }

  function forecastDay(daily, hourly, index, after = '', current) {
    const high = daily.temperature_2m_max[index];
    const low = daily.temperature_2m_min[index];
    if (!Number.isFinite(high) || !Number.isFinite(low)) return '<p>Forecast unavailable</p>';

    const [icon, summary] = condition(daily.weather_code[index], true);
    const date = daily.time[index];
    const tip = forecastTip(hourly, date, after, current);
    const hours = hourly.time.map((time, i) => {
      const hour = Number(time.slice(11, 13));
      if (!time.startsWith(date) || hour < 8 || hour > 20 || hour % 4 !== 0 || time < after) return '';
      const label = '<time datetime="' + time + '">' + (hour % 12 || 12) + (hour < 12 ? ' am' : ' pm') + '</time>';
      return forecastSlot(label, condition(hourly.weather_code[i], hourly.is_day[i]), hourly.temperature_2m[i]);
    }).join('');
    const now = Number.isFinite(current?.temperature_2m)
      ? forecastSlot('<span class="h-wx-now">Now</span>', condition(current.weather_code, current.is_day), current.temperature_2m)
      : '';

    return '<div class="h-wx-top">' + App.icon(icon, 68) +
      '<b class="h-wx-temp num">' + Math.round(high) + '°C</b>' +
      '<div>' + summary + '<div class="h-wx-low">Low ' + Math.round(low) + '°C</div></div></div>' +
      (now || hours ? '<div class="h-wx-hours">' + now + hours + '</div>' : '') +
      (tip ? '<div class="h-wx-tip">' + App.esc(weatherTips[tip]) + '</div>' : '');
  }

  function paintForecast(now) {
    if (!forecast) return;
    const parts = Object.fromEntries(forecastDate.formatToParts(now).map(part => [part.type, part.value]));
    const date = parts.year + '-' + parts.month + '-' + parts.day;
    const { daily, hourly, current } = forecast;
    const today = daily.time.indexOf(date);
    const currentTime = date + 'T' + parts.hour + ':' + parts.minute;
    view.querySelector('.h-wx-today .h-wx-data').innerHTML = forecastDay(daily, hourly, today, currentTime, current);
    view.querySelector('.h-wx-tomorrow .h-wx-data').innerHTML = forecastDay(daily, hourly, today < 0 ? -1 : today + 1);
  }

  async function getJson(endpoint, params) {
    const response = await fetch(endpoint + '?' + new URLSearchParams(params));
    if (!response.ok) throw new Error('Weather request failed');
    return response.json();
  }

  async function refreshForecast() {
    if (Date.now() < nextRefresh) return;
    const status = view.querySelector('.h-wx-status');
    nextRefresh = Date.now() + forecastInterval;
    if (!forecast) status.textContent = 'Loading forecast…';

    try {
      const data = await getJson('https://api.open-meteo.com/v1/forecast', {
        latitude: chorlton.latitude,
        longitude: chorlton.longitude,
        models: 'ukmo_seamless',
        current: 'temperature_2m,weather_code,is_day',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code',
        hourly: 'temperature_2m,weather_code,is_day',
        timezone: 'Europe/London',
        forecast_days: '3',
      });
      if (!data.daily?.time?.length || !data.hourly?.time?.length ||
          !data.daily.temperature_2m_max || !data.daily.temperature_2m_min || !data.daily.weather_code ||
          !data.hourly.temperature_2m || !data.hourly.weather_code || !data.hourly.is_day) {
        throw new Error('Forecast unavailable');
      }
      forecast = data;
      status.textContent = '';
      paintForecast(new Date());
    } catch {
      nextRefresh = Date.now() + retryInterval;
      status.textContent = forecast ? 'Weather update failed. Showing the last forecast.' : 'Weather unavailable. Trying again shortly.';
    }
  }

  let calendarBusy = false;
  let calendarNextRefresh = 0;
  let calendarDay = '';

  function paintCalendar(data) {
    const panel = view.querySelector('.h-agenda-content');
    const heading = view.querySelector('.h-agenda-title');
    heading.textContent = 'Today’s plan';
    if (data.status !== 'ok') {
      const messages = {
        permission_required: 'Allow calendar access to show Beth’s plan.',
        calendar_missing: 'Beth’s Calendar is not on this tablet yet. Open Google Calendar and enable its sync.',
        sync_disabled: 'Open Google Calendar and turn on sync and visibility for Beth’s Calendar.',
        multiple_calendars: 'More than one Beth calendar was found. Give the calendar you want to use the name Beth’s Calendar.',
        unavailable: 'The calendar could not be read. Try refreshing it.',
        browser: 'Calendar events appear in the installed Beth tablet app.',
      };
      panel.innerHTML = '<p class="h-agenda-status" role="status">' + App.esc(messages[data.status] || messages.unavailable) + '</p>' +
        (data.status === 'permission_required' ? '<button class="h-calendar-allow" type="button">Allow calendar access</button>' : '');
      return;
    }
    const today = new Date(data.dayStart);
    const tomorrow = App.addDays(today, 1);
    const afterTomorrow = App.addDays(today, 2);
    const onDay = (event, start, end) => event.start < +end && event.end > +start;
    let events = data.events.filter(event => onDay(event, today, tomorrow));
    let day = today;
    if (!events.length) {
      const upcoming = data.events.filter(event => onDay(event, tomorrow, afterTomorrow));
      if (upcoming.length) {
        events = upcoming;
        day = tomorrow;
        heading.textContent = 'Tomorrow’s plan';
      }
    }
    events.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
    const evening = event => !event.allDay && new Date(Math.max(event.start, +day)).getHours() >= 17;
    function section(title, list) {
      return '<section class="h-agenda-section"><h3>' + title + '</h3>' +
        (list.length ? '<ol>' + list.map(event => {
          const time = event.allDay ? 'All day' : event.start < +day ? 'Continues' : App.fmt.hour(new Date(event.start));
          return '<li><span class="h-event-time">' + App.esc(time) + '</span><span class="h-event-title">' + App.esc(event.title) + '</span></li>';
        }).join('') + '</ol>' : '<p class="h-agenda-empty">Nothing planned</p>') + '</section>';
    }
    panel.innerHTML = section('Daytime', events.filter(event => !evening(event))) +
      section('Evening', events.filter(evening));
  }

  async function refreshCalendar(force = false) {
    const day = new Date().toDateString();
    if (calendarBusy || (!force && calendarDay === day && Date.now() < calendarNextRefresh)) return;
    calendarBusy = true;
    calendarDay = day;
    calendarNextRefresh = Date.now() + 60000;
    try {
      if (location.hostname !== '127.0.0.1' || location.port !== '8765') {
        paintCalendar({ status: 'browser' });
        return;
      }
      const response = await fetch('/api/calendar', { cache: 'no-store' });
      if (!response.ok) throw new Error('Calendar unavailable');
      const data = await response.json();
      if (data.status === 'ok' && (!Array.isArray(data.events) || !Number.isFinite(data.dayStart))) {
        throw new Error('Invalid calendar response');
      }
      paintCalendar(data);
    } catch {
      paintCalendar({ status: 'unavailable' });
    } finally {
      calendarBusy = false;
    }
  }

  function mount(el) {
    el.innerHTML = '<div class="home">' +
      '<div class="h-clock"></div>' +
      '<section class="h-weather h-wx-today" aria-label="Chorlton weather today">' +
        '<div class="label">Today · Chorlton</div>' +
        '<div class="h-wx-data"></div><p class="h-wx-status" role="status"></p>' +
        '<a class="h-wx-source" href="https://open-meteo.com/en/license" target="_blank" rel="noopener noreferrer" aria-label="Weather data and licence: Met Office model via Open-Meteo, temperatures rounded" title="Weather data: Met Office model via Open-Meteo; temperatures rounded"><span aria-hidden="true">ⓘ</span></a>' +
      '</section>' +
      '<section class="h-weather h-wx-tomorrow" aria-label="Chorlton weather tomorrow">' +
        '<div class="label">Tomorrow</div><div class="h-wx-data"></div>' +
      '</section>' +
      '<div class="h-lower">' +
        '<section class="h-agenda" aria-labelledby="h-agenda-title">' +
          '<header class="h-panel-header"><h2 class="h-agenda-title" id="h-agenda-title">Today’s plan</h2>' +
            '<button class="h-calendar-refresh" type="button" aria-label="Refresh calendar">Refresh</button></header>' +
          '<div class="h-agenda-content"><p class="h-agenda-status" role="status">Loading calendar…</p></div></section>' +
        '<section class="h-different" aria-labelledby="h-different-title">' +
          '<h2 id="h-different-title">Different today</h2><p class="h-different-event">Grandad is visiting</p>' +
          '<p class="h-example-note">Example</p></section></div></div>';
    el.querySelector('.h-calendar-refresh').addEventListener('click', () => void refreshCalendar(true));
    el.querySelector('.h-agenda-content').addEventListener('click', async event => {
      if (!event.target.closest('.h-calendar-allow')) return;
      const button = event.target.closest('button');
      button.disabled = true;
      try {
        await fetch('/api/calendar/permission', { method: 'POST' });
      } catch {
        button.disabled = false;
      }
    });
  }

  function show(el) {
    view = el;
    if (!el.firstChild) mount(el);
    const now = new Date();
    renderClock(now);
    paintForecast(now);
    if (App.current === 'home') {
      void refreshForecast();
      void refreshCalendar();
    }
  }

  window.addEventListener('beth-calendar-permission', () => { if (view) void refreshCalendar(true); });
  window.addEventListener('focus', () => { if (App.current === 'home' && view) void refreshCalendar(true); });
  App.register('home', { show, resume: show });
  App.on('minute', () => {
    if (App.current === 'home' && view) show(view);
  });
})();
