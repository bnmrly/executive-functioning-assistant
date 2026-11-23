const routineNames = { morning: 'Morning', evening: 'Evening' };

export function mountEarningsReview(panel) {
  const money = window.RoutinePoints;
  panel.innerHTML = '<p>Tick the sections that should count towards today’s pocket money.</p>' +
    '<form><div class="parent-earnings-fields"></div>' +
    '<div class="parent-actions"><button type="submit">Save correction</button><button type="button" data-bonus>Add a bonus</button></div></form>' +
    '<p class="parent-status" role="status"></p>';
  const day = money.dayKey();
  const form = panel.querySelector('form');
  const content = panel.querySelector('.parent-earnings-fields');
  const status = panel.querySelector('.parent-status');
  const bonus = panel.querySelector('[data-bonus]');

  function render() {
    const groups = money.reviewSections(day);
    content.replaceChildren();
    for (const { routine, sections } of groups) {
      const group = document.createElement('fieldset');
      const title = document.createElement('legend');
      title.textContent = routineNames[routine];
      group.append(title);
      for (const section of sections) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = routine;
        input.value = section.id;
        input.checked = section.counted;
        label.append(input, section.label);
        group.append(label);
      }
      if (!sections.length) {
        const empty = document.createElement('p');
        empty.textContent = 'No completed sections to review.';
        group.append(empty);
      }
      content.append(group);
    }
    form.querySelector('[type="submit"]').disabled = !groups.some(group => group.sections.length);
    renderBonus();
  }

  function renderBonus() {
    const today = money.moneyHistory().get(day);
    bonus.disabled = (today?.bonusCount ?? 0) >= money.maxDailyBonus;
    bonus.textContent = bonus.disabled ? 'Bonus limit reached' : 'Add a bonus';
  }

  function edit(action, refresh) {
    if (money.dayKey() !== day) {
      status.textContent = 'It’s a new day. Reopen Pocket money to make changes.';
      return;
    }
    try {
      const message = action();
      refresh();
      status.textContent = message;
    } catch {
      status.textContent = 'Could not save the change on this device.';
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    edit(() => {
      const decisions = new Map();
      for (const input of content.querySelectorAll('input[type="checkbox"]')) {
        if (!decisions.has(input.name)) decisions.set(input.name, new Map());
        decisions.get(input.name).set(input.value, input.checked);
      }
      money.correctSections(day, decisions);
      return 'Today’s checklist earnings updated.';
    }, render);
  });
  bonus.addEventListener('click', () => edit(() => {
    const added = money.addDailyBonus();
    return added === null ? 'Today’s bonus limit has been reached.'
      : added === 0 ? 'Bonus saved.' : money.formatReward(added) + ' bonus added!';
  }, renderBonus));
  render();
}
