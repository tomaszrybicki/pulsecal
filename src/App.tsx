import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarMap } from "./components/CalendarMap";
import { EventSheet } from "./components/EventSheet";
import type { WeekSelection } from "./components/MiniCalendar";
import { MonthView } from "./components/MonthView";
import { QuickCard } from "./components/QuickCard";
import { SettingsSheet } from "./components/SettingsSheet";
import { Sidebar } from "./components/Sidebar";
import { SyncIndicator } from "./components/SyncIndicator";
import { Toast } from "./components/Toast";
import { PALETTE } from "./colors";
import { db, eventsInRange, newEventId, pendingCount, removeLocal, saveLocal, tagStats, type TagStat } from "./db";
import { allDayDraft, draftFromEvent, isDirty, timedDraft, withDraft } from "./draft";
import type { Anchor } from "./hooks/useAnchoredPlacement";
import { useGoogleSync, MIN_POLL_SEC } from "./hooks/useGoogleSync";
import { useLiveQuery } from "./hooks/useLiveQuery";
import { DESKTOP_QUERY, useMediaQuery } from "./hooks/useMediaQuery";
import { useNow } from "./hooks/useNow";
import { getCalendarId, getStoredClientId, preloadGoogle, setStoredClientId, switchCalendar } from "./sync/google";
import { UNTAGGED, isVisible, normalizeTags } from "./tags";
import type { CalEvent, DraftEvent, ViewMode } from "./types";
import {
  MINUTE,
  addDays,
  addMonths,
  chunkWeeks,
  dayRange,
  monthLabel,
  monthWeeks,
  nextQuarter,
  rangeLabel,
  startOfDay,
  startOfWeek,
} from "./time";

const POLL_KEY = "pulsecal:poll-sec";
const SIDEBAR_KEY = "pulsecal:sidebar";
const HIDDEN_TAGS_KEY = "pulsecal:hidden-tags";
const MAP_DAYS = 21;

function readPollSec(): number {
  const v = Number(localStorage.getItem(POLL_KEY));
  return Number.isFinite(v) && v >= MIN_POLL_SEC ? v : 30;
}

function readHiddenTags(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_TAGS_KEY) || "[]") as unknown;
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function App() {
  // Minuta wystarcza dla linii „teraz"; tykanie co sekundę re-renderowało całą aplikację.
  const now = useNow(30_000);
  const [view, setView] = useState<ViewMode>("map");
  const [focus, setFocus] = useState(() => startOfDay(new Date()));
  // tygodnie wybrane w małym kalendarzu (null = zwykły widok: miesiąc / 21 dni wokół fokusu)
  const [weekSel, setWeekSel] = useState<WeekSelection | null>(null);
  const [scrollToNow, setScrollToNow] = useState(1);
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  // szybka karta (tytuł + kiedy) albo pełny arkusz edycji
  const [editor, setEditor] = useState<"quick" | "full">("quick");
  // komputer: okno wpisu wyskakuje przy kursorze (ostatnie kliknięcie myszą)
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number; mouse: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clientId, setClientId] = useState(getStoredClientId);
  const [calendarId, setCalendarId] = useState(getCalendarId);
  const [pollSec, setPollSec] = useState(readPollSec);
  const [hiddenTags, setHiddenTags] = useState(readHiddenTags);
  // na komputerze kliknięcie wpisu od razu pokazuje wszystkie opcje (bez „Więcej")
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // panel boczny: na komputerze stała kolumna (zapamiętana), na telefonie wysuwana szuflada
  const [dockOpen, setDockOpen] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== "0");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sideOpen = isDesktop ? dockOpen : drawerOpen;

  const selKey = weekSel ? `${weekSel.start.getTime()}:${weekSel.weeks}` : "";
  const mapWeekKey = startOfWeek(focus).getTime();
  const mapDays = useMemo(
    () => (weekSel ? dayRange(weekSel.start, weekSel.weeks * 7) : dayRange(addDays(startOfWeek(focus), -7), MAP_DAYS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selKey, mapWeekKey],
  );
  const monthKey = `${focus.getFullYear()}-${focus.getMonth()}`;
  const gridWeeks = useMemo(
    () => (weekSel ? chunkWeeks(dayRange(weekSel.start, weekSel.weeks * 7)) : monthWeeks(focus)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selKey, monthKey],
  );

  const range = useMemo(() => {
    const days = view === "month" ? gridWeeks.flat() : mapDays;
    return { from: days[0], to: addDays(days[days.length - 1], 1) };
  }, [view, gridWeeks, mapDays]);

  const events = useLiveQuery(
    () => eventsInRange(range.from.getTime(), range.to.getTime()),
    [range.from.getTime(), range.to.getTime()],
    [] as CalEvent[],
  );
  const pending = useLiveQuery(() => pendingCount(), [], 0);
  const tagList = useLiveQuery(() => tagStats(), [], [] as TagStat[]);
  const knownTags = useMemo(() => tagList.map((t) => t.tag), [tagList]);

  const sync = useGoogleSync({ from: range.from, to: range.to, pollSec });

  useEffect(() => {
    setStoredClientId(clientId);
    preloadGoogle();
  }, [clientId]);

  useEffect(() => {
    localStorage.setItem(POLL_KEY, String(pollSec));
  }, [pollSec]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_TAGS_KEY, JSON.stringify([...hiddenTags]));
  }, [hiddenTags]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, dockOpen ? "1" : "0");
  }, [dockOpen]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY, t: Date.now(), mouse: e.pointerType !== "touch" };
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);

  const saveDraft = async () => {
    if (!draft?.title.trim()) return;
    const existing = draft.id ? await db.events.get(draft.id) : undefined;
    const event: CalEvent = {
      ...existing,
      id: existing?.id ?? newEventId(),
      title: draft.title.trim(),
      notes: draft.notes,
      start: draft.start,
      end: Math.max(draft.end, draft.start + 15 * MINUTE),
      allDay: draft.allDay,
      color: draft.color,
      tags: normalizeTags(draft.tags),
      origin: existing?.origin ?? "local",
      updatedAt: Date.now(),
      deleted: false,
      pending: 1,
    };
    await saveLocal(event);
    setDraft(null);
    if (!isVisible(event.tags, hiddenTags)) sync.notify("Zapisano. Wpis jest ukryty przez filtr tagów.", "warn");
    sync.requestSync();
  };

  const openDraft = (d: DraftEvent, mode: "quick" | "full" = "quick") => {
    // kliknięcie myszą przed chwilą → okno przy kursorze; telefon / klawiatura → arkusz od dołu
    const p = lastPointer.current;
    setAnchor(isDesktop && p?.mouse && Date.now() - p.t < 1500 ? { x: p.x, y: p.y } : null);
    setEditor(mode);
    setDraft(d);
  };

  /** Tapnięcie obok karty: nowy wpis bez zapisu (jak w Google), edycję istniejącego zapisujemy. */
  const dismissDraft = () => {
    if (draft?.id && draft.title.trim() && isDirty(draft, events.find((e) => e.id === draft.id))) {
      void saveDraft();
    } else {
      setDraft(null);
    }
  };

  const moveEvent = async (e: CalEvent, start: number, end: number) => {
    const current = await db.events.get(e.id);
    if (!current) return;
    await saveLocal({ ...current, start, end });
    sync.requestSync();
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    await removeLocal(draft.id);
    setDraft(null);
    sync.requestSync();
  };

  const changeCalendar = async (id: string) => {
    const next = id.trim() || "primary";
    if (next === getCalendarId()) return;
    await switchCalendar(next);
    setCalendarId(next);
    sync.notify(`Kalendarz docelowy: ${next}`);
    sync.syncManually();
  };

  /* ── nawigacja ── */

  const step = (dir: -1 | 1) => {
    if (weekSel) {
      const start = addDays(weekSel.start, dir * weekSel.weeks * 7);
      setWeekSel({ ...weekSel, start });
      setFocus(start);
    } else {
      setFocus((f) => (view === "month" ? addMonths(f, dir) : addDays(f, 7 * dir)));
    }
    if (view === "map") setScrollToNow((n) => n + 1);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const goToDay = (d: Date) => {
    const day = startOfDay(d);
    const inSel = weekSel && day >= weekSel.start && day < addDays(weekSel.start, weekSel.weeks * 7);
    if (!inSel) setWeekSel(null);
    setFocus(day);
    setScrollToNow((n) => n + 1);
  };

  const goToNow = () => {
    const today = startOfDay(new Date());
    if (weekSel) setWeekSel({ ...weekSel, start: startOfWeek(today) });
    setFocus(today);
    setView("map");
    setScrollToNow((n) => n + 1);
  };

  const gridLabel = weekSel ? `${weekSel.weeks} tyg.` : "miesiąc";

  const periodLabel = weekSel
    ? rangeLabel(weekSel.start, addDays(weekSel.start, weekSel.weeks * 7 - 1))
    : monthLabel(focus);

  /* ── tagi ── */

  const visibleEvents = useMemo(() => events.filter((e) => isVisible(e.tags, hiddenTags)), [events, hiddenTags]);
  const shownEvents = useMemo(() => withDraft(visibleEvents, draft), [visibleEvents, draft]);

  const toggleTag = (tag: string) =>
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const soloTag = (tag: string) =>
    setHiddenTags(new Set([...knownTags, UNTAGGED].filter((t) => t !== tag)));

  const newColor = PALETTE[0].value;

  return (
    <div className="app">
      <div className="ambient" aria-hidden>
        <div className="blob a" />
        <div className="blob b" />
        <div className="blob c" />
      </div>

      <header className="topbar">
        <button
          type="button"
          className="menu-btn"
          aria-label={sideOpen ? "Ukryj panel boczny" : "Pokaż panel boczny"}
          aria-expanded={sideOpen}
          onClick={() => (isDesktop ? setDockOpen((o) => !o) : setDrawerOpen((o) => !o))}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="brand">
          <strong>pulsecal</strong>
          <span className="period">
            <button type="button" className="nav-btn" aria-label="Wstecz" onClick={() => step(-1)}>
              ‹
            </button>
            <span className="period-text">{periodLabel}</span>
            <button type="button" className="nav-btn" aria-label="Dalej" onClick={() => step(1)}>
              ›
            </button>
            {weekSel && (
              <button
                type="button"
                className="nav-btn clear-sel"
                aria-label="Wyczyść wybrane tygodnie"
                title="Wróć do zwykłego widoku"
                onClick={() => setWeekSel(null)}
              >
                ×
              </button>
            )}
          </span>
        </div>
        <div className="chip-row">
          {/* telefon: przełącznik widoku jest w szufladzie (jak w Google Calendar) — tu brak miejsca */}
          {isDesktop && (
            <>
              <button className="chip" aria-pressed={view === "map"} onClick={() => setView("map")}>
                mapa
              </button>
              <button className="chip" aria-pressed={view === "month"} onClick={() => setView("month")}>
                {gridLabel}
              </button>
            </>
          )}
          <SyncIndicator
            state={sync.state}
            pending={pending}
            onClick={() => {
              if (sync.state === "expired") {
                // synchronicznie w handlerze — inaczej Safari zablokuje okno logowania
                void sync.connect().then((ok) => {
                  if (!ok) setSettingsOpen(true);
                });
              } else {
                setSettingsOpen(true);
              }
            }}
          />
        </div>
      </header>

      <div className="body">
        <Sidebar
          mode={isDesktop ? "docked" : "drawer"}
          open={sideOpen}
          onClose={closeDrawer}
          today={now}
          focus={focus}
          selection={weekSel}
          onPickDay={(d) => {
            goToDay(d);
            closeDrawer();
          }}
          onPickWeeks={(start, weeks) => {
            setWeekSel({ start, weeks });
            setFocus(start);
            setScrollToNow((n) => n + 1);
            closeDrawer();
          }}
          onCreate={() => {
            closeDrawer();
            openDraft(timedDraft(nextQuarter().getTime(), newColor), isDesktop ? "full" : "quick");
          }}
          view={view}
          gridLabel={gridLabel}
          onView={(v) => {
            setView(v);
            closeDrawer();
          }}
          tags={tagList}
          hidden={hiddenTags}
          onToggleTag={toggleTag}
          onSoloTag={soloTag}
          onShowAll={() => setHiddenTags(new Set())}
        />

        <main className="map-shell">
          {view === "map" ? (
            <CalendarMap
              now={now}
              days={mapDays}
              focusDay={focus}
              events={shownEvents}
              scrollToNowToken={scrollToNow}
              onSlot={(start) => openDraft(timedDraft(start.getTime(), newColor))}
              onAllDaySlot={(day) => openDraft(allDayDraft(day, newColor))}
              onEvent={(e) => openDraft(draftFromEvent(e), isDesktop ? "full" : "quick")}
              onMove={(e, start, end) => void moveEvent(e, start, end)}
            />
          ) : (
            <MonthView
              now={now}
              weeks={gridWeeks}
              month={weekSel ? null : focus.getMonth()}
              events={shownEvents}
              onDay={(d) => {
                goToDay(d);
                setView("map");
              }}
              onAdd={(d) => openDraft(allDayDraft(d, newColor))}
              onEvent={(e) => openDraft(draftFromEvent(e), isDesktop ? "full" : "quick")}
              onMove={(e, start, end) => void moveEvent(e, start, end)}
            />
          )}

          <div className="dock">
            <button className="pill" onClick={() => openDraft(timedDraft(nextQuarter().getTime(), PALETTE[4].value))}>
              Szukaj w czasie albo dodaj wpis
              <span className="pill-plus">+</span>
            </button>
            <button className="locate" aria-label="Teraz" onClick={goToNow}>
              ●
            </button>
          </div>
        </main>
      </div>

      <Toast notice={sync.notice} />

      <AnimatePresence>
        {draft && editor === "quick" && (
          <QuickCard
            key="quick"
            draft={draft}
            knownTags={knownTags}
            anchor={anchor}
            onChange={setDraft}
            onSave={() => void saveDraft()}
            onDismiss={dismissDraft}
            onMore={() => setEditor("full")}
            onDelete={draft.id ? () => void removeDraft() : undefined}
          />
        )}
        {draft && editor === "full" && (
          <EventSheet
            key="full"
            draft={draft}
            knownTags={knownTags}
            anchor={anchor}
            onChange={setDraft}
            onClose={() => setDraft(null)}
            onDismiss={dismissDraft}
            onSave={() => void saveDraft()}
            onDelete={draft.id ? () => void removeDraft() : undefined}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <SettingsSheet
            clientId={clientId}
            calendarId={calendarId}
            linked={sync.linked}
            state={sync.state}
            pending={pending}
            lastSyncAt={sync.lastSyncAt}
            pollSec={pollSec}
            onClientId={setClientId}
            onCalendarId={(id) => void changeCalendar(id)}
            onPollSec={setPollSec}
            onConnect={() => void sync.connect()}
            onDisconnect={sync.disconnect}
            onSyncNow={sync.syncManually}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
