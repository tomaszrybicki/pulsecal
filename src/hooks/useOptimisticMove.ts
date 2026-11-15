import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalEvent } from "../types";

type Override = { id: string; start: number; end: number };

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
    if (!live || (live.start === over.start && live.end === over.end)) {
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

  const settle = useCallback((id: string, start: number, end: number) => {
    setOver({ id, start, end });
    setDropped(id);
  }, []);

  return { shown, dropped, settle };
}
