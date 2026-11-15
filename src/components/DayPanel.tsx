import { useEffect } from "react";
import { whenLabel } from "../draft";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import type { CalEvent } from "../types";
import { formatClock, longDateLabel, sameDay } from "../time";
import { SheetFrame } from "./SheetFrame";

/** Tagi, które chronią wpis przed „> wszystkie niepilne". */
export const URGENT_TAGS = ["pilne", "ważne"];

export function isUrgent(e: CalEvent): boolean {
  return (e.tags ?? []).some((t) => URGENT_TAGS.includes(t.toLocaleLowerCase("pl")));
}

/** Kolejność jak w widoku miesiąca: najpierw wpisy z godziną, potem całodniowe; w grupach alfabetycznie. */
export function dayOrder(a: CalEvent, b: CalEvent): number {
  const ab = a.allDay || !sameDay(new Date(a.start), new Date(Math.max(a.start, a.end - 1)));
  const bb = b.allDay || !sameDay(new Date(b.start), new Date(Math.max(b.start, b.end - 1)));
  return Number(ab) - Number(bb) || (a.title || "").localeCompare(b.title || "", "pl", { sensitivity: "base" });
}

type Props = {
  day: Date;
  /** Wpisy tego dnia (widoczne przy obecnym filtrze tagów). */
  events: CalEvent[];
  anchor: Anchor | null;
  onClose: () => void;
  onOpen: (e: CalEvent) => void;
  /** Przesuń wpisy o `days` dni (z zachowaniem godziny). */
  onShift: (list: CalEvent[], days: number) => void;
};

/**
 * Przegląd dnia: wszystkie wpisy dnia (zamiast „+N więcej" → mapa) z szybkim przekładaniem:
 * „>" na następny dzień, „>>" o tydzień, „> wszystkie niepilne" — wszystko bez tagu „pilne"/„ważne".
 */
export function DayPanel({ day, events, anchor, onClose, onOpen, onShift }: Props) {
  const list = [...events].sort(dayOrder);
  const notUrgent = list.filter((e) => !isUrgent(e));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <SheetFrame anchor={anchor} className="day-panel" backdropClass="light" label="Przegląd dnia" onDismiss={onClose}>
      <header className="dp-head">
        <h2>{longDateLabel(day)}</h2>
        <span className="hint">{list.length ? `${list.length} wpis${list.length === 1 ? "" : list.length < 5 ? "y" : "ów"}` : "brak wpisów"}</span>
      </header>
      <button
        type="button"
        className="dp-all"
        disabled={!notUrgent.length}
        title="Przenieś na następny dzień wszystko, co nie ma tagu „pilne” ani „ważne”"
        onClick={() => onShift(notUrgent, 1)}
      >
        &gt; wszystkie niepilne{notUrgent.length ? ` (${notUrgent.length})` : ""}
      </button>
      <ul className="dp-list">
        {list.map((e) => (
          <li key={e.id} className={isUrgent(e) ? "urgent" : ""}>
            <button type="button" className="dp-open" onClick={() => onOpen(e)}>
              <span className="dp-dot" style={{ background: e.color }} aria-hidden />
              <span className="dp-main">
                <span className="dp-title">{e.title || "(bez tytułu)"}</span>
                <span className="dp-when">
                  {e.allDay || !sameDay(new Date(e.start), new Date(e.end - 1))
                    ? whenLabel(e)
                    : `${formatClock(new Date(e.start))}–${formatClock(new Date(e.end))}`}
                  {e.tags?.length ? ` · ${e.tags.join(", ")}` : ""}
                </span>
              </span>
            </button>
            <button type="button" className="dp-shift" title="Na następny dzień" aria-label={`${e.title}: na następny dzień`} onClick={() => onShift([e], 1)}>
              &gt;
            </button>
            <button type="button" className="dp-shift" title="Za tydzień" aria-label={`${e.title}: za tydzień`} onClick={() => onShift([e], 7)}>
              &gt;&gt;
            </button>
          </li>
        ))}
      </ul>
    </SheetFrame>
  );
}
