import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarMap } from "./components/CalendarMap";
import { DayPanel, type Rect } from "./components/DayPanel";
import { getDayGroups, setDayGroups, type DayGroup } from "./dayGroups";
import { getAnimMode, setAnimMode, type AnimMode } from "./motionPrefs";
import { EpicContext, EpicOpenContext, type EpicInfo } from "./components/EpicTag";
import type { Banner } from "./components/EpicBanner";
import { EventMenu } from "./components/EventMenu";
import { EventSheet } from "./components/EventSheet";
import type { WeekSelection } from "./components/MiniCalendar";
import { MonthView } from "./components/MonthView";
import { QuickCard } from "./components/QuickCard";
import { SearchSheet } from "./components/SearchSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { PrefsSheet } from "./components/PrefsSheet";
import { Sidebar } from "./components/Sidebar";
import { TagRulesSheet } from "./components/TagRulesSheet";
import { TasksView } from "./components/TasksView";
import { ProjectsView } from "./components/ProjectsView";
import { ProjectPeek, type PeekState } from "./components/ProjectPeek";
import { projectProgress, projectsForEpic, setActiveProject } from "./projects";
import { WorkItemSheet } from "./components/WorkItemSheet";
import { WorkFieldsSheet } from "./components/WorkFieldsSheet";
import { SyncIndicator } from "./components/SyncIndicator";
import { Toast } from "./components/Toast";
import { Cheers } from "./components/Cheers";
import { recordWin } from "./cheers";
import { PALETTE } from "./colors";
import { db, eventsInRange, newEventId, pendingCount, removeLocal, saveLocal, tagStats, type TagStat } from "./db";
import { allDayDraft, draftFromEvent, isDirty, timedDraft, whenLabel, withDraft } from "./draft";
import type { Anchor } from "./hooks/useAnchoredPlacement";
import { useGoogleSync, MIN_POLL_SEC } from "./hooks/useGoogleSync";
import { useLiveQuery } from "./hooks/useLiveQuery";
import { DESKTOP_QUERY, useMediaQuery } from "./hooks/useMediaQuery";
import { useNow } from "./hooks/useNow";
import { useSettingsBackup } from "./hooks/useSettingsBackup";
import { useTheme } from "./hooks/useTheme";
import { getMoveThreshold, moveFields, moveStep, setMoveThreshold } from "./moves";
import { reconcileLinks, unlinkSeries } from "./links";
import {
  findFreeSlot,
  getAlwaysFull,
  getProdHours,
  getRequireEstimate,
  getSlotMin,
  minutesLabel,
  setAlwaysFull,
  setProdHours,
  setRequireEstimate,
  setSlotMin,
  type ProdHours,
} from "./prefs";
import type { ParsedEntry } from "./quickParse";
import { getCalendarId, getStoredClientId, preloadGoogle, setStoredClientId, switchCalendar } from "./sync/google";
import { applyTagRules, getTagRules, setTagRules, type TagRule } from "./tagRules";
import {
  UNTAGGED,
  getPaintTags,
  getTagColors,
  isVisible,
  normalizeTag,
  normalizeTags,
  replacePaintTags,
  replaceTagColors,
  setPainted,
  setTagColor,
  tagKey,
  withDefaultTags,
} from "./tags";
import type { CalEvent, DraftEvent, Project, ViewMode, WorkField, WorkItem, WorkKind } from "./types";
import { formatMinutes, storedEstimate } from "./estimate";
import { ancestorIds, SLEEPY_DAYS, remainingEstimate, subtreeIds, buildTree, epicColor, lastTouched, progressOf, epicOptions, epicPath, getWorkFields, newItem, nextNum, saveItem, setWorkFields } from "./work";
import {
  MINUTE,
  atMinutes,
  formatClock,
  fromIsoDate,
  isoDate,
  longDateLabel,
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

/** Widok po otwarciu aplikacji (ustawiany gwiazdką przy przełączniku widoków; per urządzenie). */
type DefaultView = "map" | "month" | "2w";
const DEFAULT_VIEW_KEY = "pulsecal:default-view";
const VIEW_NAME: Record<DefaultView, string> = { map: "mapa", month: "miesiąc", "2w": "2 tygodnie" };
function readDefaultView(): DefaultView {
  try {
    const v = localStorage.getItem(DEFAULT_VIEW_KEY);
    return v === "map" || v === "2w" ? v : "month";
  } catch {
    return "month";
  }
}

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
  const [defaultView, setDefaultViewState] = useState<DefaultView>(readDefaultView);
  const setDefaultView = (v: DefaultView) => {
    try {
      localStorage.setItem(DEFAULT_VIEW_KEY, v);
    } catch {
      /* prywatne okno — zostaje na tę sesję */
    }
    setDefaultViewState(v);
    sync.notify(`Widok domyślny: ${VIEW_NAME[v]}`);
  };
  const [view, setView] = useState<ViewMode>(() => (defaultView === "map" ? "map" : "month"));
  // ostatni widok kalendarza — „kalendarz” w panelu bocznym wraca do niego z widoku zadań
  const lastCalView = useRef<ViewMode>(view);
  useEffect(() => {
    if (view !== "tasks" && view !== "projects") lastCalView.current = view;
  }, [view]);
  const [focus, setFocus] = useState(() => startOfDay(new Date()));
  // tygodnie wybrane w małym kalendarzu (null = zwykły widok: miesiąc / 21 dni wokół fokusu)
  const [weekSel, setWeekSel] = useState<WeekSelection | null>(() =>
    defaultView === "2w" ? { start: startOfWeek(new Date()), weeks: 2 } : null,
  );
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
  // przegląd dnia z widoku miesiąca („+N więcej" / „•••")
  // rozszerzony dzień: rozsuwa się z komórki dnia w miesiącu (from) nad siatką (area)
  const [dayPanel, setDayPanel] = useState<{ day: Date; from: Rect | null; area: Rect | null } | null>(null);
  // menu pod prawym przyciskiem myszy na wpisie
  const [menu, setMenu] = useState<{ e: CalEvent; anchor: Anchor } | null>(null);
  const [clientId, setClientId] = useState(getStoredClientId);
  const [calendarId, setCalendarId] = useState(getCalendarId);
  const [pollSec, setPollSec] = useState(readPollSec);
  const [hiddenTags, setHiddenTags] = useState(readHiddenTags);
  const [rules, setRules] = useState<TagRule[]>(getTagRules);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [moveThreshold, setMoveThresholdState] = useState(getMoveThreshold);
  // wpis przeniesiony po raz N-ty → pełna edycja z kursorem w tytule i podpowiedzią „prosty krok”
  const [stuckId, setStuckId] = useState<string | null>(null);
  // ustawienia (odnośnik „ustawienia” w panelu bocznym)
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prodHours, setProdHoursState] = useState<ProdHours>(getProdHours);
  const [slotMin, setSlotMinState] = useState(getSlotMin);
  const [alwaysFull, setAlwaysFullState] = useState(getAlwaysFull);
  const [requireEstimate, setRequireEstimateState] = useState(getRequireEstimate);
  const [animMode, setAnimModeState] = useState<AnimMode>(getAnimMode);
  // zmiana koloru tagu → przerysowanie wszystkiego (tagColor czyta z modułu tags.ts)
  const [tagColorsVer, setTagColorsVer] = useState(0);
  // na komputerze kliknięcie wpisu od razu pokazuje wszystkie opcje (bez „Więcej")
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // kliknięcie wpisu: pełna edycja na komputerze albo gdy tak ustawiono; inaczej szybka karta
  const editorMode = isDesktop || alwaysFull ? "full" : "quick";
  const theme = useTheme();
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
  const tagStatsList = useLiveQuery(() => tagStats(), [], [] as TagStat[]);
  // domyślne tagi („ważne”, „low priority”) są na liście i w podpowiedziach także bez wpisów
  const tagList: TagStat[] = useMemo(() => withDefaultTags(tagStatsList), [tagStatsList]);
  const knownTags = useMemo(() => tagList.map((t) => t.tag), [tagList]);

  /* ── zadania i epiki ── */
  const items = useLiveQuery(() => db.items.filter((i) => !i.deleted).toArray(), [], [] as WorkItem[]);
  const projects = useLiveQuery(() => db.projects.filter((p) => !p.deleted).toArray(), [], [] as Project[]);
  // wpisy przypięte do epików — z całego kalendarza, nie tylko z widocznego zakresu (postęp, lista w epiku)
  const epicEvents = useLiveQuery(
    () => db.events.where("epicId").above("").filter((e) => !e.deleted).toArray(),
    [],
    [] as CalEvent[],
  );
  // wpisy zadań spoza epików („zaplanuj w kalendarzu” przy zadaniu bez epiku)
  const linkedIds = useMemo(() => items.flatMap((i) => (i.eventId ? [i.eventId] : [])).join(","), [items]);
  const linkedEvents = useLiveQuery(
    async () =>
      linkedIds
        ? (await db.events.bulkGet(linkedIds.split(","))).filter((e): e is CalEvent => Boolean(e) && !e!.deleted)
        : [],
    [linkedIds],
    [] as CalEvent[],
  );
  const tree = useMemo(
    () => buildTree(items, [...epicEvents, ...linkedEvents].sort((a, b) => a.start - b.start)),
    [items, epicEvents, linkedEvents],
  );
  // epiki na kalendarzu: baner z nazwą i paskiem zadań (niezrobione najpierw, z pod-epikami)
  const epicBanners = useMemo<Banner[]>(
    () =>
      items
        .filter((i) => i.kind === "epic" && i.showOn)
        .map((e) => ({
          id: e.id,
          title: e.title,
          color: epicColor(e.id),
          day: startOfDay(new Date(e.showOn!)).getTime(),
          tasks: [...subtreeIds(e.id, tree)]
            .map((id) => tree.byId.get(id))
            .filter((t): t is WorkItem => Boolean(t) && t!.kind === "task")
            .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.order - b.order)
            .map((t) => ({ title: t.title, done: t.status === "done" })),
        })),
    [items, tree],
  );

  // zadanie ↔ wpis (links.ts): zadania dla wpisów w epikach, wspólny epik i nazwa, status „zrobione” po wpisie
  const reconcileBusy = useRef(false);
  const reconcileAgain = useRef(false);
  const minuteTick = Math.floor(now.getTime() / 60_000);
  useEffect(() => {
    if (reconcileBusy.current) {
      reconcileAgain.current = true;
      return;
    }
    reconcileBusy.current = true;
    void (async () => {
      try {
        do {
          reconcileAgain.current = false;
          if (await reconcileLinks(Date.now())) sync.requestSync(4000);
        } while (reconcileAgain.current);
      } finally {
        reconcileBusy.current = false;
      }
    })();
    // sync.requestSync jest stabilne; liczy się tylko zmiana danych i upływ czasu
  }, [items, epicEvents, linkedEvents, minuteTick]);
  const openTasks = useMemo(() => items.filter((i) => i.kind === "task" && i.status !== "done").length, [items]);
  // przypięte epiki w panelu bocznym: postęp z zadań, „śpi” / „prawie gotowy”
  const pinnedEpics = useMemo(() => {
    const t = now.getTime();
    return items
      .filter((i) => i.kind === "epic" && i.pinned)
      .sort((a, b) => a.order - b.order)
      .map((e) => {
        const p = progressOf(e.id, tree, t);
        return {
          id: e.id,
          title: e.title,
          color: epicColor(e.id),
          done: p.tasksDone,
          total: p.tasks,
          sleepy: e.status !== "done" && t - lastTouched(e.id, tree) > SLEEPY_DAYS * 86_400_000,
          remaining: (() => {
            const m = remainingEstimate(e.id, tree, t).minutes;
            return m ? formatMinutes(m) : "";
          })(),
        };
      });
    // przeliczane co minutę, nie co tyknięcie zegara („śpi” liczy się w dniach)
  }, [items, tree, Math.floor(now.getTime() / 60_000)]);
  const epicInfo = useMemo(() => {
    const m = new Map<string, EpicInfo>();
    for (const i of tree.byId.values()) {
      if (i.kind === "epic") {
        m.set(i.id, {
          title: i.title,
          path: epicPath(i.id, tree.byId),
          color: epicColor(i.id),
          ancestors: ancestorIds(i.id, tree.byId),
        });
      }
    }
    return m;
  }, [tree]);
  const epicChoices = useMemo(() => epicOptions(tree), [tree]);
  const [dayGroups, setDayGroupsState] = useState<DayGroup[]>(getDayGroups);
  const changeDayGroups = (next: DayGroup[]) => {
    setDayGroups(next);
    setDayGroupsState(getDayGroups());
  };
  const [workOpen, setWorkOpen] = useState<string | null>(null);
  const [workFields, setWorkFieldsState] = useState<WorkField[]>(getWorkFields);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const changeWorkFields = (next: WorkField[]) => {
    setWorkFields(next);
    setWorkFieldsState(next);
  };

  // zadania sprzed kluczy „PC-N” (v0.22.0) dostają numery raz, w kolejności utworzenia
  const numbering = useRef(false);
  useEffect(() => {
    const missing = items.filter((i) => !i.num).sort((a, b) => a.createdAt - b.createdAt);
    if (!missing.length || numbering.current) return;
    numbering.current = true;
    let n = nextNum(items);
    void (async () => {
      for (const i of missing) await saveItem({ ...i, num: n++ });
      numbering.current = false;
    })();
  }, [items]);
  const workItem = workOpen ? tree.byId.get(workOpen) : undefined;

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

  // kopia ustawień w Google: po udanej synchronizacji (jest token) i po każdej zmianie ustawień
  useSettingsBackup(sync.linked && sync.state === "idle", sync.notify, [
    hiddenTags,
    rules,
    pollSec,
    dockOpen,
    theme.pref,
    tagColorsVer,
    moveThreshold,
    workFields,
    prodHours,
    slotMin,
    requireEstimate,
    dayGroups,
  ]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY, t: Date.now(), mouse: e.pointerType !== "touch" };
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);

  const saveDraft = async () => {
    const saving = draft;
    if (!draft?.title.trim()) return;
    // ustawienie „wymagaj estymaty”: nowy wpis bez estymaty się nie zapisze
    if (!draft.id && requireEstimate && !draft.estimate) {
      sync.notify("Wybierz estymatę (5min / 30min / 1h / 2h+)", "warn");
      return;
    }
    const existing = draft.id ? await db.events.get(draft.id) : undefined;
    // wystąpienie serii wyjęte z epiku → cała seria wypada z epiku (inaczej zadanie serii by je przywróciło)
    if (existing?.recurring && existing.seriesId && existing.epicId && !draft.epicId) await unlinkSeries(existing.seriesId);
    // wpis z „P” przeniesiony w edycji na inny dzień → najbliższa wolna godzina w nowym dniu
    let when = { start: draft.start, end: draft.end, allDay: draft.allDay };
    if (existing?.autoSlot && draft.autoSlot && !sameDay(new Date(existing.start), new Date(draft.start))) {
      const slot = await slotOn(new Date(draft.start), { id: existing.id, ...when });
      if (slot) when = { ...slot, allDay: false };
      else noSlot(new Date(draft.start));
    }
    const step = existing ? moveStep(existing, when.start) : null;
    const event: CalEvent = {
      ...existing,
      id: existing?.id ?? newEventId(),
      title: draft.title.trim(),
      notes: draft.notes,
      start: when.start,
      end: Math.max(when.end, when.start + 15 * MINUTE),
      allDay: when.allDay,
      color: draft.color,
      epicId: draft.epicId || undefined,
      autoSlot: draft.autoSlot || undefined,
      // „?” (nie wiem) pozwala zapisać przy wymaganej estymacie, ale się nie zapisuje
      estimate: storedEstimate(draft.estimate),
      ...(step ? moveFields(step) : { moves: 0 }),
      tags: applyTagRules(
        draft.title.trim(),
        draft.notes,
        normalizeTags(draft.tags),
        existing ? { title: existing.title, notes: existing.notes } : undefined,
      ),
      origin: existing?.origin ?? "local",
      updatedAt: Date.now(),
      deleted: false,
      pending: 1,
    };
    // „zaplanuj w kalendarzu” przy zadaniu: najpierw powiązanie, żeby nie powstało drugie zadanie dla tego wpisu
    if (!existing && draft.taskId) {
      const task = await db.items.get(draft.taskId);
      if (task && !task.deleted) await saveItem({ ...task, eventId: event.id });
    }
    await saveLocal(event);
    // klik obok mógł już otworzyć inny wpis — zamykamy tylko ten, który zapisaliśmy
    setDraft((cur) => (cur === saving ? null : cur));
    if (step?.nudge) promptMoved(event);
    if (!isVisible(event.tags, hiddenTags)) sync.notify("Zapisano. Wpis jest ukryty przez filtr tagów.", "warn");
    sync.requestSync();
  };

  /** Kliknięcie myszą przed chwilą → okno przy kursorze; telefon / klawiatura → arkusz od dołu. */
  const pointerAnchor = (): Anchor | null => {
    const p = lastPointer.current;
    return isDesktop && p?.mouse && Date.now() - p.t < 1500 ? { x: p.x, y: p.y } : null;
  };

  const openDraft = (d: DraftEvent, mode: "quick" | "full" = "quick") => {
    setStuckId(null);
    setAnchor(pointerAnchor());
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

  /** N-te przeniesienie: krótka informacja i pełna edycja z kursorem w tytule („zacznij od prostego kroku”). */
  const promptMoved = (e: CalEvent) => {
    sync.notify(`„${e.title}” — ${e.moves}. przeniesienie`, "warn");
    setDayPanel(null);
    setMenu(null);
    setAnchor(null);
    setEditor("full");
    setDraft(draftFromEvent(e));
    setStuckId(e.id);
  };

  /** Kliknięcie etykiety epiku na wpisie → szczegóły epiku. */
  // stała funkcja (tylko settery) — kontekst EpicOpenContext nie zmienia się przy każdym renderze App
  const openEpicFromTag = useCallback((id: string) => {
    setMenu(null);
    setDayPanel(null);
    setWorkOpen(id);
  }, []);

  /* ── „P”: najbliższa wolna godzina w godzinach produktywności ── */

  const prodLabel = `${minutesLabel(prodHours.from)}–${minutesLabel(prodHours.to)}`;

  /** Wolne miejsce tego dnia dla wpisu (całodniowy → `slotMin` minut, z godziną → jego długość). */
  const slotOn = async (day: Date, e: Pick<CalEvent, "id" | "allDay" | "start" | "end">) => {
    const from = startOfDay(day).getTime();
    const list = await eventsInRange(from, addDays(day, 1).getTime());
    const dur = e.allDay ? slotMin * MINUTE : Math.max(e.end - e.start, 5 * MINUTE);
    const t = findFreeSlot(list, day, dur, Date.now(), prodHours, e.id);
    return t === null ? null : { start: t, end: t + dur };
  };

  /** Kliknięcie „P”: ten dzień, a gdy nie ma w nim wolnego miejsca — kolejne dni (do 2 tygodni naprzód). */
  const slotFrom = async (day: Date, e: Pick<CalEvent, "id" | "allDay" | "start" | "end">) => {
    for (let i = 0; i < 14; i++) {
      const slot = await slotOn(addDays(day, i), e);
      if (slot) return slot;
    }
    return null;
  };

  /** „jutro” / „śr, 18 listopada” — do powiadomień. */
  const dayWord = (t: number) => {
    const d = new Date(t);
    const today = new Date();
    if (sameDay(d, today)) return "dziś";
    if (sameDay(d, addDays(today, 1))) return "jutro";
    return longDateLabel(d);
  };

  const noSlot = (day: Date) =>
    sync.notify(`Brak wolnego miejsca ${sameDay(day, new Date()) ? "dziś" : longDateLabel(day)} w godzinach ${prodLabel}`, "warn");

  /** „P” na wpisie: włącz i wstaw w najbliższą wolną godzinę tego dnia; ponownie — wyłącz (godzina zostaje). */
  const planEvent = async (e: CalEvent) => {
    const cur = await db.events.get(e.id);
    if (!cur) return;
    if (cur.autoSlot) {
      await saveLocal({ ...cur, autoSlot: undefined });
      sync.requestSync(2000);
      sync.notify(`„${cur.title}”: „P” wyłączone, godzina zostaje`);
      return;
    }
    // wpis z przeszłości: szukamy od dziś (i nie wcześniej niż teraz), nie w jego dawnym dniu
    const day = new Date(Math.max(startOfDay(new Date(cur.start)).getTime(), startOfDay(new Date()).getTime()));
    // brak wolnego miejsca w godzinach produktywności tego dnia → następny dzień (i dalej)
    const slot = await slotFrom(day, cur);
    if (!slot) return noSlot(day);
    const step = moveStep(cur, slot.start);
    const next = { ...cur, allDay: false, start: slot.start, end: slot.end, autoSlot: true, ...moveFields(step) };
    await saveLocal(next);
    sync.requestSync(2000);
    const moved = !sameDay(day, new Date(slot.start));
    if (step.nudge) promptMoved(next);
    const time = `${formatClock(new Date(slot.start))}–${formatClock(new Date(slot.end))}`;
    sync.notify(
      moved
        ? `„${cur.title}” → ${dayWord(slot.start)} ${time} (${dayWord(cur.start)} brak wolnego miejsca)`
        : `„${cur.title}” → ${time}`,
      "ok",
      {
      label: "Cofnij",
      run: () =>
        void (async () => {
          await saveLocal(cur);
          sync.requestSync();
        })(),
    });
  };

  /** „P” w pełnej edycji: to samo na szkicu (zapis dopiero przyciskiem „Zapisz”). */
  const planDraft = async () => {
    const d = draft;
    if (!d) return;
    if (d.autoSlot) {
      setDraft((cur) => (cur === d ? { ...d, autoSlot: false } : cur));
      return;
    }
    const day = new Date(Math.max(startOfDay(new Date(d.start)).getTime(), startOfDay(new Date()).getTime()));
    const slot = await slotFrom(day, { id: d.id ?? "", allDay: d.allDay, start: d.start, end: d.end });
    if (!slot) return noSlot(day);
    if (!sameDay(day, new Date(slot.start))) {
      sync.notify(`${dayWord(d.start)} brak wolnego miejsca — przeniesione na ${dayWord(slot.start)}`);
    }
    setDraft((cur) => (cur === d ? { ...d, allDay: false, start: slot.start, end: slot.end, autoSlot: true } : cur));
  };

  /**
   * Przeniesienie wpisu (przeciągnięcie w mapie i w miesiącu). Wpis z „P” przeniesiony na inny dzień dostaje
   * najbliższą wolną godzinę w nowym dniu — także gdy upuszczono go na konkretną godzinę.
   */
  const moveEvent = async (e: CalEvent, start: number, end: number) => {
    const current = await db.events.get(e.id);
    if (!current) return;
    const step = moveStep(current, start);
    let next = { ...current, start, end, ...moveFields(step) };
    if (current.autoSlot && !sameDay(new Date(current.start), new Date(start))) {
      const slot = await slotOn(new Date(start), current);
      if (slot) next = { ...next, allDay: false, start: slot.start, end: slot.end };
      else noSlot(new Date(start));
    }
    await saveLocal(next);
    if (step.nudge) promptMoved(next);
    sync.requestSync();
  };

  /** Przesuń wpisy o `days` dni (godzina zostaje). Toast z „Cofnij" przywraca poprzednie terminy. */
  const shiftEvents = async (list: CalEvent[], days: number) => {
    const before = (await db.events.bulkGet(list.map((e) => e.id))).filter((e): e is CalEvent => Boolean(e));
    if (!before.length) return;
    let prompt: CalEvent | null = null;
    for (const e of before) {
      const start = addDays(new Date(e.start), days).getTime();
      // podpowiedź tylko dla pierwszego wpisu, który ją „wybił”; pozostałe dostaną ją przy następnym przeniesieniu
      const step = moveStep(e, start);
      const nudge: boolean = step.nudge && !prompt;
      let next: CalEvent = { ...e, start, end: addDays(new Date(e.end), days).getTime(), ...moveFields({ ...step, nudge }) };
      if (e.autoSlot) {
        const slot = await slotOn(new Date(start), e);
        if (slot) next = { ...next, allDay: false, start: slot.start, end: slot.end };
        else noSlot(new Date(start));
      }
      await saveLocal(next);
      if (nudge) prompt = next;
    }
    if (prompt) promptMoved(prompt);
    sync.requestSync(4000);
    const n = before.length;
    const what = n === 1 ? `„${before[0].title}”` : `${n} ${n < 5 ? "wpisy" : "wpisów"}`;
    sync.notify(`Przeniesiono ${what} ${days === 1 ? "na następny dzień" : `o ${days === 7 ? "tydzień" : `${days} dni`}`}`, "ok", {
      label: "Cofnij",
      run: () =>
        void (async () => {
          for (const e of before) await saveLocal(e);
          sync.requestSync();
        })(),
    });
  };

  /**
   * Usuń bez pytania, z „Cofnij" w powiadomieniu. Synchronizacja po usunięciu czeka chwilę, żeby cofnięcie
   * zwykle zdążyło przed wysłaniem DELETE do Google; jeśli nie zdążyło — wpis wraca jako nowy.
   */
  const deleteEvent = async (id: string) => {
    const before = await db.events.get(id);
    if (!before) return;
    peekProjectOf(before.epicId);
    await removeLocal(id);
    recordWin({ kind: "delete", source: "event" });
    sync.requestSync(8000);
    sync.notify(`Usunięto „${before.title}”`, "ok", {
      label: "Cofnij",
      run: () =>
        void (async () => {
          const still = await db.events.get(id);
          if (still || !before.googleEventId) {
            await db.events.put(before);
          } else {
            // usunięcie już doszło do Google → tworzymy wpis od nowa
            const { googleEventId: _g, googleEtag: _e, ...rest } = before;
            void _g;
            void _e;
            await saveLocal({ ...rest, id: newEventId(), origin: "local" });
          }
          sync.requestSync();
        })(),
    });
  };

  const removeDraft = async () => {
    if (!draft?.id) return;
    const id = draft.id;
    setDraft(null);
    await deleteEvent(id);
  };

  const patchEvent = async (id: string, patch: Partial<CalEvent>) => {
    const cur = await db.events.get(id);
    if (!cur) return;
    if ("epicId" in patch && !patch.epicId && cur.recurring && cur.seriesId && cur.epicId) await unlinkSeries(cur.seriesId);
    await saveLocal({ ...cur, ...patch, tags: normalizeTags(patch.tags ?? cur.tags ?? []) });
    sync.requestSync(2000);
  };

  const changeRules = (next: TagRule[]) => {
    setRules(next);
    setTagRules(next);
  };

  /** Reguły dla wpisów od dziś w przód (tylko dodają tagi), z „Cofnij”. Przeszłość zostaje nietknięta. */
  const applyRulesToAll = async () => {
    const from = startOfDay(new Date()).getTime();
    const all = await db.events.where("end").aboveOrEqual(from).filter((e) => !e.deleted).toArray();
    const before: CalEvent[] = [];
    for (const e of all) {
      const tags = applyTagRules(e.title, e.notes, e.tags ?? [], undefined, rules);
      if (tags.length !== (e.tags ?? []).length) {
        before.push(e);
        // wystąpienie serii z Google: tylko lokalnie (zapis w Google odłączyłby je od serii)
        if (e.recurring) await db.events.put({ ...e, tags });
        else await saveLocal({ ...e, tags });
      }
    }
    sync.requestSync(4000);
    sync.notify(
      before.length
        ? `Dodano tagi w ${before.length} ${before.length === 1 ? "wpisie" : "wpisach"} (od dziś)`
        : `Sprawdzono ${all.length} ${all.length === 1 ? "wpis" : [2, 3, 4].includes(all.length % 10) && ![12, 13, 14].includes(all.length % 100) ? "wpisy" : "wpisów"} od dziś — żadna reguła nie dodała nowego tagu`,
      "ok",
      before.length
        ? {
            label: "Cofnij",
            run: () =>
              void (async () => {
                for (const e of before) await (e.recurring ? db.events.put(e) : saveLocal(e));
                sync.requestSync();
              })(),
          }
        : undefined,
    );
  };

  /* ── zadania i epiki: akcje ── */

  /** Nowe zadanie/epik (z kolejnym numerem PC-N); `patch` = np. status kolumny tablicy. Zwraca ID. */
  // ostatnio nadany numer — dwa szybkie „Enter” nie mogą dostać tego samego klucza, zanim baza się odświeży
  const lastNum = useRef(0);
  const createItem = (kind: WorkKind, title: string, parentId: string, patch: Partial<WorkItem> = {}): string => {
    const num = Math.max(nextNum(tree.byId.values()), lastNum.current + 1);
    lastNum.current = num;
    const item = { ...newItem(kind, title, parentId, num), ...patch };
    if (!item.title) return "";
    void saveItem(item);
    sync.requestSync(3000);
    return item.id;
  };

  /** Z poziomu wpisu w kalendarzu: nowy epik na najwyższym poziomie. */
  const createEpicNamed = (name: string) => createItem("epic", name, "");

  /* ── podgląd projektu po zamknięciu zadania z epiku w projekcie ── */
  const [peek, setPeek] = useState<PeekState | null>(null);
  const peekSeq = useRef(0);
  /** Wołane PRZED zapisem zmiany: `from` = postęp sprzed zamknięcia, potem podgląd pokazuje postęp na żywo. */
  const peekProjectOf = (epicId: string | undefined) => {
    if (!epicId || view === "projects") return;
    const p = projectsForEpic(epicId, projects, tree.byId)[0];
    if (!p) return;
    // po przeciwnej stronie niż przegląd dnia (otwarty przy klikniętym dniu)
    const at = dayPanel?.from;
    const side = at && at.x + at.w / 2 > window.innerWidth / 2 ? "left" : "right";
    peekSeq.current += 1;
    setPeek({ id: peekSeq.current, projectId: p.id, from: projectProgress(p, tree, Date.now()), side });
  };
  const peekProject = peek ? projects.find((p) => p.id === peek.projectId) : undefined;

  // szybkie zmiany z listy / tablicy po kolei, każda od aktualnego stanu w bazie
  const patchChain = useRef(Promise.resolve());
  const patchItem = (id: string, patch: Partial<WorkItem>) => {
    patchChain.current = patchChain.current.then(async () => {
      const cur = await db.items.get(id);
      // status zmieniony ręcznie (lista, tablica) — już nie zmienia się sam po zakończeniu wpisu
      const manual = patch.status !== undefined && patch.status !== cur?.status ? { statusManual: true } : {};
      if (cur && !cur.deleted) {
        const closing = patch.status === "done" && cur.status !== "done";
        if (closing) peekProjectOf(cur.kind === "epic" ? cur.id : cur.parentId);
        await saveItem({ ...cur, ...patch, ...manual });
        if (closing) recordWin({ kind: "done", source: cur.kind === "epic" ? "epic" : "task" });
      }
    });
    sync.requestSync(3000);
  };

  const saveWork = (item: WorkItem) => {
    const prev = tree.byId.get(item.id);
    if (item.status === "done" && prev && prev.status !== "done") {
      peekProjectOf(item.kind === "epic" ? item.id : item.parentId);
      recordWin({ kind: "done", source: item.kind === "epic" ? "epic" : "task" });
    }
    void saveItem(item);
    sync.requestSync(2000);
  };

  /** Usuń zadanie/epik: zawartość epiku idzie piętro wyżej, wpisy z kalendarza tracą epik. Z „Cofnij”. */
  const deleteWork = async (item: WorkItem) => {
    setWorkOpen(null);
    const children = tree.children.get(item.id) ?? [];
    // wpisy zadania zostają w kalendarzu, tylko bez epiku (zadanie z epiku → wpis bez epiku)
    const evs = (tree.events.get(item.id) ?? []).filter((e) => e.epicId);
    const saveEv = (e: CalEvent) => (e.recurring ? db.events.put(e) : saveLocal(e));
    // jedna transakcja: links.ts nie zobaczy wpisu z epikiem bez zadania (odtworzyłby je)
    await db.transaction("rw", db.items, db.events, async () => {
      for (const c of children) await saveItem({ ...c, parentId: item.parentId });
      for (const e of evs) await saveEv({ ...e, epicId: undefined });
      if (item.remote) await saveItem({ ...item, deleted: true });
      else await db.items.delete(item.id);
    });
    recordWin({ kind: "delete", source: item.kind === "epic" ? "epic" : "task" });
    sync.requestSync(4000);
    sync.notify(`Usunięto ${item.kind === "epic" ? "epik" : "zadanie"} „${item.title}”`, "ok", {
      label: "Cofnij",
      run: () =>
        void (async () => {
          await db.transaction("rw", db.items, db.events, async () => {
            await saveItem({ ...item, deleted: false });
            for (const c of children) await saveItem(c);
            for (const e of evs) await saveEv(e);
          });
          sync.requestSync();
        })(),
    });
  };

  /** Z epiku: nowy wpis w kalendarzu od razu przypięty do epiku. */
  const planInEpic = (epicId: string) => {
    setWorkOpen(null);
    openDraft({ ...timedDraft(nextQuarter().getTime(), newColor), epicId }, editorMode);
  };

  /* ── przytrzymanie „zaplanuj”: zadanie przeciągane na dzień w kalendarzu ── */

  // mode „plan” = zadanie → nowy wpis; „show” = przypięty epik → baner epiku na kalendarzu (showOn)
  const [planDrag, setPlanDrag] = useState<{
    task: WorkItem;
    x: number;
    y: number;
    label: string;
    mode: "plan" | "show";
  } | null>(null);
  const planDragRef = useRef(planDrag);
  planDragRef.current = planDrag;
  const planDragFrom = useRef<ViewMode>("tasks");

  const startPlanDrag = (task: WorkItem, x: number, y: number, mode: "plan" | "show" = "plan") => {
    planDragFrom.current = view;
    if (view === "tasks") setView(lastCalView.current);
    if (mode === "show") closeDrawer();
    setPlanDrag({ task, x, y, label: "", mode });
  };

  /** Przypięty epik z panelu bocznego albo jego baner w kalendarzu → przeciąganie na dzień. */
  const dragEpic = (id: string, x: number, y: number) => {
    const epic = tree.byId.get(id);
    if (epic) startPlanDrag(epic, x, y, "show");
  };

  /** Epik upuszczony na dzień: baner epiku na kalendarzu (z „Cofnij”). */
  const showEpicOn = (epic: WorkItem, day: Date) => {
    const prev = epic.showOn ?? null;
    patchItem(epic.id, { showOn: startOfDay(day).getTime() });
    sync.notify(`„${epic.title}” na kalendarzu: ${longDateLabel(day)}`, "ok", {
      label: "Cofnij",
      run: () => patchItem(epic.id, { showOn: prev }),
    });
  };

  /** Dzień pod punktem: kolumna godzin w mapie (z godziną, co 15 min) albo dzień w miesiącu / pasmo całodniowe. */
  const planTargetAt = (x: number, y: number): { el: HTMLElement; day: Date; minutes: number | null } | null => {
    for (const node of document.elementsFromPoint(x, y)) {
      const el = node as HTMLElement;
      const iso = el.dataset?.day;
      if (!iso) continue;
      const day = fromIsoDate(iso);
      if (el.classList.contains("hours")) {
        const r = el.getBoundingClientRect();
        const min = Math.floor(((y - r.top) / (r.height / 24)) * 4) * 15;
        return { el, day, minutes: Math.min(23 * 60 + 45, Math.max(0, min)) };
      }
      return { el, day, minutes: null };
    }
    return null;
  };

  useEffect(() => {
    if (!planDrag) return;
    document.body.classList.add("plan-dragging");
    let raf = 0;
    let over: HTMLElement | null = null;
    const mark = (el: HTMLElement | null) => {
      if (over === el) return;
      over?.classList.remove("plan-over");
      el?.classList.add("plan-over");
      over = el;
    };
    const move = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = planTargetAt(x, y);
        mark(t?.el ?? null);
        const show = planDragRef.current?.mode === "show";
        const label = t
          ? `${longDateLabel(t.day)}${t.minutes === null || show ? (show ? "" : " · cały dzień") : `, ${formatClock(atMinutes(t.day, t.minutes))}`}`
          : "";
        setPlanDrag((p) => p && { ...p, x, y, label });
      });
    };
    const finish = (e: PointerEvent | null) => {
      const task = planDragRef.current?.task;
      const mode = planDragRef.current?.mode;
      const t = e ? planTargetAt(e.clientX, e.clientY) : null;
      mark(null);
      setPlanDrag(null);
      if (!task) return;
      if (!t) {
        // upuszczone obok kalendarza — wracamy tam, skąd zaczęło się przeciąganie
        if (planDragFrom.current === "tasks") setView("tasks");
        return;
      }
      if (mode === "show") {
        showEpicOn(task, t.day);
        return;
      }
      setWorkOpen(null);
      const base =
        t.minutes === null ? allDayDraft(t.day, newColor) : timedDraft(atMinutes(t.day, t.minutes).getTime(), newColor);
      setStuckId(null);
      setAnchor(isDesktop && e ? { x: e.clientX, y: e.clientY } : null);
      setEditor(editorMode);
      setDraft({ ...base, title: task.title, epicId: task.parentId || undefined, taskId: task.id });
    };
    const up = (e: PointerEvent) => finish(e);
    const cancel = () => finish(null);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      over?.classList.remove("plan-over");
      document.body.classList.remove("plan-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
    };
    // tylko początek / koniec przeciągania; pozycję aktualizuje sam efekt
  }, [planDrag !== null]);

  /** „Zaplanuj w kalendarzu” przy zadaniu: nowy wpis z nazwą zadania, w jego epiku, powiązany z zadaniem. */
  const planTask = (task: WorkItem) => {
    setWorkOpen(null);
    openDraft(
      { ...timedDraft(nextQuarter().getTime(), newColor), title: task.title, epicId: task.parentId || undefined, taskId: task.id },
      editorMode,
    );
  };

  const openEventFromWork = (e: CalEvent) => {
    setWorkOpen(null);
    openDraft(draftFromEvent(e), editorMode);
  };

  /**
   * Zmiana nazwy tagu we wszystkich wpisach (też w przeszłości; wszystkie warianty wielkości liter).
   * Nazwa już istniejącego tagu = scalenie. Przenosi też filtr, kolor i reguły. Z „Cofnij”.
   */
  const renameTag = async (from: string, to: string) => {
    const name = normalizeTag(to);
    if (!name || name === from) return;
    const fromKey = tagKey(from);
    const toKey = tagKey(name);
    const affected = await db.events
      .filter((e) => !e.deleted && (e.tags ?? []).some((t) => tagKey(t) === fromKey))
      .toArray();
    const prevRules = rules;
    const prevHidden = hiddenTags;
    const prevColors = { ...getTagColors() };
    const prevPaint = getPaintTags();

    const save = (e: CalEvent) =>
      // wystąpienie serii z Google: tylko lokalnie (zapis w Google odłączyłby je od serii)
      e.recurring ? db.events.put(e) : saveLocal(e);
    for (const e of affected) {
      const tags = normalizeTags(e.tags.map((t) => (tagKey(t) === fromKey || tagKey(t) === toKey ? name : t)));
      await save({ ...e, tags });
    }
    if (fromKey !== toKey) {
      if (hiddenTags.has(fromKey)) {
        setHiddenTags((prev) => {
          const next = new Set(prev);
          next.delete(fromKey);
          next.add(toKey);
          return next;
        });
      }
      if (prevPaint.includes(fromKey)) replacePaintTags([...prevPaint.filter((k) => k !== fromKey && k !== toKey), toKey]);
      const color = prevColors[fromKey];
      if (color && !prevColors[toKey]) setTagColor(name, color);
      if (color) setTagColor(from, null);
    }
    if (rules.some((r) => tagKey(r.tag) === fromKey)) {
      changeRules(rules.map((r) => (tagKey(r.tag) === fromKey ? { ...r, tag: name } : r)));
    }
    setTagColorsVer((v) => v + 1);
    sync.requestSync(4000);
    sync.notify(
      `„${from}” → „${name}” w ${affected.length} ${affected.length === 1 ? "wpisie" : "wpisach"}`,
      "ok",
      {
        label: "Cofnij",
        run: () =>
          void (async () => {
            for (const e of affected) await save(e);
            changeRules(prevRules);
            setHiddenTags(prevHidden);
            replaceTagColors(prevColors);
            replacePaintTags(prevPaint);
            setTagColorsVer((v) => v + 1);
            sync.requestSync();
          })(),
      },
    );
  };

  /**
   * Usunięcie tagu ze wszystkich wpisów (też w przeszłości). Znika też jego filtr, kolor, „koloruj” i reguły,
   * które go dodają (inaczej wróciłby przy następnym zapisie). Z „Cofnij”.
   */
  const deleteTag = async (tag: string) => {
    const key = tagKey(tag);
    const affected = await db.events.filter((e) => !e.deleted && (e.tags ?? []).some((t) => tagKey(t) === key)).toArray();
    const prevRules = rules;
    const prevHidden = hiddenTags;
    const prevColors = { ...getTagColors() };
    const prevPaint = getPaintTags();
    // wystąpienie serii z Google: tylko lokalnie (zapis w Google odłączyłby je od serii)
    const save = (e: CalEvent) => (e.recurring ? db.events.put(e) : saveLocal(e));
    for (const e of affected) await save({ ...e, tags: e.tags.filter((t) => tagKey(t) !== key) });
    if (hiddenTags.has(key)) {
      setHiddenTags((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
    if (prevPaint.includes(key)) replacePaintTags(prevPaint.filter((k) => k !== key));
    if (prevColors[key]) setTagColor(tag, null);
    const dropped = rules.filter((r) => tagKey(r.tag) === key).length;
    if (dropped) changeRules(rules.filter((r) => tagKey(r.tag) !== key));
    setTagColorsVer((v) => v + 1);
    sync.requestSync(4000);
    const n = affected.length;
    sync.notify(
      `Usunięto tag „${tag}” z ${n} ${n === 1 ? "wpisu" : "wpisów"}${dropped ? ` i ${dropped} ${dropped === 1 ? "regułę" : "reguły"}` : ""}`,
      "ok",
      {
        label: "Cofnij",
        run: () =>
          void (async () => {
            for (const e of affected) await save(e);
            changeRules(prevRules);
            setHiddenTags(prevHidden);
            replaceTagColors(prevColors);
            replacePaintTags(prevPaint);
            setTagColorsVer((v) => v + 1);
            sync.requestSync();
          })(),
      },
    );
  };

  const eventActions = {
    onDelete: isDesktop ? (e: CalEvent) => void deleteEvent(e.id) : undefined,
    onContext: isDesktop ? (e: CalEvent, pt: Anchor) => setMenu({ e, anchor: pt }) : undefined,
    onPlan: isDesktop ? (e: CalEvent) => void planEvent(e) : undefined,
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
    // z widoku zadań „dziś” wraca do kalendarza
    if (view === "tasks" || view === "projects") setView(lastCalView.current);
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
  const sheetOpen =
    Boolean(draft) || settingsOpen || searchOpen || rulesOpen || Boolean(dayPanel) || Boolean(menu) || Boolean(workOpen) || fieldsOpen || prefsOpen;
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

  const showTwoWeeks = () => {
    const start = startOfWeek(focus);
    setWeekSel({ start, weeks: 2 });
    setView("month");
    navigate(start);
  };

  /** mapa / miesiąc / 2 tyg. zawsze widoczne; inny wybrany zakres tygodni jako osobny, dodatkowy przycisk. */
  const viewChips = (after?: () => void) => (
    <>
      <ViewChip
        label="mapa"
        pressed={view === "map"}
        isDefault={defaultView === "map"}
        onSetDefault={() => setDefaultView("map")}
        onClick={() => {
          setView("map");
          after?.();
        }}
      />
      <ViewChip
        label="miesiąc"
        pressed={view === "month" && !weekSel}
        isDefault={defaultView === "month"}
        onSetDefault={() => setDefaultView("month")}
        onClick={() => {
          if (weekSel) clearWeekSel();
          setView("month");
          after?.();
        }}
      />
      <ViewChip
        label="2 tyg."
        title="Dwa tygodnie od tygodnia z wybranym dniem"
        pressed={view === "month" && weekSel?.weeks === 2}
        isDefault={defaultView === "2w"}
        onSetDefault={() => setDefaultView("2w")}
        onClick={() => {
          showTwoWeeks();
          after?.();
        }}
      />
      {weekSel && weekSel.weeks !== 2 && (
        <button
          className="chip"
          aria-pressed={view === "month"}
          title="Siatka wybranych tygodni"
          onClick={() => {
            setView("month");
            after?.();
          }}
        >
          {weekSel.weeks} tyg.
        </button>
      )}
    </>
  );

  // przyciski widoków w panelu bocznym: ten sam element, dopóki nie zmieni się nic, od czego zależą
  // (navigate/closeDrawer/setDefaultView to same settery) — panel boczny nie przelicza się przy każdym kliknięciu
  const sideViewSwitch = useMemo(
    () => viewChips(closeDrawer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, weekSel, defaultView, focus],
  );

  const periodLabel = weekSel
    ? rangeLabel(weekSel.start, addDays(weekSel.start, weekSel.weeks * 7 - 1))
    : monthLabel(focus);

  /* ── tagi ── */

  const visibleEvents = useMemo(() => events.filter((e) => isVisible(e.tags, hiddenTags)), [events, hiddenTags]);
  // zapisany wpis otwarty w edycji (licznik przeniesień, „bez podpowiedzi”)
  const draftEvent = draft?.id ? events.find((e) => e.id === draft.id) : undefined;
  const shownEvents = useMemo(() => withDraft(visibleEvents, draft), [visibleEvents, draft]);

  const toggleTag = (tag: string) =>
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  const soloTag = (tag: string) =>
    setHiddenTags(new Set([...tagList.map((t) => t.key), UNTAGGED].filter((t) => t !== tag)));

  const newColor = PALETTE[0].value;

  /* ── szukaj / szybkie dodawanie ── */

  const openFromSearch = (e: CalEvent) => {
    setSearchOpen(false);
    goToDay(new Date(e.start));
    openDraft(draftFromEvent(e), editorMode);
  };

  const createFromSearch = async (p: ParsedEntry) => {
    setSearchOpen(false);
    // „wymagaj estymaty”: zamiast zapisu od razu — karta wpisu z wypełnionymi polami, do wybrania estymaty
    if (requireEstimate) {
      goToDay(new Date(p.start));
      openDraft(
        { title: p.title, notes: "", start: p.start, end: p.end, allDay: p.allDay, color: PALETTE[4].value, tags: p.tags },
        "quick",
      );
      return;
    }
    const event: CalEvent = {
      id: newEventId(),
      title: p.title,
      notes: "",
      start: p.start,
      end: p.end,
      allDay: p.allDay,
      color: PALETTE[4].value,
      tags: applyTagRules(p.title, "", p.tags),
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
    <EpicContext.Provider value={epicInfo}>
    <EpicOpenContext.Provider value={openEpicFromTag}>
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
          <span className="period" hidden={view === "tasks" || view === "projects"}>
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
          {isDesktop && viewChips()}
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
          viewSwitch={sideViewSwitch}
          view={view}
          onView={(v) => {
            setView(v === "calendar" ? lastCalView.current : v);
            closeDrawer();
          }}
          openTasks={openTasks}
          pinned={pinnedEpics}
          onOpenEpic={(id) => {
            closeDrawer();
            setWorkOpen(id);
          }}
          onDragEpic={dragEpic}
          onOpenPrefs={() => {
            closeDrawer();
            setPrefsOpen(true);
          }}
          tags={tagList}
          hidden={hiddenTags}
          onToggleTag={toggleTag}
          onSoloTag={soloTag}
          onShowAll={() => setHiddenTags(new Set())}
          theme={theme.pref}
          onTheme={theme.setPref}
          onTagColor={(tag, color) => {
            setTagColor(tag, color);
            setTagColorsVer((v) => v + 1);
          }}
          onOpenRules={() => {
            closeDrawer();
            setRulesOpen(true);
          }}
          onApplyRules={() => void applyRulesToAll()}
          onRenameTag={(from, to) => void renameTag(from, to)}
          onDeleteTag={(tag) => void deleteTag(tag)}
          onPaintTag={(tag, on) => {
            setPainted(tag, on);
            setTagColorsVer((v) => v + 1);
          }}
        />

        <main className="map-shell">
          {/* widok zadań zostaje w DOM (ukryty) podczas przeciągania z niego — dotyk nie gubi wtedy palca */}
          {(view === "tasks" || planDrag) && (
            <div className="tasks-host" style={{ display: view === "tasks" ? "contents" : "none" }}>
              <TasksView
                tree={tree}
                now={now.getTime()}
                onOpen={(i) => setWorkOpen(i.id)}
                onCreate={createItem}
                onPatch={(i, p) => patchItem(i.id, p)}
                onOpenEvent={openEventFromWork}
                onPlanTask={planTask}
                onPlanHold={startPlanDrag}
                onEditFields={() => setFieldsOpen(true)}
              />
            </div>
          )}
          {view === "projects" && (
            <ProjectsView
              projects={projects}
              tree={tree}
              now={now.getTime()}
              onOpenEpic={(id) => setWorkOpen(id)}
              onCreateEpic={createEpicNamed}
              onChanged={() => sync.requestSync(3000)}
              notify={sync.notify}
            />
          )}
          {view === "tasks" || view === "projects" ? null : view === "map" ? (
            <CalendarMap
              now={now}
              days={mapDays}
              focusDay={focus}
              events={shownEvents}
              scrollToNowToken={scrollToNow}
              onEdge={weekSel ? undefined : (dir) => setMapStart((s) => addDays(s, dir * MAP_SHIFT))}
              onVisibleDay={weekSel ? undefined : (d) => setFocus((f) => (sameDay(f, d) ? f : startOfDay(d)))}
              onStep={weekSel ? step : undefined}
              {...eventActions}
              banners={epicBanners}
              onOpenEpic={openEpicFromTag}
              onDragEpic={dragEpic}
              onSlot={(start) => openDraft(timedDraft(start.getTime(), newColor))}
              onAllDaySlot={(day) => openDraft(allDayDraft(day, newColor))}
              onEvent={(e) => openDraft(draftFromEvent(e), editorMode)}
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
              onDayDetails={(d) => {
                const rect = (el: Element | null): Rect | null => {
                  const r = el?.getBoundingClientRect();
                  return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
                };
                setDayPanel({
                  day: startOfDay(d),
                  from: rect(document.querySelector(`.m-day[data-day="${isoDate(d)}"]`)),
                  area: rect(document.querySelector(".m-weeks")),
                });
              }}
              onAdd={(d) => openDraft(allDayDraft(d, newColor))}
              onEvent={(e) => openDraft(draftFromEvent(e), editorMode)}
              onMove={(e, start, end) => void moveEvent(e, start, end)}
              onStep={step}
              {...eventActions}
              banners={epicBanners}
              onOpenEpic={openEpicFromTag}
              onDragEpic={dragEpic}
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
      <Cheers />
      <AnimatePresence>
        {peek && peekProject && (
          <ProjectPeek
            key={peek.id}
            peek={peek}
            project={peekProject}
            progress={projectProgress(peekProject, tree, now.getTime())}
            onOpen={() => {
              setActiveProject(peekProject.id);
              setPeek(null);
              setDayPanel(null);
              setWorkOpen(null);
              setView("projects");
            }}
            onClose={() => setPeek(null)}
          />
        )}
      </AnimatePresence>

      {planDrag && (
        <div className="plan-ghost" style={{ transform: `translate(${planDrag.x + 14}px, ${planDrag.y + 12}px)` }} aria-hidden>
          <b>
            {planDrag.mode === "show" ? "◆ " : "◷ "}
            {planDrag.task.title || "(bez nazwy)"}
          </b>
          <span>{planDrag.label || "upuść na dzień w kalendarzu · Esc anuluje"}</span>
        </div>
      )}

      <AnimatePresence>
        {draft && editor === "quick" && (
          <QuickCard
            key="quick"
            draft={draft}
            knownTags={knownTags}
            anchor={anchor}
            moves={draftEvent?.moves}
            nudgeOff={draftEvent?.nudgeOff}
            onNudgeOff={draftEvent ? (off) => void patchEvent(draftEvent.id, { nudgeOff: off || undefined }) : undefined}
            epics={epicChoices}
            onCreateEpic={createEpicNamed}
            requireEstimate={requireEstimate}
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
            moves={draftEvent?.moves}
            nudgeOff={draftEvent?.nudgeOff}
            onNudgeOff={draftEvent ? (off) => void patchEvent(draftEvent.id, { nudgeOff: off || undefined }) : undefined}
            epics={epicChoices}
            onCreateEpic={createEpicNamed}
            requireEstimate={requireEstimate}
            stuck={stuckId === draft.id}
            onPlan={() => void planDraft()}
            prodLabel={prodLabel}
            onChange={setDraft}
            onClose={() => setDraft(null)}
            onDismiss={dismissDraft}
            onSave={() => void saveDraft()}
            onDelete={draft.id ? () => void removeDraft() : undefined}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dayPanel && !draft && (
          <DayPanel
            // osobny klucz na dzień: inny dzień otwarty w trakcie zamykania = nowy panel (bez „zamrożonej” wysokości)
            key={`day:${dayPanel.day.getTime()}`}
            day={dayPanel.day}
            from={dayPanel.from}
            area={dayPanel.area}
            events={visibleEvents.filter(
              (e) => e.start < addDays(dayPanel.day, 1).getTime() && e.end > dayPanel.day.getTime(),
            )}
            onClose={() => setDayPanel(null)}
            onOpen={(e) => openDraft(draftFromEvent(e), editorMode)}
            onShift={(list, days) => void shiftEvents(list, days)}
            onDelete={(e) => void deleteEvent(e.id)}
            onContext={eventActions.onContext}
            onPlan={(e) => void planEvent(e)}
            groups={dayGroups}
            onGroups={changeDayGroups}
            knownTags={knownTags}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menu && (
          <EventMenu
            key={`menu-${menu.e.id}`}
            event={menu.e}
            anchor={menu.anchor}
            knownTags={knownTags}
            epics={epicChoices}
            onCreateEpic={createEpicNamed}
            onClose={() => setMenu(null)}
            onPatch={(p) => void patchEvent(menu.e.id, p)}
            onDelete={() => {
              setMenu(null);
              void deleteEvent(menu.e.id);
            }}
            onEdit={() => {
              const e = menu.e;
              setMenu(null);
              setStuckId(null);
              setAnchor(menu.anchor);
              setEditor("full");
              setDraft(draftFromEvent(e));
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {workItem && !draft && (
          <WorkItemSheet
            key={`work-${workItem.id}`}
            item={workItem}
            tree={tree}
            now={now.getTime()}
            onSave={saveWork}
            onDelete={(i) => void deleteWork(i)}
            onClose={() => setWorkOpen(null)}
            onOpenItem={(i) => setWorkOpen(i.id)}
            onOpenEvent={openEventFromWork}
            onPlan={planInEpic}
            onPlanTask={planTask}
            onPlanHold={startPlanDrag}
            fields={workFields}
            onCreate={createItem}
            onEditFields={() => setFieldsOpen(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fieldsOpen && (
          <WorkFieldsSheet key="fields" fields={workFields} onChange={changeWorkFields} onClose={() => setFieldsOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {prefsOpen && (
          <PrefsSheet
            key="prefs"
            moveThreshold={moveThreshold}
            onMoveThreshold={(v) => {
              setMoveThreshold(v);
              setMoveThresholdState(v);
            }}
            hours={prodHours}
            onHours={(h) => {
              setProdHours(h);
              setProdHoursState(h);
            }}
            slotMin={slotMin}
            onSlotMin={(n) => {
              setSlotMin(n);
              setSlotMinState(n);
            }}
            alwaysFull={alwaysFull}
            onAlwaysFull={(on) => {
              setAlwaysFull(on);
              setAlwaysFullState(on);
            }}
            requireEstimate={requireEstimate}
            onRequireEstimate={(on) => {
              setRequireEstimate(on);
              setRequireEstimateState(on);
            }}
            animMode={animMode}
            onAnimMode={(m) => {
              setAnimMode(m);
              setAnimModeState(m);
            }}
            isDesktop={isDesktop}
            onOpenSync={() => {
              setPrefsOpen(false);
              setSettingsOpen(true);
            }}
            onClose={() => setPrefsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rulesOpen && (
          <TagRulesSheet
            key="rules"
            rules={rules}
            knownTags={knownTags}
            onChange={changeRules}
            onApplyAll={() => void applyRulesToAll()}
            onClose={() => setRulesOpen(false)}
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
    </EpicOpenContext.Provider>
    </EpicContext.Provider>
  );
}

/** Przycisk widoku z gwiazdką „ustaw jako domyślny” (pokazuje się po najechaniu). */
function ViewChip(p: {
  label: string;
  title?: string;
  pressed: boolean;
  isDefault: boolean;
  onClick: () => void;
  onSetDefault: () => void;
}) {
  return (
    <span className={`chip-wrap${p.isDefault ? " is-default" : ""}`}>
      <button className="chip" aria-pressed={p.pressed} title={p.title} onClick={p.onClick}>
        {p.label}
      </button>
      <button
        type="button"
        className="chip-default"
        aria-pressed={p.isDefault}
        aria-label={p.isDefault ? `${p.label} — widok domyślny` : `Ustaw „${p.label}” jako widok domyślny`}
        title={p.isDefault ? "Widok domyślny (po otwarciu aplikacji)" : "Ustaw jako widok domyślny (po otwarciu aplikacji)"}
        onClick={p.onSetDefault}
      >
        {p.isDefault ? "★" : "☆"}
      </button>
    </span>
  );
}
