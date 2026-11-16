import { createContext, useContext } from "react";

export type EpicInfo = { title: string; path: string; color: string };

/** Epiki do etykiet na wpisach w kalendarzu (App podaje mapę id → nazwa/kolor). */
export const EpicContext = createContext<ReadonlyMap<string, EpicInfo>>(new Map());

/** Etykieta epiku na wpisie (nic, gdy wpis nie jest w epiku). */
export function EpicTag({ id }: { id?: string }) {
  const epics = useContext(EpicContext);
  const ep = id ? epics.get(id) : undefined;
  if (!ep) return null;
  return (
    <span className="epic-tag" style={{ ["--epic" as string]: ep.color }} title={`Epik: ${ep.path}`}>
      {ep.title}
    </span>
  );
}
