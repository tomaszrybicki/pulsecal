import { useEffect } from "react";
import { toggleAllDay } from "../draft";
import type { DraftEvent } from "../types";
import { addDays, dayDiff, endOfDay, parseLocalInput, toDateInput, toLocalInput } from "../time";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import { SheetFrame } from "./SheetFrame";
import { ColorSwatches } from "./ColorSwatches";
import { TagInput } from "./TagInput";

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
  /** Punkt kliknięcia na komputerze → okno wyskakuje przy kursorze. */
  anchor?: Anchor | null;
};

export function EventSheet({ draft, onChange, onClose, onDismiss, onSave, onDelete, knownTags, anchor = null }: Props) {
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
        <label className="field">
          Tytuł
          <input
            data-autofocus={!draft.id || undefined}
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
        {draft.allDay ? (
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
        )}
        <div className="field">
          Tagi
          <TagInput value={draft.tags} known={knownTags} onChange={(tags) => onChange({ ...draft, tags })} />
        </div>
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
