import { GOOGLE_COLOR_MAP, PALETTE } from "../colors";
import { db, upsertEvent } from "../db";
import type { CalEvent } from "../types";
import { isoDate } from "../time";

const TOKEN_KEY = "pulsecal:google-token";
const CLIENT_KEY = "pulsecal:google-client-id";
const CAL_KEY = "pulsecal:google-calendar-id";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

type TokenBlob = { access_token: string; expires_at: number };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

export function getStoredClientId(): string {
  return localStorage.getItem(CLIENT_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

export function setStoredClientId(id: string): void {
  localStorage.setItem(CLIENT_KEY, id.trim());
}

export function getCalendarId(): string {
  return localStorage.getItem(CAL_KEY) || "primary";
}

export function setCalendarId(id: string): void {
  localStorage.setItem(CAL_KEY, id.trim() || "primary");
}

function readToken(): TokenBlob | null {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as TokenBlob;
    if (t.expires_at < Date.now() + 15_000) return null;
    return t;
  } catch {
    return null;
  }
}

function writeToken(token: string, expiresIn: number): void {
  sessionStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({
      access_token: token,
      expires_at: Date.now() + expiresIn * 1000,
    } satisfies TokenBlob),
  );
}

export function isGoogleConnected(): boolean {
  return Boolean(readToken());
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.dataset.gis = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
}

export async function connectGoogle(): Promise<void> {
  const clientId = getStoredClientId();
  if (!clientId) throw new Error("Brak Google Client ID");
  await loadGis();
  await new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Brak tokenu"));
          return;
        }
        writeToken(resp.access_token, resp.expires_in ?? 3600);
        resolve();
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export function disconnectGoogle(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function authHeader(): Promise<HeadersInit> {
  let token = readToken();
  if (!token) {
    await connectGoogle();
    token = readToken();
  }
  if (!token) throw new Error("Nie połączono z Google");
  return { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" };
}

type GEvent = {
  id: string;
  etag?: string;
  summary?: string;
  description?: string;
  status?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
};

function parseGEvent(g: GEvent): CalEvent | null {
  const startRaw = g.start?.dateTime || g.start?.date;
  const endRaw = g.end?.dateTime || g.end?.date;
  if (!startRaw || !endRaw) return null;
  const allDay = Boolean(g.start?.date && !g.start.dateTime);
  const start = new Date(startRaw).getTime();
  let end = new Date(endRaw).getTime();
  if (allDay) end = end - 1;
  return {
    id: `g:${g.id}`,
    title: g.summary || "(bez tytułu)",
    notes: g.description || "",
    start,
    end,
    allDay,
    color: GOOGLE_COLOR_MAP[g.colorId || ""] || PALETTE[3].value,
    googleEventId: g.id,
    googleEtag: g.etag,
    origin: "google",
    updatedAt: g.updated ? new Date(g.updated).getTime() : Date.now(),
    deleted: g.status === "cancelled",
  };
}

function toGEvent(e: CalEvent): Record<string, unknown> {
  const start = new Date(e.start);
  const end = new Date(e.end);
  if (e.allDay) {
    return {
      summary: e.title,
      description: e.notes,
      start: { date: isoDate(start) },
      end: { date: isoDate(new Date(end.getTime() + 36e5)) },
    };
  }
  return {
    summary: e.title,
    description: e.notes,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

async function api(path: string, init: RequestInit): Promise<Response> {
  const headers = { ...(await authHeader()), ...(init.headers || {}) };
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers });
  if (res.status === 401) {
    disconnectGoogle();
    throw new Error("Sesja Google wygasła — połącz ponownie");
  }
  return res;
}

export async function pullGoogleRange(from: Date, to: Date): Promise<number> {
  const calendarId = encodeURIComponent(getCalendarId());
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    maxResults: "250",
    showDeleted: "false",
    orderBy: "startTime",
  });
  const res = await api(`/calendars/${calendarId}/events?${params}`, { method: "GET" });
  if (!res.ok) throw new Error(`Google Calendar: ${res.status}`);
  const data = (await res.json()) as { items?: GEvent[] };
  let n = 0;
  for (const item of data.items ?? []) {
    const mapped = parseGEvent(item);
    if (!mapped) continue;
    const existing = await db.events.where("googleEventId").equals(item.id).first();
    if (existing && existing.origin === "local") {
      mapped.id = existing.id;
      mapped.origin = "both";
    } else if (existing) {
      mapped.id = existing.id;
      mapped.origin = existing.origin === "local" ? "both" : existing.origin;
    }
    await upsertEvent(mapped);
    n += 1;
  }
  return n;
}

export async function pushLocalEvent(event: CalEvent): Promise<CalEvent> {
  const calendarId = encodeURIComponent(getCalendarId());
  if (event.googleEventId) {
    const res = await api(`/calendars/${calendarId}/events/${encodeURIComponent(event.googleEventId)}`, {
      method: "PATCH",
      body: JSON.stringify(toGEvent(event)),
    });
    if (!res.ok) throw new Error(`Nie udało się zaktualizować w Google (${res.status})`);
    const g = (await res.json()) as GEvent;
    const next = { ...event, googleEtag: g.etag, origin: "both" as const, updatedAt: Date.now() };
    await upsertEvent(next);
    return next;
  }
  const res = await api(`/calendars/${calendarId}/events`, {
    method: "POST",
    body: JSON.stringify(toGEvent(event)),
  });
  if (!res.ok) throw new Error(`Nie udało się zapisać w Google (${res.status})`);
  const g = (await res.json()) as GEvent;
  const next: CalEvent = {
    ...event,
    googleEventId: g.id,
    googleEtag: g.etag,
    origin: "both",
    updatedAt: Date.now(),
  };
  await upsertEvent(next);
  return next;
}

export async function deleteOnGoogle(event: CalEvent): Promise<void> {
  if (!event.googleEventId) return;
  const calendarId = encodeURIComponent(getCalendarId());
  await api(`/calendars/${calendarId}/events/${encodeURIComponent(event.googleEventId)}`, {
    method: "DELETE",
  });
}

export async function syncBidirectional(from: Date, to: Date): Promise<string> {
  const pulled = await pullGoogleRange(from, to);
  const locals = await db.events.filter((e) => !e.deleted && !e.googleEventId).toArray();
  let pushed = 0;
  for (const e of locals) {
    await pushLocalEvent(e);
    pushed += 1;
  }
  const deleted = await db.events.filter((e) => e.deleted && Boolean(e.googleEventId)).toArray();
  for (const e of deleted) {
    await deleteOnGoogle(e);
    await db.events.delete(e.id);
  }
  return `Pobrano ${pulled}, wysłano ${pushed}`;
}
