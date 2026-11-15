import Dexie, { type EntityTable } from "dexie";
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
    .filter((e) => !e.deleted && (e.title.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q)))
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
