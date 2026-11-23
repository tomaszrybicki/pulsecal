/**
 * Licznik przeniesień: ile razy wpis trafił na inny dzień (przeciągnięcie, „>”/„>>”, zmiana daty w edycji,
 * przeniesienie w Google). Zmiana godziny w tym samym dniu się nie liczy.
 * Co N przeniesień (ustawienie, domyślnie 10) proponujemy rozbicie wpisu na mniejsze kroki: N liczymy od
 * ostatniej podpowiedzi (`nudgedAt`), więc po niej wpis można znowu przenieść N razy. `nudgeOff` = nie pytaj.
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

type MoveState = Pick<CalEvent, "start" | "moves" | "nudgedAt" | "nudgeOff">;

/**
 * Przeniesienie wpisu: nowy licznik i czy pokazać podpowiedź. Podpowiedź wypada, gdy od ostatniej minęło
 * N przeniesień (wpisy sprzed `nudgedAt` liczą od ostatniej wielokrotności N, jak dawniej).
 */
export function moveStep(prev: MoveState, nextStart: number, threshold = getMoveThreshold()): { moves: number; nudge: boolean } {
  const before = prev.moves ?? 0;
  const moves = countMove(prev, nextStart);
  if (prev.nudgeOff || moves <= before) return { moves, nudge: false };
  const base = Math.min(prev.nudgedAt ?? Math.floor(before / threshold) * threshold, before);
  return { moves, nudge: moves - base >= threshold };
}

/** Pola licznika do zapisania razem z przeniesieniem (z podpowiedzią zapamiętujemy, przy którym była). */
export function moveFields(step: { moves: number; nudge: boolean }): Pick<CalEvent, "moves"> & { nudgedAt?: number } {
  return step.nudge ? { moves: step.moves, nudgedAt: step.moves } : { moves: step.moves };
}
