import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MIN_POLL_SEC } from "../hooks/useGoogleSync";
import { backdropMotion, sheetMotion } from "./sheetMotion";
import { hasValidToken, listCalendars, type CalendarInfo } from "../sync/google";
import type { SyncState } from "../types";
import { formatClock } from "../time";

type Props = {
  clientId: string;
  calendarId: string;
  linked: boolean;
  state: SyncState;
  pending: number;
  lastSyncAt: number | null;
  pollSec: number;
  onClientId: (v: string) => void;
  onCalendarId: (v: string) => void;
  onPollSec: (v: number) => void;
  moveThreshold: number;
  onMoveThreshold: (v: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSyncNow: () => void;
  onClose: () => void;
};

const STATE_TEXT: Record<SyncState, string> = {
  off: "Niepołączono — wpisy są tylko na tym urządzeniu.",
  idle: "Połączono.",
  syncing: "Synchronizuję…",
  expired: "Sesja Google wygasła (Google daje ją na ok. godzinę). Kliknij „Połącz ponownie”.",
  offline: "Offline — zmiany wyślą się po powrocie internetu.",
  error: "Ostatnia synchronizacja się nie udała.",
};

export function SettingsSheet(p: Props) {
  const [calendars, setCalendars] = useState<CalendarInfo[] | null>(null);
  const [calDraft, setCalDraft] = useState(p.calendarId);
  const [pollDraft, setPollDraft] = useState(String(p.pollSec));
  const [moveDraft, setMoveDraft] = useState(String(p.moveThreshold));

  useEffect(() => setCalDraft(p.calendarId), [p.calendarId]);

  useEffect(() => {
    if (!p.linked || !hasValidToken()) return;
    let alive = true;
    listCalendars()
      .then((c) => alive && setCalendars(c))
      .catch(() => alive && setCalendars(null));
    return () => {
      alive = false;
    };
  }, [p.linked, p.state]);

  const commitCalendar = (id: string) => {
    const next = id.trim() || "primary";
    if (next === p.calendarId) return;
    const ok = window.confirm(
      `Zmienić kalendarz na „${next}”?\nWpisy pobrane z obecnego kalendarza znikną z aplikacji, a Twoje własne wpisy zostaną skopiowane do nowego.`,
    );
    if (ok) p.onCalendarId(next);
    else setCalDraft(p.calendarId);
  };

  const commitPoll = () => {
    const v = Math.min(600, Math.max(MIN_POLL_SEC, Math.round(Number(pollDraft) || 30)));
    setPollDraft(String(v));
    p.onPollSec(v);
  };

  return (
    <motion.div
      className="sheet-backdrop"
      onClick={p.onClose}
      role="presentation"
      {...backdropMotion}
    >
      <motion.div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ustawienia"
        {...sheetMotion}
      >
        <div className="grab" />
        <h2>Google Calendar</h2>
        <p className="hint">
          Pulsecal trzyma wpisy lokalnie (IndexedDB). Google to kopia zapasowa i źródło nowych
          wydarzeń. Na iOS kalendarz jest odpytywany tylko, gdy aplikacja jest otwarta.
        </p>
        <p className={`hint sync-status ${p.state}`}>
          {STATE_TEXT[p.state]}
          {p.pending > 0 &&
            (p.state === "off"
              ? ` Po połączeniu do Google trafi: ${p.pending}.`
              : ` W kolejce do wysłania: ${p.pending}.`)}
          {p.lastSyncAt && ` Ostatnio: ${formatClock(new Date(p.lastSyncAt))}.`}
        </p>
        <label className="field">
          OAuth Client ID
          <input
            value={p.clientId}
            placeholder="xxx.apps.googleusercontent.com"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => p.onClientId(e.target.value)}
          />
        </label>
        {calendars && calendars.length > 0 ? (
          <label className="field">
            Kalendarz
            <select value={p.calendarId} onChange={(e) => commitCalendar(e.target.value)}>
              {!calendars.some((c) => c.id === p.calendarId || (c.primary && p.calendarId === "primary")) && (
                <option value={p.calendarId}>{p.calendarId}</option>
              )}
              {calendars.map((c) => (
                <option key={c.id} value={c.primary ? "primary" : c.id}>
                  {c.summary}
                  {c.primary ? " (główny)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            Calendar ID
            <input
              value={calDraft}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCalDraft(e.target.value)}
              onBlur={() => commitCalendar(calDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
        )}
        <label className="field">
          Interwał odpytywania (sekundy)
          <input
            type="number"
            inputMode="numeric"
            min={MIN_POLL_SEC}
            max={600}
            value={pollDraft}
            onChange={(e) => setPollDraft(e.target.value)}
            onBlur={commitPoll}
          />
        </label>
        <label className="field">
          Zaproponuj rozbicie wpisu po tylu przeniesieniach na inny dzień
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={99}
            value={moveDraft}
            onChange={(e) => setMoveDraft(e.target.value)}
            onBlur={() => {
              const v = Math.min(99, Math.max(2, Math.round(Number(moveDraft) || 10)));
              setMoveDraft(String(v));
              p.onMoveThreshold(v);
            }}
          />
        </label>
        <p className="hint">
          W Google Cloud: utwórz projekt → włącz Calendar API → OAuth client typu Web → dodaj
          origin tej aplikacji (np. http://localhost:5173 oraz origin PWA).
        </p>
        <div className="row-actions">
          {p.linked && p.state !== "expired" ? (
            <button type="button" className="ghost" onClick={p.onDisconnect}>
              Rozłącz
            </button>
          ) : (
            <button type="button" className="ghost" onClick={p.onConnect}>
              {p.linked ? "Połącz ponownie" : "Połącz"}
            </button>
          )}
          <button type="button" className="primary" onClick={p.onSyncNow} disabled={!p.linked}>
            Sync teraz
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
