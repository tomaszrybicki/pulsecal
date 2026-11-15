import Dexie, { type EntityTable } from "dexie";
import type { CalEvent } from "./types";
import { PALETTE } from "./colors";
import { addDays, atMinutes, startOfDay } from "./time";

class PulseDB extends Dexie {
  events!: EntityTable<CalEvent, "id">;

  constructor() {
    super("pulsecal");
    this.version(1).stores({
      events: "id, start, end, googleEventId, updatedAt, deleted",
    });
  }
}

export const db = new PulseDB();

const SEEDED = "pulsecal:seeded-v1";
const DEDUPED = "pulsecal:dedupe-v1";

export async function seedIfEmpty(): Promise<void> {
  if (!localStorage.getItem(SEEDED)) {
    localStorage.setItem(SEEDED, "1");
    const count = await db.events.count();
    if (count === 0) {
      await addSamples();
    }
  }
  await dedupeLocalClones();
}

async function addSamples(): Promise<void> {

  const today = startOfDay(new Date());
  const now = Date.now();
  const samples: CalEvent[] = [
    {
      id: crypto.randomUUID(),
      title: "Głęboka praca",
      notes: "Jeden kęs. Bez przełączania.",
      start: atMinutes(today, 9 * 60 + 30).getTime(),
      end: atMinutes(today, 11 * 60).getTime(),
      allDay: false,
      color: PALETTE[2].value,
      origin: "local",
      updatedAt: now,
      deleted: false,
    },
    {
      id: crypto.randomUUID(),
      title: "Spacer / reset",
      notes: "",
      start: atMinutes(today, 13 * 60).getTime(),
      end: atMinutes(today, 13 * 60 + 40).getTime(),
      allDay: false,
      color: PALETTE[0].value,
      origin: "local",
      updatedAt: now,
      deleted: false,
    },
    {
      id: crypto.randomUUID(),
      title: "Inbox 15 min",
      notes: "Tylko triage, nie robienie.",
      start: atMinutes(addDays(today, 1), 10 * 60).getTime(),
      end: atMinutes(addDays(today, 1), 10 * 60 + 15).getTime(),
      allDay: false,
      color: PALETTE[3].value,
      origin: "local",
      updatedAt: now,
      deleted: false,
    },
  ];

  await db.events.bulkAdd(samples);
}

async function dedupeLocalClones(): Promise<void> {
  if (localStorage.getItem(DEDUPED)) return;
  localStorage.setItem(DEDUPED, "1");
  const all = await db.events.toArray();
  const seen = new Set<string>();
  for (const e of all) {
    if (e.googleEventId) continue;
    const key = `${e.title}|${e.start}|${e.end}`;
    if (seen.has(key)) await db.events.delete(e.id);
    else seen.add(key);
  }
}

export async function upsertEvent(event: CalEvent): Promise<void> {
  await db.events.put(event);
}

export async function softDeleteEvent(id: string): Promise<void> {
  await db.events.update(id, { deleted: true, updatedAt: Date.now() });
}

export async function eventsInRange(from: number, to: number): Promise<CalEvent[]> {
  return db.events
    .where("start")
    .below(to)
    .filter((e) => !e.deleted && e.end > from)
    .toArray();
}
