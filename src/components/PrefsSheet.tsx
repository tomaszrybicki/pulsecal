import { useEffect, useState } from "react";
import { DEFAULT_MOVE_THRESHOLD } from "../moves";
import { DEFAULT_SLOT_MIN, minutesLabel, type ProdHours } from "../prefs";
import { SheetFrame } from "./SheetFrame";

type Props = {
  moveThreshold: number;
  onMoveThreshold: (n: number) => void;
  hours: ProdHours;
  onHours: (h: ProdHours) => void;
  slotMin: number;
  onSlotMin: (n: number) => void;
  alwaysFull: boolean;
  onAlwaysFull: (on: boolean) => void;
  /** Komputer: kliknięcie i tak zawsze otwiera pełną edycję. */
  isDesktop: boolean;
  onOpenSync: () => void;
  onClose: () => void;
};

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromTime = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const clampInt = (v: string, min: number, max: number, fallback: number) =>
  Math.min(max, Math.max(min, Math.round(Number(v) || fallback)));

/** Ustawienia aplikacji (odnośnik „ustawienia” na dole panelu bocznego). */
export function PrefsSheet(p: Props) {
  const [moveDraft, setMoveDraft] = useState(String(p.moveThreshold));
  const [slotDraft, setSlotDraft] = useState(String(p.slotMin));
  const [from, setFrom] = useState(toTime(p.hours.from));
  const [to, setTo] = useState(toTime(p.hours.to));
  const f = fromTime(from);
  const t = fromTime(to);
  const hoursOk = f !== null && t !== null && t > f;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);

  const commitHours = () => {
    if (hoursOk && (f !== p.hours.from || t !== p.hours.to)) p.onHours({ from: f, to: t });
  };

  return (
    <SheetFrame anchor={null} className="prefs-sheet" label="Ustawienia" onDismiss={p.onClose}>
      <h2>ustawienia</h2>

      <section className="prefs-group">
        <h3>godziny produktywności</h3>
        <div className="field-row">
          <label className="field">
            Od
            <input type="time" step={300} value={from} onChange={(e) => setFrom(e.target.value)} onBlur={commitHours} />
          </label>
          <label className="field">
            Do
            <input type="time" step={300} value={to} onChange={(e) => setTo(e.target.value)} onBlur={commitHours} />
          </label>
        </div>
        {!hoursOk && <p className="hint warn-text">Koniec musi być później niż początek.</p>}
        <label className="field">
          Długość wpisu planowanego przyciskiem „P” (minuty)
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={240}
            step={5}
            value={slotDraft}
            onChange={(e) => setSlotDraft(e.target.value)}
            onBlur={() => {
              const v = clampInt(slotDraft, 5, 240, DEFAULT_SLOT_MIN);
              setSlotDraft(String(v));
              p.onSlotMin(v);
            }}
          />
        </label>
        <p className="hint">
          „P” na wpisie (po najechaniu myszą albo w pełnej edycji) wstawia go w najbliższe wolne miejsce tego dnia między{" "}
          {hoursOk ? `${minutesLabel(f)} a ${minutesLabel(t)}` : "tymi godzinami"}. Wpis z „P” przeniesiony na inny dzień
          (w widoku miesiąca albo „&gt;”) znowu dostaje najbliższą wolną godzinę. Wpis całodniowy dostaje tyle minut,
          ile wyżej; wpis z godziną zachowuje swoją długość.
        </p>
      </section>

      <section className="prefs-group">
        <h3>przenoszenie</h3>
        <label className="field">
          Po tylu przeniesieniach na inny dzień podpowiedz pierwszy krok
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={99}
            value={moveDraft}
            onChange={(e) => setMoveDraft(e.target.value)}
            onBlur={() => {
              const v = clampInt(moveDraft, 2, 99, DEFAULT_MOVE_THRESHOLD);
              setMoveDraft(String(v));
              p.onMoveThreshold(v);
            }}
          />
        </label>
        <p className="hint">Wtedy otwiera się pełna edycja wpisu z kursorem w tytule.</p>
      </section>

      <section className="prefs-group">
        <h3>edycja</h3>
        <label className="toggle">
          <input
            type="checkbox"
            checked={p.isDesktop || p.alwaysFull}
            disabled={p.isDesktop}
            onChange={(e) => p.onAlwaysFull(e.target.checked)}
          />
          <span className="toggle-track" aria-hidden>
            <span className="toggle-knob" />
          </span>
          Zawsze pełna edycja po kliknięciu wpisu
        </label>
        <p className="hint">
          {p.isDesktop
            ? "Na komputerze kliknięcie zawsze otwiera pełną edycję. Ustawienie dotyczy telefonu."
            : "Bez szybkiej karty i „Więcej”. Ustawienie tylko na tym urządzeniu."}
        </p>
      </section>

      <div className="row-actions">
        <button type="button" className="ghost" onClick={p.onOpenSync}>
          Google Calendar…
        </button>
        <button type="button" className="primary" onClick={p.onClose}>
          Gotowe
        </button>
      </div>
    </SheetFrame>
  );
}
