import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { EpicTag } from "./EpicTag";
import { EstSuffix } from "./EstimatePicker";
import { whenLabel } from "../draft";
import { ESTIMATES } from "../estimate";
import type { CalEvent } from "../types";
import { formatClock, longDateLabel, sameDay } from "../time";
import { LOW_PRIORITY_TAG, isLowPriority, shownColor } from "../tags";

/** Tagi wyróżnione (pogrubione) w przeglądzie dnia. */
export const URGENT_TAGS = ["pilne", "ważne"];

export function isUrgent(e: CalEvent): boolean {
  return (e.tags ?? []).some((t) => URGENT_TAGS.includes(t.toLocaleLowerCase("pl")));
}

/** Najkrótsza estymata (5 min) — takie wpisy idą do bańki „na szybko” na górze. */
const QUICK_MIN = ESTIMATES[0];

/** „1 wpis”, „3 wpisy”, „5 wpisów”, „22 wpisy”. */
function entries(n: number): string {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20);
  return `${n} wpis${n === 1 ? "" : few ? "y" : "ów"}`;
}

/** Najpierw wpisy z godziną (po kolei w czasie), potem całodniowe (alfabetycznie). */
export function dayOrder(a: CalEvent, b: CalEvent): number {
  const ab = a.allDay || !sameDay(new Date(a.start), new Date(Math.max(a.start, a.end - 1)));
  const bb = b.allDay || !sameDay(new Date(b.start), new Date(Math.max(b.start, b.end - 1)));
  // wpisy z godziną po kolei w czasie, całodniowe alfabetycznie
  return (
    Number(ab) - Number(bb) ||
    (ab ? 0 : a.start - b.start) ||
    (a.title || "").localeCompare(b.title || "", "pl", { sensitivity: "base" })
  );
}

/** Prostokąt na ekranie (px). */
export type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  day: Date;
  /** Wpisy tego dnia (widoczne przy obecnym filtrze tagów). */
  events: CalEvent[];
  /** Komórka dnia w miesiącu — z niej widok się „rozsuwa” i do niej wraca. */
  from: Rect | null;
  /** Obszar kalendarza (siatka miesiąca) — rozsunięty dzień jest wyśrodkowany nad nim. */
  area: Rect | null;
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

const HEAD_H = 58;
const BULK_H = 44;
const ROW_H = 30;
const PAD = 20;
/** Bańka „na szybko”: nagłówek + odstępy. */
const QUICK_H = 40;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Rozszerzony dzień: komórka dnia z miesiąca na chwilę „rozsuwa się” na większy obszar (i wraca do niej
 * po zamknięciu) — bez osobnego okienka. Wpisy w jednej linii, z szybkim przekładaniem:
 * „>” na następny dzień, „>>” o tydzień, „> wszystkie low priority”.
 */
export function DayPanel({ day, events, from, area, onClose, onOpen, onShift, onDelete, onContext, onPlan }: Props) {
  const reduce = useReducedMotion();
  const list = [...events].sort(dayOrder);
  const low = list.filter(isLowPriority);
  const quick = list.filter((e) => e.estimate === QUICK_MIN);
  const rest = list.filter((e) => e.estimate !== QUICK_MIN);
  const main = list.length - low.length;
  const count = !list.length
    ? "brak wpisów"
    : !low.length
      ? entries(list.length)
      : main
        ? `${entries(main)} + ${low.length} ${LOW_PRIORITY_TAG}`
        : `tylko ${LOW_PRIORITY_TAG} (${low.length})`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // docelowy prostokąt: szeroko nad kalendarzem, wysokość wg liczby wpisów (dalej przewijanie)
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const box = area ?? { x: 0, y: 0, w: vw, h: vh };
  const width = Math.min(820, vw - 24, Math.max(box.w - 32, 320));
  const height = Math.min(
    HEAD_H + BULK_H + Math.max(1, list.length) * (ROW_H + 2) + PAD + (quick.length ? QUICK_H : 0),
    vh * 0.82,
    vh - 24,
  );
  const left = clamp(box.x + (box.w - width) / 2, 12, vw - width - 12);
  const centerY = from ? from.y + from.h / 2 : vh / 2;
  const top = clamp(centerY - height / 2, 12, vh - height - 12);
  const target = { left, top, width, height, borderRadius: 22, opacity: 1 };
  const origin = from
    ? { left: from.x, top: from.y, width: from.w, height: from.h, borderRadius: 16, opacity: 1 }
    : { ...target, opacity: 0 };
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 340, damping: 30, mass: 0.9 };

  const when = (e: CalEvent) =>
    e.allDay
      ? "cały dzień"
      : !sameDay(new Date(e.start), new Date(e.end - 1))
        ? whenLabel(e)
        : `${formatClock(new Date(e.start))}–${formatClock(new Date(e.end))}`;

  const row = (e: CalEvent) => (
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
      <button type="button" className="dx-open" onClick={() => onOpen(e)}>
        <span className="dx-dot" style={{ background: shownColor(e) }} aria-hidden />
        <span className="dx-time">{when(e)}</span>
        <span className="dx-title">
          {e.title || "(bez tytułu)"}
          <EstSuffix min={e.estimate} />
        </span>
        <EpicTag id={e.epicId} />
        {e.tags?.length ? <span className="dx-tags">{e.tags.join(", ")}</span> : null}
        {e.moves ? (
          <span className="dx-mv" title={`Przeniesiony ${e.moves}×`}>
            ↷{e.moves}
          </span>
        ) : null}
      </button>
      <span className="dx-actions">
        {onPlan && (
          <button
            type="button"
            className={`dx-btn dx-plan${e.autoSlot ? " on" : ""}`}
            aria-pressed={Boolean(e.autoSlot)}
            title={e.autoSlot ? "P: w godzinach produktywności (kliknij, żeby wyłączyć)" : "P: najbliższa wolna godzina w godzinach produktywności"}
            aria-label={`${e.title}: P`}
            onClick={() => onPlan(e)}
          >
            P
          </button>
        )}
        <button type="button" className="dx-btn" title="Na następny dzień" aria-label={`${e.title}: na następny dzień`} onClick={() => onShift([e], 1)}>
          &gt;
        </button>
        <button type="button" className="dx-btn" title="Za tydzień" aria-label={`${e.title}: za tydzień`} onClick={() => onShift([e], 7)}>
          &gt;&gt;
        </button>
        <button type="button" className="dx-btn dx-del" title="Usuń" aria-label={`Usuń ${e.title}`} onClick={() => onDelete(e)}>
          ×
        </button>
      </span>
    </li>
  );

  return (
    <>
      <motion.div
        className="dx-backdrop"
        onClick={onClose}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <motion.div
        className="day-expand"
        role="dialog"
        aria-label={`Przegląd dnia: ${longDateLabel(day)}`}
        initial={origin}
        animate={target}
        exit={origin}
        transition={spring}
      >
        <motion.div
          className="dx-inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: reduce ? 0 : 0.1, duration: 0.18 } }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
        >
          <header className="dx-head">
            <span className="dx-num">{day.getDate()}</span>
            <span className="dx-date">
              <b>{longDateLabel(day)}</b>
              <span className="hint">{count}</span>
            </span>
            <button
              type="button"
              className="dx-all"
              disabled={!low.length}
              title={`Przenieś na następny dzień wszystko z tagiem „${LOW_PRIORITY_TAG}”`}
              onClick={() => onShift(low, 1)}
            >
              &gt; wszystkie {LOW_PRIORITY_TAG}
              {low.length ? ` (${low.length})` : ""}
            </button>
            <button type="button" className="sheet-x dx-x" aria-label="Zamknij" title="Zamknij (Esc)" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="dx-body">
            {quick.length > 0 && (
              <section className="dx-quick" aria-label={`Na szybko: ${QUICK_MIN} min`}>
                <h3 className="dx-quick-head">
                  na szybko <span>{QUICK_MIN} min · {quick.length}</span>
                </h3>
                <ul className="dx-list">{quick.map(row)}</ul>
              </section>
            )}
            <ul className="dx-list">
              {rest.map(row)}
              {!list.length && <li className="dx-empty hint">Nic tego dnia.</li>}
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
