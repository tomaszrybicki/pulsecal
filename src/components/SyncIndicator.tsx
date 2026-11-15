import type { SyncState } from "../types";

const LABEL: Record<SyncState, string> = {
  off: "Google niepołączony — ustawienia",
  idle: "Zsynchronizowano z Google — ustawienia",
  syncing: "Synchronizuję z Google…",
  expired: "Sesja Google wygasła — kliknij, aby połączyć ponownie",
  offline: "Offline — zmiany czekają w kolejce",
  error: "Błąd synchronizacji — ustawienia",
};

type Props = { state: SyncState; pending: number; onClick: () => void };

/** Kropka stanu: zielona = ok, pulsuje = sync, bursztynowa = wygasło, szara = off/offline, czerwona = błąd. */
export function SyncIndicator({ state, pending, onClick }: Props) {
  const showQueue = pending > 0 && state !== "off";
  const label = showQueue ? `${LABEL[state]} (${pending} w kolejce)` : LABEL[state];
  return (
    <button className={`icon-btn sync-btn ${state}`} aria-label={label} title={label} onClick={onClick}>
      <span className={`sync-dot ${state}`} />
      {state === "expired" && <span className="sync-label">połącz</span>}
      {state !== "expired" && showQueue && <span className="sync-badge">{pending}</span>}
    </button>
  );
}
