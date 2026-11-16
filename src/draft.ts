import type { CalEvent, DraftEvent } from "./types";
import {
  HOUR,
  MINUTE,
  atMinutes,
  endOfDay,
  formatClock,
  longDateLabel,
  nextQuarter,
  sameDay,
  startOfDay,
} from "./time";

/** ID pseudo-wpisu, którym widoki pokazują szkic (jak „(bez tytułu)" w Google Calendar). */
export const DRAFT_ID = "__draft__";

export const DEFAULT_TIMED_MIN = 45;

export function draftFromEvent(e: CalEvent): DraftEvent {
  return {
    id: e.id,
    title: e.title,
    notes: e.notes,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    color: e.color,
    tags: e.tags ?? [],
    epicId: e.epicId,
    autoSlot: e.autoSlot,
    estimate: e.estimate,
  };
}

export function timedDraft(start: number, color: string, minutes = DEFAULT_TIMED_MIN): DraftEvent {
  return { title: "", notes: "", start, end: start + minutes * MINUTE, allDay: false, color, tags: [] };
}

export function allDayDraft(day: Date, color: string): DraftEvent {
  return {
    title: "",
    notes: "",
    start: startOfDay(day).getTime(),
    end: endOfDay(day).getTime(),
    allDay: true,
    color,
    tags: [],
  };
}

/** Cały dzień ⇄ godzina. Z całego dnia robi godzinny wpis (dziś: najbliższy kwadrans, inaczej 9:00). */
export function toggleAllDay(d: DraftEvent): DraftEvent {
  if (d.allDay) {
    const day = new Date(d.start);
    const start = sameDay(day, new Date()) ? nextQuarter() : atMinutes(day, 9 * 60);
    return { ...d, allDay: false, start: start.getTime(), end: start.getTime() + HOUR };
  }
  return {
    ...d,
    allDay: true,
    start: startOfDay(new Date(d.start)).getTime(),
    end: endOfDay(new Date(Math.max(d.start, d.end - 1))).getTime(),
  };
}

export function whenLabel(d: Pick<DraftEvent, "start" | "end" | "allDay">): string {
  const s = new Date(d.start);
  const e = new Date(d.end);
  if (d.allDay) {
    return sameDay(s, e) ? `${longDateLabel(s)} · cały dzień` : `${longDateLabel(s)} – ${longDateLabel(e)}`;
  }
  if (sameDay(s, e)) return `${longDateLabel(s)} · ${formatClock(s)}–${formatClock(e)}`;
  return `${longDateLabel(s)} ${formatClock(s)} – ${longDateLabel(e)} ${formatClock(e)}`;
}

export function isDirty(d: DraftEvent, original: CalEvent | undefined): boolean {
  if (!original) return true;
  return (
    d.title.trim() !== original.title ||
    d.notes !== original.notes ||
    d.color !== original.color ||
    d.start !== original.start ||
    d.end !== original.end ||
    d.allDay !== original.allDay ||
    d.tags.join(",") !== (original.tags ?? []).join(",") ||
    (d.epicId ?? "") !== (original.epicId ?? "") ||
    Boolean(d.autoSlot) !== Boolean(original.autoSlot) ||
    Math.max(0, d.estimate ?? 0) !== Math.max(0, original.estimate ?? 0)
  );
}

/** Szkic jako wpis do narysowania w widokach (podgląd na żywo podczas tworzenia/edycji). */
export function withDraft(events: CalEvent[], d: DraftEvent | null): CalEvent[] {
  if (!d) return events;
  const patch = {
    title: d.title,
    color: d.color,
    start: d.start,
    end: d.end,
    allDay: d.allDay,
    tags: d.tags,
    estimate: d.estimate,
  };
  if (d.id) return events.map((e) => (e.id === d.id ? { ...e, ...patch } : e));
  return [
    ...events,
    { ...patch, id: DRAFT_ID, notes: "", origin: "local", updatedAt: 0, deleted: false, pending: 0 },
  ];
}
