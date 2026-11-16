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
import { DEFAULT_GOOGLE_COLOR, GOOGLE_EVENT_COLORS, googleIdForColor, paletteById, paletteByValue } from "../colors";
import { db } from "../db";
import type { CalEvent, WorkItem } from "../types";
import { applyTagRules } from "../tagRules";
import { isSettings, type AppSettings, type SettingsBackup } from "../settings";
import { htmlToText, joinTags, splitTags } from "../tags";
import { fromIsoDate, isoDate, addDays, sameDay } from "../time";

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
      delete e.googleEventId;
      delete e.googleEtag;
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
  /** Tylko wydarzenie „główne” serii (przy singleEvents=false). */
  recurrence?: string[];
  extendedProperties?: { private?: Record<string, string> };
};

type GList = { items?: GEvent[]; nextPageToken?: string };

/* ── kolory ── */

const CAL_COLOR_KEY = "pulsecal:google-calendar-color";
/** Zmiana sposobu liczenia kolorów → jednorazowe przekolorowanie już pobranych wpisów (pełny pull bez etagów). */
const COLOR_RULES_VERSION = "2";
const COLOR_RULES_KEY = "pulsecal:google-color-rules";

function calendarColor(): string | null {
  try {
    const c = JSON.parse(localStorage.getItem(CAL_COLOR_KEY) || "null") as { id: string; color: string } | null;
    return c && c.id === getCalendarId() ? c.color : null;
  } catch {
    return null;
  }
}

/** Kolor kalendarza (dla wpisów bez własnego koloru w Google) — raz na kalendarz, z calendarList. */
async function ensureCalendarColor(): Promise<void> {
  if (calendarColor()) return;
  try {
    const c = await apiJson<{ backgroundColor?: string }>(`/users/me/calendarList/${encodeURIComponent(getCalendarId())}`);
    if (c.backgroundColor) {
      localStorage.setItem(CAL_COLOR_KEY, JSON.stringify({ id: getCalendarId(), color: c.backgroundColor.toLowerCase() }));
    }
  } catch (err) {
    if (err instanceof NeedsAuthError) throw err;
    // brak koloru kalendarza nie blokuje synchronizacji — zostaje domyślny
  }
}

/**
 * Kolor wpisu z Google:
 * - nasz kolor (pulseColor), jeśli w Google nikt go nie zmienił (colorId nadal pasuje),
 * - colorId (także z etykietą koloru) → dokładnie ten kolor co w Google,
 * - brak colorId → kolor kalendarza (tak wygląda w Google), a bez niego domyślny.
 */
function remoteColor(g: GEvent): string {
  const own = paletteById(g.extendedProperties?.private?.pulseColor);
  if (own && (!g.colorId || g.colorId === own.gid)) return own.value;
  if (g.colorId && GOOGLE_EVENT_COLORS[g.colorId]) return GOOGLE_EVENT_COLORS[g.colorId];
  return calendarColor() ?? DEFAULT_GOOGLE_COLOR;
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
  const { notes, tags } = splitTags(g.description || "");
  return {
    title: g.summary || "(bez tytułu)",
    notes,
    tags,
    start,
    end,
    allDay,
    color: remoteColor(g),
    googleEventId: g.id,
    googleEtag: g.etag,
    recurring: Boolean(g.recurringEventId),
    seriesId: g.recurringEventId,
    epicId: g.extendedProperties?.private?.pulseEpic || undefined,
    autoSlot: g.extendedProperties?.private?.pulseAuto === "1" || undefined,
    estimate: Number(g.extendedProperties?.private?.pulseEst) || undefined,
    updatedAt: g.updated ? new Date(g.updated).getTime() : Date.now(),
    moves: Number(g.extendedProperties?.private?.pulseMoves) || 0,
    deleted: false,
  };
}

function toGEvent(e: CalEvent): Record<string, unknown> {
  const pal = paletteByValue(e.color);
  const body: Record<string, unknown> = {
    summary: e.title,
    description: joinTags(e.notes, e.tags ?? []),
    extendedProperties: {
      private: {
        pulseId: e.id,
        ...(pal ? { pulseColor: pal.id } : {}),
        ...(e.moves ? { pulseMoves: String(e.moves) } : {}),
        // zawsze (także pusty) — PATCH scala klucze, więc bez tego nie dałoby się wypiąć wpisu z epiku
        pulseEpic: e.epicId ?? "",
        pulseAuto: e.autoSlot ? "1" : "",
        pulseEst: e.estimate ? String(e.estimate) : "",
      },
    },
  };
  // nasz kolor → jego colorId; dokładny kolor Google → ten sam colorId; kolor kalendarza → bez colorId
  const gid = pal?.gid ?? googleIdForColor(e.color);
  if (gid) body.colorId = gid;
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

async function pushPending(): Promise<{ pushed: number; removed: number; failed: number; error?: Error }> {
  const queue = await db.events.where("pending").equals(1).toArray();
  let pushed = 0;
  let removed = 0;
  let failed = 0;
  let error: Error | undefined;
  for (const e of queue) {
    try {
      const r = await pushOne(e);
      if (r === "pushed") pushed += 1;
      else removed += 1;
    } catch (err) {
      // Brak autoryzacji dotyczy wszystkich wpisów — przerywamy. Inny błąd (np. 400 dla jednego wpisu)
      // nie może blokować reszty kolejki ani pobierania; wpis zostaje pending i spróbujemy później.
      if (err instanceof NeedsAuthError) throw err;
      failed += 1;
      error ??= err instanceof Error ? err : new Error(String(err));
    }
  }
  return { pushed, removed, failed, error };
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

async function listAll(params: Record<string, string>, path = calPath()): Promise<GEvent[]> {
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({ ...params, maxResults: "250", ...(pageToken ? { pageToken } : {}) });
    const page = await apiJson<GList>(`${path}?${q}`);
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

/* ── wydarzenia cykliczne ── */

/** Lokalne wpisy jednej serii: instancje (ID Google „<idSerii>_<start>”) i ewentualna kopia samej serii. */
function seriesLocals(masterId: string): Promise<CalEvent[]> {
  const prefix = `${masterId}_`;
  return db.events
    .filter((e) => e.seriesId === masterId || e.googleEventId === masterId || Boolean(e.googleEventId?.startsWith(prefix)))
    .toArray();
}

/** Seria usunięta w Google → usuń jej lokalne wpisy (poza tymi, które czekają na wysyłkę). */
async function dropSeries(masterId: string): Promise<number> {
  const gone = (await seriesLocals(masterId)).filter((e) => !e.pending);
  if (gone.length) await db.events.bulkDelete(gone.map((e) => e.id));
  return gone.length;
}

/**
 * Seria zmieniona w Google („wszystkie wydarzenia” / „to i następne”) → pobierz jej wystąpienia w oknie
 * i usuń lokalne, których już nie ma. Zmiana godziny serii zmienia ID wystąpień, więc bez tego zostałyby
 * stare kopie, a nowe pojawiłyby się dopiero przy pełnej synchronizacji.
 */
async function reconcileSeries(masterId: string, from: number, to: number): Promise<number> {
  const path = `${calPath()}/${encodeURIComponent(masterId)}/instances`;
  const params = { timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), showDeleted: "true" };
  let items: GEvent[];
  try {
    items = await listAll(params, path);
  } catch (err) {
    if (err instanceof NeedsAuthError) throw err;
    if (/Google Calendar (404|410)/.test(String(err))) return dropSeries(masterId);
    throw err;
  }
  let changed = 0;
  const seen = new Set<string>();
  for (const g of items) {
    if (g.status !== "cancelled") seen.add(g.id);
    if (await applyRemote(g)) changed += 1;
  }
  const stale = (await seriesLocals(masterId)).filter(
    (e) =>
      !e.pending &&
      !seen.has(e.googleEventId ?? "") &&
      (e.googleEventId === masterId || (e.end > from && e.start < to)),
  );
  if (stale.length) {
    await db.events.bulkDelete(stale.map((e) => e.id));
    changed += stale.length;
  }
  return changed;
}

/** Zastosuj zdalne wydarzenie lokalnie. Zwraca true, jeśli coś się zmieniło. */
async function applyRemote(g: GEvent, ignoreEtag = false): Promise<boolean> {
  if (g.id === SETTINGS_EVENT_ID) return false; // ukryty wpis z ustawieniami — nie pokazujemy go
  if (g.id.startsWith(ITEM_PREFIX)) return applyRemoteItem(g); // kopia zadania/epiku
  const existing = await db.events.where("googleEventId").equals(g.id).first();

  if (g.status === "cancelled") {
    if (!existing) return false;
    await db.events.delete(existing.id);
    return true;
  }

  const parsed = parseGEvent(g);
  if (!parsed) return false;

  // reguły tagów (też domyślna „!” → „ważne”) dla zmian z Google; wtedy wpis wraca do Google z linią „Tagi: …”.
  // Wyjątek: wystąpienie serii — tagi z reguł tylko lokalnie, bo zapis jednego wystąpienia w Google
  // odłącza je od serii (późniejsze zmiany całej serii by go nie objęły).
  const withAuto = (prev?: { title: string; notes: string }) => {
    if (parsed.recurring) {
      const tags = applyTagRules(parsed.title, parsed.notes, parsed.tags);
      return { ...parsed, tags, pending: 0 as const };
    }
    const tags = applyTagRules(parsed.title, parsed.notes, parsed.tags, prev);
    return tags === parsed.tags
      ? { ...parsed, pending: 0 as const }
      : { ...parsed, tags, pending: 1 as const, updatedAt: Date.now() };
  };

  if (existing) {
    if (!ignoreEtag && existing.googleEtag && existing.googleEtag === g.etag) return false;
    // lokalna, niewysłana zmiana nowsza od zdalnej → zostawiamy lokalną (wyśle się przy następnym syncu)
    if (existing.pending && existing.updatedAt >= parsed.updatedAt) return false;
    // przeniesione w Google na inny dzień → też liczy się jako przeniesienie
    const knownMoves = Math.max(parsed.moves ?? 0, existing.moves ?? 0);
    const moved = !sameDay(new Date(existing.start), new Date(parsed.start));
    await db.events.put({
      ...withAuto({ title: existing.title, notes: existing.notes }),
      moves: moved ? knownMoves + 1 : knownMoves,
      id: existing.id,
      origin: existing.origin === "local" ? "both" : existing.origin,
    });
    return true;
  }

  // Wydarzenie utworzone przez Pulsecal na innym urządzeniu ma nasze ID w extendedProperties.
  // (Wystąpienia serii dziedziczą je po wpisie, z którego powstała seria — wtedy go nie używamy.)
  const pulseId = g.recurringEventId ? undefined : g.extendedProperties?.private?.pulseId;
  const localTwin = pulseId ? await db.events.get(pulseId) : undefined;
  await db.events.put({
    ...withAuto(),
    id: localTwin && !localTwin.googleEventId ? localTwin.id : pulseId && !localTwin ? pulseId : `g:${g.id}`,
    origin: pulseId ? "both" : "google",
  });
  return true;
}

async function pullFull(from: Date, to: Date, ignoreEtag = false): Promise<number> {
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
    if (await applyRemote(g, ignoreEtag)) changed += 1;
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
  return changed + (await pullItems());
}

/**
 * Zmiany od `since`. Bez rozwijania serii (singleEvents=false): pojedyncze wpisy i zmienione wystąpienia
 * przychodzą wprost, a zmieniona seria jako jeden wpis z `recurrence` → odświeżamy jej wystąpienia w oknie.
 * Bez timeMin/timeMax, żeby nie zgubić serii zaczętej przed oknem.
 */
async function pullSince(from: number, to: number, since: number): Promise<number> {
  const items = await listAll({ showDeleted: "true", updatedMin: new Date(since).toISOString() });
  let changed = 0;
  for (const g of items) {
    if (g.id === SETTINGS_EVENT_ID) continue;
    if (g.recurrence?.length && g.status !== "cancelled") {
      changed += await reconcileSeries(g.id, from, to);
      continue;
    }
    if (await applyRemote(g)) changed += 1;
    // usunięta seria przychodzi jako samo { id, status: "cancelled" }
    if (g.status === "cancelled" && !g.recurringEventId) changed += await dropSeries(g.id);
  }
  return changed;
}

/* ───────────────────────── publiczne API ───────────────────────── */

export type SyncResult = {
  pulled: number;
  pushed: number;
  removed: number;
  full: boolean;
  /** Wpisy, których nie udało się wysłać (zostają w kolejce). */
  failed: number;
  pushError?: Error;
};

let inflight: Promise<SyncResult> | null = null;

/** Jedna synchronizacja naraz; równoległe wywołania dostają ten sam wynik. */
export function syncNow(from: Date, to: Date, opts: { forceFull?: boolean } = {}): Promise<SyncResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (!navigator.onLine) throw new Error("Brak internetu — zmiany czekają w kolejce");
    if (!readToken()) throw new NeedsAuthError();

    const startedAt = Date.now();
    await ensureCalendarColor();
    const recolor = localStorage.getItem(COLOR_RULES_KEY) !== COLOR_RULES_VERSION;
    const ev = await pushPending();
    const it = await pushItems();
    const pushed = ev.pushed + it.pushed;
    const removed = ev.removed;
    const failed = ev.failed + it.failed;
    const pushError = ev.error ?? it.error;

    const meta = readMeta();
    const covered = meta && meta.from <= from.getTime() && meta.to >= to.getTime();
    const fresh = meta && startedAt - meta.fullAt < FULL_EVERY_MS;
    let pulled: number;
    let full = false;
    if (!opts.forceFull && !recolor && meta && covered && fresh) {
      pulled = await pullSince(meta.from, meta.to, meta.since - CLOCK_SKEW_MS);
      writeMeta({ ...meta, since: startedAt });
    } else {
      // okno pełnej synchronizacji trochę szersze niż widok, żeby przewijanie nie wymuszało pełnej
      const wideFrom = addDays(from, -14);
      const wideTo = addDays(to, 14);
      pulled = await pullFull(wideFrom, wideTo, recolor);
      if (recolor) localStorage.setItem(COLOR_RULES_KEY, COLOR_RULES_VERSION);
      full = true;
      writeMeta({
        from: wideFrom.getTime(),
        to: wideTo.getTime(),
        fullAt: startedAt,
        since: startedAt,
        calendarId: getCalendarId(),
      });
    }
    return { pulled, pushed, removed, full, failed, pushError };
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

/* ───────────────────────── kopia ustawień w Google ───────────────────────── */

/**
 * Ustawienia aplikacji trzymamy jako jeden ukryty wpis całodniowy 1.01.2000 (stałe ID, prywatny,
 * „wolny” czas). Opis = notka dla człowieka + JSON w bloku ```json. Pulsecal go nie pokazuje (applyRemote).
 */
export const SETTINGS_EVENT_ID = "pulsecalsettings0";
const SETTINGS_NOTE =
  "Ustawienia aplikacji Pulsecal (kopia zapasowa). Nie usuwaj i nie zmieniaj — Pulsecal odczytuje je po " +
  "połączeniu z Google na nowym urządzeniu.";

export async function readSettingsBackup(): Promise<SettingsBackup | null> {
  const res = await api(`${calPath()}/${SETTINGS_EVENT_ID}`);
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Odczyt ustawień z Google nieudany (${res.status})`);
  const g = (await res.json()) as GEvent;
  if (g.status === "cancelled") return null;
  const m = /```json\s*([\s\S]*?)```/.exec(htmlToText(g.description || ""));
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]) as { updatedAt?: number; settings?: unknown };
    return isSettings(data.settings) ? { settings: data.settings, updatedAt: Number(data.updatedAt) || 0 } : null;
  } catch {
    return null;
  }
}

export async function writeSettingsBackup(settings: AppSettings, updatedAt: number): Promise<void> {
  const body = {
    summary: "Pulsecal — ustawienia (nie usuwaj)",
    description: `${SETTINGS_NOTE}\n\n\`\`\`json\n${JSON.stringify({ updatedAt, settings }, null, 2)}\n\`\`\``,
    start: { date: "2000-01-01" },
    end: { date: "2000-01-02" },
    transparency: "transparent",
    visibility: "private",
    status: "confirmed",
    extendedProperties: { private: { pulseSettings: "1" } },
  };
  let res = await api(`${calPath()}/${SETTINGS_EVENT_ID}`, { method: "PATCH", body: JSON.stringify(body) });
  if (res.status === 404 || res.status === 410) {
    res = await api(calPath(), { method: "POST", body: JSON.stringify({ ...body, id: SETTINGS_EVENT_ID }) });
  }
  if (!res.ok) throw new Error(`Zapis ustawień w Google nieudany (${res.status})`);
}

/* ───────────────────────── kopia zadań i epików ───────────────────────── */

/**
 * Każde zadanie/epik to osobny ukryty wpis całodniowy 2.01.2000 (ID „pulsetask<id>”, prywatny, „wolny” czas)
 * z JSON-em w opisie — jak kopia ustawień, ale osobno, żeby zmiana jednego nie nadpisywała innych
 * (dwa urządzenia) i żeby nie trafić na limit długości jednego opisu.
 */
const ITEM_PREFIX = "pulsetask";
const ITEM_NOTE =
  "Zadanie / epik z aplikacji Pulsecal (kopia zapasowa). Nie usuwaj i nie zmieniaj — Pulsecal odczytuje je " +
  "na innych urządzeniach.";

type ItemData = Pick<
  WorkItem,
  | "id"
  | "kind"
  | "title"
  | "description"
  | "status"
  | "parentId"
  | "order"
  | "createdAt"
  | "updatedAt"
  | "num"
  | "priority"
  | "due"
  | "estimate"
  | "fields"
  | "comments"
  | "pinned"
  | "eventId"
  | "seriesId"
  | "statusManual"
>;

function itemBody(i: WorkItem): Record<string, unknown> {
  const data: ItemData = {
    id: i.id,
    kind: i.kind,
    title: i.title,
    description: i.description,
    status: i.status,
    parentId: i.parentId,
    order: i.order,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    num: i.num,
    priority: i.priority,
    due: i.due ?? null,
    estimate: i.estimate ?? null,
    fields: i.fields ?? {},
    comments: i.comments ?? [],
    pinned: Boolean(i.pinned),
    eventId: i.eventId,
    seriesId: i.seriesId,
    statusManual: Boolean(i.statusManual),
  };
  return {
    summary: `Pulsecal — ${i.kind === "epic" ? "epik" : "zadanie"}: ${i.title}`,
    description: `${ITEM_NOTE}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    start: { date: "2000-01-02", dateTime: null },
    end: { date: "2000-01-03", dateTime: null },
    status: "confirmed",
    transparency: "transparent",
    visibility: "private",
    extendedProperties: { private: { pulseType: "item" } },
  };
}

function parseItem(g: GEvent): ItemData | null {
  // zachłannie do ostatniego ``` — opis zadania może sam zawierać ```
  const m = /```json\s*([\s\S]*)```/.exec(htmlToText(g.description || ""));
  if (!m) return null;
  try {
    const d = JSON.parse(m[1]) as Partial<ItemData>;
    if (typeof d.id !== "string" || typeof d.title !== "string") return null;
    if (d.kind !== "epic" && d.kind !== "task") return null;
    return {
      id: d.id,
      kind: d.kind,
      title: d.title,
      description: typeof d.description === "string" ? d.description : "",
      status: d.status === "doing" || d.status === "done" ? d.status : "todo",
      parentId: typeof d.parentId === "string" ? d.parentId : "",
      order: Number(d.order) || 0,
      createdAt: Number(d.createdAt) || 0,
      updatedAt: Number(d.updatedAt) || 0,
      num: Number(d.num) || undefined,
      priority: ["highest", "high", "medium", "low", "lowest"].includes(String(d.priority))
        ? d.priority
        : "medium",
      due: Number(d.due) || null,
      estimate: d.estimate === null || d.estimate === undefined || Number.isNaN(Number(d.estimate)) ? null : Number(d.estimate),
      fields: d.fields && typeof d.fields === "object" ? (d.fields as Record<string, string>) : {},
      comments: Array.isArray(d.comments)
        ? d.comments
            .filter((c) => c && typeof c.text === "string" && typeof c.id === "string")
            .map((c) => ({ id: c.id, text: c.text, at: Number(c.at) || 0, ...(c.edited ? { edited: Number(c.edited) } : {}) }))
        : [],
      pinned: d.pinned === true,
      eventId: typeof d.eventId === "string" && d.eventId ? d.eventId : undefined,
      seriesId: typeof d.seriesId === "string" && d.seriesId ? d.seriesId : undefined,
      statusManual: d.statusManual === true,
    };
  } catch {
    return null;
  }
}

/** Kopia z Google → lokalnie (wygrywa nowsza zmiana; niewysłana lokalna nie jest nadpisywana starszą). */
async function applyRemoteItem(g: GEvent): Promise<boolean> {
  const id = g.id.slice(ITEM_PREFIX.length);
  const cur = await db.items.get(id);
  if (g.status === "cancelled") {
    if (!cur || cur.pending) return false;
    await db.items.delete(id);
    return true;
  }
  const d = parseItem(g);
  if (!d || d.id !== id) return false;
  if (cur && (cur.updatedAt === d.updatedAt || (cur.pending && cur.updatedAt > d.updatedAt))) return false;
  await db.items.put({ ...d, deleted: false, pending: 0, remote: 1 });
  return true;
}

/** Wszystkie kopie (także usunięte — żeby usunięcie z innego urządzenia dotarło też po dłuższej przerwie). */
async function pullItems(): Promise<number> {
  const list = await listAll({ privateExtendedProperty: "pulseType=item", showDeleted: "true" });
  let changed = 0;
  for (const g of list) if (g.id.startsWith(ITEM_PREFIX) && (await applyRemoteItem(g))) changed += 1;
  return changed;
}

async function pushItems(): Promise<{ pushed: number; failed: number; error?: Error }> {
  const queue = await db.items.where("pending").equals(1).toArray();
  let pushed = 0;
  let failed = 0;
  let error: Error | undefined;
  for (const i of queue) {
    try {
      const path = `${calPath()}/${ITEM_PREFIX}${i.id}`;
      if (i.deleted) {
        const res = await api(path, { method: "DELETE" });
        if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Usuwanie zadania nieudane (${res.status})`);
        await db.items.delete(i.id);
        continue;
      }
      // PATCH przywraca też wpis usunięty wcześniej w Google (status: confirmed); brak → POST z naszym ID
      let res = await api(path, { method: "PATCH", body: JSON.stringify(itemBody(i)) });
      if (res.status === 404) {
        res = await api(calPath(), { method: "POST", body: JSON.stringify({ ...itemBody(i), id: `${ITEM_PREFIX}${i.id}` }) });
      }
      if (!res.ok) throw new Error(`Kopia zadania „${i.title}” w Google nieudana (${res.status})`);
      await db.transaction("rw", db.items, async () => {
        const cur = await db.items.get(i.id);
        if (!cur) return;
        await db.items.update(i.id, { remote: 1, ...(cur.updatedAt === i.updatedAt ? { pending: 0 as const } : {}) });
      });
      pushed += 1;
    } catch (err) {
      if (err instanceof NeedsAuthError) throw err;
      failed += 1;
      error ??= err instanceof Error ? err : new Error(String(err));
    }
  }
  return { pushed, failed, error };
}
