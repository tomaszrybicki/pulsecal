/**
 * Ustawienia z arkusza „ustawienia” (odnośnik na dole panelu bocznego):
 * godziny produktywności i długość wpisu planowanego przyciskiem „P”, pełna edycja po kliknięciu wpisu.
 * Godziny i długość są w kopii ustawień w Google; „pełna edycja” jest osobna na każdym urządzeniu.
 */
import type { CalEvent } from "./types";
import { MINUTE, sameDay, startOfDay } from "./time";

/** Minuty od północy. */
export type ProdHours = { from: number; to: number };

export const DEFAULT_HOURS: ProdHours = { from: 9 * 60, to: 17 * 60 };
export const DEFAULT_SLOT_MIN = 15;

const K = {
  from: "pulsecal:prod-from",
  to: "pulsecal:prod-to",
  slot: "pulsecal:slot-min",
  full: "pulsecal:always-full",
};

function readNum(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function write(key: string, v: string): void {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* prywatne okno — zostaje na tę sesję */
  }
}

export function getProdHours(): ProdHours {
  const from = readNum(K.from);
  const to = readNum(K.to);
  if (from === null || to === null || from < 0 || to > 24 * 60 || to <= from) return DEFAULT_HOURS;
  return { from, to };
}

export function setProdHours(h: ProdHours): void {
  write(K.from, String(h.from));
  write(K.to, String(h.to));
}

export function getSlotMin(): number {
  const v = readNum(K.slot);
  return v !== null && v >= 5 && v <= 240 ? Math.round(v) : DEFAULT_SLOT_MIN;
}

export function setSlotMin(n: number): void {
  write(K.slot, String(n));
}

export function getAlwaysFull(): boolean {
  try {
    return localStorage.getItem(K.full) === "1";
  } catch {
    return false;
  }
}

export function setAlwaysFull(on: boolean): void {
  write(K.full, on ? "1" : "0");
}

/** „9:00” z minut od północy. */
export function minutesLabel(m: number): string {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

const STEP = 5 * MINUTE;

/**
 * Najwcześniejszy wolny początek (epoch ms) w godzinach produktywności danego dnia, w którym zmieści się
 * `dur` ms bez nachodzenia na wpisy z godziną. Dziś — nie wcześniej niż teraz (zaokrąglone do 5 min).
 * null = brak miejsca.
 */
export function findFreeSlot(
  dayEvents: CalEvent[],
  day: Date,
  dur: number,
  now: number,
  hours: ProdHours,
  excludeId?: string,
): number | null {
  const base = startOfDay(day).getTime();
  const end = base + hours.to * MINUTE;
  let t = base + hours.from * MINUTE;
  if (sameDay(day, new Date(now))) t = Math.max(t, Math.ceil(now / STEP) * STEP);
  const busy = dayEvents
    .filter((e) => !e.allDay && !e.deleted && e.id !== excludeId && e.end > t && e.start < end)
    .sort((a, b) => a.start - b.start);
  for (const b of busy) {
    if (b.end <= t) continue;
    if (b.start >= t + dur) break;
    t = Math.max(t, b.end);
  }
  return t + dur <= end ? t : null;
}
