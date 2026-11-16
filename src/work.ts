/**
 * Zadania i epiki — prosta „jira” do spraw osobistych.
 * Epik grupuje zadania, inne epiki i wpisy z kalendarza (CalEvent.epicId).
 * Lokalnie tabela `items` (Dexie), kopia w Google jako ukryte wpisy 2.01.2000 (sync/google.ts).
 */
import { db, newEventId } from "./db";
import type { CalEvent, WorkItem, WorkKind, WorkStatus } from "./types";

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

export function newItem(kind: WorkKind, title: string, parentId = ""): WorkItem {
  const now = Date.now();
  return {
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
  /** epicId → wpisy z kalendarza. */
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
  const evs = new Map<string, CalEvent[]>();
  for (const e of events) {
    if (!e.epicId || !byId.has(e.epicId)) continue;
    const list = evs.get(e.epicId);
    if (list) list.push(e);
    else evs.set(e.epicId, [e]);
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

/** Postęp epiku: zadania (zrobione) i wpisy (odbyte) w nim i we wszystkich jego pod-epikach. */
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
  for (const e of tree.events.get(id) ?? []) {
    p.events += 1;
    if (e.end < now) p.eventsDone += 1;
  }
  p.done = p.tasksDone + p.eventsDone;
  p.total = p.tasks + p.events;
  return p;
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
