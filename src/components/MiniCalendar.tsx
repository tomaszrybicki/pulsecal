import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  isoWeek,
  longDateLabel,
  monthGrid,
  monthLabel,
  sameDay,
  startOfMonth,
} from "../time";

export type WeekSelection = { start: Date; weeks: number };

export const MAX_SELECTED_WEEKS = 6;

type Props = {
  today: Date;
  focus: Date;
  selection: WeekSelection | null;
  /** Kliknięcie jednego dnia: przejdź do niego (zakres tygodni się czyści). */
  onPickDay: (d: Date) => void;
  /** Przeciągnięcie przez kilka dni/tygodni albo klik w numer tygodnia: pokaż te tygodnie. */
  onPickWeeks: (start: Date, weeks: number) => void;
};

type Drag = { a: number; b: number; byWeek: boolean };

/**
 * Mały kalendarz jak w Google Calendar. Przeciągnij po dniach (albo po numerach tygodni),
 * żeby wybrać kilka tygodni — główny widok pokaże dokładnie je.
 */
export function MiniCalendar({ today, focus, selection, onPickDay, onPickWeeks }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(focus));
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  // nawigacja w głównym widoku przestawia też mały kalendarz
  const focusKey = `${focus.getFullYear()}-${focus.getMonth()}`;
  useEffect(() => {
    setMonth(startOfMonth(focus));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const cells = monthGrid(month);
  const selFrom = selection?.start.getTime() ?? 0;
  const selTo = selection ? addDays(selection.start, selection.weeks * 7).getTime() : 0;

  const indexAt = (x: number, y: number): { i: number; byWeek: boolean } | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-i],[data-w]");
    if (!el) return null;
    if (el.dataset.w !== undefined) return { i: Number(el.dataset.w) * 7, byWeek: true };
    return { i: Number(el.dataset.i), byWeek: false };
  };

  const setBoth = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const hit = indexAt(e.clientX, e.clientY);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setBoth({ a: hit.i, b: hit.i, byWeek: hit.byWeek });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const hit = indexAt(e.clientX, e.clientY);
    if (hit && hit.i !== d.b) setBoth({ ...d, b: hit.i });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    setBoth(null);
    if (!d) return;
    if (!d.byWeek && d.a === d.b) {
      onPickDay(cells[d.a]);
      return;
    }
    const r0 = Math.floor(Math.min(d.a, d.b) / 7);
    const r1 = Math.floor(Math.max(d.a, d.b) / 7);
    onPickWeeks(cells[r0 * 7], Math.min(MAX_SELECTED_WEEKS, r1 - r0 + 1));
  };

  // podgląd zaznaczenia w trakcie przeciągania (całe tygodnie)
  const dragRows =
    drag && (drag.byWeek || drag.a !== drag.b)
      ? [Math.floor(Math.min(drag.a, drag.b) / 7), Math.floor(Math.max(drag.a, drag.b) / 7)]
      : null;

  return (
    <div className="mini">
      <div className="mini-head">
        <span>{monthLabel(month)}</span>
        <button type="button" className="nav-btn" aria-label="Poprzedni miesiąc" onClick={() => setMonth(addMonths(month, -1))}>
          ‹
        </button>
        <button type="button" className="nav-btn" aria-label="Następny miesiąc" onClick={() => setMonth(addMonths(month, 1))}>
          ›
        </button>
      </div>
      <div
        className="mini-grid"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setBoth(null)}
        onKeyDown={(e) => {
          // klawiatura: Enter/spacja na dniu = przejdź, na numerze tygodnia = pokaż ten tydzień
          if (e.key !== "Enter" && e.key !== " ") return;
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-i],[data-w]");
          if (!el) return;
          e.preventDefault();
          if (el.dataset.w !== undefined) onPickWeeks(cells[Number(el.dataset.w) * 7], 1);
          else onPickDay(cells[Number(el.dataset.i)]);
        }}
      >
        <span className="mini-wk-head" aria-hidden>
          tc
        </span>
        {WEEKDAY_LABELS.map((d) => (
          <span key={d} className="mini-dow">
            {d.slice(0, 1)}
          </span>
        ))}
        {Array.from({ length: 6 }, (_, row) => {
          const week = cells.slice(row * 7, row * 7 + 7);
          const rowDragged = dragRows && row >= dragRows[0] && row <= dragRows[1];
          return [
            <button
              key={`w${row}`}
              type="button"
              className={`mini-wk${rowDragged ? " dragging" : ""}`}
              data-w={row}
              aria-label={`Pokaż tydzień ${isoWeek(week[0])}`}
            >
              {isoWeek(week[0])}
            </button>,
            ...week.map((d, c) => {
              const i = row * 7 + c;
              const t = d.getTime();
              const inSel = selection && t >= selFrom && t < selTo;
              const cls = [
                "mini-day",
                d.getMonth() !== month.getMonth() && "out",
                sameDay(d, today) && "today",
                !selection && sameDay(d, focus) && "focus",
                inSel && "sel",
                inSel && c === 0 && "sel-l",
                inSel && c === 6 && "sel-r",
                rowDragged && "dragging",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button key={i} type="button" className={cls} data-i={i} aria-label={longDateLabel(d)}>
                  {d.getDate()}
                </button>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}
