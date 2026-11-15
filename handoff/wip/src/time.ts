const WEEKDAY = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const MONTH = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];
const MONTH_GEN = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const WEEKDAY_LABELS = WEEKDAY;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Liczba dni kalendarzowych między dwiema datami (odporna na zmianę czasu). */
export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export function weekdayLabel(d: Date): string {
  const i = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return WEEKDAY[i];
}

export function monthLabel(d: Date): string {
  return `${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

export function longDateLabel(d: Date): string {
  return `${weekdayLabel(d)}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatClock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDayHeading(d: Date): string {
  return `${weekdayLabel(d)} ${d.getDate()}`;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / MINUTE);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function atMinutes(day: Date, minutes: number): Date {
  const x = startOfDay(day);
  x.setMinutes(minutes);
  return x;
}

/** Najbliższy kolejny kwadrans (np. 10:07 → 10:15). */
export function nextQuarter(from = new Date()): Date {
  const x = new Date(from);
  x.setSeconds(0, 0);
  const m = x.getMinutes();
  x.setMinutes(Math.ceil((m + 1) / 15) * 15);
  return x;
}

export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateInput(ts: number): string {
  return isoDate(new Date(ts));
}

/** Parsuje wartość z <input type="datetime-local"> / "date"; zwraca null dla pustej/niepoprawnej. */
export function parseLocalInput(value: string): number | null {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const t = new Date(y, mo - 1, d, h || 0, mi || 0).getTime();
  return Number.isFinite(t) ? t : null;
}

export function dayRange(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Data z "YYYY-MM-DD" jako lokalna północ (new Date("YYYY-MM-DD") daje UTC!). */
export function fromIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
