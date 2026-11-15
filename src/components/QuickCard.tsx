import { useEffect, useRef } from "react";
import { PALETTE } from "../colors";
import { toggleAllDay, whenLabel } from "../draft";
import type { DraftEvent } from "../types";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import { SheetFrame } from "./SheetFrame";
import { TagInput } from "./TagInput";

type Props = {
  draft: DraftEvent;
  onChange: (d: DraftEvent) => void;
  onSave: () => void;
  /** Zamknięcie bez przycisku (tło, Esc). Istniejący wpis App zapisuje, jeśli coś zmieniono. */
  onDismiss: () => void;
  onMore: () => void;
  onDelete?: () => void;
  knownTags: string[];
  /** Punkt kliknięcia na komputerze → karta wyskakuje przy kursorze. */
  anchor?: Anchor | null;
};

/**
 * Szybka karta (odpowiednik popovera Google Calendar): tytuł, kiedy, kolor, akcje.
 * Nowy wpis → kursor od razu w tytule. Istniejący → tytuł to pole edycji (zmiana nazwy jednym tapnięciem).
 * Miejsce na przyszłe szybkie akcje: wiersz `.quick-actions`.
 */
export function QuickCard({ draft, onChange, onSave, onDismiss, onMore, onDelete, knownTags, anchor = null }: Props) {
  const isNew = !draft.id;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) return;
    input.current?.focus();
  }, [isNew]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const canSave = draft.title.trim().length > 0;

  return (
    <SheetFrame
      anchor={anchor}
      className="quick"
      backdropClass="light"
      label={isNew ? "Nowy wpis" : "Wpis"}
      onDismiss={onDismiss}
    >
        <input
          ref={input}
          className="quick-title"
          value={draft.title}
          placeholder={isNew ? "Dodaj tytuł" : "Bez tytułu"}
          enterKeyHint="done"
          aria-label="Tytuł"
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) onSave();
          }}
        />
        <div className="quick-when">
          <span>{whenLabel(draft)}</span>
          <button type="button" className="mini-chip" onClick={() => onChange(toggleAllDay(draft))}>
            {draft.allDay ? "+ godzina" : "cały dzień"}
          </button>
        </div>
        <TagInput value={draft.tags} known={knownTags} maxSuggestions={6} onChange={(tags) => onChange({ ...draft, tags })} />
        <div className="swatches small">
          {PALETTE.map((c) => (
            <button
              key={c.id}
              type="button"
              className="swatch"
              aria-label={`Kolor ${c.id}`}
              style={{ background: c.value }}
              aria-pressed={draft.color === c.value}
              onClick={() => onChange({ ...draft, color: c.value })}
            />
          ))}
        </div>
        <div className="row-actions quick-actions">
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete}>
              Usuń
            </button>
          )}
          <button type="button" className="ghost" onClick={onMore}>
            Więcej
          </button>
          <button type="button" className="primary" onClick={onSave} disabled={!canSave}>
            Zapisz
          </button>
        </div>
    </SheetFrame>
  );
}
