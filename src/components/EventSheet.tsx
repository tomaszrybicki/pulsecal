import { motion } from "framer-motion";
import { PALETTE } from "../colors";
import type { DraftEvent } from "../types";
import { toLocalInput } from "../time";

type Props = {
  draft: DraftEvent;
  onChange: (d: DraftEvent) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
};

export function EventSheet({ draft, onChange, onClose, onSave, onDelete }: Props) {
  return (
    <motion.div
      className="sheet-backdrop"
      onClick={onClose}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Wpis"
        initial={{ y: 48, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
      >
        <div className="grab" />
        <h2>{draft.id ? "Wpis" : "Nowy blob"}</h2>
        <label className="field">
          Tytuł
          <input
            autoFocus
            value={draft.title}
            placeholder="Co się dzieje?"
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="field">
          Start
          <input
            type="datetime-local"
            value={toLocalInput(draft.start)}
            onChange={(e) => onChange({ ...draft, start: new Date(e.target.value).getTime() })}
          />
        </label>
        <label className="field">
          Koniec
          <input
            type="datetime-local"
            value={toLocalInput(draft.end)}
            onChange={(e) => onChange({ ...draft, end: new Date(e.target.value).getTime() })}
          />
        </label>
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
          <div className="swatches">
            {PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                className="swatch"
                style={{ background: c.value }}
                aria-pressed={draft.color === c.value}
                onClick={() => onChange({ ...draft, color: c.value })}
              />
            ))}
          </div>
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
          <button type="button" className="primary" onClick={onSave}>
            Zapisz
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
