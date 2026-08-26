export function startOfLocalDay(date: Date = new Date()) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLocalDay(next);
}

export function getTodayDateKey(from: Date = new Date()) {
  return toDateKey(startOfLocalDay(from));
}

export function getTomorrowDateKey(from: Date = new Date()) {
  return toDateKey(addDays(startOfLocalDay(from), 1));
}

export function getNextWeekendSaturdayDate(from: Date = new Date()) {
  const today = startOfLocalDay(from);
  const dayOfWeek = today.getDay();

  if (dayOfWeek === 6) {
    return addDays(today, 7);
  }

  return addDays(today, (6 - dayOfWeek + 7) % 7);
}

export function getNextWeekendSaturdayDateKey(from: Date = new Date()) {
  return toDateKey(getNextWeekendSaturdayDate(from));
}

export function isDueDateToday(dueDate: string | null | undefined) {
  if (!dueDate) return false;

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return false;

  return toDateKey(startOfLocalDay(date)) === getTodayDateKey();
}
