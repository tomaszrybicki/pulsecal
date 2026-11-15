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
  googleEventId?: string;
  googleEtag?: string;
  origin: EventOrigin;
  updatedAt: number;
  deleted: boolean;
}

export interface DraftEvent {
  id?: string;
  title: string;
  notes: string;
  start: number;
  end: number;
  allDay: boolean;
  color: string;
}
