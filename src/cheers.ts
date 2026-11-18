/**
 * Zachęty i mini-osiągnięcia. Po zamknięciu zadania / epiku (status „zrobione”) albo usunięciu wpisu / zadania
 * u góry ekranu na chwilę wyskakuje sprężysty „dymek” („Świetna robota!”, kilka pod rząd → „On fire!”), a za
 * kamienie milowe — osiągnięcie (lista w ustawieniach → „osiągnięcia”). Dymek nie łapie kliknięć.
 * Liczniki i zdobyte osiągnięcia tylko na tym urządzeniu (localStorage), bez kopii w Google.
 */
import { addDays, isoDate } from "./time";

export type WinKind = "done" | "delete";
export type WinSource = "event" | "task" | "epic";
export type Win = { kind: WinKind; source: WinSource };

export type CheerMode = "all" | "awards" | "off";
export const CHEER_MODES: [CheerMode, string][] = [
  ["all", "wszystko"],
  ["awards", "tylko osiągnięcia"],
  ["off", "nic"],
];

export type CheerTone = "done" | "del" | "fire" | "epic";

export type Cheer = {
  id: number;
  /** null = same osiągnięcia (tryb „tylko osiągnięcia”). */
  text: string | null;
  tone: CheerTone;
  /** Ile pod rząd (bez dłuższej przerwy). */
  combo: number;
  unlocked: Achievement[];
};

export type Stats = {
  v: 1;
  total: number;
  done: number;
  deleted: number;
  epics: number;
  bestCombo: number;
  /** Dzień (yyyy-mm-dd) i liczba zamknięć / usunięć tego dnia. */
  day: string;
  dayWins: number;
  /** Seria dni pod rząd z czymś zamkniętym / usuniętym. */
  lastDay: string;
  dayStreak: number;
  bestDayStreak: number;
  early: number;
  night: number;
  /** id osiągnięcia → kiedy zdobyte (ms). */
  unlocked: Record<string, number>;
};

export type Achievement = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** Ukryte: w ustawieniach „???”, dopóki nie zdobyte. */
  secret?: boolean;
  /** [ile jest, ile trzeba]. */
  goal: (s: Stats) => [number, number];
};

const todayWins = (s: Stats) => (s.day === isoDate(new Date()) ? s.dayWins : 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", icon: "🌱", name: "Pierwszy krok", desc: "Zamknij albo usuń pierwsze zadanie lub wpis.", goal: (s) => [s.total, 1] },
  { id: "day5", icon: "☕", name: "Rozgrzewka", desc: "5 zamkniętych albo usuniętych jednego dnia.", goal: (s) => [todayWins(s), 5] },
  { id: "day10", icon: "💪", name: "Dzień konkretów", desc: "10 jednego dnia.", goal: (s) => [todayWins(s), 10] },
  { id: "combo3", icon: "🔥", name: "On fire", desc: "3 pod rząd, bez dłuższej przerwy (do 2 minut między nimi).", goal: (s) => [s.bestCombo, 3] },
  { id: "combo7", icon: "⚡", name: "Nie do zatrzymania", desc: "7 pod rząd.", goal: (s) => [s.bestCombo, 7] },
  { id: "done10", icon: "✅", name: "Domykacz", desc: "10 zamkniętych zadań.", goal: (s) => [s.done, 10] },
  { id: "done50", icon: "🚀", name: "Maszyna", desc: "50 zamkniętych zadań.", goal: (s) => [s.done, 50] },
  { id: "epic", icon: "🏔️", name: "Epicko!", desc: "Zamknij cały epik.", goal: (s) => [s.epics, 1] },
  { id: "clean10", icon: "🧹", name: "Porządki", desc: "Usuń 10 wpisów albo zadań.", goal: (s) => [s.deleted, 10] },
  { id: "clean50", icon: "🪴", name: "Minimalista", desc: "Usuń 50 wpisów albo zadań.", goal: (s) => [s.deleted, 50] },
  { id: "streak3", icon: "📅", name: "Trzy dni z rzędu", desc: "Coś zamknięte albo usunięte 3 dni pod rząd.", goal: (s) => [s.bestDayStreak, 3] },
  { id: "streak7", icon: "🌈", name: "Tydzień w rytmie", desc: "7 dni pod rząd.", goal: (s) => [s.bestDayStreak, 7] },
  { id: "hundred", icon: "💯", name: "Setka", desc: "100 zamkniętych albo usuniętych łącznie.", goal: (s) => [s.total, 100] },
  { id: "early", icon: "🐦", name: "Ranny ptaszek", desc: "Zamknij albo usuń coś między 4:00 a 7:00.", secret: true, goal: (s) => [s.early, 1] },
  { id: "night", icon: "🌙", name: "Nocna zmiana", desc: "Zamknij albo usuń coś po 23:00.", secret: true, goal: (s) => [s.night, 1] },
];

const STATS = "pulsecal:wins";
const MODE = "pulsecal:cheers";
/** Maks. przerwa między kolejnymi, żeby liczyły się „pod rząd”. */
const COMBO_MS = 2 * 60_000;

const fresh = (): Stats => ({
  v: 1,
  total: 0,
  done: 0,
  deleted: 0,
  epics: 0,
  bestCombo: 0,
  day: "",
  dayWins: 0,
  lastDay: "",
  dayStreak: 0,
  bestDayStreak: 0,
  early: 0,
  night: 0,
  unlocked: {},
});

export function getStats(): Stats {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS) ?? "null") as Partial<Stats> | null;
    return raw && raw.v === 1 ? { ...fresh(), ...raw, unlocked: { ...(raw.unlocked ?? {}) } } : fresh();
  } catch {
    return fresh();
  }
}

function saveStats(s: Stats): void {
  try {
    localStorage.setItem(STATS, JSON.stringify(s));
  } catch {
    /* prywatne okno — liczy się tylko w tej sesji */
  }
}

export function getCheerMode(): CheerMode {
  try {
    const v = localStorage.getItem(MODE);
    return v === "awards" || v === "off" ? v : "all";
  } catch {
    return "all";
  }
}

export function setCheerMode(m: CheerMode): void {
  try {
    localStorage.setItem(MODE, m);
  } catch {
    /* prywatne okno */
  }
}

export const reached = (a: Achievement, s: Stats): boolean => {
  const [n, need] = a.goal(s);
  return n >= need;
};

const DONE = ["Świetna robota!", "Brawo!", "Odhaczone!", "Tak trzymać!", "Jedno mniej!", "Super!", "Zrobione!"];
const DEL = ["Porządek!", "Jedno mniej!", "Lżej!", "Mniej na głowie!", "Czyściej!", "Wyrzucone!"];
const TWO = ["Dwa z rzędu!", "Rozkręcasz się!"];
const FIRE = ["On fire! 🔥"];
const UNSTOPPABLE = ["Nie do zatrzymania!", "Lecisz! 🔥"];
const TURBO = ["Tryb turbo! ⚡", "Legenda! ⚡"];

let lastText = "";
function pick(list: string[]): string {
  const pool = list.length > 1 ? list.filter((t) => t !== lastText) : list;
  lastText = pool[Math.floor(Math.random() * pool.length)];
  return lastText;
}

function message(w: Win, combo: number): { text: string; tone: CheerTone } {
  if (w.kind === "done" && w.source === "epic") return { text: "Epik zamknięty! 🏔️", tone: "epic" };
  if (combo >= 7) return { text: pick(TURBO), tone: "fire" };
  if (combo >= 5) return { text: pick(UNSTOPPABLE), tone: "fire" };
  if (combo >= 3) return { text: pick(FIRE), tone: "fire" };
  const tone: CheerTone = w.kind === "done" ? "done" : "del";
  if (combo === 2) return { text: pick(TWO), tone };
  return { text: pick(w.kind === "done" ? DONE : DEL), tone };
}

type Listener = (c: Cheer) => void;
const listeners = new Set<Listener>();

/** Komponent `Cheers` słucha tu nowych dymków. */
export function onCheer(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let seq = 0;
let combo = 0;
let lastWin = 0;

/** Zamknięte / usunięte: policz, sprawdź osiągnięcia i pokaż dymek (wg ustawienia „zachęty”). */
export function recordWin(w: Win, now = new Date()): void {
  const s = getStats();
  const t = now.getTime();
  const today = isoDate(now);
  s.total += 1;
  if (w.kind === "done") {
    s.done += 1;
    if (w.source === "epic") s.epics += 1;
  } else {
    s.deleted += 1;
  }
  if (s.day !== today) {
    s.day = today;
    s.dayWins = 0;
  }
  s.dayWins += 1;
  if (s.lastDay !== today) {
    s.dayStreak = s.lastDay === isoDate(addDays(now, -1)) ? s.dayStreak + 1 : 1;
    s.lastDay = today;
    s.bestDayStreak = Math.max(s.bestDayStreak, s.dayStreak);
  }
  combo = t - lastWin <= COMBO_MS ? combo + 1 : 1;
  lastWin = t;
  s.bestCombo = Math.max(s.bestCombo, combo);
  const h = now.getHours();
  if (h >= 4 && h < 7) s.early += 1;
  if (h >= 23 || h < 4) s.night += 1;
  const unlocked = ACHIEVEMENTS.filter((a) => !s.unlocked[a.id] && reached(a, s));
  for (const a of unlocked) s.unlocked[a.id] = t;
  saveStats(s);

  const mode = getCheerMode();
  if (mode === "off" || (mode === "awards" && !unlocked.length)) return;
  const m = message(w, combo);
  const cheer: Cheer = { id: ++seq, text: mode === "all" ? m.text : null, tone: m.tone, combo, unlocked };
  for (const fn of listeners) fn(cheer);
}
