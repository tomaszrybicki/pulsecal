import { useEffect, useRef, useState } from "react";
import { colorInk } from "../colors";
import { DRAFT_ID } from "../draft";
import { useDragGesture, type Pt } from "../hooks/useDragGesture";
import { useOptimisticMove } from "../hooks/useOptimisticMove";
import type { CalEvent } from "../types";
import {
  MINUTE,
  addDays,
  atMinutes,
  endOfDay,
  formatClock,
  formatDayHeading,
  minutesSinceMidnight,
  sameDay,
  startOfDay,
} from "../time";

const HOUR_H = 72;
const SNAP = 15 * MINUTE;
const MIN_DURATION = 15 * MINUTE;

type Props = {
  now: Date;
  /** Dni do pokazania (21 dni wokół fokusu albo tygodnie wybrane w małym kalendarzu). */
  days: Date[];
  /** Dzień, do którego przewijamy (dzisiaj / wybrany w nawigacji). */
  focusDay: Date;
  events: CalEvent[];
  onSlot: (start: Date) => void;
  onAllDaySlot: (day: Date) => void;
  onEvent: (e: CalEvent) => void;
  onMove: (e: CalEvent, start: number, end: number) => void;
  scrollToNowToken: number;
};

type LaidOut = CalEvent & { col: number; cols: number };

/** Podgląd przeciąganego wpisu (nowe położenie) — rysowany jako „duch", oryginał zostaje w miejscu. */
type Preview = { e: CalEvent; start: number; end: number };

function layoutDay(events: CalEvent[]): LaidOut[] {
  const items = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: LaidOut[] = [];
  const clusters: CalEvent[][] = [];

  for (const e of items) {
    const last = clusters[clusters.length - 1];
    if (!last) {
      clusters.push([e]);
      continue;
    }
    const clusterEnd = Math.max(...last.map((x) => x.end));
    if (e.start < clusterEnd) last.push(e);
    else clusters.push([e]);
  }

  for (const cluster of clusters) {
    const cols: CalEvent[][] = [];
    for (const e of cluster) {
      const idx = cols.findIndex((col) => col[col.length - 1].end <= e.start);
      if (idx === -1) cols.push([e]);
      else cols[idx].push(e);
    }
    for (let c = 0; c < cols.length; c++) {
      for (const e of cols[c]) out.push({ ...e, col: c, cols: cols.length });
    }
  }
  return out;
}

const snap = (t: number) => Math.round(t / SNAP) * SNAP;

const blobVars = (color: string) => ({
  ["--blob" as string]: color,
  ["--blob-ink" as string]: colorInk(color),
});

export function CalendarMap({
  now,
  days,
  focusDay,
  events,
  onSlot,
  onAllDaySlot,
  onEvent,
  onMove,
  scrollToNowToken,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const { shown, dropped, settle } = useOptimisticMove(events);
  const [preview, setPreview] = useState<Preview | null>(null);
  // strefy auto-przewijania: u góry przyklejone nagłówki dni, z lewej kolumna godzin, na dole dock
  const { bind } = useDragGesture({ scroller, edges: { top: 72, left: 90, bottom: 110, right: 40 } });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const snapTo = () => {
      // Pozycja z DOM zamiast dayW * index — szerokość kolumny i odstępy zależą od CSS/ekranu.
      const heads = el.querySelectorAll<HTMLElement>(".day-head");
      const gutter = el.querySelector<HTMLElement>(".gutter")?.offsetWidth ?? 52;
      const todayIndex = Math.max(0, days.findIndex((d) => sameDay(d, focusDay)));
      const target = heads[todayIndex];
      if (target) {
        const delta = target.getBoundingClientRect().left - el.getBoundingClientRect().left;
        el.scrollLeft = Math.max(0, el.scrollLeft + delta - gutter);
      }
      const focusMinutes = sameDay(focusDay, now) ? minutesSinceMidnight(now) : 9 * 60;
      el.scrollTop = Math.max(0, (focusMinutes / 60) * HOUR_H - el.clientHeight * 0.35);
    };
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(snapTo));
    return () => window.cancelAnimationFrame(id);
    // now is read once per locate/focus change, not every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToNowToken, days, focusDay]);

  /** Kolumna dnia pod kursorem (poza siatką → najbliższa skrajna). */
  const columnAt = (x: number, selector: string): { index: number; rect: DOMRect } | null => {
    const cols = scroller.current?.querySelectorAll<HTMLElement>(selector);
    if (!cols?.length) return null;
    let index = 0;
    cols.forEach((c, i) => {
      if (x >= c.getBoundingClientRect().left) index = i;
    });
    return { index, rect: cols[index].getBoundingClientRect() };
  };

  /** Czas pod kursorem w siatce godzin (bez przyciągania). */
  const timeAt = (p: Pt): number | null => {
    const col = columnAt(p.x, ".hours");
    if (!col) return null;
    const min = Math.min(24 * 60, Math.max(0, ((p.y - col.rect.top) / HOUR_H) * 60));
    return atMinutes(days[col.index], Math.round(min)).getTime();
  };

  const commit = (e: CalEvent, start: number, end: number) => {
    if (start === e.start && end === e.end) return;
    settle(e.id, start, end);
    onMove(e, start, end);
  };

  const moveTimed = (e: CalEvent) => {
    let grab = 0;
    let next: Preview = { e, start: e.start, end: e.end };
    return bind({
      onStart: (p) => {
        grab = (timeAt(p) ?? e.start) - e.start;
      },
      onMove: (p) => {
        const t = timeAt(p);
        if (t === null) return;
        const start = snap(t - grab);
        next = { e, start, end: start + (e.end - e.start) };
        setPreview(next);
      },
      onEnd: (p) => {
        setPreview(null);
        if (p) commit(e, next.start, next.end);
      },
    });
  };

  const resizeTimed = (e: CalEvent) => {
    let next: Preview = { e, start: e.start, end: e.end };
    return bind({
      onStart: () => undefined,
      onMove: (p) => {
        const t = timeAt(p);
        if (t === null) return;
        next = { e, start: e.start, end: Math.max(e.start + MIN_DURATION, snap(t)) };
        setPreview(next);
      },
      onEnd: (p) => {
        setPreview(null);
        if (p) commit(e, next.start, next.end);
      },
    });
  };

  /** Prawa krawędź wpisu całodniowego: rozciąganie na kolejne dni (albo skracanie, min. 1 dzień). */
  const stretchAllDay = (e: CalEvent) => {
    let next: Preview = { e, start: e.start, end: e.end };
    return bind({
      onStart: () => undefined,
      onMove: (p) => {
        const col = columnAt(p.x, ".allday");
        if (!col) return;
        const day = days[col.index];
        next = { e, start: e.start, end: endOfDay(new Date(Math.max(day.getTime(), e.start))).getTime() };
        setPreview(next);
      },
      onEnd: (p) => {
        setPreview(null);
        if (p) commit(e, next.start, next.end);
      },
    });
  };

  const moveAllDay = (e: CalEvent) => {
    let grab = 0;
    let next: Preview = { e, start: e.start, end: e.end };
    return bind({
      onStart: (p) => {
        grab = columnAt(p.x, ".allday")?.index ?? 0;
      },
      onMove: (p) => {
        const col = columnAt(p.x, ".allday");
        if (!col) return;
        const shift = col.index - grab;
        next = {
          e,
          start: addDays(new Date(e.start), shift).getTime(),
          end: addDays(new Date(e.end), shift).getTime(),
        };
        setPreview(next);
      },
      onEnd: (p) => {
        setPreview(null);
        if (p) commit(e, next.start, next.end);
      },
    });
  };

  const stateClass = (e: CalEvent) =>
    `${e.id === DRAFT_ID ? " ghost-draft" : ""}${preview?.e.id === e.id ? " drag-source" : ""}${dropped === e.id ? " dropped" : ""}`;

  return (
    <div className="map-scroll" ref={scroller}>
      <div className={`grid${days.length <= 7 ? " fit" : ""}`} style={{ ["--days" as string]: days.length }}>
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className={`day-head${sameDay(d, now) ? " today" : ""}`}>
            <b>{formatDayHeading(d)}</b>
          </div>
        ))}
        <div />
        {days.map((d) => {
          const from = startOfDay(d).getTime();
          const to = addDays(d, 1).getTime();
          const allDay = shown.filter((e) => e.allDay && e.start < to && e.end > from);
          const ghost = preview?.e.allDay && preview.start < to && preview.end > from ? preview : null;
          return (
            <div
              key={`ad-${d.toISOString()}`}
              className="allday"
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) onAllDaySlot(d);
              }}
            >
              {allDay.map((e) => (
                <button
                  key={e.id}
                  className={`event-blob allday-blob${stateClass(e)}`}
                  style={blobVars(e.color)}
                  {...(e.id === DRAFT_ID ? {} : moveAllDay(e))}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (e.id !== DRAFT_ID) onEvent(e);
                  }}
                >
                  <strong>{e.title || "(bez tytułu)"}</strong>
                  {e.id !== DRAFT_ID && sameDay(new Date(e.end), d) && (
                    <span className="resize-edge" aria-hidden {...stretchAllDay(e)} />
                  )}
                </button>
              ))}
              {ghost && (
                <div className="event-blob allday-blob drag-ghost" style={blobVars(ghost.e.color)}>
                  <strong>{ghost.e.title || "(bez tytułu)"}</strong>
                </div>
              )}
            </div>
          );
        })}
        <div className="gutter">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="hour-label" style={{ top: h * HOUR_H }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const from = startOfDay(d).getTime();
          const to = addDays(d, 1).getTime();
          const dayEvents = layoutDay(shown.filter((e) => !e.allDay && e.start < to && e.end > from));
          const isToday = sameDay(d, now);
          const nowTop = (minutesSinceMidnight(now) / 60) * HOUR_H;
          const ghost = preview && !preview.e.allDay && preview.start < to && preview.end > from ? preview : null;
          return (
            <div
              key={`h-${d.toISOString()}`}
              className="hours"
              onClick={(ev) => {
                const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                const y = ev.clientY - rect.top;
                const minutes = Math.floor((y / HOUR_H) * 4) * 15;
                onSlot(atMinutes(d, minutes));
              }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="hour-line" style={{ top: h * HOUR_H }} />
              ))}
              {dayEvents.map((e) => {
                // wpis przechodzący przez północ: rysujemy tylko część z tego dnia
                const segStart = Math.max(e.start, from);
                const segEnd = Math.min(e.end, to);
                const top = ((segStart - from) / 36e5) * HOUR_H;
                const height = Math.max(28, ((segEnd - segStart) / 36e5) * HOUR_H);
                const width = `calc((100% - 10px) / ${e.cols})`;
                const left = `calc(5px + ${e.col} * (100% - 10px) / ${e.cols})`;
                const draggable = e.id !== DRAFT_ID;
                return (
                  <button
                    key={e.id}
                    className={`event-blob${stateClass(e)}`}
                    style={{ top, height, width, left, ...blobVars(e.color) }}
                    {...(draggable ? moveTimed(e) : {})}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (draggable) onEvent(e);
                    }}
                  >
                    <strong>{e.title || "(bez tytułu)"}</strong>
                    <small>
                      {formatClock(new Date(e.start))}–{formatClock(new Date(e.end))}
                    </small>
                    {e.tags?.length > 0 && <em className="blob-tags">{e.tags.join(" · ")}</em>}
                    {draggable && segEnd === e.end && (
                      <>
                        <span className="resize-handle" aria-hidden {...resizeTimed(e)} />
                        {/* róg: w dół = późniejszy koniec, w bok = koniec w innym dniu (wpis kilkudniowy) */}
                        <span className="resize-corner" aria-hidden {...resizeTimed(e)} />
                      </>
                    )}
                  </button>
                );
              })}
              {ghost && (
                <div
                  className="event-blob drag-ghost"
                  style={{
                    top: ((Math.max(ghost.start, from) - from) / 36e5) * HOUR_H,
                    height: Math.max(28, ((Math.min(ghost.end, to) - Math.max(ghost.start, from)) / 36e5) * HOUR_H),
                    left: 5,
                    right: 5,
                    ...blobVars(ghost.e.color),
                  }}
                >
                  <strong>{ghost.e.title || "(bez tytułu)"}</strong>
                  <small>
                    {formatClock(new Date(ghost.start))}–{formatClock(new Date(ghost.end))}
                  </small>
                </div>
              )}
              {isToday && (
                <div className="now-line" style={{ top: nowTop }}>
                  <span className="now-blob" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
