/**
 * Licznik przeniesień: ile razy wpis trafił na inny dzień (przeciągnięcie, „>”/„>>”, zmiana daty w edycji,
 * przeniesienie w Google). Zmiana godziny w tym samym dniu się nie liczy.
 * Po każdych N przeniesieniach (ustawienie, domyślnie 10) proponujemy rozbicie wpisu na mniejsze kroki.
 */
import type { CalEvent } from "./types";
import { sameDay } from "./time";

const THRESHOLD_KEY = "pulsecal:move-threshold";
export const DEFAULT_MOVE_THRESHOLD = 10;

export function getMoveThreshold(): number {
  const v = Number(localStorage.getItem(THRESHOLD_KEY));
  return Number.isFinite(v) && v >= 2 ? Math.round(v) : DEFAULT_MOVE_THRESHOLD;
}

export function setMoveThreshold(n: number): void {
  localStorage.setItem(THRESHOLD_KEY, String(n));
}

/** Nowa wartość licznika po zmianie startu wpisu. */
export function countMove(prev: Pick<CalEvent, "start" | "moves">, nextStart: number): number {
  const n = prev.moves ?? 0;
  return sameDay(new Date(prev.start), new Date(nextStart)) ? n : n + 1;
}

/** Czy ten krok licznika (prev → next) przekroczył próg (10, 20, 30… przy progu 10). */
export function crossesThreshold(prev: number, next: number, threshold = getMoveThreshold()): boolean {
  return next > prev && next >= threshold && Math.floor(next / threshold) > Math.floor(prev / threshold);
}
