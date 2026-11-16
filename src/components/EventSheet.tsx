import { useEffect } from "react";
import { toggleAllDay } from "../draft";
import type { DraftEvent } from "../types";
import { addDays, dayDiff, endOfDay, formatClock, parseLocalInput, toDateInput, toLocalInput } from "../time";
import { DateField, prefersNativeDate } from "./DateField";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import { SheetFrame } from "./SheetFrame";
import { ColorSwatches } from "./ColorSwatches";
import { TagInput } from "./TagInput";
import { EpicPicker } from "./EpicPicker";

type Props = {
  draft: DraftEvent;
  onChange: (d: DraftEvent) => void;
  /** „Anuluj": zamknij bez zapisu. */
  onClose: () => void;
  /** Tło / Esc: istniejący wpis ze zmianami App zapisuje, nowy odrzuca. */
  onDismiss: () => void;
  onSave: () => void;
  onDelete?: () => void;
  knownTags: string[];
  /** Ile razy wpis przeniesiono na inny dzień. */
  moves?: number;
  /** Punkt kliknięcia na komputerze → okno wyskakuje przy kursorze. */
  anchor?: Anchor | null;
  /** Epiki do wyboru (work.ts). */
  epics?: { id: string; label: string }[];
  /** Nowy epik z poziomu wpisu → jego ID. */
  onCreateEpic?: (name: string) => string;
  /** Otwarte po N-tym przeniesieniu: podpowiedź „zacznij od prostego kroku” i kursor w tytule. */
  stuck?: boolean;
  /** „P”: najbliższa wolna godzina w godzinach produktywności (albo wyłączenie). */
  onPlan?: () => void;
  /** np. „9:00–17:00” */
  prodLabel?: string;
};

const NATIVE_DATE = prefersNativeDate();

export function EventSheet({
  draft,
  onChange,
  onClose,
  onDismiss,
  onSave,
  onDelete,
  knownTags,
  anchor = null,
  moves,
  epics = [],
  onCreateEpic,
  stuck = false,
  onPlan,
  prodLabel,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const setTimedStart = (value: string) => {
    const start = parseLocalInput(value);
    // zachowaj długość wpisu przy przesuwaniu startu
    if (start !== null) onChange({ ...draft, start, end: start + (draft.end - draft.start) });
  };
  const setTimedEnd = (value: string) => {
    const end = parseLocalInput(value);
    if (end !== null) onChange({ ...draft, end });
  };
  const setDayStart = (value: string) => {
    const start = parseLocalInput(value);
    if (start === null) return;
    const days = dayDiff(new Date(draft.start), new Date(draft.end));
    onChange({ ...draft, start, end: endOfDay(addDays(new Date(start), days)).getTime() });
  };
  const setDayEnd = (value: string) => {
    const t = parseLocalInput(value);
    if (t === null) return;
    onChange({ ...draft, end: endOfDay(new Date(Math.max(t, draft.start))).getTime() });
  };

  return (
    <SheetFrame anchor={anchor} label="Wpis" onDismiss={onDismiss}>
        <h2>{draft.id ? "Wpis" : "Nowy blob"}</h2>
        {stuck ? (
          <p className="stuck-hint">
            ↷ {moves}. przeniesienie. Zacznij od prostego kroku — wpisz go jako tytuł.
          </p>
        ) : moves ? (
          <p className="moves-hint">↷ przeniesiony {moves}×</p>
        ) : null}
        <label className="field">
          Tytuł
          <input
            data-autofocus={!draft.id || stuck || undefined}
            value={draft.title}
            placeholder="Co się dzieje?"
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={draft.allDay} onChange={() => onChange(toggleAllDay(draft))} />
          <span className="toggle-track" aria-hidden>
            <span className="toggle-knob" />
          </span>
          Cały dzień
        </label>
        {onPlan && (
          <button
            type="button"
            className={`plan-toggle${draft.autoSlot ? " on" : ""}`}
            aria-pressed={Boolean(draft.autoSlot)}
            onClick={onPlan}
          >
            <b>P</b>
            {draft.autoSlot
              ? `w godzinach produktywności${prodLabel ? ` (${prodLabel})` : ""} — kliknij, żeby wyłączyć`
              : `najbliższa wolna godzina${prodLabel ? ` w ${prodLabel}` : ""}`}
          </button>
        )}
        {NATIVE_DATE ? (
          // iPhone/iPad: natywne pola (kółko wyboru) — bez siatki tygodnia, więc bez problemu z niedzielą
          draft.allDay ? (
            <div className="field-row">
              <label className="field">
                Od
                <input type="date" value={toDateInput(draft.start)} onChange={(e) => setDayStart(e.target.value)} />
              </label>
              <label className="field">
                Do
                <input type="date" value={toDateInput(draft.end)} onChange={(e) => setDayEnd(e.target.value)} />
              </label>
            </div>
          ) : (
            <>
              <label className="field">
                Start
                <input
                  type="datetime-local"
                  value={toLocalInput(draft.start)}
                  onChange={(e) => setTimedStart(e.target.value)}
                />
              </label>
              <label className="field">
                Koniec
                <input
                  type="datetime-local"
                  value={toLocalInput(draft.end)}
                  onChange={(e) => setTimedEnd(e.target.value)}
                />
              </label>
            </>
          )
        ) : draft.allDay ? (
          <div className="field-row">
            <div className="field">
              Od
              <DateField label="Od" value={draft.start} onChange={(day) => setDayStart(toDateInput(day))} />
            </div>
            <div className="field">
              Do
              <DateField label="Do" value={draft.end} onChange={(day) => setDayEnd(toDateInput(day))} />
            </div>
          </div>
        ) : (
          <>
            <div className="field">
              Start
              <div className="date-time">
                <DateField
                  label="Data startu"
                  value={draft.start}
                  onChange={(day) => setTimedStart(`${toDateInput(day)}T${formatClock(new Date(draft.start))}`)}
                />
                <input
                  type="time"
                  aria-label="Godzina startu"
                  value={formatClock(new Date(draft.start))}
                  onChange={(e) => e.target.value && setTimedStart(`${toDateInput(draft.start)}T${e.target.value}`)}
                />
              </div>
            </div>
            <div className="field">
              Koniec
              <div className="date-time">
                <DateField
                  label="Data końca"
                  value={draft.end}
                  onChange={(day) => setTimedEnd(`${toDateInput(day)}T${formatClock(new Date(draft.end))}`)}
                />
                <input
                  type="time"
                  aria-label="Godzina końca"
                  value={formatClock(new Date(draft.end))}
                  onChange={(e) => e.target.value && setTimedEnd(`${toDateInput(draft.end)}T${e.target.value}`)}
                />
              </div>
            </div>
          </>
        )}
        <div className="field">
          Tagi
          <TagInput value={draft.tags} known={knownTags} onChange={(tags) => onChange({ ...draft, tags })} />
        </div>
        {onCreateEpic && (
          <div className="field">
            Epik
            <EpicPicker
              value={draft.epicId}
              epics={epics}
              onCreateEpic={onCreateEpic}
              onChange={(epicId) => onChange({ ...draft, epicId })}
            />
          </div>
        )}
        <label className="field">
          Notatka
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </label>
        <div className="field">
          Kolor
          <ColorSwatches value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
        </div>
        <div className="row-actions">
          {onDelete ? (
            <button type="button" className="danger" onClick={onDelete}>
              Usuń
            </button>
          ) : (
            <button type="button" className="ghost" onClick={onClose}>
              Anuluj
            </button>
          )}
          <button type="button" className="primary" onClick={onSave} disabled={!draft.title.trim()}>
            Zapisz
          </button>
        </div>
    </SheetFrame>
  );
}
