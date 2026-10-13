const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const longDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function formatTime(timestamp: number): string {
  return timeFormatter.format(timestamp);
}

/** Время последнего сообщения в списке чатов. */
export function formatChatListTime(timestamp: number, now = Date.now()): string {
  const daysAgo = (startOfDay(now) - startOfDay(timestamp)) / DAY_MS;
  if (daysAgo === 0) return formatTime(timestamp);
  if (daysAgo < 7) return weekdayFormatter.format(timestamp);
  return shortDateFormatter.format(timestamp);
}

/** Разделитель дат в ленте сообщений. */
export function formatDayDivider(timestamp: number, now = Date.now()): string {
  const daysAgo = (startOfDay(now) - startOfDay(timestamp)) / DAY_MS;
  if (daysAgo === 0) return 'Сегодня';
  if (daysAgo === 1) return 'Вчера';
  return longDateFormatter.format(timestamp).replace(/\s*г\.$/, '');
}
