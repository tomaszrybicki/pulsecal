/**
 * Ustawienia aplikacji do kopii zapasowej w Google Calendar (ukryty wpis, patrz sync/google.ts).
 * Źródłem prawdy zostaje localStorage; tu tylko zbieramy/odtwarzamy i pilnujemy, kiedy coś się zmieniło.
 * Nigdy nie zapisujemy tokenu Google ani Client ID.
 */
import { getTagRules, withDefaultRules, type TagRule } from "./tagRules";
import type { WorkField } from "./types";
import { getWorkFields, setWorkFields } from "./work";
import { getMoveThreshold, setMoveThreshold } from "./moves";
import { getProdHours, getSlotMin, setProdHours, setSlotMin } from "./prefs";
import { getPaintTags, getTagColors, reloadPaintTags, reloadTagColors } from "./tags";

export type AppSettings = {
  v: 1;
  hiddenTags: string[];
  tagRules: TagRule[];
  pollSec: number;
  sidebar: boolean;
  theme: string;
  /** Kolory tagów ustawione ręcznie (klucz tagu → #rrggbb). */
  tagColors?: Record<string, string>;
  /** Tagi, których kolor przejmują wpisy. */
  paintTags?: string[];
  /** Po ilu przeniesieniach proponować rozbicie wpisu. */
  moveThreshold?: number;
  /** Własne pola zadań (definicje). */
  workFields?: WorkField[];
  /** Godziny produktywności (minuty od północy) i długość wpisu z „P”. */
  prodFrom?: number;
  prodTo?: number;
  slotMin?: number;
  /** 2 = reguły zawierają już domyślną „!” (starsze kopie jej nie mają). */
  rulesV?: number;
};

export type SettingsBackup = { settings: AppSettings; updatedAt: number };

const K = {
  hidden: "pulsecal:hidden-tags",
  poll: "pulsecal:poll-sec",
  sidebar: "pulsecal:sidebar",
  theme: "pulsecal:theme",
  rules: "pulsecal:tag-rules",
  colors: "pulsecal:tag-colors",
  paint: "pulsecal:tag-paint",
};
/** Ostatnio widziany stan (JSON) — do wykrycia zmian. */
const SEEN = "pulsecal:settings-seen";
/** Kiedy ustawienia zmieniły się lokalnie (0 = nigdy — świeże urządzenie, można odtworzyć bez pytania). */
const UPDATED = "pulsecal:settings-updated";
/** JSON ostatnio zapisany w Google. */
const BACKED = "pulsecal:settings-backed";

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function collectSettings(): AppSettings {
  const poll = Number(localStorage.getItem(K.poll));
  return {
    v: 1,
    hiddenTags: readJson<string[]>(K.hidden, []),
    tagRules: getTagRules(),
    pollSec: Number.isFinite(poll) && poll > 0 ? poll : 30,
    sidebar: localStorage.getItem(K.sidebar) !== "0",
    theme: localStorage.getItem(K.theme) || "auto",
    tagColors: getTagColors(),
    paintTags: getPaintTags(),
    moveThreshold: getMoveThreshold(),
    rulesV: 2,
    workFields: getWorkFields(),
    prodFrom: getProdHours().from,
    prodTo: getProdHours().to,
    slotMin: getSlotMin(),
  };
}

export const settingsJson = (s: AppSettings) => JSON.stringify(s);

export function localUpdatedAt(): number {
  return Number(localStorage.getItem(UPDATED)) || 0;
}

/** Wołać po każdej zmianie ustawień; zwraca aktualny JSON. */
export function noteLocalChange(): string {
  const json = settingsJson(collectSettings());
  const seen = localStorage.getItem(SEEN);
  if (seen === null) {
    localStorage.setItem(SEEN, json); // pierwsze uruchomienie — to nie jest „zmiana użytkownika"
  } else if (seen !== json) {
    localStorage.setItem(SEEN, json);
    localStorage.setItem(UPDATED, String(Date.now()));
  }
  return json;
}

export function needsBackup(json: string): boolean {
  return localStorage.getItem(BACKED) !== json;
}

export function markBackedUp(json: string): void {
  localStorage.setItem(BACKED, json);
}

export function isSettings(x: unknown): x is AppSettings {
  const s = x as AppSettings;
  return Boolean(s) && s.v === 1 && Array.isArray(s.hiddenTags) && Array.isArray(s.tagRules);
}

/** Zapisz ustawienia z kopii lokalnie (potem przeładowanie strony, żeby wszystko je wczytało). */
export function applySettings(b: SettingsBackup): void {
  const s = b.settings;
  localStorage.setItem(K.hidden, JSON.stringify(s.hiddenTags));
  localStorage.setItem(K.rules, JSON.stringify((s.rulesV ?? 1) < 2 ? withDefaultRules(s.tagRules) : s.tagRules));
  localStorage.setItem(K.poll, String(s.pollSec));
  localStorage.setItem(K.sidebar, s.sidebar ? "1" : "0");
  localStorage.setItem(K.theme, s.theme);
  localStorage.setItem(K.colors, JSON.stringify(s.tagColors ?? {}));
  reloadTagColors();
  localStorage.setItem(K.paint, JSON.stringify(s.paintTags ?? []));
  reloadPaintTags();
  if (s.moveThreshold) setMoveThreshold(s.moveThreshold);
  if (Array.isArray(s.workFields)) setWorkFields(s.workFields);
  if (typeof s.prodFrom === "number" && typeof s.prodTo === "number" && s.prodTo > s.prodFrom) {
    setProdHours({ from: s.prodFrom, to: s.prodTo });
  }
  if (s.slotMin) setSlotMin(s.slotMin);
  const json = settingsJson(collectSettings());
  localStorage.setItem(SEEN, json);
  localStorage.setItem(BACKED, json);
  localStorage.setItem(UPDATED, String(b.updatedAt));
}
