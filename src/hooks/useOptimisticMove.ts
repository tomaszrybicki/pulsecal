import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalEvent } from "../types";

/** from* = pozycja przed upuszczeniem: każda zmiana w bazie względem niej znaczy, że zapis już dotarł. */
type Override = { id: string; start: number; end: number; fromStart: number; fromEnd: number };

/**
 * Po upuszczeniu wpis od razu stoi w nowym miejscu, zanim liveQuery z IndexedDB dogoni zapis
 * (bez tego mignąłby na starej pozycji). `dropped` = id do animacji „squish".
 */
export function useOptimisticMove(events: CalEvent[]) {
  const [over, setOver] = useState<Override | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);

  useEffect(() => {
    if (!over) return;
    const live = events.find((e) => e.id === over.id);
    // zapis dotarł — także gdy wylądował gdzie indziej niż upuszczono (wpis z „P” dostaje wolną godzinę)
    if (!live || (live.start === over.start && live.end === over.end) || live.start !== over.fromStart || live.end !== over.fromEnd) {
      setOver(null);
      return;
    }
    const t = window.setTimeout(() => setOver(null), 4000);
    return () => window.clearTimeout(t);
  }, [events, over]);

  useEffect(() => {
    if (!dropped) return;
    const t = window.setTimeout(() => setDropped(null), 520);
    return () => window.clearTimeout(t);
  }, [dropped]);

  const shown = useMemo(
    () => (over ? events.map((e) => (e.id === over.id ? { ...e, start: over.start, end: over.end } : e)) : events),
    [events, over],
  );

  const settle = useCallback(
    (id: string, start: number, end: number) => {
      const cur = events.find((e) => e.id === id);
      setOver({ id, start, end, fromStart: cur?.start ?? start, fromEnd: cur?.end ?? end });
      setDropped(id);
    },
    [events],
  );

  return { shown, dropped, settle };
}
