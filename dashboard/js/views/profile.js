const pocketMoney = window.RoutinePoints;
const portraitKey = 'dashboard-profile-portrait-v1';
const avatars = [
  ['Fox', '1F98A'], ['Cat', '1F431'], ['Panda', '1F43C'],
  ['Unicorn', '1F984'], ['Dinosaur', '1F996'], ['Butterfly', '1F98B'],
];
const routines = [['Morning', 'morning'], ['Evening', 'evening']];
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const weekDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fullDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthDate = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const { formatMoney, formatReward } = pocketMoney;
const avatarUrl = id => '/avatars/' + id + '.svg';

let view;
let period = 'day';
let selectedDate;
let currentDay = pocketMoney.dayKey();
let portraitRequest = 0;

function periodStart(date) {
  if (period === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
  if (period === 'week') return App.addDays(date, -((date.getDay() + 6) % 7));
  return date;
}

function periodEnd(start) {
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return App.addDays(start, period === 'week' ? 7 : 1);
}

function updateDate() {
  const today = App.dayStart(new Date());
  const key = pocketMoney.dayKey(today);
  if (!selectedDate || (currentDay !== key && pocketMoney.dayKey(selectedDate) === currentDay)) selectedDate = today;
  currentDay = key;
  return today;
}

function movePeriod(direction) {
  const start = periodStart(selectedDate);
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + direction, 1);
  return App.addDays(start, direction * (period === 'week' ? 7 : 1));
}

function showPortrait() {
  const display = view.querySelector('.profile-portrait');
  const saved = JSON.parse(localStorage.getItem(portraitKey));
  const avatar = avatars.find(([, id]) => saved?.avatar === id);
  const photo = typeof saved?.photo === 'string' && saved.photo.startsWith('data:image/jpeg;base64,');
  display.textContent = 'B';
  if (avatar || photo) {
    const image = document.createElement('img');
    image.alt = avatar ? avatar[0] + ' avatar' : 'Beth’s photo';
    image.src = avatar ? avatarUrl(avatar[1]) : saved.photo;
    display.replaceChildren(image);
  }
  view.querySelector('.profile-photo-button').textContent = photo ? 'Change photo' : 'Add photo';
  view.querySelector('.profile-clear').hidden = !avatar && !photo;
  for (const button of view.querySelectorAll('[data-avatar]')) {
    button.setAttribute('aria-pressed', String(button.dataset.avatar === avatar?.[1]));
  }
}

function savePortrait(choice) {
  portraitRequest++;
  try {
    if (choice) localStorage.setItem(portraitKey, JSON.stringify(choice));
    else localStorage.removeItem(portraitKey);
    showPortrait();
    setPortraitStatus('');
    return true;
  } catch {
    setPortraitStatus('Could not save this picture on this device.');
    return false;
  }
}

function setPortraitStatus(message) {
  view.querySelector('.profile-photo-status').textContent = message;
}

async function loadPhoto(file) {
  const request = ++portraitRequest;
  if (file.size > 20 * 1024 * 1024) {
    setPortraitStatus('Choose a photo smaller than 20 MB.');
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid photo');
    const canvas = document.createElement('canvas');
    const size = Math.min(512, image.naturalWidth, image.naturalHeight);
    canvas.width = canvas.height = size;
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fbf9f4';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2,
      crop, crop, 0, 0, size, size);
    const photo = canvas.toDataURL('image/jpeg', 0.85);
    if (request === portraitRequest) savePortrait({ photo });
  } catch {
    if (request === portraitRequest) setPortraitStatus('Could not open this photo. Try a JPEG or PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dayDetails(day, isToday) {
  const bonus = day?.bonus ?? 0;
  const limitReached = (day?.bonusCount ?? 0) >= pocketMoney.maxDailyBonus;
  const routineRows = routines.map(([label, id]) =>
    '<li><span>' + label + '</span><strong>' + formatMoney(day?.[id] ?? 0) + '</strong></li>'
  ).join('');
  const bonusRow = isToday
    ? '<li><span>Adult bonus</span><strong>' + formatMoney(bonus) + '</strong>' +
      '<button type="button" data-daily-bonus' + (limitReached ? ' disabled>Bonus limit reached' : '>Add a bonus') +
      '</button></li>'
    : bonus ? '<li><span>Adult bonus</span><strong>' + formatMoney(bonus) + '</strong></li>' : '';
  return '<ul class="profile-rows">' + routineRows + bonusRow + '</ul>';
}

function render() {
  const today = updateDate();
  const start = periodStart(selectedDate);
  const end = periodEnd(start);
  const current = pocketMoney.dayKey(start) === pocketMoney.dayKey(periodStart(today));
  const content = view.querySelector('.profile-period-content');
  for (const button of view.querySelectorAll('[data-period]')) {
    button.setAttribute('aria-pressed', String(period === button.dataset.period));
  }
  view.querySelector('[data-move="1"]').disabled = current;
  view.querySelector('.profile-date').textContent = period === 'month' ? monthDate.format(start)
    : period === 'week' ? weekDate.formatRange(start, App.addDays(end, -1))
    : fullDate.format(start);

  try {
    const history = pocketMoney.moneyHistory();
    const lifetime = [...history.values()].reduce((sum, day) => sum + day.pence, 0);
    view.querySelector('.profile-lifetime').textContent = formatMoney(lifetime);
    const rows = [];
    let total = 0;
    let bonusPence = 0;
    for (let date = start; date < end && date <= today; date = App.addDays(date, 1)) {
      const day = history.get(pocketMoney.dayKey(date));
      const pence = day?.pence ?? 0;
      total += pence;
      bonusPence += day?.bonus ?? 0;
      rows.push('<li><span>' + shortDate.format(date) + '</span><strong>' + formatMoney(pence) + '</strong></li>');
    }
    const heading = period === 'week'
      ? '<div class="profile-money"><span>Week total' +
        (bonusPence ? '<small>Includes ' + formatMoney(bonusPence) + ' in bonuses</small>' : '') +
        '</span><strong>' + formatMoney(total) + ' earned</strong></div>'
      : '<p class="profile-period-total">' + formatMoney(total) + ' earned</p>';
    content.innerHTML = heading +
      (period === 'day' ? dayDetails(history.get(pocketMoney.dayKey(start)), current)
        : '<ul class="profile-rows">' + rows.join('') + '</ul>');
  } catch {
    content.textContent = 'Pocket money could not be loaded on this device.';
  }
}

function mount(el) {
  el.innerHTML = '<div class="profile">' +
    '<section class="profile-points" aria-labelledby="profile-points-title"><div class="profile-points-heading">' +
    '<h2 id="profile-points-title">Pocket money</h2><strong class="profile-lifetime">£0.00</strong><span>All time</span></div>' +
    '<div class="profile-periods" role="group" aria-label="Pocket money period">' +
    ['Day', 'Week', 'Month'].map(label => '<button type="button" data-period="' + label.toLowerCase() + '">' + label + '</button>').join('') +
    '</div><div class="profile-pager"><button type="button" data-move="-1" aria-label="Previous period">←</button>' +
    '<h3 class="profile-date"></h3><button type="button" data-move="1" aria-label="Next period">→</button></div>' +
    '<div class="profile-period-content"></div><p class="profile-points-status" role="status"></p></section>' +
    '<div class="profile-side">' +
    '<section class="profile-identity" aria-labelledby="profile-name">' +
    '<h1 id="profile-name">Beth</h1><div class="profile-portrait">B</div>' +
    '<div class="profile-actions"><button type="button" aria-expanded="false" aria-controls="profile-avatars" data-choose-avatar>Choose an avatar</button>' +
    '<button type="button" class="profile-photo-button">Add photo</button>' +
    '<button type="button" class="profile-clear" hidden>Remove picture</button>' +
    '<input type="file" id="profile-photo" accept="image/*" aria-label="Profile photo" hidden></div>' +
    '<p class="profile-photo-status" role="status"></p>' +
    '<div id="profile-avatars" hidden><div class="profile-avatar-grid">' + avatars.map(([label, id]) =>
      '<button type="button" data-avatar="' + id + '" aria-pressed="false"><img src="' + avatarUrl(id) +
      '" alt=""><span>' + label + '</span></button>').join('') + '</div>' +
    '<p class="profile-credit">Artwork by OpenMoji · CC BY-SA 4.0</p></div></section>' +
    '<section class="profile-placeholder" aria-labelledby="profile-placeholder-title">' +
    '<h2 id="profile-placeholder-title">Placeholder</h2></section></div></div>';

  const file = el.querySelector('#profile-photo');
  const picker = el.querySelector('#profile-avatars');
  const chooseAvatar = el.querySelector('[data-choose-avatar]');
  const bonusStatus = el.querySelector('.profile-points-status');
  const photoButton = el.querySelector('.profile-photo-button');
  photoButton.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    if (file.files[0]) void loadPhoto(file.files[0]);
    file.value = '';
  });
  el.querySelector('.profile-clear').addEventListener('click', () => {
    if (savePortrait(null)) chooseAvatar.focus();
  });
  el.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === chooseAvatar) {
      picker.hidden = !picker.hidden;
      chooseAvatar.setAttribute('aria-expanded', String(!picker.hidden));
    } else if (button.dataset.avatar) {
      if (savePortrait({ avatar: button.dataset.avatar })) {
        picker.hidden = true;
        chooseAvatar.setAttribute('aria-expanded', 'false');
        chooseAvatar.focus();
      }
    } else if (button.dataset.period || button.dataset.move) {
      bonusStatus.textContent = '';
      if (button.dataset.period) period = button.dataset.period;
      else selectedDate = movePeriod(Number(button.dataset.move));
      render();
    } else if (button.hasAttribute('data-daily-bonus')) {
      if (pocketMoney.dayKey(selectedDate) !== pocketMoney.dayKey()) {
        render();
        return;
      }
      try {
        const added = pocketMoney.addDailyBonus();
        render();
        bonusStatus.textContent = added === null ? 'Today’s bonus limit has been reached.'
          : added === 0 ? 'Bonus saved.' : formatReward(added) + ' bonus added!';
        const nextButton = el.querySelector('[data-daily-bonus]:enabled');
        nextButton?.focus();
      } catch {
        bonusStatus.textContent = 'Could not save this bonus on this device.';
      }
    }
  });
  try {
    showPortrait();
  } catch {
    setPortraitStatus('Could not load your saved picture.');
  }
}

function show(el) {
  view = el;
  if (!el.firstChild) mount(el);
  render();
}

App.register('profile', { show, resume: show });
App.on('minute', () => {
  if (App.current === 'profile' && currentDay !== pocketMoney.dayKey()) render();
});
window.addEventListener('storage', event => {
  if (App.current === 'profile' && (event.key === null || event.key.startsWith(pocketMoney.prefix))) render();
});
