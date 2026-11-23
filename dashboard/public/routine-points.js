(function () {
  'use strict';

  const prefix = 'dashboard-points-v1:';
  const routines = ['morning', 'evening'];
  const sectionNames = Object.freeze({
    toilet: 'Toilet', care: 'Teeth and face', dressed: 'Getting dressed', hair: 'Hair',
    bedtime: 'Ready for bed', clean: 'Clean',
  });
  const maxDailyBonus = 2;
  const maxWeeklyBonus = 7 * maxDailyBonus;
  const weeklyChangeKey = 'dashboard-points-weekly-change-v2';
  const balanceStartKey = 'dashboard-points-balance-start-v1';
  const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

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

  function sectionAwards(date, routine) {
    return [...awards(date, routine)]
      .filter(id => id.startsWith('section:'))
      .map(id => id.slice('section:'.length));
  }

  function corrections(date) {
    return JSON.parse(localStorage.getItem(prefix + date + ':corrections')) || {};
  }

  function reviewSections(date) {
    const saved = corrections(date);
    return routines.map(routine => ({
      routine,
      sections: sectionAwards(date, routine).map(id => ({
        id,
        label: window.DashboardRoutines?.sections(routine).find(section => section.key === id)?.name || sectionNames[id] || 'Removed section',
        counted: !saved[routine]?.includes(id),
      })),
    }));
  }

  function correctSections(date, decisions) {
    if (date !== dayKey()) throw new Error('The day has changed. Open the review again.');
    const saved = corrections(date);
    const excluded = {};
    for (const routine of routines) {
      const choices = decisions.get(routine);
      excluded[routine] = sectionAwards(date, routine).filter(id =>
        choices?.has(id) ? !choices.get(id) : saved[routine]?.includes(id)
      );
    }
    localStorage.setItem(prefix + date + ':corrections', JSON.stringify(excluded));
  }

  function grantSection(date, routine, section) {
    const earned = awards(date, routine);
    const id = 'section:' + section;
    if (earned.has(id)) return 0;
    const pence = rewardPence(date, 1, 0);
    earned.add(id);
    localStorage.setItem(prefix + date + ':' + routine, JSON.stringify([...earned]));
    return pence;
  }

  function addDailyBonus() {
    const date = dayKey();
    const daily = awards(date, 'daily');
    const legacyCount = routines.filter(routine => awards(date, routine).has('bonus')).length;
    if (daily.size + legacyCount >= maxDailyBonus) return null;
    const pence = rewardPence(date, 0, 1);
    daily.add('bonus:' + (daily.size + 1));
    localStorage.setItem(prefix + date + ':daily', JSON.stringify([...daily]));
    return pence;
  }

  function history() {
    const days = new Map();
    const balanceStart = localStorage.getItem(balanceStartKey);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const [date, routine] = key.slice(prefix.length).split(':');
      if (balanceStart && date < balanceStart) continue;
      if (routine !== 'daily' && !routines.includes(routine)) continue;
      if (!days.has(date)) days.set(date, { bonusPoints: 0 });
      const day = days.get(date);
      const earned = awards(date, routine);
      if (routine === 'daily') {
        day.bonusPoints += earned.size;
      } else {
        // The automatic completion award belongs only to weeks under the old rules.
        const excluded = corrections(date)[routine];
        day[routine] = [...earned].filter(id => id.startsWith('section:') && !excluded?.includes(id.slice('section:'.length))).length +
          (date < firstWeek && earned.has('routine') ? 2 : 0);
        if (earned.has('bonus')) day.bonusPoints++;
      }
    }
    return days;
  }

  function mondayKey(date) {
    const monday = new Date(date + 'T12:00:00');
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    return dayKey(monday);
  }

  function firstWeekWithSectionPoints() {
    const firstWeek = mondayKey(dayKey());
    try {
      const saved = localStorage.getItem(weeklyChangeKey);
      if (saved) return saved;
      localStorage.setItem(weeklyChangeKey, firstWeek);
    } catch {
      // Keep the app usable if this device does not allow saving.
    }
    return firstWeek;
  }

  const firstWeek = firstWeekWithSectionPoints();
  function weeklyPence(checklistPoints, bonusPoints, weekStart) {
    if (weekStart < firstWeek) {
      return Math.min(500, Math.round((checklistPoints + bonusPoints) * 500 / 84));
    }
    const paidChecklistPoints = Math.min(checklistPoints, 56);
    const paidBonusPoints = Math.min(bonusPoints, maxWeeklyBonus);
    const checklistPence = paidChecklistPoints * 500 / 56;
    const bonusPence = paidBonusPoints * 100 / maxWeeklyBonus;
    return Math.round(checklistPence + bonusPence);
  }

  function rewardPence(date, checklistChange, bonusChange) {
    const monday = mondayKey(date);
    let checklistPoints = 0;
    let bonusPoints = 0;
    for (const [key, day] of history()) {
      if (key > date || mondayKey(key) !== monday) continue;
      checklistPoints += (day.morning ?? 0) + (day.evening ?? 0);
      bonusPoints += day.bonusPoints;
    }
    return weeklyPence(checklistPoints + checklistChange, bonusPoints + bonusChange, monday) -
      weeklyPence(checklistPoints, bonusPoints, monday);
  }

  function moneyHistory() {
    const entries = [...history()].sort(([a], [b]) => a.localeCompare(b));
    const days = new Map();
    let week;
    let checklistPoints = 0;
    let bonusPoints = 0;
    for (const [date, day] of entries) {
      const monday = mondayKey(date);
      if (monday !== week) {
        week = monday;
        checklistPoints = bonusPoints = 0;
      }
      // Allocate rounded pennies in day order so daily amounts sum to the weekly total.
      const start = weeklyPence(checklistPoints, bonusPoints, week);
      checklistPoints += day.morning ?? 0;
      const afterMorning = weeklyPence(checklistPoints, bonusPoints, week);
      checklistPoints += day.evening ?? 0;
      const afterEvening = weeklyPence(checklistPoints, bonusPoints, week);
      bonusPoints += day.bonusPoints;
      const end = weeklyPence(checklistPoints, bonusPoints, week);
      days.set(date, {
        pence: end - start,
        morning: afterMorning - start,
        evening: afterEvening - afterMorning,
        bonus: end - afterEvening,
        bonusCount: day.bonusPoints,
      });
    }
    return days;
  }

  const formatMoney = pence => pounds.format(pence / 100);
  const formatReward = pence => pence < 100 ? pence + 'p' : formatMoney(pence);

  dateLegacyProgress();
  window.RoutinePoints = {
    dayKey, grantSection, addDailyBonus, moneyHistory, formatMoney, formatReward,
    prefix, maxDailyBonus, balanceStartKey, sectionNames, reviewSections, correctSections,
  };
})();
