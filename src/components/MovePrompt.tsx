import { useEffect, useState } from "react";
import type { CalEvent } from "../types";
import { SheetFrame } from "./SheetFrame";

type Props = {
  event: CalEvent;
  onClose: () => void;
  /** Dopisz kroki do notatki wpisu (jako listę „- krok”). */
  onAppendNotes: (steps: string[]) => void;
  /** Utwórz z kroków osobne wpisy tego samego dnia. */
  onCreateSteps: (steps: string[]) => void;
};

/**
 * Wpis przenoszony wiele razy → łagodna propozycja: rozpisz go na mniejsze, konkretne kroki.
 * (Częste odkładanie zwykle znaczy, że zadanie jest za duże albo niejasne — pierwszy krok pomaga zacząć.)
 */
export function MovePrompt({ event, onClose, onAppendNotes, onCreateSteps }: Props) {
  const [text, setText] = useState("");
  const steps = text
    .split("\n")
    .map((s) => s.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
  const n = event.moves ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <SheetFrame anchor={null} className="move-prompt" label="Rozbij wpis na kroki" onDismiss={onClose}>
      <h2>Przeniesiony {n} razy</h2>
      <p className="hint">
        „{event.title}” odkładasz już {n}. raz. Może łatwiej będzie zacząć, gdy rozpiszesz go na mniejsze, konkretne
        kroki — albo zapiszesz, co dokładnie jest pierwszym krokiem.
      </p>
      <label className="field">
        Kroki — jeden w linii
        <textarea
          rows={5}
          value={text}
          data-autofocus
          placeholder={"np.\nznaleźć numer telefonu\nzadzwonić i umówić termin"}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="row-actions">
        <button type="button" className="ghost" onClick={onClose}>
          Nie teraz
        </button>
        <button type="button" className="ghost" disabled={!steps.length} onClick={() => onAppendNotes(steps)}>
          Dopisz do notatki
        </button>
        <button type="button" className="primary" disabled={!steps.length} onClick={() => onCreateSteps(steps)}>
          Osobne wpisy ({steps.length})
        </button>
      </div>
    </SheetFrame>
  );
}
