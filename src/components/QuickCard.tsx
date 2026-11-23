import { useEffect, useRef } from "react";
import { toggleAllDay, whenLabel } from "../draft";
import type { DraftEvent } from "../types";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import { SheetFrame } from "./SheetFrame";
import { ColorSwatches } from "./ColorSwatches";
import { TagInput } from "./TagInput";
import { EpicPicker } from "./EpicPicker";
import { EstimatePicker } from "./EstimatePicker";
import { MovesHint } from "./MovesHint";

type Props = {
  draft: DraftEvent;
  onChange: (d: DraftEvent) => void;
  onSave: () => void;
  /** Zamknięcie bez przycisku (tło, Esc). Istniejący wpis App zapisuje, jeśli coś zmieniono. */
  onDismiss: () => void;
  onMore: () => void;
  onDelete?: () => void;
  knownTags: string[];
  /** Ile razy wpis przeniesiono na inny dzień. */
  moves?: number;
  /** Podpowiedź „prosty krok” wyłączona dla tego wpisu. */
  nudgeOff?: boolean;
  /** Włącz / wyłącz podpowiedź dla tego wpisu (od razu zapisuje). */
  onNudgeOff?: (off: boolean) => void;
  /** Punkt kliknięcia na komputerze → karta wyskakuje przy kursorze. */
  anchor?: Anchor | null;
  epics?: { id: string; label: string }[];
  onCreateEpic?: (name: string) => string;
  /** Ustawienie: nowy wpis tylko z estymatą. */
  requireEstimate?: boolean;
};

/**
 * Szybka karta (odpowiednik popovera Google Calendar): tytuł, kiedy, kolor, akcje.
 * Nowy wpis → kursor od razu w tytule. Istniejący → tytuł to pole edycji (zmiana nazwy jednym tapnięciem).
 * Miejsce na przyszłe szybkie akcje: wiersz `.quick-actions`.
 */
export function QuickCard({
  draft,
  onChange,
  onSave,
  onDismiss,
  onMore,
  onDelete,
  knownTags,
  anchor = null,
  moves,
  nudgeOff = false,
  onNudgeOff,
  epics = [],
  onCreateEpic,
  requireEstimate = false,
}: Props) {
  const isNew = !draft.id;
  const needEst = isNew && requireEstimate && !draft.estimate;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const canSave = draft.title.trim().length > 0 && !needEst;

  return (
    <SheetFrame
      anchor={anchor}
      className="quick"
      backdropClass="light"
      label={isNew ? "Nowy wpis" : "Wpis"}
      onDismiss={onDismiss}
      closable
    >
        <input
          ref={input}
          className="quick-title"
          data-autofocus={isNew || undefined}
          value={draft.title}
          placeholder={isNew ? "Dodaj tytuł" : "Bez tytułu"}
          enterKeyHint="done"
          aria-label="Tytuł"
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSave) onSave();
          }}
        />
        <EstimatePicker
          className="quick-est"
          value={draft.estimate}
          missing={needEst}
          onChange={(estimate) => onChange({ ...draft, estimate })}
        />
        {moves ? <MovesHint moves={moves} off={nudgeOff} onToggle={onNudgeOff} /> : null}
        <div className="quick-when">
          <span>{whenLabel(draft)}</span>
          <button type="button" className="mini-chip" onClick={() => onChange(toggleAllDay(draft))}>
            {draft.allDay ? "+ godzina" : "cały dzień"}
          </button>
        </div>
        <TagInput value={draft.tags} known={knownTags} maxSuggestions={6} onChange={(tags) => onChange({ ...draft, tags })} />
        <ColorSwatches small value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
        {onCreateEpic && (
          <EpicPicker
            className="quick-epic"
            value={draft.epicId}
            epics={epics}
            onCreateEpic={onCreateEpic}
            onChange={(epicId) => onChange({ ...draft, epicId })}
          />
        )}
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
