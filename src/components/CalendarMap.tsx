import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { colorInk } from "../colors";
import { shownColor } from "../tags";
import { DRAFT_ID } from "../draft";
import { useDragGesture, type Pt } from "../hooks/useDragGesture";
import { useOptimisticMove } from "../hooks/useOptimisticMove";
import { DelBtn, PlanBtn } from "./DelBtn";
import { EpicTag } from "./EpicTag";
import { TagDots } from "./TagDots";
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
  /** Okno bez końca: przewinięto blisko krawędzi → App przesuwa okno dni (pozycja na ekranie zostaje). */
  onEdge?: (dir: -1 | 1) => void;
  /** Pierwszy widoczny dzień (etykieta miesiąca, mały kalendarz) — po przewinięciu. */
  onVisibleDay?: (d: Date) => void;
  /** Stały zakres tygodni: kółko/przesunięcie poza krawędź → poprzedni/następny zakres. */
  onStep?: (dir: -1 | 1) => void;
  /** Usunięcie z przycisku „×" po najechaniu (komputer). */
  onDelete?: (e: CalEvent) => void;
  /** Prawy przycisk myszy na wpisie → menu (kolor, tagi, usuń). */
  onContext?: (e: CalEvent, pt: { x: number; y: number }) => void;
  /** „P” po najechaniu: najbliższa wolna godzina w godzinach produktywności. */
  onPlan?: (e: CalEvent) => void;
};

/** Ile kolumn od krawędzi zaczynamy doładowywać kolejne dni. */
const EDGE_COLS = 3;
const SWIPE_MIN = 60;
const WHEEL_STEP = 80;

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
  onEdge,
  onVisibleDay,
  onStep,
  onDelete,
  onContext,
  onPlan,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const { shown, dropped, settle } = useOptimisticMove(events);
  const [preview, setPreview] = useState<Preview | null>(null);
  // strefy auto-przewijania: u góry przyklejone nagłówki dni, z lewej kolumna godzin, na dole dock
  const { bind } = useDragGesture({ scroller, edges: { top: 72, left: 90, bottom: 110, right: 40 } });

  // aktualne wartości dla efektów, które nie powinny się uruchamiać przy każdej zmianie
  const live = useRef({ days, focusDay, now, onEdge, onVisibleDay, onStep });
  live.current = { days, focusDay, now, onEdge, onVisibleDay, onStep };
  const lastToken = useRef(scrollToNowToken);
  const edgeAsked = useRef(false);
  const lastVisible = useRef(0);
  /** Dzień widoczny przy lewej krawędzi w chwili prośby o przesunięcie okna + jego odległość od krawędzi. */
  const keep = useRef<{ t: number; off: number } | null>(null);

  const colWidth = () => scroller.current?.querySelector<HTMLElement>(".hours")?.offsetWidth ?? 180;

  /** Pozycja (w treści przewijanej) lewej krawędzi kolumny dnia o indeksie i. */
  const colLeft = (el: HTMLElement, i: number) =>
    (el.querySelector<HTMLElement>(".day-head")?.offsetLeft ?? 68) + i * colWidth();

  // Okno dni przesunięte przez onEdge (nie nawigacja): ten sam dzień wraca w to samo miejsce ekranu,
  // więc przewijanie wygląda na nieskończone. Ustawiamy pozycję bezwzględnie (a nie „o 14 dni"), bo
  // przeglądarki różnie same poprawiają scroll po zmianie treści (np. Chrome przez scroll-snap).
  const firstKey = days[0].getTime();
  useLayoutEffect(() => {
    const el = scroller.current;
    const navigated = lastToken.current !== scrollToNowToken;
    const k = keep.current;
    keep.current = null;
    if (el && k && !navigated) {
      const i = days.findIndex((d) => d.getTime() === k.t);
      if (i >= 0) el.scrollLeft = colLeft(el, i) - k.off;
    }
    edgeAsked.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, scrollToNowToken]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Synchronicznie i bez mierzenia każdej kolumny (tylko arytmetyka) — tanie, działa też w tle.
    const check = () => {
      const { days: ds, onEdge: edge, onVisibleDay: visible } = live.current;
      const w = colWidth();
      const gutter = el.querySelector<HTMLElement>(".gutter")?.offsetWidth ?? 52;
      const i = Math.min(ds.length - 1, Math.max(0, Math.floor((el.scrollLeft + gutter + w / 2 - colLeft(el, 0)) / w)));
      if (edge && !edgeAsked.current) {
        const dir = el.scrollLeft < w * EDGE_COLS ? -1 : el.scrollWidth - el.clientWidth - el.scrollLeft < w * EDGE_COLS ? 1 : 0;
        if (dir) {
          edgeAsked.current = true;
          keep.current = { t: ds[i].getTime(), off: colLeft(el, i) - el.scrollLeft };
          edge(dir);
        }
      }
      if (visible) {
        const t = ds[i]?.getTime();
        if (t !== undefined && t !== lastVisible.current) {
          lastVisible.current = t;
          visible(ds[i]);
        }
      }
    };
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, []);

  // Kółko myszy: nad nagłówkami dni / wierszem całodniowym przewija daty (w pionie nie ma tam czego
  // przewijać). Przy stałym zakresie tygodni kółko/gest w bok za krawędzią zmienia zakres.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let acc = 0;
    let lock = 0;
    // tolerancja kilku pikseli: zaokrąglenia szerokości kolumn nie mogą blokować zmiany zakresu
    const atStart = () => el.scrollLeft <= 24;
    const atEnd = () => el.scrollLeft >= el.scrollWidth - el.clientWidth - 24;
    const tryStep = (delta: number) => {
      const step = live.current.onStep;
      if (!step) return false;
      const t = performance.now();
      if (t < lock) {
        lock = t + 180; // bezwładność touchpada: jeden gest = jeden krok
        return true;
      }
      if ((delta < 0 && !atStart()) || (delta > 0 && !atEnd())) return false;
      acc += delta;
      if (Math.abs(acc) < WHEEL_STEP) return true;
      step(acc > 0 ? 1 : -1);
      acc = 0;
      lock = t + 450;
      return true;
    };
    const onWheel = (e: WheelEvent) => {
      const scale = e.deltaMode === 1 ? 16 : 1;
      const dx = e.deltaX * scale;
      const dy = e.deltaY * scale;
      const overHeads = (e.target as Element | null)?.closest?.(".day-head, .allday");
      const sideways = Math.abs(dx) > Math.abs(dy) || e.shiftKey;
      const delta = sideways ? (Math.abs(dx) > Math.abs(dy) ? dx : dy) : overHeads ? dy : 0;
      if (!delta) return;
      if (tryStep(delta)) {
        e.preventDefault();
        return;
      }
      if (overHeads && !sideways) {
        e.preventDefault();
        el.scrollLeft += delta;
      }
    };
    let touch: { x: number; y: number; t: number; start: boolean; end: boolean } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touch =
        e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now(), start: atStart(), end: atEnd() } : null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const step = live.current.onStep;
      const t = e.changedTouches[0];
      if (!step || !touch || !t) return;
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      const quick = Date.now() - touch.t < 700;
      if (quick && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && touch.end) step(1);
        if (dx > 0 && touch.start) step(-1);
      }
      touch = null;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Nawigacja (i pierwsze wyświetlenie): przewiń do fokusu zaraz po wyrenderowaniu, przed malowaniem.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    lastToken.current = scrollToNowToken;
    const snapTo = () => {
      const { days, focusDay, now } = live.current;
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
    snapTo();
    // tylko przy nawigacji (token) i przy montowaniu — nie przy przesunięciu okna ani zmianie fokusu z przewijania
  }, [scrollToNowToken]);

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

  const ctx = (e: CalEvent) =>
    onContext && e.id !== DRAFT_ID
      ? {
          onContextMenu: (ev: React.MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
            onContext(e, { x: ev.clientX, y: ev.clientY });
          },
        }
      : {};

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
                  style={blobVars(shownColor(e))}
                  {...(e.id === DRAFT_ID ? {} : moveAllDay(e))}
                  {...ctx(e)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (e.id !== DRAFT_ID) onEvent(e);
                  }}
                >
                  <strong>
                    <TagDots tags={e.tags} />
                    {e.title || "(bez tytułu)"}
                  </strong>
                  <EpicTag id={e.epicId} />
                  {onPlan && e.id !== DRAFT_ID && <PlanBtn on={Boolean(e.autoSlot)} onPlan={() => onPlan(e)} />}
                  {onDelete && e.id !== DRAFT_ID && <DelBtn onDelete={() => onDelete(e)} />}
                  {e.id !== DRAFT_ID && sameDay(new Date(e.end), d) && (
                    <span className="resize-edge" aria-hidden {...stretchAllDay(e)} />
                  )}
                </button>
              ))}
              {ghost && (
                <div className="event-blob allday-blob drag-ghost" style={blobVars(shownColor(ghost.e))}>
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
                    style={{ top, height, width, left, ...blobVars(shownColor(e)) }}
                    {...(draggable ? moveTimed(e) : {})}
                    {...ctx(e)}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (draggable) onEvent(e);
                    }}
                  >
                    <strong>
                      <TagDots tags={e.tags} />
                      {e.title || "(bez tytułu)"}
                    </strong>
                    <small>
                      {formatClock(new Date(e.start))}–{formatClock(new Date(e.end))}
                      {e.moves ? <span className="mv" title={`Przeniesiony ${e.moves}×`}> · ↷{e.moves}</span> : null}
                    </small>
                    <EpicTag id={e.epicId} />
                    {onPlan && draggable && <PlanBtn on={Boolean(e.autoSlot)} onPlan={() => onPlan(e)} />}
                    {onDelete && draggable && <DelBtn onDelete={() => onDelete(e)} />}
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
                    ...blobVars(shownColor(ghost.e)),
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
