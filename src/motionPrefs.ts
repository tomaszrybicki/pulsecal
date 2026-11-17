/**
 * Animacje: „pełne” (sprężyste, jak dawniej), „szybkie” (domyślne: te same sprężyny, ale ~2,4× szybciej
 * i bez czekania z treścią), „minimalne” (jak szybkie, ale przegląd dnia otwiera się od razu) albo
 * „wyłączone” (wszystko od razu — framer-motion pomija animacje, CSS bez animacji i przejść). Ustawienie tylko na tym urządzeniu (telefon i komputer mogą się różnić).
 */
import { MotionGlobalConfig } from "framer-motion";

export type AnimMode = "full" | "fast" | "min" | "off";

export const ANIM_MODES: [AnimMode, string][] = [
  ["full", "pełne"],
  ["fast", "szybkie"],
  ["min", "minimalne"],
  ["off", "wyłączone"],
];

const KEY = "pulsecal:anim";
const DEFAULT_MODE: AnimMode = "fast";
/** O ile szybciej w trybie „szybkie”. */
const FAST = 2.4;

function read(): AnimMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "full" || v === "fast" || v === "min" || v === "off" ? v : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

let mode: AnimMode = read();

export const getAnimMode = (): AnimMode => mode;

/** Animacje wyłączone: `initial={false}` — element od razu w stanie końcowym, bez czekania na klatkę. */
export const animOff = (): boolean => mode === "off";

/** Wołać raz na starcie (main.tsx) i po każdej zmianie. */
export function applyAnimMode(): void {
  MotionGlobalConfig.skipAnimations = mode === "off";
  document.documentElement.dataset.anim = mode;
}

export function setAnimMode(next: AnimMode): void {
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* prywatne okno — zostaje na tę sesję */
  }
  applyAnimMode();
}

type Transition = {
  type?: "spring" | "tween";
  stiffness?: number;
  damping?: number;
  mass?: number;
  duration?: number;
  delay?: number;
  ease?: "easeIn" | "easeOut" | "easeInOut" | "linear";
};

/**
 * Przejście framer-motion wg ustawienia. „Szybkie”: sprężyna z tym samym „odbiciem”, ale krótsza
 * (sztywność ×k², tłumienie ×k), czasy ÷k, bez opóźnień. „Wyłączone”: od razu.
 */
export function tr<T extends Transition>(t: T): T {
  if (mode === "off") return { duration: 0 } as T;
  if (mode === "full") return t;
  const o = { ...t };
  if (typeof o.stiffness === "number") o.stiffness *= FAST * FAST;
  if (typeof o.damping === "number") o.damping *= FAST;
  if (typeof o.duration === "number") o.duration /= FAST;
  if (typeof o.delay === "number") o.delay = 0;
  return o;
}

/** Przegląd dnia bez animacji: przy „wyłączone” i „minimalne” (rozsunięty dzień od razu, reszta animacji zostaje). */
export const dayInstant = (): boolean => mode === "off" || mode === "min";

/** Przejście dla przeglądu dnia: od razu przy „minimalne” / „wyłączone”, inaczej jak `tr()`. */
export function trDay<T extends Transition>(t: T): T {
  return dayInstant() ? ({ duration: 0 } as T) : tr(t);
}
