/**
 * Synchronizacja z Google Calendar (tylko w przeglądarce, bez backendu).
 *
 * Model:
 * - IndexedDB (Dexie) jest źródłem prawdy dla UI. Każda lokalna zmiana dostaje `pending = 1`.
 * - `syncNow()` najpierw wysyła kolejkę (POST/PATCH/DELETE), potem pobiera zmiany z Google.
 * - Pobieranie: pełne okno (z wykrywaniem usunięć) co FULL_EVERY_MS albo gdy okno się zmieni,
 *   a pomiędzy — tanie odpytywanie przyrostowe (`updatedMin`), więc polling co kilka sekund jest OK.
 * - Konflikty: wygrywa nowsza zmiana (lokalny `updatedAt` vs `updated` z Google).
 * - Token OAuth (Google Identity Services, token flow) żyje ~1 h. Odnowienie wymaga gestu
 *   użytkownika (Safari blokuje popupy), więc po wygaśnięciu stan = "expired" i UI pokazuje
 *   „Połącz ponownie" — dane lokalne i kolejka czekają.
 */
import { DEFAULT_GOOGLE_COLOR, GOOGLE_COLOR_MAP, paletteById, paletteByValue } from "../colors";
import { db } from "../db";
import type { CalEvent } from "../types";
import { fromIsoDate, isoDate, addDays } from "../time";

const TOKEN_KEY = "pulsecal:google-token";
const LINKED_KEY = "pulsecal:google-linked";
const CLIENT_KEY = "pulsecal:google-client-id";
const CAL_KEY = "pulsecal:google-calendar-id";
const SYNC_KEY = "pulsecal:google-sync-state";
const SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");
const API = "https://www.googleapis.com/calendar/v3";
const FULL_EVERY_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 2 * 60_000;

export class NeedsAuthError extends Error {
  constructor(message = "Sesja Google wygasła — połącz ponownie") {
    super(message);
    this.name = "NeedsAuthError";
  }
}

type TokenBlob = { access_token: string; expires_at: number };
type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }) => TokenClient;
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

/* ───────────────────────── ustawienia ───────────────────────── */

export function getStoredClientId(): string {
  return localStorage.getItem(CLIENT_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

export function setStoredClientId(id: string): void {
  const v = id.trim();
  if (v) localStorage.setItem(CLIENT_KEY, v);
  else localStorage.removeItem(CLIENT_KEY);
}

export function getCalendarId(): string {
  return localStorage.getItem(CAL_KEY) || "primary";
}

/**
 * Zmiana kalendarza docelowego: wpisy pobrane ze starego kalendarza znikają lokalnie,
 * a własne wpisy Pulsecal trafiają do kolejki, żeby skopiować je do nowego.
 */
export async function switchCalendar(id: string): Promise<void> {
  const next = id.trim() || "primary";
  if (next === getCalendarId()) return;
  localStorage.setItem(CAL_KEY, next);
  localStorage.removeItem(SYNC_KEY);
  await db.transaction("rw", db.events, async () => {
    await db.events.filter((e) => e.origin === "google").delete();
    await db.events.toCollection().modify((e) => {
      if (e.deleted) return;
      e.googleEventId = undefined;
      e.googleEtag = undefined;
      e.origin = "local";
      e.pending = 1;
    });
    await db.events.filter((e) => e.deleted).delete();
  });
}

/* ───────────────────────── token / GIS ───────────────────────── */

function readToken(): TokenBlob | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as TokenBlob;
    if (t.expires_at < Date.now() + 30_000) return null;
    return t;
  } catch {
    return null;
  }
}

function writeToken(token: string, expiresIn: number): void {
  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ access_token: token, expires_at: Date.now() + expiresIn * 1000 } satisfies TokenBlob),
  );
  localStorage.setItem(LINKED_KEY, "1");
}

/** Użytkownik kiedyś połączył konto (i nie rozłączył). */
export function isGoogleLinked(): boolean {
  return localStorage.getItem(LINKED_KEY) === "1";
}

export function hasValidToken(): boolean {
  return Boolean(readToken());
}

export function tokenExpiresAt(): number | null {
  return readToken()?.expires_at ?? null;
}

let gisPromise: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;
let tokenClientFor = "";
let pendingAuth: { resolve: () => void; reject: (e: Error) => void } | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("Nie udało się wczytać logowania Google (offline?)"));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

function ensureTokenClient(clientId: string): TokenClient | null {
  if (!window.google?.accounts?.oauth2) return null;
  if (tokenClient && tokenClientFor === clientId) return tokenClient;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (resp) => {
      const p = pendingAuth;
      pendingAuth = null;
      if (resp.error || !resp.access_token) {
        p?.reject(new Error(resp.error_description || resp.error || "Google nie zwrócił tokenu"));
        return;
      }
      writeToken(resp.access_token, resp.expires_in ?? 3600);
      p?.resolve();
    },
    error_callback: (err) => {
      const p = pendingAuth;
      pendingAuth = null;
      p?.reject(
        new Error(
          err.type === "popup_closed"
            ? "Okno logowania zamknięte"
            : err.type === "popup_failed_to_open"
              ? "Przeglądarka zablokowała okno logowania — spróbuj jeszcze raz"
              : err.message || "Logowanie Google nieudane",
        ),
      );
    },
  });
  tokenClientFor = clientId;
  return tokenClient;
}

/**
 * Wczytuje skrypt Google zawczasu, żeby kliknięcie „Połącz" mogło od razu (synchronicznie,
 * w ramach gestu użytkownika) otworzyć okno logowania — inaczej iOS Safari je blokuje.
 */
export function preloadGoogle(): void {
  const clientId = getStoredClientId();
  if (!clientId) return;
  void loadGis()
    .then(() => ensureTokenClient(clientId))
    .catch(() => undefined);
}

/** Wywoływać bezpośrednio z handlera kliknięcia. */
export function connectGoogle(): Promise<void> {
  const clientId = getStoredClientId();
  if (!clientId) return Promise.reject(new Error("Najpierw wklej Google OAuth Client ID"));

  const request = (client: TokenClient) =>
    new Promise<void>((resolve, reject) => {
      pendingAuth?.reject(new Error("Przerwano"));
      pendingAuth = { resolve, reject };
      // Po pierwszej zgodzie nie pokazujemy ekranu zgody ponownie — tylko szybkie okno.
      client.requestAccessToken({ prompt: isGoogleLinked() ? "" : "consent" });
    });

  const ready = ensureTokenClient(clientId);
  if (ready) return request(ready);
  return loadGis().then(() => {
    const client = ensureTokenClient(clientId);
    if (!client) throw new Error("Logowanie Google niedostępne");
    return request(client);
  });
}

export function disconnectGoogle(): void {
  const t = readToken();
  if (t) window.google?.accounts.oauth2.revoke?.(t.access_token);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LINKED_KEY);
  localStorage.removeItem(SYNC_KEY);
}

/* ───────────────────────── HTTP ───────────────────────── */

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken();
  if (!token) throw new NeedsAuthError();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    throw new NeedsAuthError();
  }
  if (res.status === 403) {
    const body = await res.clone().text();
    if (/insufficient|scope/i.test(body)) {
      localStorage.removeItem(TOKEN_KEY);
      throw new NeedsAuthError("Brak uprawnień do kalendarza — połącz ponownie i zaakceptuj dostęp");
    }
  }
  return res;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 140)}`);
  return (await res.json()) as T;
}

function calPath(): string {
  return `/calendars/${encodeURIComponent(getCalendarId())}/events`;
}

/* ───────────────────────── mapowanie ───────────────────────── */

type GTime = { dateTime?: string; date?: string; timeZone?: string };
type GEvent = {
  id: string;
  etag?: string;
  summary?: string;
  description?: string;
  status?: string;
  colorId?: string;
  start?: GTime;
  end?: GTime;
  updated?: string;
  recurringEventId?: string;
  extendedProperties?: { private?: Record<string, string> };
};

type GList = { items?: GEvent[]; nextPageToken?: string };

function remoteColor(g: GEvent): string {
  const own = paletteById(g.extendedProperties?.private?.pulseColor);
  // jeśli ktoś zmienił kolor w Google, colorId nie zgadza się z naszym — wtedy wygrywa Google
  if (own && (!g.colorId || g.colorId === own.gid)) return own.value;
  return GOOGLE_COLOR_MAP[g.colorId || ""] || DEFAULT_GOOGLE_COLOR;
}

function parseGEvent(g: GEvent): Omit<CalEvent, "id" | "origin" | "pending"> | null {
  const allDay = Boolean(g.start?.date && !g.start?.dateTime);
  let start: number;
  let end: number;
  if (allDay) {
    if (!g.start?.date || !g.end?.date) return null;
    start = fromIsoDate(g.start.date).getTime();
    // Google: koniec wyłączny (następny dzień). Lokalnie: ostatnia milisekunda ostatniego dnia.
    end = fromIsoDate(g.end.date).getTime() - 1;
  } else {
    if (!g.start?.dateTime || !g.end?.dateTime) return null;
    start = new Date(g.start.dateTime).getTime();
    end = new Date(g.end.dateTime).getTime();
  }
  return {
    title: g.summary || "(bez tytułu)",
    notes: g.description || "",
    start,
    end,
    allDay,
    color: remoteColor(g),
    googleEventId: g.id,
    googleEtag: g.etag,
    recurring: Boolean(g.recurringEventId),
    updatedAt: g.updated ? new Date(g.updated).getTime() : Date.now(),
    deleted: false,
  };
}

function toGEvent(e: CalEvent): Record<string, unknown> {
  const pal = paletteByValue(e.color);
  const body: Record<string, unknown> = {
    summary: e.title,
    description: e.notes,
    extendedProperties: { private: { pulseId: e.id, ...(pal ? { pulseColor: pal.id } : {}) } },
  };
  if (pal) body.colorId = pal.gid;
  if (e.allDay) {
    body.start = { date: isoDate(new Date(e.start)), dateTime: null };
    body.end = { date: isoDate(addDays(new Date(e.end), 1)), dateTime: null };
  } else {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    body.start = { dateTime: new Date(e.start).toISOString(), timeZone: tz, date: null };
    body.end = { dateTime: new Date(e.end).toISOString(), timeZone: tz, date: null };
  }
  return body;
}

/** Lokalne ID → poprawne ID Google (znaki a–v, 0–9, min. 5). */
function googleIdFor(localId: string): string {
  const id = localId.toLowerCase().replace(/[^a-v0-9]/g, "");
  return id.length >= 5 ? id : crypto.randomUUID().replace(/-/g, "");
}

/* ───────────────────────── wysyłka ───────────────────────── */

async function pushOne(e: CalEvent): Promise<"pushed" | "removed"> {
  if (e.deleted) {
    if (e.googleEventId) {
      const res = await api(`${calPath()}/${encodeURIComponent(e.googleEventId)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        throw new Error(`Usuwanie w Google nieudane (${res.status})`);
      }
    }
    await db.events.delete(e.id);
    return "removed";
  }

  let g: GEvent | null = null;
  if (e.googleEventId) {
    const res = await api(`${calPath()}/${encodeURIComponent(e.googleEventId)}`, {
      method: "PATCH",
      body: JSON.stringify(toGEvent(e)),
    });
    if (res.ok) g = (await res.json()) as GEvent;
    else if (res.status !== 404 && res.status !== 410) {
      throw new Error(`Aktualizacja w Google nieudana (${res.status})`);
    }
    // 404/410: wydarzenie usunięte w Google, ale lokalnie edytowane później → tworzymy na nowo
  }
  if (!g) {
    const gid = e.googleEventId ? googleIdFor(crypto.randomUUID()) : googleIdFor(e.id);
    const res = await api(calPath(), {
      method: "POST",
      body: JSON.stringify({ ...toGEvent(e), id: gid }),
    });
    if (res.ok) {
      g = (await res.json()) as GEvent;
    } else if (res.status === 409) {
      // poprzednia próba doszła, tylko nie dostaliśmy odpowiedzi → aktualizujemy istniejące
      g = await apiJson<GEvent>(`${calPath()}/${gid}`, { method: "PATCH", body: JSON.stringify(toGEvent(e)) });
    } else {
      throw new Error(`Zapis w Google nieudany (${res.status})`);
    }
  }

  // Zapisujemy wynik tylko jeśli użytkownik nie zmienił wpisu w międzyczasie.
  await db.transaction("rw", db.events, async () => {
    const current = await db.events.get(e.id);
    if (!current) return;
    const untouched = current.updatedAt === e.updatedAt;
    await db.events.update(e.id, {
      googleEventId: g!.id,
      googleEtag: g!.etag,
      origin: current.origin === "google" ? "google" : "both",
      ...(untouched ? { pending: 0 as const } : {}),
    });
  });
  return "pushed";
}

async function pushPending(): Promise<{ pushed: number; removed: number }> {
  const queue = await db.events.where("pending").equals(1).toArray();
  let pushed = 0;
  let removed = 0;
  for (const e of queue) {
    const r = await pushOne(e);
    if (r === "pushed") pushed += 1;
    else removed += 1;
  }
  return { pushed, removed };
}

/* ───────────────────────── pobieranie ───────────────────────── */

type SyncMeta = { from: number; to: number; fullAt: number; since: number; calendarId: string };

function readMeta(): SyncMeta | null {
  try {
    const m = JSON.parse(localStorage.getItem(SYNC_KEY) || "null") as SyncMeta | null;
    return m && m.calendarId === getCalendarId() ? m : null;
  } catch {
    return null;
  }
}

function writeMeta(m: SyncMeta): void {
  localStorage.setItem(SYNC_KEY, JSON.stringify(m));
}

async function listAll(params: Record<string, string>): Promise<GEvent[]> {
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({ ...params, maxResults: "250", ...(pageToken ? { pageToken } : {}) });
    const page = await apiJson<GList>(`${calPath()}?${q}`);
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

/** Zastosuj zdalne wydarzenie lokalnie. Zwraca true, jeśli coś się zmieniło. */
async function applyRemote(g: GEvent): Promise<boolean> {
  const existing = await db.events.where("googleEventId").equals(g.id).first();

  if (g.status === "cancelled") {
    if (!existing) return false;
    await db.events.delete(existing.id);
    return true;
  }

  const parsed = parseGEvent(g);
  if (!parsed) return false;

  if (existing) {
    if (existing.googleEtag && existing.googleEtag === g.etag) return false;
    // lokalna, niewysłana zmiana nowsza od zdalnej → zostawiamy lokalną (wyśle się przy następnym syncu)
    if (existing.pending && existing.updatedAt >= parsed.updatedAt) return false;
    await db.events.put({
      ...parsed,
      id: existing.id,
      origin: existing.origin === "local" ? "both" : existing.origin,
      pending: 0,
    });
    return true;
  }

  // Wydarzenie utworzone przez Pulsecal na innym urządzeniu ma nasze ID w extendedProperties.
  const pulseId = g.extendedProperties?.private?.pulseId;
  const localTwin = pulseId ? await db.events.get(pulseId) : undefined;
  await db.events.put({
    ...parsed,
    id: localTwin && !localTwin.googleEventId ? localTwin.id : pulseId && !localTwin ? pulseId : `g:${g.id}`,
    origin: pulseId ? "both" : "google",
    pending: 0,
  });
  return true;
}

async function pullFull(from: Date, to: Date): Promise<number> {
  const items = await listAll({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    showDeleted: "false",
  });
  let changed = 0;
  const seen = new Set<string>();
  for (const g of items) {
    seen.add(g.id);
    if (await applyRemote(g)) changed += 1;
  }
  // Usunięte (lub przeniesione poza okno) w Google → usuń lokalną kopię, o ile nie czeka na wysyłkę.
  const stale = await db.events
    .where("start")
    .below(to.getTime())
    .filter((e) => e.end > from.getTime() && Boolean(e.googleEventId) && !e.pending && !seen.has(e.googleEventId!))
    .toArray();
  if (stale.length) {
    await db.events.bulkDelete(stale.map((e) => e.id));
    changed += stale.length;
  }
  return changed;
}

async function pullSince(from: Date, to: Date, since: number): Promise<number> {
  const items = await listAll({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    showDeleted: "true",
    updatedMin: new Date(since).toISOString(),
  });
  let changed = 0;
  for (const g of items) if (await applyRemote(g)) changed += 1;
  return changed;
}

/* ───────────────────────── publiczne API ───────────────────────── */

export type SyncResult = { pulled: number; pushed: number; removed: number; full: boolean };

let inflight: Promise<SyncResult> | null = null;

/** Jedna synchronizacja naraz; równoległe wywołania dostają ten sam wynik. */
export function syncNow(from: Date, to: Date, opts: { forceFull?: boolean } = {}): Promise<SyncResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (!navigator.onLine) throw new Error("Brak internetu — zmiany czekają w kolejce");
    if (!readToken()) throw new NeedsAuthError();

    const startedAt = Date.now();
    const { pushed, removed } = await pushPending();

    const meta = readMeta();
    const covered = meta && meta.from <= from.getTime() && meta.to >= to.getTime();
    const fresh = meta && startedAt - meta.fullAt < FULL_EVERY_MS;
    let pulled: number;
    let full = false;
    if (!opts.forceFull && meta && covered && fresh) {
      pulled = await pullSince(from, to, meta.since - CLOCK_SKEW_MS);
      writeMeta({ ...meta, since: startedAt });
    } else {
      // okno pełnej synchronizacji trochę szersze niż widok, żeby przewijanie nie wymuszało pełnej
      const wideFrom = addDays(from, -14);
      const wideTo = addDays(to, 14);
      pulled = await pullFull(wideFrom, wideTo);
      full = true;
      writeMeta({
        from: wideFrom.getTime(),
        to: wideTo.getTime(),
        fullAt: startedAt,
        since: startedAt,
        calendarId: getCalendarId(),
      });
    }
    return { pulled, pushed, removed, full };
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export type CalendarInfo = { id: string; summary: string; primary: boolean; color?: string };

export async function listCalendars(): Promise<CalendarInfo[]> {
  const data = await apiJson<{
    items?: { id: string; summary: string; primary?: boolean; accessRole: string; backgroundColor?: string }[];
  }>("/users/me/calendarList?minAccessRole=writer");
  return (data.items ?? [])
    .map((c) => ({ id: c.id, summary: c.summary, primary: Boolean(c.primary), color: c.backgroundColor }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.summary.localeCompare(b.summary));
}
