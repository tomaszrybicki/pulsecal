import { createContext, useContext } from "react";

export type EpicInfo = {
  title: string;
  path: string;
  color: string;
  /** Epiki nadrzędne (najbliższy pierwszy) — np. grupa „Zdrowie” obejmuje też „Zdrowie › internista”. */
  ancestors: string[];
};

/** Epiki do etykiet na wpisach w kalendarzu (App podaje mapę id → nazwa/kolor). */
export const EpicContext = createContext<ReadonlyMap<string, EpicInfo>>(new Map());

/** Kliknięcie etykiety epiku → szczegóły epiku (App). */
export const EpicOpenContext = createContext<((id: string) => void) | null>(null);

/** Etykieta epiku na wpisie (nic, gdy wpis nie jest w epiku). */
export function EpicTag({ id }: { id?: string }) {
  const epics = useContext(EpicContext);
  const open = useContext(EpicOpenContext);
  const ep = id ? epics.get(id) : undefined;
  if (!id || !ep) return null;
  if (!open) {
    return (
      <span className="epic-tag" style={{ ["--epic" as string]: ep.color }} title={`Epik: ${ep.path}`}>
        {ep.title}
      </span>
    );
  }
  // span role=button, bo etykieta siedzi w <button> wpisu; bez startu przeciągania i bez otwierania wpisu
  return (
    <span
      role="button"
      tabIndex={-1}
      className="epic-tag link"
      style={{ ["--epic" as string]: ep.color }}
      title={`Epik: ${ep.path} — kliknij, żeby otworzyć`}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        open(id);
      }}
    >
      {ep.title}
    </span>
  );
}
