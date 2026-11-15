import { useEffect, useMemo, useRef } from "react";
import { colorInk } from "../colors";
import type { CalEvent } from "../types";
import {
  addDays,
  formatClock,
  formatDayHeading,
  minutesSinceMidnight,
  sameDay,
  startOfDay,
  weekDays,
} from "../time";

const HOUR_H = 72;

type Props = {
  now: Date;
  anchor: Date;
  events: CalEvent[];
  onSlot: (start: Date) => void;
  onEvent: (e: CalEvent) => void;
  scrollToNowToken: number;
};

type LaidOut = CalEvent & { col: number; cols: number };

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

export function CalendarMap({ now, anchor, events, onSlot, onEvent, scrollToNowToken }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const days = useMemo(
    () => weekDays(anchor, 21),
    [anchor.getFullYear(), anchor.getMonth(), anchor.getDate()],
  );

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const snap = () => {
      const col = el.querySelector(".hours") as HTMLElement | null;
      const dayW = col?.getBoundingClientRect().width ?? 160;
      const todayIndex = Math.max(0, days.findIndex((d) => sameDay(d, anchor)));
      el.scrollLeft = Math.max(0, todayIndex * (dayW + 12) - 24);
      const focusMinutes = sameDay(anchor, now) ? minutesSinceMidnight(now) : 9 * 60;
      el.scrollTop = Math.max(0, (focusMinutes / 60) * HOUR_H - el.clientHeight * 0.35);
    };
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(snap));
    return () => window.cancelAnimationFrame(id);
    // now is read once per locate/focus change, not every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToNowToken, days, anchor]);

  return (
    <div className="map-scroll" ref={scroller}>
      <div className="grid" style={{ ["--days" as string]: days.length }}>
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
          const allDay = events.filter((e) => e.allDay && e.start < to && e.end > from);
          return (
            <div key={`ad-${d.toISOString()}`} className="allday">
              {allDay.map((e) => (
                <button
                  key={e.id}
                  className="event-blob"
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: 28,
                    ["--blob" as string]: e.color,
                    ["--blob-ink" as string]: colorInk(e.color),
                  }}
                  onClick={() => onEvent(e)}
                >
                  <strong>{e.title}</strong>
                </button>
              ))}
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
          const dayEvents = layoutDay(events.filter((e) => !e.allDay && e.start < to && e.end > from));
          const isToday = sameDay(d, now);
          const nowTop = (minutesSinceMidnight(now) / 60) * HOUR_H;
          return (
            <div
              key={`h-${d.toISOString()}`}
              className="hours"
              onClick={(ev) => {
                const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                const y = ev.clientY - rect.top;
                const minutes = Math.round(y / HOUR_H * 60 / 15) * 15;
                onSlot(new Date(from + minutes * 60_000));
              }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="hour-line" style={{ top: h * HOUR_H }} />
              ))}
              {dayEvents.map((e) => {
                const top = Math.max(0, ((e.start - from) / 36e5) * HOUR_H);
                const height = Math.max(28, ((e.end - e.start) / 36e5) * HOUR_H);
                const width = `calc((100% - 10px) / ${e.cols})`;
                const left = `calc(5px + ${e.col} * (100% - 10px) / ${e.cols})`;
                return (
                  <button
                    key={e.id}
                    className="event-blob"
                    style={{
                      top,
                      height,
                      width,
                      left,
                      ["--blob" as string]: e.color,
                      ["--blob-ink" as string]: colorInk(e.color),
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEvent(e);
                    }}
                  >
                    <strong>{e.title}</strong>
                    <small>
                      {formatClock(new Date(e.start))}–{formatClock(new Date(e.end))}
                    </small>
                  </button>
                );
              })}
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
