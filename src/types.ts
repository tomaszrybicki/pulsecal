export type EventOrigin = "local" | "google" | "both";

export type ViewMode = "map" | "month";

export interface CalEvent {
  id: string;
  title: string;
  notes: string;
  start: number;
  end: number;
  allDay: boolean;
  color: string;
  /** Tagi (małe litery). W Google zapisane jako ostatnia linia opisu „Tagi: a, b" — patrz tags.ts. */
  tags: string[];
  /** Ile razy wpis przeniesiono na inny dzień (moves.ts). W Google: extendedProperties.private.pulseMoves. */
  moves?: number;
  googleEventId?: string;
  googleEtag?: string;
  /** Instancja wydarzenia cyklicznego z Google (edycja dotyczy tylko tej instancji). */
  recurring?: boolean;
  /** ID serii w Google (recurringEventId) — do odświeżenia całej serii po zmianie w Google. */
  seriesId?: string;
  origin: EventOrigin;
  updatedAt: number;
  deleted: boolean;
  /** 1 = lokalna zmiana czeka na wysłanie do Google (liczba, bo IndexedDB nie indeksuje booleanów). */
  pending: 0 | 1;
}

export interface DraftEvent {
  id?: string;
  title: string;
  notes: string;
  start: number;
  end: number;
  allDay: boolean;
  color: string;
  tags: string[];
}

export type SyncState = "off" | "idle" | "syncing" | "expired" | "offline" | "error";
