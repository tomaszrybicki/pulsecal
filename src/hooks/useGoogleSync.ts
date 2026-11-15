import { useCallback, useEffect, useRef, useState } from "react";
import {
  NeedsAuthError,
  connectGoogle,
  disconnectGoogle,
  hasValidToken,
  isGoogleLinked,
  syncNow,
  tokenExpiresAt,
  type SyncResult,
} from "../sync/google";
import type { SyncState } from "../types";

export const MIN_POLL_SEC = 10;
const DEBOUNCE_MS = 800;

export type NoticeAction = { label: string; run: () => void };
export type SyncNotice = { id: number; text: string; tone: "ok" | "warn" | "error"; action?: NoticeAction };

type Options = { from: Date; to: Date; pollSec: number };

function describe(r: SyncResult): string | null {
  const parts: string[] = [];
  if (r.pushed) parts.push(`wysłano ${r.pushed}`);
  if (r.removed) parts.push(`usunięto ${r.removed}`);
  if (r.pulled) parts.push(`pobrano ${r.pulled}`);
  return parts.length ? `Google: ${parts.join(", ")}` : null;
}

/**
 * Odpytywanie Google + stan synchronizacji dla UI.
 * Nigdy nie otwiera okna logowania samo — `connect()` trzeba wołać bezpośrednio z onClick.
 */
export function useGoogleSync({ from, to, pollSec }: Options) {
  const [linked, setLinked] = useState(isGoogleLinked);
  const [state, setState] = useState<SyncState>(() =>
    !isGoogleLinked() ? "off" : !navigator.onLine ? "offline" : hasValidToken() ? "idle" : "expired",
  );
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const range = useRef({ from, to });
  range.current = { from, to };
  const linkedRef = useRef(linked);
  linkedRef.current = linked;
  const debounce = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string, tone: SyncNotice["tone"] = "ok", action?: NoticeAction) => {
    setNotice({ id: Date.now() + Math.random(), text, tone, action });
  }, []);

  const run = useCallback(
    async (opts: { forceFull?: boolean; manual?: boolean } = {}) => {
      if (!linkedRef.current) {
        setState("off");
        return;
      }
      if (!navigator.onLine) {
        setState("offline");
        if (opts.manual) notify("Brak internetu — zmiany czekają w kolejce", "warn");
        return;
      }
      if (!hasValidToken()) {
        setState("expired");
        if (opts.manual) notify("Sesja Google wygasła — połącz ponownie", "warn");
        return;
      }
      setState("syncing");
      try {
        const r = await syncNow(range.current.from, range.current.to, { forceFull: opts.forceFull });
        setLastSyncAt(Date.now());
        if (r.failed) {
          setState("error");
          notify(`Nie wysłano ${r.failed} wpis(ów): ${r.pushError?.message ?? "błąd Google"}`, "error");
          return;
        }
        setState("idle");
        const msg = describe(r);
        if (msg && (opts.manual || r.pulled || r.removed)) notify(msg);
        else if (opts.manual) notify("Wszystko zsynchronizowane");
      } catch (err) {
        if (err instanceof NeedsAuthError) {
          setState("expired");
          notify(err.message, "warn");
        } else if (!navigator.onLine) {
          setState("offline");
        } else {
          setState("error");
          notify(err instanceof Error ? err.message : "Synchronizacja nieudana", "error");
        }
      }
    },
    [notify],
  );

  /** Po lokalnej zmianie: zbiera kilka szybkich zmian w jedną synchronizację. */
  const requestSync = useCallback(
    (delayMs = DEBOUNCE_MS) => {
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => void run(), delayMs);
    },
    [run],
  );

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  // Polling tylko gdy aplikacja jest widoczna (iOS i tak nie daje działać w tle).
  useEffect(() => {
    if (!linked) return;
    const tick = () => {
      if (document.visibilityState === "visible") void run();
    };
    const id = window.setInterval(tick, Math.max(MIN_POLL_SEC, pollSec) * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onOnline = () => void run();
    const onOffline = () => setState("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [linked, pollSec, run]);

  // Zmiana widocznego okna → dociągnij je (syncNow sam zdecyduje, czy potrzebny pełny pull).
  const fromMs = from.getTime();
  const toMs = to.getTime();
  useEffect(() => {
    if (linked) requestSync();
  }, [linked, fromMs, toMs, requestSync]);

  // Token wygasa po ~1 h: pokaż „połącz ponownie" od razu, a nie dopiero przy następnym tiku.
  useEffect(() => {
    if (!linked || state === "expired" || state === "off") return;
    const exp = tokenExpiresAt();
    if (!exp) return;
    const id = window.setTimeout(() => setState("expired"), Math.max(0, exp - 30_000 - Date.now()) + 1000);
    return () => window.clearTimeout(id);
  }, [linked, state]);

  /** Wołać synchronicznie z handlera kliknięcia (Safari blokuje popup po await). */
  const connect = useCallback((): Promise<boolean> => {
    return connectGoogle().then(
      () => {
        setLinked(true);
        linkedRef.current = true;
        notify("Połączono z Google");
        void run({ forceFull: true });
        return true;
      },
      (err: unknown) => {
        notify(err instanceof Error ? err.message : "Nie udało się połączyć", "error");
        return false;
      },
    );
  }, [notify, run]);

  const disconnect = useCallback(() => {
    disconnectGoogle();
    setLinked(false);
    linkedRef.current = false;
    setState("off");
    notify("Rozłączono. Dane lokalne zostają.");
  }, [notify]);

  const syncManually = useCallback(() => void run({ forceFull: true, manual: true }), [run]);

  return { linked, state, notice, lastSyncAt, notify, requestSync, syncManually, connect, disconnect };
}
