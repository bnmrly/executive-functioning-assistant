const settings = window.DashboardRoutines;
const colours = ['water', 'teeth', 'bag'];
const escape = value => App.esc(value);
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');

export function mountRoutineEditor(panel) {
  panel.innerHTML = '<p>Changes keep today’s ticks for tasks you leave in place.</p>' +
    '<form><label>Routine <select name="routine"><option value="morning">Morning</option><option value="evening">Evening</option></select></label>' +
    '<div class="parent-routine-sections"></div><div class="parent-actions">' +
    '<button type="button" data-action="add-section">Add section</button><button type="submit">Save checklist</button></div></form>' +
    '<p class="parent-status" role="status"></p>';
  const form = panel.querySelector('form');
  const root = panel.querySelector('.parent-routine-sections');
  const select = form.elements.routine;
  const status = panel.querySelector('.parent-status');
  const drafts = new Map();

  function groups() {
    if (!drafts.has(select.value)) drafts.set(select.value, settings.sections(select.value));
    return drafts.get(select.value);
  }

  function orderButtons(index, length, item) {
    return '<button type="button" aria-label="Move ' + item + ' up" data-action="up"' +
      (index === 0 ? ' disabled' : '') + '>Up</button>' +
      '<button type="button" aria-label="Move ' + item + ' down" data-action="down"' +
      (index === length - 1 ? ' disabled' : '') + '>Down</button>';
  }

  function render() {
    const list = groups();
    root.innerHTML = list.map((group, index) => '<fieldset data-section="' + index + '">' +
      '<legend>' + escape(group.name || 'New section') + '</legend><div class="parent-editor-row">' +
      '<label>Section name <input data-name maxlength="80" value="' + escape(group.name) + '" required></label>' +
      orderButtons(index, list.length, 'section') +
      '<button type="button" data-action="remove-section"' + (list.length < 2 ? ' disabled' : '') + '>Remove section</button></div>' +
      group.tasks.map(([, title], task) => '<div class="parent-editor-row" data-task="' + task + '">' +
        '<label>Task <input data-task-name maxlength="140" value="' + escape(title) + '" required></label>' +
        orderButtons(task, group.tasks.length, 'task') +
        '<button type="button" aria-label="Remove task" data-action="remove-task"' +
          (group.tasks.length < 2 ? ' disabled' : '') + '>Remove</button></div>').join('') +
      '<button type="button" data-action="add-task">Add task</button></fieldset>').join('');
  }

  select.addEventListener('change', () => { status.textContent = ''; render(); });
  form.addEventListener('input', event => {
    const input = event.target;
    const section = input.closest('[data-section]');
    if (!section) return;
    const group = groups()[Number(section.dataset.section)];
    if (input.hasAttribute('data-name')) group.name = input.value;
    if (input.hasAttribute('data-task-name')) {
      group.tasks[Number(input.closest('[data-task]').dataset.task)][1] = input.value;
    }
  });
  form.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const list = groups();
    const { action } = button.dataset;
    if (action === 'add-section') {
      list.push({ key: newId(), name: '', accent: colours[list.length % colours.length], tasks: [[newId(), '']] });
      render();
      root.lastElementChild.querySelector('[data-name]').focus();
      return;
    }
    const sectionIndex = Number(button.closest('[data-section]').dataset.section);
    const tasks = list[sectionIndex].tasks;
    const task = button.closest('[data-task]');
    const index = task ? Number(task.dataset.task) : sectionIndex;
    const items = task ? tasks : list;
    if (action === 'add-task') tasks.push([newId(), '']);
    if (action === 'remove-task' || action === 'remove-section') items.splice(index, 1);
    if (action === 'up' || action === 'down') {
      const next = index + (action === 'up' ? -1 : 1);
      [items[index], items[next]] = [items[next], items[index]];
    }
    render();
    if (action === 'add-task') {
      root.querySelector('[data-section="' + sectionIndex + '"]').querySelector('[data-task="' +
        (tasks.length - 1) + '"] input').focus();
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const list = groups().map(group => ({
        ...group, name: group.name.trim(), tasks: group.tasks.map(([id, title]) => [id, title.trim()]),
      }));
      settings.saveSections(select.value, list);
      drafts.set(select.value, list);
      render();
      status.textContent = 'Checklist saved.';
    } catch (error) {
      status.textContent = error.message;
    }
  });
  render();
}
