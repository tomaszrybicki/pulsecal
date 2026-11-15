import { useEffect, useMemo, useState } from "react";
import { CalendarMap } from "./components/CalendarMap";
import { EventSheet } from "./components/EventSheet";
import { MonthView } from "./components/MonthView";
import { SettingsSheet } from "./components/SettingsSheet";
import { PALETTE } from "./colors";
import { db, eventsInRange, seedIfEmpty, softDeleteEvent, upsertEvent } from "./db";
import { useLiveQuery } from "./hooks/useLiveQuery";
import { useNow } from "./hooks/useNow";
import {
  connectGoogle,
  deleteOnGoogle,
  disconnectGoogle,
  getCalendarId,
  getStoredClientId,
  isGoogleConnected,
  pushLocalEvent,
  setCalendarId,
  setStoredClientId,
  syncBidirectional,
} from "./sync/google";
import type { DraftEvent, ViewMode } from "./types";
import { addDays, monthLabel, startOfDay, startOfWeek } from "./time";

const POLL_KEY = "pulsecal:poll-sec";

export function App() {
  const now = useNow(1000);
  const [view, setView] = useState<ViewMode>("map");
  const [focus, setFocus] = useState(() => startOfDay(new Date()));
  const [scrollToNow, setScrollToNow] = useState(1);
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clientId, setClientId] = useState(getStoredClientId);
  const [calendarId, setCalId] = useState(getCalendarId);
  const [pollSec, setPollSec] = useState(() => Number(localStorage.getItem(POLL_KEY)) || 30);
  const [connected, setConnected] = useState(isGoogleConnected);
  const [status, setStatus] = useState("Lokalna baza gotowa. Google jest opcjonalną kopią.");

  const range = useMemo(() => {
    const from = addDays(startOfWeek(focus), -7);
    const to = addDays(from, 28);
    return { from: from.getTime(), to: to.getTime(), fromDate: from, toDate: to };
  }, [focus]);

  const events = useLiveQuery(
    () => eventsInRange(range.from, range.to),
    [range.from, range.to],
    [],
  );

  useEffect(() => {
    void seedIfEmpty();
  }, []);

  useEffect(() => {
    setStoredClientId(clientId);
  }, [clientId]);

  useEffect(() => {
    setCalendarId(calendarId);
  }, [calendarId]);

  useEffect(() => {
    localStorage.setItem(POLL_KEY, String(pollSec));
  }, [pollSec]);

  useEffect(() => {
    if (!connected) return;

    const run = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const msg = await syncBidirectional(range.fromDate, range.toDate);
        setStatus(msg);
        setConnected(isGoogleConnected());
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Sync nieudany");
        setConnected(isGoogleConnected());
      }
    };

    void run();
    const id = window.setInterval(run, Math.max(15, pollSec) * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [connected, pollSec, range.from, range.to]);

  const saveDraft = async () => {
    if (!draft?.title.trim()) return;
    const existing = draft.id ? await db.events.get(draft.id) : undefined;
    const event = {
      id: draft.id ?? crypto.randomUUID(),
      title: draft.title.trim(),
      notes: draft.notes,
      start: draft.start,
      end: Math.max(draft.end, draft.start + 15 * 60_000),
      allDay: draft.allDay,
      color: draft.color,
      origin: existing?.origin ?? ("local" as const),
      updatedAt: Date.now(),
      deleted: false,
      googleEventId: existing?.googleEventId,
      googleEtag: existing?.googleEtag,
    };
    await upsertEvent(event);
    setDraft(null);
    if (connected) {
      try {
        await pushLocalEvent(event);
        setStatus("Zapisano lokalnie i w Google");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Zapis lokalny OK, Google nie");
      }
    }
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    const existing = await db.events.get(draft.id);
    await softDeleteEvent(draft.id);
    setDraft(null);
    if (connected && existing) {
      try {
        await deleteOnGoogle(existing);
        await db.events.delete(draft.id);
      } catch {
        setStatus("Usunięto lokalnie — Google później");
      }
    }
  };

  return (
    <div className="app">
      <div className="ambient" aria-hidden>
        <div className="blob a" />
        <div className="blob b" />
        <div className="blob c" />
      </div>

      <header className="topbar">
        <div className="brand">
          <strong>pulsecal</strong>
          <span>{monthLabel(focus)}</span>
        </div>
        <div className="chip-row">
          <button className="chip" aria-pressed={view === "map"} onClick={() => setView("map")}>
            mapa
          </button>
          <button className="chip" aria-pressed={view === "month"} onClick={() => setView("month")}>
            miesiąc
          </button>
          <button
            className="icon-btn"
            aria-label="Ustawienia Google"
            onClick={() => setSettingsOpen(true)}
            title={status}
          >
            <span className={`sync-dot${connected ? " on" : ""}`} />
          </button>
        </div>
      </header>

      <main className="map-shell">
        {view === "map" ? (
          <CalendarMap
            now={now}
            anchor={focus}
            events={events}
            scrollToNowToken={scrollToNow}
            onSlot={(start) =>
              setDraft({
                title: "",
                notes: "",
                start: start.getTime(),
                end: start.getTime() + 45 * 60_000,
                allDay: false,
                color: PALETTE[0].value,
              })
            }
            onEvent={(e) =>
              setDraft({
                id: e.id,
                title: e.title,
                notes: e.notes,
                start: e.start,
                end: e.end,
                allDay: e.allDay,
                color: e.color,
              })
            }
          />
        ) : (
          <MonthView
            now={now}
            cursor={focus}
            events={events}
            onDay={(d) => {
              setFocus(startOfDay(d));
              setView("map");
              setScrollToNow((n) => n + 1);
            }}
          />
        )}

        <div className="dock">
          <button
            className="pill"
            onClick={() =>
              setDraft({
                title: "",
                notes: "",
                start: Date.now(),
                end: Date.now() + 45 * 60_000,
                allDay: false,
                color: PALETTE[4].value,
              })
            }
          >
            Szukaj w czasie albo dodaj wpis
            <span className="pill-plus">+</span>
          </button>
          <button
            className="locate"
            aria-label="Teraz"
            onClick={() => {
              setFocus(startOfDay(new Date()));
              setView("map");
              setScrollToNow((n) => n + 1);
            }}
          >
            ●
          </button>
        </div>
      </main>

      {draft && (
        <EventSheet
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={() => void saveDraft()}
          onDelete={draft.id ? () => void removeDraft() : undefined}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          clientId={clientId}
          calendarId={calendarId}
          connected={connected}
          status={status}
          pollSec={pollSec}
          onClientId={setClientId}
          onCalendarId={setCalId}
          onPollSec={setPollSec}
          onConnect={() => {
            void (async () => {
              try {
                await connectGoogle();
                setConnected(true);
                setStatus("Połączono z Google");
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Nie udało się połączyć");
              }
            })();
          }}
          onDisconnect={() => {
            disconnectGoogle();
            setConnected(false);
            setStatus("Rozłączono. Dane lokalne zostają.");
          }}
          onSyncNow={() => {
            void (async () => {
              try {
                const msg = await syncBidirectional(range.fromDate, range.toDate);
                setConnected(isGoogleConnected());
                setStatus(msg);
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Sync nieudany");
              }
            })();
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
