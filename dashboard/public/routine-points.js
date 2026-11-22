(function () {
  'use strict';

  const prefix = 'dashboard-points-v1:';
  const routines = ['morning', 'evening'];
  const pointsFor = id => id === 'routine' ? 2 : 1;

  function dayKey(date = new Date()) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
      .map(part => String(part).padStart(2, '0')).join('-');
  }

  // Anchor saved pre-points checkmarks to the day the updated dashboard first opens.
  function dateLegacyProgress() {
    for (const routine of routines) {
      try {
        const key = 'beth-checklist-' + routine + '-v2';
        const saved = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(saved?.changes) && !saved.date) {
          localStorage.setItem(key, JSON.stringify({ ...saved, date: dayKey() }));
        }
      } catch {
        // The checklist handles its own storage messages.
      }
    }
  }

  function awards(date, routine) {
    const saved = JSON.parse(localStorage.getItem(prefix + date + ':' + routine));
    return new Set(Array.isArray(saved) ? saved : []);
  }

  function grant(date, routine, ids) {
    const earned = awards(date, routine);
    let added = 0;
    for (const id of ids) {
      if (earned.has(id) || (id === 'bonus' && !earned.has('routine'))) continue;
      earned.add(id);
      added += pointsFor(id);
    }
    if (added) localStorage.setItem(prefix + date + ':' + routine, JSON.stringify([...earned]));
    return added;
  }

  function history() {
    const days = new Map();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const [date, routine] = key.slice(prefix.length).split(':');
      if (!routines.includes(routine)) continue;
      if (!days.has(date)) days.set(date, {});
      const earned = awards(date, routine);
      days.get(date)[routine] = {
        points: [...earned].reduce((sum, id) => sum + pointsFor(id), 0),
        finished: earned.has('routine'),
        bonus: earned.has('bonus'),
      };
    }
    return days;
  }

  function weeklyPence(points) {
    return Math.min(500, Math.round(points * 500 / 84));
  }

  dateLegacyProgress();
  window.RoutinePoints = { dayKey, grant, history, weeklyPence, prefix };
})();
