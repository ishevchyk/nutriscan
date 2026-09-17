export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateStr: string, delta: number): string {
  const d = fromISODate(dateStr);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

export function isToday(dateStr: string): boolean {
  return dateStr === toISODate(new Date());
}

const WEEKDAY_MONTH_DAY = { weekday: 'short', month: 'short', day: 'numeric' } as const;

export function formatDateLabel(dateStr: string): string {
  if (isToday(dateStr)) return 'Today';
  return fromISODate(dateStr).toLocaleDateString(undefined, WEEKDAY_MONTH_DAY);
}

export function getYearMonth(dateStr: string): { year: number; month: number } {
  const [year, month] = dateStr.split('-').map(Number);
  return { year, month };
}

export function makeISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 (Monday) - 6 (Sunday) for the 1st of the month, since the tracker calendar's week starts Monday. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay(); // 0 (Sun) - 6 (Sat)
  return (jsDay + 6) % 7;
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1)
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    .toUpperCase();
}
