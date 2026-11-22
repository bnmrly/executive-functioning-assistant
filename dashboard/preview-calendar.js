import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isOverviewPlan } from './js/views/plan-events.js';

// Served by Vite for browser previews. The Android WebView supplies its own calendar.
const schoolPlans = ['', 'Science', 'Regular day', 'Swimming', 'PE', 'Golden time', ''];
const snapshotPath = join(tmpdir(), 'executive-functioning-dashboard-calendar.json');

function addWeekendPlaceholders(events, firstDay, days) {
  const date = new Date(firstDay);
  for (let index = 0; index < days; index++, date.setDate(date.getDate() + 1)) {
    const weekday = date.getDay();
    if (weekday !== 6 && weekday !== 0) continue;
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    if (events.some(event => event.allDay && isOverviewPlan(event) && event.start < +nextDay && event.end > +date)) continue;
    events.push({ title: 'Home plan: Placeholder', start: +date, end: +nextDay, allDay: true });
  }
}

function readSnapshot(request, firstDay, days) {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress);
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(request.headers.host ?? '');
  if (!local || !localHost) return null;
  const end = new Date(firstDay);
  end.setDate(end.getDate() + days);
  try {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    if (+firstDay < Date.parse(snapshot.from) || +end > Date.parse(snapshot.to)) return null;
    const events = snapshot.events.map(event => ({
      ...event,
      start: event.allDay ? +new Date(event.start + 'T00:00:00') : Date.parse(event.start),
      end: event.allDay ? +new Date(event.end + 'T00:00:00') : Date.parse(event.end),
    })).filter(event => event.start < +end && event.end > +firstDay);
    return { status: 'ok', dayStart: +firstDay, events, snapshot: true };
  } catch {
    return null;
  }
}

export function previewCalendar(request, response, next) {
  const url = new URL(request.url, 'http://localhost');
  if (request.method !== 'GET' || url.pathname !== '/api/calendar') return next();

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const start = url.searchParams.get('start');
  const firstDay = start ? new Date(start + 'T00:00:00') : dayStart;
  const days = Number(url.searchParams.get('days') ?? 2);
  if (!Number.isFinite(+firstDay) || !Number.isInteger(days) || days < 1 || days > 31) {
    response.writeHead(400).end();
    return;
  }

  const snapshot = readSnapshot(request, firstDay, days);
  if (snapshot) {
    addWeekendPlaceholders(snapshot.events, firstDay, days);
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(snapshot));
    return;
  }

  const events = [];
  for (let index = 0; index < days; index++) {
    const date = new Date(firstDay);
    date.setDate(date.getDate() + index);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const school = schoolPlans[date.getDay()];
    if (school) events.push({ title: 'School plan: ' + school, start: +date, end: +nextDay, allDay: true });
    if (+date === +dayStart || date.getDay() === 1) {
      events.push({ title: 'Home plan: Birthday', start: +date, end: +nextDay, allDay: true });
    }
    for (const [title, hour, minute] of [
      [school ? 'Go to school' : 'No school. Hooray.', 8, 20],
      ['Get ready for bed', 19, 45],
    ]) {
      const start = new Date(date);
      start.setHours(hour, minute, 0, 0);
      events.push({ title, start: +start, end: +start + 900000, allDay: false });
    }
  }

  addWeekendPlaceholders(events, firstDay, days);
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ status: 'ok', dayStart: +firstDay, events, sample: true }));
}
