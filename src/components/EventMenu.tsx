import { useEffect, useState } from "react";
import type { Anchor } from "../hooks/useAnchoredPlacement";
import type { CalEvent } from "../types";
import { SheetFrame } from "./SheetFrame";
import { ColorSwatches } from "./ColorSwatches";
import { TagInput } from "./TagInput";
import { EpicPicker } from "./EpicPicker";

type Props = {
  event: CalEvent;
  anchor: Anchor | null;
  knownTags: string[];
  onClose: () => void;
  /** Zmiana zapisywana od razu (kolor / tagi). */
  onPatch: (patch: Partial<Pick<CalEvent, "color" | "tags" | "epicId">>) => void;
  /** Epiki do wyboru (work.ts). */
  epics?: { id: string; label: string }[];
  onCreateEpic?: (name: string) => string;
  onDelete: () => void;
  onEdit: () => void;
};

/** Menu pod prawym przyciskiem myszy na wpisie: kolor, tagi, edycja, usuń — bez wchodzenia w edycję. */
export function EventMenu({ event, anchor, knownTags, onClose, onPatch, onDelete, onEdit, epics = [], onCreateEpic }: Props) {
  const [color, setColor] = useState(event.color);
  const [tags, setTags] = useState(event.tags ?? []);
  const [epicId, setEpicId] = useState(event.epicId ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <SheetFrame anchor={anchor} className="event-menu" backdropClass="light" label="Menu wpisu" onDismiss={onClose} closable>
      <div className="em-title">{event.title || "(bez tytułu)"}</div>
      <ColorSwatches
        small
        value={color}
        onChange={(c) => {
          setColor(c);
          onPatch({ color: c });
        }}
      />
      <TagInput
        value={tags}
        known={knownTags}
        maxSuggestions={6}
        onChange={(t) => {
          setTags(t);
          onPatch({ tags: t });
        }}
      />
      {onCreateEpic && (
        <EpicPicker
          className="em-epic"
          value={epicId || undefined}
          epics={epics}
          onCreateEpic={onCreateEpic}
          onChange={(id) => {
            setEpicId(id ?? "");
            onPatch({ epicId: id });
          }}
        />
      )}
      <div className="row-actions">
        <button type="button" className="danger" onClick={onDelete}>
          Usuń
        </button>
        <button type="button" className="ghost" onClick={onEdit}>
          Edytuj
        </button>
        <button type="button" className="primary" onClick={onClose}>
          OK
        </button>
      </div>
    </SheetFrame>
  );
}
