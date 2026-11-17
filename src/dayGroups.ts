/**
 * Grupy w przeglądzie dnia (rozsunięty dzień): „na szybko” (estymata 5 min), wybrane tagi i epiki, „pozostałe”.
 * Kolejność = kolejność wyświetlania; wpis trafia do PIERWSZEJ pasującej grupy, „pozostałe” zbiera resztę.
 * Zapis w localStorage + w kopii ustawień w Google (settings.ts).
 */
import { ESTIMATES } from "./estimate";
import { hasTag, tagKey } from "./tags";
import type { CalEvent } from "./types";

export type DayGroupKind = "quick" | "rest" | "tag" | "epic";

export type DayGroup = {
  /** "quick", "rest", "tag:<tagKey>", "epic:<id epiku>" */
  id: string;
  kind: DayGroupKind;
  /** Tag (tak, jak wpisany) albo id epiku; "" dla „quick” i „rest”. */
  key: string;
  /** Zwinięta: widać tylko nagłówek. */
  collapsed?: boolean;
};

/** Najkrótsza estymata (5 min) — grupa „na szybko”. */
export const QUICK_MIN = ESTIMATES[0];

export const QUICK_GROUP: DayGroup = { id: "quick", kind: "quick", key: "" };
export const REST_GROUP: DayGroup = { id: "rest", kind: "rest", key: "" };
const DEFAULT_GROUPS: DayGroup[] = [QUICK_GROUP, REST_GROUP];

const KEY = "pulsecal:day-groups";

export const tagGroup = (tag: string): DayGroup => ({ id: `tag:${tagKey(tag)}`, kind: "tag", key: tag });
export const epicGroup = (id: string): DayGroup => ({ id: `epic:${id}`, kind: "epic", key: id });

/** Poprawna lista: znane rodzaje, bez duplikatów, „pozostałe” zawsze jest. */
export function cleanGroups(raw: unknown): DayGroup[] {
  if (!Array.isArray(raw)) return DEFAULT_GROUPS;
  const out: DayGroup[] = [];
  const seen = new Set<string>();
  for (const x of raw as Partial<DayGroup>[]) {
    if (!x || typeof x !== "object") continue;
    let g: DayGroup | null = null;
    if (x.kind === "quick") g = { ...QUICK_GROUP };
    else if (x.kind === "rest") g = { ...REST_GROUP };
    else if (x.kind === "tag" && typeof x.key === "string" && x.key.trim()) g = tagGroup(x.key.trim());
    else if (x.kind === "epic" && typeof x.key === "string" && x.key) g = epicGroup(x.key);
    if (!g || seen.has(g.id)) continue;
    if (x.collapsed) g.collapsed = true;
    seen.add(g.id);
    out.push(g);
  }
  if (!seen.has("rest")) out.push({ ...REST_GROUP });
  return out;
}

export function getDayGroups(): DayGroup[] {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? DEFAULT_GROUPS : cleanGroups(JSON.parse(v));
  } catch {
    return DEFAULT_GROUPS;
  }
}

export function setDayGroups(groups: DayGroup[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cleanGroups(groups)));
  } catch {
    /* prywatne okno — zostaje na tę sesję */
  }
}

export function inGroup(g: DayGroup, e: CalEvent): boolean {
  switch (g.kind) {
    case "quick":
      return e.estimate === QUICK_MIN;
    case "tag":
      return hasTag(e.tags ?? [], g.key);
    case "epic":
      return e.epicId === g.key;
    default:
      return false;
  }
}

/** Id grupy, do której trafia wpis (pierwsza pasująca, inaczej „pozostałe”). */
export function groupOf(e: CalEvent, groups: DayGroup[]): string {
  return groups.find((g) => inGroup(g, e))?.id ?? REST_GROUP.id;
}

/**
 * Nowa kolejność po przeciągnięciu widocznych grup: widoczne zajmują swoje dotychczasowe miejsca na liście
 * (w nowej kolejności), niewidoczne (bez wpisów tego dnia) zostają tam, gdzie były.
 */
export function reorderVisible(groups: DayGroup[], visibleOrder: string[]): DayGroup[] {
  const vis = new Set(visibleOrder);
  const byId = new Map(groups.map((g) => [g.id, g]));
  const queue = visibleOrder.filter((id) => byId.has(id));
  return groups.map((g) => (vis.has(g.id) ? byId.get(queue.shift() ?? g.id)! : g));
}
