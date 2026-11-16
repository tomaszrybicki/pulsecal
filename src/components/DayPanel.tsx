import { EpicTag } from "./EpicTag";
import { shownColor } from "../tags";
import { useEffect } from "react";
import { whenLabel } from "../draft";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import type { CalEvent } from "../types";
import { formatClock, longDateLabel, sameDay } from "../time";
import { LOW_PRIORITY_TAG, hasTag } from "../tags";
import { SheetFrame } from "./SheetFrame";
import { EstSuffix } from "./EstimatePicker";

/** Tagi wyróżnione (pogrubione) w przeglądzie dnia. */
export const URGENT_TAGS = ["pilne", "ważne"];

export function isUrgent(e: CalEvent): boolean {
  return (e.tags ?? []).some((t) => URGENT_TAGS.includes(t.toLocaleLowerCase("pl")));
}

export function isLowPriority(e: CalEvent): boolean {
  return hasTag(e.tags ?? [], LOW_PRIORITY_TAG);
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
  onDelete: (e: CalEvent) => void;
  /** Prawy przycisk myszy na wpisie → menu (kolor, tagi, usuń). */
  onContext?: (e: CalEvent, pt: { x: number; y: number }) => void;
  /** „P”: najbliższa wolna godzina w godzinach produktywności (albo wyłączenie). */
  onPlan?: (e: CalEvent) => void;
};

/**
 * Przegląd dnia: wszystkie wpisy dnia (zamiast „+N więcej" → mapa) z szybkim przekładaniem:
 * „>" na następny dzień, „>>" o tydzień, „> wszystkie low priority" — wszystko z tagiem „low priority".
 */
export function DayPanel({ day, events, anchor, onClose, onOpen, onShift, onDelete, onContext, onPlan }: Props) {
  const list = [...events].sort(dayOrder);
  const low = list.filter(isLowPriority);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <SheetFrame anchor={anchor} className="day-panel" backdropClass="light" label="Przegląd dnia" onDismiss={onClose} closable>
      <header className="dp-head">
        <h2>{longDateLabel(day)}</h2>
        <span className="hint">{list.length ? `${list.length} wpis${list.length === 1 ? "" : list.length < 5 ? "y" : "ów"}` : "brak wpisów"}</span>
      </header>
      <button
        type="button"
        className="dp-all"
        disabled={!low.length}
        title={`Przenieś na następny dzień wszystko z tagiem „${LOW_PRIORITY_TAG}”`}
        onClick={() => onShift(low, 1)}
      >
        &gt; wszystkie {LOW_PRIORITY_TAG}
        {low.length ? ` (${low.length})` : ""}
      </button>
      <ul className="dp-list">
        {list.map((e) => (
          <li
            key={e.id}
            className={isUrgent(e) ? "urgent" : isLowPriority(e) ? "low" : ""}
            onContextMenu={
              onContext
                ? (ev) => {
                    ev.preventDefault();
                    onContext(e, { x: ev.clientX, y: ev.clientY });
                  }
                : undefined
            }
          >
            <button type="button" className="dp-open" onClick={() => onOpen(e)}>
              <span className="dp-dot" style={{ background: shownColor(e) }} aria-hidden />
              <span className="dp-main">
                <span className="dp-title">
                  {e.title || "(bez tytułu)"}
                  <EstSuffix min={e.estimate} /> <EpicTag id={e.epicId} />
                </span>
                <span className="dp-when">
                  {e.allDay || !sameDay(new Date(e.start), new Date(e.end - 1))
                    ? whenLabel(e)
                    : `${formatClock(new Date(e.start))}–${formatClock(new Date(e.end))}`}
                  {e.tags?.length ? ` · ${e.tags.join(", ")}` : ""}
                  {e.moves ? ` · przeniesiony ${e.moves}×` : ""}
                </span>
              </span>
            </button>
            {onPlan && (
              <button
                type="button"
                className={`dp-shift dp-plan${e.autoSlot ? " on" : ""}`}
                aria-pressed={Boolean(e.autoSlot)}
                title={e.autoSlot ? "P: w godzinach produktywności (kliknij, żeby wyłączyć)" : "P: najbliższa wolna godzina w godzinach produktywności"}
                aria-label={`${e.title}: P`}
                onClick={() => onPlan(e)}
              >
                P
              </button>
            )}
            <button type="button" className="dp-shift" title="Na następny dzień" aria-label={`${e.title}: na następny dzień`} onClick={() => onShift([e], 1)}>
              &gt;
            </button>
            <button type="button" className="dp-shift" title="Za tydzień" aria-label={`${e.title}: za tydzień`} onClick={() => onShift([e], 7)}>
              &gt;&gt;
            </button>
            <button type="button" className="dp-shift dp-del" title="Usuń" aria-label={`Usuń ${e.title}`} onClick={() => onDelete(e)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </SheetFrame>
  );
}
