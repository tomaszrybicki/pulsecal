export type EventOrigin = "local" | "google" | "both";

export type ViewMode = "map" | "month" | "tasks";

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
  /** Epik, do którego należy wpis (work.ts). W Google: extendedProperties.private.pulseEpic. */
  epicId?: string;
  /** „P”: planowany w najbliższej wolnej godzinie w godzinach produktywności (prefs.ts). W Google: pulseAuto. */
  autoSlot?: boolean;
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
  epicId?: string;
  autoSlot?: boolean;
}

export type WorkKind = "epic" | "task";
export type WorkStatus = "todo" | "doing" | "done";
export type Priority = "highest" | "high" | "medium" | "low" | "lowest";

/** Własne pole zadań (definicja; wartości w WorkItem.fields). */
export interface WorkField {
  id: string;
  name: string;
  type: "text" | "number" | "select";
  /** Tylko dla „select”. */
  options: string[];
}

/** Zadanie albo epik (work.ts). */
/** Komentarz do zadania / epiku (najnowszy na górze listy). */
export interface WorkComment {
  id: string;
  text: string;
  /** Dodano (epoch ms). */
  at: number;
  /** Ostatnia edycja (epoch ms). */
  edited?: number;
}

export interface WorkItem {
  id: string;
  kind: WorkKind;
  title: string;
  description: string;
  status: WorkStatus;
  /** Epik nadrzędny ("" = najwyższy poziom; pusty string, bo IndexedDB nie indeksuje null). */
  parentId: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  /** 1 = zmiana czeka na wysłanie kopii do Google. */
  pending: 0 | 1;
  /** 1 = kopia jest już w Google. */
  remote?: 0 | 1;
  /** Numer do klucza „PC-12”. */
  num?: number;
  priority?: Priority;
  /** Termin: północ lokalna (epoch ms). */
  due?: number | null;
  /** Szacunek (punkty / godziny — jak kto liczy). */
  estimate?: number | null;
  /** Własne pola: id pola → wartość. */
  fields?: Record<string, string>;
  comments?: WorkComment[];
  /** Epik przypięty w panelu bocznym (podgląd postępu). */
  pinned?: boolean;
}

export type SyncState = "off" | "idle" | "syncing" | "expired" | "offline" | "error";
