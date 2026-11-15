import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarMap } from "./components/CalendarMap";
import { EventSheet } from "./components/EventSheet";
import type { WeekSelection } from "./components/MiniCalendar";
import { MonthView } from "./components/MonthView";
import { QuickCard } from "./components/QuickCard";
import { SearchSheet } from "./components/SearchSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { Sidebar } from "./components/Sidebar";
import { SyncIndicator } from "./components/SyncIndicator";
import { Toast } from "./components/Toast";
import { PALETTE } from "./colors";
import { db, eventsInRange, newEventId, pendingCount, removeLocal, saveLocal, tagStats, type TagStat } from "./db";
import { allDayDraft, draftFromEvent, isDirty, timedDraft, whenLabel, withDraft } from "./draft";
import type { Anchor } from "./hooks/useAnchoredPlacement";
import { useGoogleSync, MIN_POLL_SEC } from "./hooks/useGoogleSync";
import { useLiveQuery } from "./hooks/useLiveQuery";
import { DESKTOP_QUERY, useMediaQuery } from "./hooks/useMediaQuery";
import { useNow } from "./hooks/useNow";
import type { ParsedEntry } from "./quickParse";
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
  sameDay,
  startOfDay,
  startOfWeek,
} from "./time";

const POLL_KEY = "pulsecal:poll-sec";
const SIDEBAR_KEY = "pulsecal:sidebar";
const HIDDEN_TAGS_KEY = "pulsecal:hidden-tags";
/** Okno mapy: 6 tygodni, przesuwane o 2 tygodnie przy krawędzi (przewijanie bez końca). */
const MAP_DAYS = 42;
const MAP_SHIFT = 14;

const mapStartFor = (d: Date) => addDays(startOfWeek(d), -MAP_SHIFT);

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
  // początek okna dni w mapie — niezależny od fokusu, żeby przewijanie nie skakało
  const [mapStart, setMapStart] = useState(() => mapStartFor(new Date()));
  const [scrollToNow, setScrollToNow] = useState(1);
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  // szybka karta (tytuł + kiedy) albo pełny arkusz edycji
  const [editor, setEditor] = useState<"quick" | "full">("quick");
  // komputer: okno wpisu wyskakuje przy kursorze (ostatnie kliknięcie myszą)
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const lastPointer = useRef<{ x: number; y: number; t: number; mouse: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
  const mapDays = useMemo(
    () => (weekSel ? dayRange(weekSel.start, weekSel.weeks * 7) : dayRange(mapStart, MAP_DAYS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selKey, mapStart.getTime()],
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

  /** Każdy jawny skok (strzałki, dziś, mały kalendarz…): fokus + okno mapy wokół niego + przewinięcie. */
  const navigate = (d: Date) => {
    const day = startOfDay(d);
    setFocus(day);
    setMapStart(mapStartFor(day));
    setScrollToNow((n) => n + 1);
  };

  const step = (dir: -1 | 1) => {
    if (weekSel) {
      const start = addDays(weekSel.start, dir * weekSel.weeks * 7);
      setWeekSel({ ...weekSel, start });
      navigate(start);
    } else {
      navigate(view === "month" ? addMonths(focus, dir) : addDays(focus, 7 * dir));
    }
  };

  const closeDrawer = () => setDrawerOpen(false);

  const goToDay = (d: Date) => {
    const day = startOfDay(d);
    const inSel = weekSel && day >= weekSel.start && day < addDays(weekSel.start, weekSel.weeks * 7);
    if (!inSel) setWeekSel(null);
    navigate(day);
  };

  /** „dziś": wraca do dzisiejszego dnia w obecnym widoku (wybrany zakres tygodni przesuwa się na dziś). */
  const goToday = () => {
    const today = startOfDay(new Date());
    if (weekSel) setWeekSel({ ...weekSel, start: startOfWeek(today) });
    navigate(today);
  };

  const goToNow = () => {
    goToday();
    setView("map");
  };

  const clearWeekSel = () => {
    setWeekSel(null);
    navigate(focus);
  };

  // skrót klawiszowy „t" = dziś (jak w Google Calendar), gdy nie piszesz i nie ma otwartego okna
  const goTodayRef = useRef(goToday);
  goTodayRef.current = goToday;
  const sheetOpen = Boolean(draft) || settingsOpen || searchOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheetOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "t" || e.key === "T") goTodayRef.current();
      // „/" = szukaj (jak w Google Calendar)
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

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

  /* ── szukaj / szybkie dodawanie ── */

  const openFromSearch = (e: CalEvent) => {
    setSearchOpen(false);
    goToDay(new Date(e.start));
    openDraft(draftFromEvent(e), isDesktop ? "full" : "quick");
  };

  const createFromSearch = async (p: ParsedEntry) => {
    setSearchOpen(false);
    const event: CalEvent = {
      id: newEventId(),
      title: p.title,
      notes: "",
      start: p.start,
      end: p.end,
      allDay: p.allDay,
      color: PALETTE[4].value,
      tags: p.tags,
      origin: "local",
      updatedAt: Date.now(),
      deleted: false,
      pending: 1,
    };
    await saveLocal(event);
    goToDay(new Date(p.start));
    const hidden = !isVisible(event.tags, hiddenTags);
    sync.notify(
      `Dodano „${p.title}” · ${whenLabel(p)}${hidden ? " (ukryty przez filtr tagów)" : ""}`,
      hidden ? "warn" : "ok",
    );
    sync.requestSync();
  };

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
            <button
              type="button"
              className="today-btn"
              title="Wróć do dzisiejszego dnia (T)"
              aria-label="Dziś"
              onClick={goToday}
            >
              dziś
            </button>
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
                onClick={clearWeekSel}
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
            navigate(start);
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
              onEdge={weekSel ? undefined : (dir) => setMapStart((s) => addDays(s, dir * MAP_SHIFT))}
              onVisibleDay={weekSel ? undefined : (d) => setFocus((f) => (sameDay(f, d) ? f : startOfDay(d)))}
              onStep={weekSel ? step : undefined}
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
              onStep={step}
            />
          )}

          <div className="dock">
            <div className="pill">
              <button type="button" className="pill-search" onClick={() => setSearchOpen(true)}>
                Szukaj w czasie albo dodaj wpis
              </button>
              <button
                type="button"
                className="pill-plus"
                aria-label="Nowy wpis"
                onClick={() => openDraft(timedDraft(nextQuarter().getTime(), PALETTE[4].value))}
              >
                +
              </button>
            </div>
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
        {searchOpen && (
          <SearchSheet
            key="search"
            knownTags={knownTags}
            onClose={() => setSearchOpen(false)}
            onOpenEvent={openFromSearch}
            onCreate={(p) => void createFromSearch(p)}
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
