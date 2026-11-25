const storageKey = 'dashboard-today-message-v1';
const londonDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
});

export const todayMessageLimit = 500;

export function todayMessageDate(now = new Date()) {
  const { year, month, day } = Object.fromEntries(
    londonDate.formatToParts(now).map(part => [part.type, part.value])
  );
  return year + '-' + month + '-' + day;
}

export function readTodayMessage(date = todayMessageDate()) {
  try {
    const message = JSON.parse(localStorage.getItem(storageKey));
    if (message?.date === date && typeof message.text === 'string') return message.text;
  } catch {
    // The card stays hidden when there is no readable message.
  }
  return '';
}

export function saveTodayMessage(text, date) {
  text = text.trim();
  if (text.length > todayMessageLimit) throw new Error('Keep the message to 500 characters.');
  if (text) localStorage.setItem(storageKey, JSON.stringify({ date, text }));
  else localStorage.removeItem(storageKey);
}
