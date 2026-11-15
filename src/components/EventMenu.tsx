import { useEffect, useState } from "react";
import { PALETTE } from "../colors";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import type { CalEvent } from "../types";
import { SheetFrame } from "./SheetFrame";
import { TagInput } from "./TagInput";

type Props = {
  event: CalEvent;
  anchor: Anchor | null;
  knownTags: string[];
  onClose: () => void;
  /** Zmiana zapisywana od razu (kolor / tagi). */
  onPatch: (patch: Partial<Pick<CalEvent, "color" | "tags">>) => void;
  onDelete: () => void;
  onEdit: () => void;
};

/** Menu pod prawym przyciskiem myszy na wpisie: kolor, tagi, edycja, usuń — bez wchodzenia w edycję. */
export function EventMenu({ event, anchor, knownTags, onClose, onPatch, onDelete, onEdit }: Props) {
  const [color, setColor] = useState(event.color);
  const [tags, setTags] = useState(event.tags ?? []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <SheetFrame anchor={anchor} className="event-menu" backdropClass="light" label="Menu wpisu" onDismiss={onClose}>
      <div className="em-title">{event.title || "(bez tytułu)"}</div>
      <div className="swatches small">
        {PALETTE.map((c) => (
          <button
            key={c.id}
            type="button"
            className="swatch"
            aria-label={`Kolor ${c.id}`}
            style={{ background: c.value }}
            aria-pressed={color === c.value}
            onClick={() => {
              setColor(c.value);
              onPatch({ color: c.value });
            }}
          />
        ))}
      </div>
      <TagInput
        value={tags}
        known={knownTags}
        maxSuggestions={6}
        onChange={(t) => {
          setTags(t);
          onPatch({ tags: t });
        }}
      />
      <div className="row-actions">
        <button type="button" className="danger" onClick={onDelete}>
          Usuń
        </button>
        <button type="button" className="ghost" onClick={onEdit}>
          Edytuj
        </button>
      </div>
    </SheetFrame>
  );
}
