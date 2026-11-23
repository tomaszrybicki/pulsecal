/**
 * Grupy w przeglądzie dnia (rozsunięty dzień): „na szybko” (estymata 5 min), wybrane tagi i epiki, „pozostałe”.
 * Kolejność = kolejność wyświetlania; wpis trafia do PIERWSZEJ pasującej grupy, „pozostałe” zbiera resztę.
 * Wyjątek: grupa z pierwszeństwem („focus”, ◉) bierze wszystkie swoje wpisy, nawet gdy wyżej jest inna pasująca.
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
  /** Kolor wybrany ręcznie (#rrggbb); brak = kolor tagu / epiku („auto”). */
  color?: string;
  /** Pierwszeństwo („focus”): wpis pasujący też do innych grup trafia tutaj, bez względu na kolejność. Najwyżej jedna. */
  focus?: boolean;
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
  let focused = false;
  for (const x of raw as Partial<DayGroup>[]) {
    if (!x || typeof x !== "object") continue;
    let g: DayGroup | null = null;
    if (x.kind === "quick") g = { ...QUICK_GROUP };
    else if (x.kind === "rest") g = { ...REST_GROUP };
    else if (x.kind === "tag" && typeof x.key === "string" && x.key.trim()) g = tagGroup(x.key.trim());
    else if (x.kind === "epic" && typeof x.key === "string" && x.key) g = epicGroup(x.key);
    if (!g || seen.has(g.id)) continue;
    if (x.collapsed) g.collapsed = true;
    if (typeof x.color === "string" && /^#[0-9a-f]{6}$/i.test(x.color)) g.color = x.color;
    if (x.focus && !focused && g.kind !== "rest") {
      g.focus = true;
      focused = true;
    }
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

/** Epiki nadrzędne danego epiku (najbliższy pierwszy). */
export type EpicParents = (epicId: string) => readonly string[];

/** Czy wpis należy do grupy; grupa epiku obejmuje też wpisy z jego pod-epików. */
export function inGroup(g: DayGroup, e: CalEvent, parents?: EpicParents): boolean {
  switch (g.kind) {
    case "quick":
      return e.estimate === QUICK_MIN;
    case "tag":
      return hasTag(e.tags ?? [], g.key);
    case "epic":
      return Boolean(e.epicId) && (e.epicId === g.key || (parents?.(e.epicId!).includes(g.key) ?? false));
    default:
      return false;
  }
}

/** Id grupy, do której trafia wpis: grupa z pierwszeństwem, jeśli pasuje; inaczej pierwsza pasująca; inaczej „pozostałe”. */
export function groupOf(e: CalEvent, groups: DayGroup[], parents?: EpicParents): string {
  const focus = groups.find((g) => g.focus);
  if (focus && inGroup(focus, e, parents)) return focus.id;
  return groups.find((g) => inGroup(g, e, parents))?.id ?? REST_GROUP.id;
}

/** Włącz pierwszeństwo tej grupy (wyłącza je w pozostałych) albo wyłącz, jeśli już je ma. */
export function toggleFocus(groups: DayGroup[], id: string): DayGroup[] {
  return groups.map((g) => {
    const { focus: _f, ...rest } = g;
    void _f;
    return g.id === id && !g.focus ? { ...rest, focus: true } : rest;
  });
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
