import { useEffect, useRef, useState } from "react";
import { WEEKDAY_LABELS, addMonths, longDateLabel, monthGrid, monthLabel, sameDay, startOfDay, startOfMonth } from "../time";

/** iPhone/iPad: zostawiamy natywne pola (kółko wyboru jest dobre i nie ma siatki tygodnia). */
export function prefersNativeDate(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

type Props = {
  /** Dowolny moment dnia (epoch ms). */
  value: number;
  /** Wybrany dzień (północ lokalna, epoch ms). */
  onChange: (day: number) => void;
  label: string;
};

/**
 * Pole daty z własnym kalendarzem: tydzień od poniedziałku (natywny wybór daty bierze pierwszy dzień
 * tygodnia z języka przeglądarki/systemu, np. niedzielę w angielskim Chrome).
 */
export function DateField({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date(value)));
  const box = useRef<HTMLDivElement>(null);
  const selected = new Date(value);
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    setMonth(startOfMonth(new Date(value)));
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const y = selected.getFullYear();
  return (
    <div className="date-field" ref={box}>
      <button
        type="button"
        className="date-btn"
        aria-label={`${label}: ${longDateLabel(selected)} ${y}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {longDateLabel(selected)}
        {y !== today.getFullYear() ? ` ${y}` : ""}
      </button>
      {open && (
        <div className="date-pop" role="dialog" aria-label={label}>
          <div className="mini-head">
            <span>{monthLabel(month)}</span>
            <button type="button" className="nav-btn" aria-label="Poprzedni miesiąc" onClick={() => setMonth(addMonths(month, -1))}>
              ‹
            </button>
            <button type="button" className="nav-btn" aria-label="Następny miesiąc" onClick={() => setMonth(addMonths(month, 1))}>
              ›
            </button>
          </div>
          <div className="date-grid">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d} className="mini-dow">
                {d.slice(0, 1)}
              </span>
            ))}
            {monthGrid(month).map((d) => (
              <button
                key={d.getTime()}
                type="button"
                className={[
                  "mini-day",
                  d.getMonth() !== month.getMonth() && "out",
                  sameDay(d, today) && "today",
                  sameDay(d, selected) && "focus",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={longDateLabel(d)}
                aria-pressed={sameDay(d, selected)}
                onClick={() => {
                  onChange(startOfDay(d).getTime());
                  setOpen(false);
                }}
              >
                {d.getDate()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
