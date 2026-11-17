/**
 * Zadania i epiki — prosta „jira” do spraw osobistych.
 * Epik grupuje zadania i inne epiki; zadanie może mieć wpis w kalendarzu (eventId / seriesId, links.ts).
 * Lokalnie tabela `items` (Dexie), kopia w Google jako ukryte wpisy 2.01.2000 (sync/google.ts).
 */
import { db, newEventId } from "./db";
import { addDays, formatClock, formatDayShort, sameDay } from "./time";
import type { CalEvent, Priority, WorkField, WorkItem, WorkKind, WorkStatus } from "./types";

export const STATUSES: WorkStatus[] = ["todo", "doing", "done"];

export const STATUS_LABEL: Record<WorkStatus, string> = {
  todo: "do zrobienia",
  doing: "w toku",
  done: "zrobione",
};

export const KIND_LABEL: Record<WorkKind, string> = { epic: "epik", task: "zadanie" };

export function nextStatus(s: WorkStatus): WorkStatus {
  return STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length];
}

export const PRIORITIES: Priority[] = ["highest", "high", "medium", "low", "lowest"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  highest: "najwyższy",
  high: "wysoki",
  medium: "średni",
  low: "niski",
  lowest: "najniższy",
};

export const PRIORITY_ICON: Record<Priority, string> = {
  highest: "⇈",
  high: "↑",
  medium: "=",
  low: "↓",
  lowest: "⇊",
};

export const priorityOf = (i: WorkItem): Priority => i.priority ?? "medium";

/** Klucz jak w Jira: „PC-12”. */
export const KEY_PREFIX = "PC";
export const itemKey = (i: WorkItem): string => (i.num ? `${KEY_PREFIX}-${i.num}` : "");

export function nextNum(items: Iterable<WorkItem>): number {
  let max = 0;
  for (const i of items) max = Math.max(max, i.num ?? 0);
  return max + 1;
}

export function newItem(kind: WorkKind, title: string, parentId = "", num?: number): WorkItem {
  const now = Date.now();
  return {
    num,
    priority: "medium",
    id: newEventId(),
    kind,
    title: title.trim(),
    description: "",
    status: "todo",
    parentId,
    order: now,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    pending: 1,
  };
}

/** Każda lokalna zmiana zadania/epiku → do wysłania (kopia w Google). */
export async function saveItem(item: WorkItem): Promise<void> {
  await db.items.put({ ...item, pending: 1, updatedAt: Date.now() });
}

/** Stały kolor epiku (z ID, więc nie zmienia się po zmianie nazwy). */
export function epicColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 52% 52%)`;
}

export type Tree = {
  byId: Map<string, WorkItem>;
  /** parentId ("" = najwyższy poziom) → dzieci, posortowane: epiki, potem zadania, w kolejności dodania. */
  children: Map<string, WorkItem[]>;
  /** ID zadania → powiązane wpisy z kalendarza (jeden wpis albo wystąpienia serii), po kolei. */
  events: Map<string, CalEvent[]>;
};

export function buildTree(items: WorkItem[], events: CalEvent[]): Tree {
  const byId = new Map(items.map((i) => [i.id, i]));
  const children = new Map<string, WorkItem[]>();
  for (const i of items) {
    // rodzic usunięty albo nieznany → najwyższy poziom
    const p = i.parentId && byId.has(i.parentId) ? i.parentId : "";
    const list = children.get(p);
    if (list) list.push(i);
    else children.set(p, [i]);
  }
  for (const list of children.values()) {
    list.sort((a, b) => (a.kind === b.kind ? a.order - b.order : a.kind === "epic" ? -1 : 1));
  }
  const byEvent = new Map<string, string>();
  const bySeries = new Map<string, string>();
  for (const i of items) {
    if (i.eventId) byEvent.set(i.eventId, i.id);
    if (i.seriesId) bySeries.set(i.seriesId, i.id);
  }
  const evs = new Map<string, CalEvent[]>();
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const tid = byEvent.get(e.id) ?? (e.seriesId ? bySeries.get(e.seriesId) : undefined);
    if (!tid) continue;
    const list = evs.get(tid);
    if (list) list.push(e);
    else evs.set(tid, [e]);
  }
  for (const list of evs.values()) list.sort((a, b) => a.start - b.start);
  return { byId, children, events: evs };
}

export type Progress = {
  tasksDone: number;
  tasks: number;
  /** wpisy z kalendarza: „odbyte” = już się skończyły */
  eventsDone: number;
  events: number;
  done: number;
  total: number;
};

/** Postęp epiku: zrobione zadania w nim i we wszystkich jego pod-epikach (wpisy z kalendarza są zadaniami). */
export function progressOf(id: string, tree: Tree, now: number, seen = new Set<string>()): Progress {
  const p: Progress = { tasksDone: 0, tasks: 0, eventsDone: 0, events: 0, done: 0, total: 0 };
  if (seen.has(id)) return p;
  seen.add(id);
  for (const c of tree.children.get(id) ?? []) {
    if (c.kind === "task") {
      p.tasks += 1;
      if (c.status === "done") p.tasksDone += 1;
    } else {
      const sub = progressOf(c.id, tree, now, seen);
      p.tasks += sub.tasks;
      p.tasksDone += sub.tasksDone;
      p.events += sub.events;
      p.eventsDone += sub.eventsDone;
    }
  }
  void now;
  p.done = p.tasksDone + p.eventsDone;
  p.total = p.tasks + p.events;
  return p;
}

/** Ostatnia zmiana w epiku: on sam i wszystko pod nim (zadania, pod-epiki). */
export function lastTouched(id: string, tree: Tree): number {
  let t = 0;
  for (const x of subtreeIds(id, tree)) t = Math.max(t, tree.byId.get(x)?.updatedAt ?? 0);
  return t;
}

/** Epik „śpi”, gdy nic się w nim nie zmieniło od tylu dni. */
export const SLEEPY_DAYS = 7;
/** Epik „prawie gotowy” (pulsuje) od tego udziału zrobionych zadań. */
export const ALMOST_DONE = 0.8;

/** Kolor paska postępu: od koralowego (0%) przez żółty do zielonego (100%). */
export function progressColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  return `hsl(${Math.round(8 + 130 * r)} 62% ${Math.round(56 - 8 * r)}%)`;
}

/** Status zadania z jednym wpisem, dopóki nie zmienisz go ręcznie: „zrobione” po zakończeniu wpisu. */
export function autoStatus(e: Pick<CalEvent, "end">, now: number): WorkStatus {
  return e.end < now ? "done" : "todo";
}

/** Krótko, kiedy jest wpis zadania: „dziś 14:00”, „jutro”, „18 lis 9:30”. */
export function whenShort(e: Pick<CalEvent, "start" | "allDay">, now: number): string {
  const d = new Date(e.start);
  const today = new Date(now);
  const day = sameDay(d, today) ? "dziś" : sameDay(d, addDays(today, 1)) ? "jutro" : formatDayShort(d);
  return e.allDay ? day : `${day} ${formatClock(d)}`;
}

/** Ile czasu zostało w epiku wg estymat wpisów niezrobionych zadań (z pod-epikami). */
export function remainingEstimate(id: string, tree: Tree, now: number, seen = new Set<string>()): { minutes: number; tasks: number } {
  const r = { minutes: 0, tasks: 0 };
  if (seen.has(id)) return r;
  seen.add(id);
  for (const c of tree.children.get(id) ?? []) {
    if (c.kind === "epic") {
      const sub = remainingEstimate(c.id, tree, now, seen);
      r.minutes += sub.minutes;
      r.tasks += sub.tasks;
    } else if (c.status !== "done") {
      const est = taskWhen(c.id, tree, now)?.estimate;
      if (est) {
        r.minutes += est;
        r.tasks += 1;
      }
    }
  }
  return r;
}

/** Wpis zadania do pokazania: najbliższy jeszcze niezakończony (seria), inaczej ostatni. */
export function taskWhen(id: string, tree: Tree, now: number): CalEvent | undefined {
  const list = tree.events.get(id);
  if (!list?.length) return undefined;
  return list.find((e) => e.end >= now) ?? list[list.length - 1];
}

/** Stałe ID zadania dla wpisu / serii (32 znaki hex) — to samo na każdym urządzeniu, więc bez duplikatów. */
export function linkedTaskId(key: string): string {
  let h1 = 0x6a09e667,
    h2 = 0xbb67ae85,
    h3 = 0x3c6ef372,
    h4 = 0xa54ff53a;
  for (let i = 0; i < key.length; i++) {
    const k = key.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [h1 ^ h2 ^ h3 ^ h4, h2 ^ h1, h3 ^ h1, h4 ^ h1].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/** ID elementu i wszystkich jego potomków (żeby nie wstawić epiku do samego siebie). */
export function subtreeIds(id: string, tree: Tree): Set<string> {
  const out = new Set<string>([id]);
  const walk = (x: string) => {
    for (const c of tree.children.get(x) ?? []) {
      if (out.has(c.id)) continue;
      out.add(c.id);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

/** „Remont › Kuchnia” — ścieżka epiku od góry. */
/** Id nadrzędnych elementów (rodzic, dziadek, …), bez pętli. */
export function ancestorIds(id: string, byId: Map<string, WorkItem>): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parentId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = byId.get(cur)?.parentId;
  }
  return out;
}

export function epicPath(id: string, byId: Map<string, WorkItem>): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.title || "(bez nazwy)");
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.join(" › ");
}

/** Epiki do wyboru w polach „Epik” (ze ścieżką, alfabetycznie). */
export function epicOptions(tree: Tree, exclude?: Set<string>): { id: string; label: string }[] {
  return [...tree.byId.values()]
    .filter((i) => i.kind === "epic" && !exclude?.has(i.id))
    .map((i) => ({ id: i.id, label: epicPath(i.id, tree.byId) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pl"));
}

/* ── własne pola ── */

const FIELDS_KEY = "pulsecal:work-fields";

export function getWorkFields(): WorkField[] {
  try {
    const v = JSON.parse(localStorage.getItem(FIELDS_KEY) || "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((f): f is WorkField => f && typeof f.id === "string" && typeof f.name === "string")
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type === "number" || f.type === "select" ? f.type : "text",
        options: Array.isArray(f.options) ? f.options.filter((o) => typeof o === "string") : [],
      }));
  } catch {
    return [];
  }
}

export function setWorkFields(fields: WorkField[]): void {
  localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
}

/** Termin minął (i zadanie nie jest zrobione). */
export function isOverdue(i: WorkItem, now: number): boolean {
  if (!i.due || i.status === "done") return false;
  const end = new Date(i.due);
  end.setDate(end.getDate() + 1);
  return end.getTime() <= now;
}
