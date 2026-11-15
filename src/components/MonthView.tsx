import { motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { colorInk } from "../colors";
import { DRAFT_ID } from "../draft";
import { useDragGesture, type Pt } from "../hooks/useDragGesture";
import { useOptimisticMove } from "../hooks/useOptimisticMove";
import type { CalEvent } from "../types";
import { WEEKDAY_LABELS, addDays, dayDiff, formatClock, isoDate, sameDay, startOfDay } from "../time";

type Props = {
  now: Date;
  /** Tygodnie do pokazania (miesiąc albo zakres wybrany w małym kalendarzu). */
  weeks: Date[][];
  /** Miesiąc do przyciemnienia dni spoza niego; null = zakres tygodni (bez przyciemniania). */
  month: number | null;
  events: CalEvent[];
  /** Tapnięcie numeru dnia / „+N" → ten dzień w mapie. */
  onDay: (d: Date) => void;
  /** „+N więcej" i przycisk „•••" w dniu: okienko z wszystkimi wpisami dnia (przegląd dnia). */
  onDayDetails: (d: Date) => void;
  /** Tapnięcie pustego miejsca w dniu → szybkie dodanie. */
  onAdd: (d: Date) => void;
  onEvent: (e: CalEvent) => void;
  onMove: (e: CalEvent, start: number, end: number) => void;
  /** Kółko myszy / przesunięcie palcem w pionie: poprzedni (-1) / następny (1) miesiąc lub zakres. */
  onStep: (dir: -1 | 1) => void;
};

const WHEEL_STEP = 60;
const SWIPE_MIN = 60;

const DAYNUM_H = 26;
const MONTH_TAG = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const LANE_H = 18;
const ROW_GAP = 2;

type Seg = {
  e: CalEvent;
  col: number;
  span: number;
  lane: number;
  bar: boolean;
  contL: boolean;
  contR: boolean;
};

function eventDays(e: CalEvent): { s: Date; e: Date } {
  // koniec wpisu z godziną jest wyłączny (10:00–00:00 kończy się poprzedniego dnia)
  return { s: startOfDay(new Date(e.start)), e: startOfDay(new Date(Math.max(e.start, e.end - 1))) };
}

function isBar(e: CalEvent): boolean {
  const d = eventDays(e);
  return e.allDay || !sameDay(d.s, d.e);
}

/** Układ tygodnia jak w Google Calendar: wielodniowe/całodniowe paski na górze, potem wpisy wg godziny. */
function layoutWeek(weekStart: Date, events: CalEvent[]): Seg[] {
  const weekEnd = addDays(weekStart, 7);
  const segs: Seg[] = [];
  for (const e of events) {
    const d = eventDays(e);
    if (d.e < weekStart || d.s >= weekEnd) continue;
    const col = Math.max(0, dayDiff(weekStart, d.s));
    const last = Math.min(6, dayDiff(weekStart, d.e));
    segs.push({
      e,
      col,
      span: last - col + 1,
      lane: 0,
      bar: isBar(e),
      contL: d.s < weekStart,
      contR: d.e >= weekEnd,
    });
  }
  // Najpierw wpisy z godziną (jednodniowe), potem całodniowe/kilkudniowe; w każdej grupie alfabetycznie.
  // Paski kilkudniowe muszą mieć jeden pas przez cały tydzień, więc trafiają pod wszystkie wpisy z godziną.
  const byTitle = (a: Seg, b: Seg) => (a.e.title || "").localeCompare(b.e.title || "", "pl", { sensitivity: "base" });
  segs.sort((a, b) => Number(a.bar) - Number(b.bar) || a.col - b.col || byTitle(a, b) || b.span - a.span);
  const lanes: boolean[][] = [];
  for (const s of segs) {
    let lane = lanes.findIndex((used) => !used.slice(s.col, s.col + s.span).some(Boolean));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(Array(7).fill(false));
    }
    for (let c = s.col; c < s.col + s.span; c++) lanes[lane][c] = true;
    s.lane = lane;
  }
  return segs;
}

export function MonthView({ now, weeks, month, events, onDay, onDayDetails, onAdd, onEvent, onMove, onStep }: Props) {
  const reduce = useReducedMotion();
  const wheel = useRef({ acc: 0, last: 0, lock: 0 });
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const slideDir = useRef(0);
  const prevStart = useRef(weeks[0][0].getTime());
  if (prevStart.current !== weeks[0][0].getTime()) {
    slideDir.current = weeks[0][0].getTime() > prevStart.current ? 1 : -1;
    prevStart.current = weeks[0][0].getTime();
  }

  const onWheel = (e: React.WheelEvent) => {
    const w = wheel.current;
    const t = performance.now();
    if (t < w.lock) {
      w.lock = t + 180; // bezwładność touchpada: jeden gest = jeden krok
      return;
    }
    if (t - w.last > 250) w.acc = 0;
    w.last = t;
    w.acc += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    if (Math.abs(w.acc) < WHEEL_STEP) return;
    onStep(w.acc > 0 ? 1 : -1);
    w.acc = 0;
    w.lock = t + 450;
  };

  const root = useRef<HTMLDivElement>(null);
  const weeksRef = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(110);
  const { shown, dropped, settle } = useOptimisticMove(events);
  const { bind } = useDragGesture({ scroller: root });
  const [drag, setDrag] = useState<{ e: CalEvent; shift: number; x: number; y: number; dx: number; dy: number; w: number } | null>(
    null,
  );
  // rozciąganie za prawy róg: indeks dnia, na którym ma się kończyć wpis
  const [stretch, setStretch] = useState<{ e: CalEvent; to: number } | null>(null);

  const gridStart = weeks[0][0];

  // Ile pasów zmieści się w wierszu tygodnia — reszta trafia do „+N".
  useLayoutEffect(() => {
    const el = weeksRef.current;
    if (!el) return;
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (first) setRowH(first.getBoundingClientRect().height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks.length, gridStart.getTime()]);
  // zakres tygodni (nie miesiąc): 1. dzień miesiąca podpisujemy nazwą miesiąca, jak w Google
  const isRange = month === null;
  const cap = Math.max(1, Math.floor((rowH - DAYNUM_H - ROW_GAP * 2) / (LANE_H + ROW_GAP)));

  const dayIndexAt = (p: Pt): number | null => {
    const cells = root.current?.querySelectorAll<HTMLElement>(".m-day");
    if (!cells) return null;
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].getBoundingClientRect();
      if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) return i;
    }
    return null;
  };

  const dragFor = (e: CalEvent) => {
    let grab = 0;
    let shift = 0;
    let dx = 0;
    let dy = 0;
    let w = 120;
    return bind({
      onStart: (p) => {
        grab = dayIndexAt(p) ?? 0;
        shift = 0;
        const chips = root.current?.querySelectorAll<HTMLElement>(`[data-ev="${CSS.escape(e.id)}"]`) ?? [];
        for (const c of chips) {
          const r = c.getBoundingClientRect();
          if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
            dx = p.x - r.left;
            dy = p.y - r.top;
            w = Math.min(r.width, 200);
          }
        }
      },
      onMove: (p) => {
        const i = dayIndexAt(p);
        if (i !== null) shift = i - grab;
        setDrag({ e, shift, x: p.x, y: p.y, dx: Math.min(dx, w - 12), dy, w });
      },
      onEnd: (p) => {
        setDrag(null);
        if (!p || !shift) return;
        const start = addDays(new Date(e.start), shift).getTime();
        const end = addDays(new Date(e.end), shift).getTime();
        settle(e.id, start, end);
        onMove(e, start, end);
      },
    });
  };

  /** Prawy róg: wpis jednodniowy → kilkudniowy (albo krótszy). Godzina końca zostaje ta sama. */
  const stretchFor = (e: CalEvent) => {
    const d = eventDays(e);
    const startIdx = dayDiff(gridStart, d.s);
    const endIdx = dayDiff(gridStart, d.e);
    let to = endIdx;
    return bind({
      onStart: () => {
        to = endIdx;
      },
      onMove: (p) => {
        const i = dayIndexAt(p);
        if (i !== null) to = Math.max(i, startIdx);
        setStretch({ e, to });
      },
      onEnd: (p) => {
        setStretch(null);
        if (!p || to === endIdx) return;
        const end = addDays(new Date(e.end), to - endIdx).getTime();
        settle(e.id, e.start, end);
        onMove(e, e.start, end);
      },
    });
  };

  // podświetlenie dni, na które spadnie przeciągany / rozciągany wpis
  const target = useMemo(() => {
    if (stretch) return { from: dayDiff(gridStart, eventDays(stretch.e).s), to: stretch.to };
    if (!drag) return null;
    const d = eventDays(drag.e);
    return { from: dayDiff(gridStart, d.s) + drag.shift, to: dayDiff(gridStart, d.e) + drag.shift };
  }, [drag, stretch, gridStart]);

  return (
    <div
      className="month"
      ref={root}
      onWheel={onWheel}
      onTouchStartCapture={(e) => {
        const t = e.touches[0];
        swipe.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
      }}
      onTouchEndCapture={(e) => {
        const s = swipe.current;
        const t = e.changedTouches[0];
        swipe.current = null;
        if (!s || !t || drag || stretch) return;
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Date.now() - s.t < 700 && Math.abs(dy) > SWIPE_MIN && Math.abs(dy) > Math.abs(dx) * 1.5) {
          onStep(dy < 0 ? 1 : -1);
        }
      }}
    >
      <div className="m-head">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <motion.div
        key={isoDate(gridStart)}
        className="m-weeks"
        ref={weeksRef}
        initial={reduce || !slideDir.current ? false : { opacity: 0.2, y: slideDir.current * 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        {weeks.map((week, w) => {
          const segs = layoutWeek(week[0], shown);
          const perDay = Array(7).fill(0) as number[];
          for (const s of segs) for (let c = s.col; c < s.col + s.span; c++) perDay[c] += 1;
          const dayLimit = perDay.map((n) => (n > cap ? cap - 1 : cap));
          const visible = (s: Seg) => s.lane < Math.min(...dayLimit.slice(s.col, s.col + s.span));
          const hidden = Array(7).fill(0) as number[];
          for (const s of segs) {
            if (!visible(s)) for (let c = s.col; c < s.col + s.span; c++) hidden[c] += 1;
          }
          return (
            <div
              key={isoDate(week[0])}
              className="m-week"
              style={{ gridTemplateRows: `${DAYNUM_H}px repeat(${cap}, ${LANE_H}px) 1fr` }}
            >
              {week.map((d, c) => {
                const idx = w * 7 + c;
                const isTarget = target && idx >= target.from && idx <= target.to;
                return (
                  <div
                    key={isoDate(d)}
                    className={`m-day${month !== null && d.getMonth() !== month ? " out" : ""}${sameDay(d, now) ? " today" : ""}${isTarget ? " drop-target" : ""}`}
                    style={{ gridColumn: c + 1, gridRow: "1 / -1" }}
                    onClick={(ev) => {
                      if (ev.target === ev.currentTarget) onAdd(d);
                    }}
                  >
                    <button type="button" className="m-num" aria-label={`Pokaż ${isoDate(d)}`} onClick={() => onDay(d)}>
                      {d.getDate()}
                      {isRange && d.getDate() === 1 ? ` ${MONTH_TAG[d.getMonth()]}` : ""}
                    </button>
                    {perDay[c] > 0 && (
                      <button
                        type="button"
                        className="m-day-more"
                        title="Przegląd dnia"
                        aria-label={`Przegląd dnia ${isoDate(d)}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onDayDetails(d);
                        }}
                      >
                        •••
                      </button>
                    )}
                  </div>
                );
              })}
              {segs.filter(visible).map((s) => (
                <MonthChip
                  key={`${s.e.id}-${w}`}
                  seg={s}
                  className={`${drag?.e.id === s.e.id ? " drag-source" : ""}${stretch?.e.id === s.e.id ? " stretching" : ""}${dropped === s.e.id ? " dropped" : ""}`}
                  bindProps={s.e.id === DRAFT_ID ? undefined : dragFor(s.e)}
                  stretchProps={s.e.id === DRAFT_ID || s.contR ? undefined : stretchFor(s.e)}
                  onClick={() => {
                    if (s.e.id !== DRAFT_ID) onEvent(s.e);
                  }}
                />
              ))}
              {hidden.map((n, c) =>
                n > 0 ? (
                  <button
                    key={`more-${c}`}
                    type="button"
                    className="m-more"
                    style={{ gridColumn: c + 1, gridRow: dayLimit[c] + 2 }}
                    onClick={() => onDayDetails(week[c])}
                  >
                    +{n} więcej
                  </button>
                ) : null,
              )}
            </div>
          );
        })}
      </motion.div>
      {drag && (
        <div
          className={`m-ev m-float${isBar(drag.e) ? " bar" : ""}`}
          style={{
            left: drag.x - drag.dx,
            top: drag.y - drag.dy,
            width: drag.w,
            ["--blob" as string]: drag.e.color,
            ["--blob-ink" as string]: colorInk(drag.e.color),
          }}
        >
          <ChipBody e={drag.e} bar={isBar(drag.e)} />
        </div>
      )}
    </div>
  );
}

function ChipBody({ e, bar }: { e: CalEvent; bar: boolean }) {
  return (
    <>
      {!bar && <i className="dot" />}
      {!e.allDay && <span className="t">{formatClock(new Date(e.start))}</span>}
      <span className="n">{e.title || "(bez tytułu)"}</span>
    </>
  );
}

type BindProps = ReturnType<ReturnType<typeof useDragGesture>["bind"]>;

function MonthChip({
  seg,
  className,
  bindProps,
  stretchProps,
  onClick,
}: {
  seg: Seg;
  className: string;
  bindProps?: BindProps;
  /** Uchwyt w prawym rogu (tylko na odcinku, w którym wpis się kończy). */
  stretchProps?: BindProps;
  onClick: () => void;
}) {
  const { e } = seg;
  return (
    <button
      type="button"
      data-ev={e.id}
      className={`m-ev${seg.bar ? " bar" : ""}${seg.contL ? " cont-l" : ""}${seg.contR ? " cont-r" : ""}${e.id === DRAFT_ID ? " ghost-draft" : ""}${className}`}
      style={{
        gridColumn: `${seg.col + 1} / span ${seg.span}`,
        gridRow: seg.lane + 2,
        ["--blob" as string]: e.color,
        ["--blob-ink" as string]: colorInk(e.color),
      }}
      title={e.title}
      {...bindProps}
      onClick={(ev) => {
        ev.stopPropagation();
        onClick();
      }}
    >
      <ChipBody e={e} bar={seg.bar} />
      {stretchProps && <span className="m-resize" aria-hidden {...stretchProps} />}
    </button>
  );
}
