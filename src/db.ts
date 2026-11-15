import Dexie, { type EntityTable } from "dexie";
import { normalizeTags, splitTags, tagKey } from "./tags";
import type { CalEvent } from "./types";

class PulseDB extends Dexie {
  events!: EntityTable<CalEvent, "id">;

  constructor() {
    super("pulsecal");
    this.version(1).stores({
      events: "id, start, end, googleEventId, updatedAt, deleted",
    });
    // v2: flaga `pending` (kolejka wysyłki do Google) + usunięcie przykładowych wpisów,
    // żeby nie wysłały się do prawdziwego kalendarza przy pierwszym połączeniu.
    this.version(2)
      .stores({
        events: "id, start, end, googleEventId, updatedAt, pending",
      })
      .upgrade(async (tx) => {
        const table = tx.table<CalEvent & { pending?: 0 | 1 }, string>("events");
        await table.toCollection().modify((e, ref) => {
          if (!e.googleEventId && SAMPLE_SIGNATURES.has(`${e.title}|${e.notes}`)) {
            delete (ref as { value?: unknown }).value;
            return;
          }
          e.pending = e.googleEventId ? (e.deleted ? 1 : 0) : 1;
        });
      });
    // v3: tagi jako osobne pole z indeksem multiEntry (filtrowanie, lista tagów).
    // Linia „Tagi: …" z opisu przechodzi do `tags`, notatka zostaje bez niej.
    this.version(3)
      .stores({
        events: "id, start, end, googleEventId, updatedAt, pending, *tags",
      })
      .upgrade(async (tx) => {
        await tx
          .table<CalEvent, string>("events")
          .toCollection()
          .modify((e) => {
            const { notes, tags } = splitTags(e.notes ?? "");
            e.notes = notes;
            e.tags = normalizeTags([...(e.tags ?? []), ...tags]);
          });
      });
  }
}

const SAMPLE_SIGNATURES = new Set([
  "Głęboka praca|Jeden kęs. Bez przełączania.",
  "Spacer / reset|",
  "Inbox 15 min|Tylko triage, nie robienie.",
]);

export const db = new PulseDB();

export function newEventId(): string {
  // 32 znaki hex — poprawne również jako ID wydarzenia w Google (base32hex),
  // dzięki czemu wysyłka jest idempotentna (ponowny POST → 409 zamiast duplikatu).
  return crypto.randomUUID().replace(/-/g, "");
}

/** Zapis lokalnej zmiany: oznacza wpis do wysłania. */
export async function saveLocal(event: CalEvent): Promise<void> {
  await db.events.put({ ...event, pending: 1, updatedAt: Date.now() });
}

export async function removeLocal(id: string): Promise<void> {
  const e = await db.events.get(id);
  if (!e) return;
  if (!e.googleEventId) {
    await db.events.delete(id);
    return;
  }
  await db.events.update(id, { deleted: true, pending: 1, updatedAt: Date.now() });
}

export async function eventsInRange(from: number, to: number): Promise<CalEvent[]> {
  return db.events
    .where("start")
    .below(to)
    .filter((e) => !e.deleted && e.end > from)
    .toArray();
}

export async function searchEvents(query: string, limit = 30): Promise<CalEvent[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = await db.events
    .filter(
      (e) =>
        !e.deleted &&
        (e.title.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q) ||
          (e.tags ?? []).some((t) => t.includes(q))),
    )
    .toArray();
  const now = Date.now();
  // najpierw nadchodzące (od najbliższego), potem przeszłe (od najświeższego)
  hits.sort((a, b) => {
    const af = a.end >= now;
    const bf = b.end >= now;
    if (af !== bf) return af ? -1 : 1;
    return af ? a.start - b.start : b.start - a.start;
  });
  return hits.slice(0, limit);
}

export async function pendingCount(): Promise<number> {
  return db.events.where("pending").equals(1).count();
}

/** tag = pisownia do wyświetlania (najczęstsza), key = klucz porównań (małe litery). */
export type TagStat = { tag: string; key: string; count: number };

/** Wszystkie użyte tagi z liczbą wpisów (najczęstsze pierwsze) — z indeksu, bez czytania wpisów. */
export async function tagStats(): Promise<TagStat[]> {
  const keys = (await db.events.orderBy("tags").keys()) as string[];
  // „Praca” i „praca” to jeden tag; pokazujemy najczęstszą pisownię
  const groups = new Map<string, Map<string, number>>();
  for (const t of keys) {
    const k = tagKey(t);
    const g = groups.get(k) ?? new Map<string, number>();
    g.set(t, (g.get(t) ?? 0) + 1);
    groups.set(k, g);
  }
  return [...groups]
    .map(([key, g]) => {
      const [tag] = [...g].sort((a, b) => b[1] - a[1])[0];
      return { tag, key, count: [...g.values()].reduce((s, n) => s + n, 0) };
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pl"));
}
