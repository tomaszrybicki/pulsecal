export type EventOrigin = "local" | "google" | "both";

export type ViewMode = "map" | "month" | "tasks" | "projects";

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
  /** Przy którym przeniesieniu była ostatnia podpowiedź „prosty krok” (moves.ts). W Google: pulseNudgedAt. */
  nudgedAt?: number;
  /** Bez podpowiedzi „prosty krok” dla tego wpisu (licznik dalej liczy). W Google: pulseNoNudge. */
  nudgeOff?: boolean;
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
  /** Estymata czasowa w minutach (5 / 30 / 60 / 120 = „2h+”, estimate.ts). W Google: pulseEst. */
  estimate?: number;
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
  estimate?: number;
  /** „Zaplanuj w kalendarzu” przy zadaniu: nowy wpis zostanie powiązany z tym zadaniem. */
  taskId?: string;
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
  /** Zadanie z terminem w kalendarzu: ID wpisu (links.ts). */
  eventId?: string;
  /** Zadanie dla całej serii wpisów powtarzalnych: ID serii w Google. */
  seriesId?: string;
  /** Status ustawiony ręcznie — wtedy nie zmienia się sam po zakończeniu wpisu. */
  statusManual?: boolean;
  /** Epik na kalendarzu: dzień (lokalna północ), w którym jest pokazany jako baner z paskiem zadań. */
  showOn?: number | null;
}

/** Grafika projektu (projects.ts, ProjectArt.tsx). */
/** "custom" = własna grafika (Project.image → tabela `assets`). */
export type ProjectArtKind = "car" | "person" | "custom";

/** Epik położony na płótnie projektu. Współrzędne w jednostkach płótna (CANVAS_W × CANVAS_H, projects.ts). */
export interface ProjectPin {
  epicId: string;
  /** Środek karty epiku. */
  x: number;
  y: number;
  /** Łamana strzałka od karty do punktu na grafice (brak = bez strzałki). */
  arrow?: { x: number; y: number } | null;
}

/** Projekt: grafika + opis + epiki rozłożone wokół grafiki; postęp = suma zrobionych zadań w tych epikach. */
export interface Project {
  id: string;
  title: string;
  description: string;
  art: ProjectArtKind;
  /** Własna grafika: ID w tabeli `assets` + wymiary (po zmniejszeniu przy wgraniu). */
  image?: { id: string; w: number; h: number } | null;
  /** Rozmiar grafiki na płótnie (1 = domyślny). */
  artScale?: number;
  pins: ProjectPin[];
  order: number;
  createdAt: number;
  updatedAt: number;
  deleted: boolean;
  /** 1 = zmiana czeka na wysłanie kopii do Google. */
  pending: 0 | 1;
}

/** Wgrana grafika projektu (data URL, zmniejszona). Osobno od projektu: przeciąganie kart nie wysyła jej od nowa. */
export interface ProjectAsset {
  id: string;
  /** data:image/…;base64,… */
  data: string;
  w: number;
  h: number;
  updatedAt: number;
  deleted: boolean;
  /** 1 = czeka na wysłanie kopii do Google. */
  pending: 0 | 1;
  /** -1 = Google jej nie przyjął (za duża) — zostaje tylko na tym urządzeniu, nie ponawiamy. */
  remote?: 0 | 1 | -1;
}

export type SyncState = "off" | "idle" | "syncing" | "expired" | "offline" | "error";
