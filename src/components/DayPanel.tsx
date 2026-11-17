import { Reorder, motion, useDragControls, useReducedMotion } from "framer-motion";
import { useContext, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { EpicContext, EpicTag, type EpicInfo } from "./EpicTag";
import { EstSuffix } from "./EstimatePicker";
import { PALETTE } from "../colors";
import { dayInstant, tr, trDay } from "../motionPrefs";
import { whenLabel } from "../draft";
import {
  QUICK_GROUP,
  QUICK_MIN,
  REST_GROUP,
  epicGroup,
  groupOf,
  reorderVisible,
  tagGroup,
  type DayGroup,
} from "../dayGroups";
import type { CalEvent } from "../types";
import { formatClock, longDateLabel, sameDay } from "../time";
import { LOW_PRIORITY_TAG, isLowPriority, shownColor, tagColor } from "../tags";

/** Tagi wyróżnione (pogrubione) w przeglądzie dnia. */
export const URGENT_TAGS = ["pilne", "ważne"];

export function isUrgent(e: CalEvent): boolean {
  return (e.tags ?? []).some((t) => URGENT_TAGS.includes(t.toLocaleLowerCase("pl")));
}

/** „1 wpis”, „3 wpisy”, „5 wpisów”, „22 wpisy”. */
function entries(n: number): string {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20);
  return `${n} wpis${n === 1 ? "" : few ? "y" : "ów"}`;
}

/** Najpierw wpisy z godziną (po kolei w czasie), potem całodniowe (alfabetycznie). */
export function dayOrder(a: CalEvent, b: CalEvent): number {
  const ab = a.allDay || !sameDay(new Date(a.start), new Date(Math.max(a.start, a.end - 1)));
  const bb = b.allDay || !sameDay(new Date(b.start), new Date(Math.max(b.start, b.end - 1)));
  // wpisy z godziną po kolei w czasie, całodniowe alfabetycznie
  return (
    Number(ab) - Number(bb) ||
    (ab ? 0 : a.start - b.start) ||
    (a.title || "").localeCompare(b.title || "", "pl", { sensitivity: "base" })
  );
}

/** Prostokąt na ekranie (px). */
export type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  day: Date;
  /** Wpisy tego dnia (widoczne przy obecnym filtrze tagów). */
  events: CalEvent[];
  /** Komórka dnia w miesiącu — z niej widok się „rozsuwa” i do niej wraca. */
  from: Rect | null;
  /** Obszar kalendarza (siatka miesiąca) — rozsunięty dzień jest wyśrodkowany nad nim. */
  area: Rect | null;
  onClose: () => void;
  onOpen: (e: CalEvent) => void;
  /** Przesuń wpisy o `days` dni (z zachowaniem godziny). */
  onShift: (list: CalEvent[], days: number) => void;
  onDelete: (e: CalEvent) => void;
  /** Prawy przycisk myszy na wpisie → menu (kolor, tagi, usuń). */
  onContext?: (e: CalEvent, pt: { x: number; y: number }) => void;
  /** „P”: najbliższa wolna godzina w godzinach produktywności (albo wyłączenie). */
  onPlan?: (e: CalEvent) => void;
  /** Grupy (kolejność, zwinięcie) — zapisywane trwale przez App. */
  groups: DayGroup[];
  onGroups: (next: DayGroup[]) => void;
  /** Znane tagi (podpowiedzi w „Grupuj…”). */
  knownTags: string[];
};

const HEAD_H = 58;
const ROW_H = 25;
const PAD = 16;
/** Nagłówek grupy + odstępy bańki. */
const GROUP_H = 30;
/** Pole „Grupuj…”. */
const GROUPER_H = 46;
/** Podpowiedzi pod „Grupuj…”. */
const PICK_H = 78;
const QUICK_COLOR = "#2f7d5b";
/** Rząd kolorów pod nagłówkiem grupy. */
const PAINT_H = 38;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

type GroupInfo = { name: string; sub: string; color: string | null };

/** Nazwa i kolor grupy (kolor wybrany ręcznie wygrywa z kolorem tagu / epiku). */
function groupInfo(g: DayGroup, epics: ReadonlyMap<string, EpicInfo>): GroupInfo {
  const base = autoInfo(g, epics);
  return g.color ? { ...base, color: g.color } : base;
}

function autoInfo(g: DayGroup, epics: ReadonlyMap<string, EpicInfo>): GroupInfo {
  switch (g.kind) {
    case "quick":
      return { name: "na szybko", sub: `${QUICK_MIN} min`, color: QUICK_COLOR };
    case "tag":
      return { name: g.key, sub: "tag", color: tagColor(g.key) };
    case "epic": {
      const ep = epics.get(g.key);
      // grupa epiku obejmuje też jego pod-epiki (dayGroups.ts inGroup)
      return { name: ep?.title ?? "(usunięty epik)", sub: "epik", color: ep?.color ?? "#8a8178" };
    }
    default:
      return { name: "pozostałe", sub: "", color: null };
  }
}

/**
 * Rozszerzony dzień: komórka dnia z miesiąca na chwilę „rozsuwa się” na większy obszar (i wraca do niej
 * po zamknięciu) — bez osobnego okienka. Wpisy w jednej linii, z szybkim przekładaniem:
 * „>” na następny dzień, „>>” o tydzień, „> wszystkie low priority”.
 * Grupy („na szybko”, tagi, epiki, „pozostałe”): wpis trafia do pierwszej pasującej od góry; kolejność
 * zmienia się, przeciągając uchwyt ⠿, nowe dodaje pole „Grupuj…”.
 */
export function DayPanel({
  day,
  events,
  from,
  area,
  onClose,
  onOpen,
  onShift,
  onDelete,
  onContext,
  onPlan,
  groups,
  onGroups,
  knownTags,
}: Props) {
  const reduce = useReducedMotion();
  const epics = useContext(EpicContext);
  // „>” / „×”: wpis znika z listy od razu (nie czekając na bazę), więc szybkie drugie kliknięcie trafia już
  // w następny wiersz, a nie drugi raz w ten sam. id → start w chwili kliknięcia (wpis wielodniowy po
  // przesunięciu może dalej być tego dnia — wtedy ma inny start i znów jest widoczny).
  const [gone, setGone] = useState<ReadonlyMap<string, number>>(() => new Map());
  useEffect(() => {
    setGone((prev) => {
      if (!prev.size) return prev;
      const now = new Map(events.map((e) => [e.id, e.start]));
      const next = new Map([...prev].filter(([id, start]) => now.get(id) === start));
      return next.size === prev.size ? prev : next;
    });
  }, [events]);
  const list = events.filter((e) => gone.get(e.id) !== e.start).sort(dayOrder);
  const low = list.filter(isLowPriority);
  const main = list.length - low.length;
  const count = !list.length
    ? "brak wpisów"
    : !low.length
      ? entries(list.length)
      : main
        ? `${entries(main)} + ${low.length} ${LOW_PRIORITY_TAG}`
        : `tylko ${LOW_PRIORITY_TAG} (${low.length})`;

  // grupy: wpis → pierwsza pasująca; widoczne tylko te z wpisami (i świeżo dodana, żeby było widać efekt)
  const [fresh, setFresh] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  /** Grupa z otwartym wyborem koloru. */
  const [painting, setPainting] = useState<string | null>(null);
  const buckets = new Map<string, CalEvent[]>();
  for (const e of list) {
    const id = groupOf(e, groups, (epicId) => epics.get(epicId)?.ancestors ?? []);
    const b = buckets.get(id);
    if (b) b.push(e);
    else buckets.set(id, [e]);
  }
  const itemsOf = (id: string) => buckets.get(id) ?? [];
  const visible = groups.filter((g) => itemsOf(g.id).length > 0 || g.id === fresh);
  // same „pozostałe” (albo pusto) → zwykła lista bez nagłówków; raz pokazane grupy zostają do zamknięcia
  // (inaczej po zniknięciu ostatniej grupy nagłówek „pozostałe” by zniknął i wiersze by podskoczyły)
  const grouped = useRef(false);
  const plainNow = visible.length === 0 || (visible.length === 1 && visible[0].kind === "rest");
  if (!plainNow) grouped.current = true;
  const plain = plainNow && !grouped.current;

  // przeciąganie grup: kolejność trzymana lokalnie, zapis po puszczeniu
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const dragRef = useRef<string[] | null>(null);
  /** Trwa przeciąganie grupy — tylko wtedy grupy przesuwają się z animacją (poza tym od razu, bez zjeżdżania). */
  const [dragging, setDragging] = useState(false);
  const byId = new Map(groups.map((g) => [g.id, g]));
  const ids = (dragOrder ?? visible.map((g) => g.id)).filter((id) => byId.has(id));
  const reorder = (next: string[]) => {
    dragRef.current = next;
    setDragOrder(next);
  };
  const endDrag = () => {
    const o = dragRef.current;
    dragRef.current = null;
    setDragOrder(null);
    setDragging(false);
    if (o) onGroups(reorderVisible(groups, o));
  };

  const addGroup = (g: DayGroup) => {
    if (!byId.has(g.id)) {
      const at = groups.findIndex((x) => x.id === REST_GROUP.id);
      const next = [...groups];
      next.splice(at < 0 ? next.length : at, 0, g);
      onGroups(next);
    }
    setFresh(g.id);
  };
  const removeGroup = (id: string) => {
    if (fresh === id) setFresh(null);
    onGroups(groups.filter((g) => g.id !== id));
  };
  const toggleGroup = (id: string) =>
    onGroups(groups.map((g) => (g.id === id ? { ...g, collapsed: !g.collapsed } : g)));
  const colorGroup = (id: string, color: string | undefined) => {
    onGroups(groups.map((g) => (g.id === id ? { ...g, color } : g)));
    setPainting(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // docelowy prostokąt: szeroko nad kalendarzem, wysokość wg zawartości (dalej przewijanie)
  const rowsShown = plain
    ? list.length
    : visible.reduce((n, g) => n + (g.collapsed ? 0 : Math.max(1, itemsOf(g.id).length)), 0);
  const floor = useRef(0);
  const lastHeight = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** Najmniejsza wysokość treści listy (px) — żeby usunięcie przy dnie przewinięcia nie cofało przewinięcia. */
  const [minContent, setMinContent] = useState(0);
  const contentStyle = minContent ? { minHeight: minContent } : undefined;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const box = area ?? { x: 0, y: 0, w: vw, h: vh };
  const width = Math.min(820, vw - 24, Math.max(box.w - 32, 320));
  const natural = Math.min(
    HEAD_H +
      PAD +
      Math.max(1, rowsShown) * (ROW_H + 1) +
      (plain ? 0 : visible.length * GROUP_H) +
      GROUPER_H +
      (picking ? PICK_H : 0) +
      (painting && !plain ? PAINT_H : 0),
    vh * 0.82,
    vh - 24,
  );
  // po „>” / „×” okno się nie zmniejsza (ani nie przesuwa) — wiersze pod klikniętym podjeżdżają w górę,
  // więc następny wpis jest dokładnie pod kursorem; puste miejsce zostaje na dole do zamknięcia
  const height = Math.min(Math.max(natural, floor.current), vh * 0.82, vh - 24);
  lastHeight.current = height;
  const left = clamp(box.x + (box.w - width) / 2, 12, vw - width - 12);
  const centerY = from ? from.y + from.h / 2 : vh / 2;
  const top = clamp(centerY - height / 2, 12, vh - height - 12);
  const target = { left, top, width, height, borderRadius: 22, opacity: 1 };
  const origin = from
    ? { left: from.x, top: from.y, width: from.w, height: from.h, borderRadius: 16, opacity: 1 }
    : { ...target, opacity: 0 };
  const spring = reduce ? { duration: 0 } : trDay({ type: "spring" as const, stiffness: 340, damping: 30, mass: 0.9 });

  /** Zabierz wpisy z listy tak, żeby nic nad nimi nie drgnęło (patrz `gone`, `floor`, `minContent`). */
  const takeAway = (out: CalEvent[]) => {
    floor.current = lastHeight.current;
    // przewinięte do samego dołu: krótsza treść cofnęłaby przewinięcie i wiersze zjechałyby w dół
    const b = bodyRef.current;
    if (b && b.scrollHeight > b.clientHeight + 1) {
      const cs = getComputedStyle(b);
      const need = b.scrollTop + b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setMinContent((m) => Math.max(m, Math.floor(need)));
    }
    setGone((prev) => new Map([...prev, ...out.map((e) => [e.id, e.start] as const)]));
  };
  const shift = (out: CalEvent[], days: number) => {
    if (!out.length) return;
    takeAway(out);
    onShift(out, days);
  };
  const remove = (e: CalEvent) => {
    takeAway([e]);
    onDelete(e);
  };

  const when = (e: CalEvent) =>
    e.allDay
      ? "cały dzień"
      : !sameDay(new Date(e.start), new Date(e.end - 1))
        ? whenLabel(e)
        : `${formatClock(new Date(e.start))}–${formatClock(new Date(e.end))}`;

  const row = (e: CalEvent) => (
    <li
      key={e.id}
      className={isUrgent(e) ? "urgent" : isLowPriority(e) ? "low" : ""}
      onContextMenu={
        onContext
          ? (ev) => {
              ev.preventDefault();
              onContext(e, { x: ev.clientX, y: ev.clientY });
            }
          : undefined
      }
    >
      <button type="button" className="dx-open" onClick={() => onOpen(e)}>
        <span className="dx-dot" style={{ background: shownColor(e) }} aria-hidden />
        <span className="dx-time">{when(e)}</span>
        {isUrgent(e) && (
          <span className="dx-bang" title="ważne" aria-label="ważne">
            !
          </span>
        )}
        <span className="dx-title">
          {e.title || "(bez tytułu)"}
          <EstSuffix min={e.estimate} />
        </span>
        <EpicTag id={e.epicId} />
        {e.tags?.length ? <span className="dx-tags">{e.tags.join(", ")}</span> : null}
        {e.moves ? (
          <span className="dx-mv" title={`Przeniesiony ${e.moves}×`}>
            ↷{e.moves}
          </span>
        ) : null}
      </button>
      <span className="dx-actions">
        {onPlan && (
          <button
            type="button"
            className={`dx-btn dx-plan${e.autoSlot ? " on" : ""}`}
            aria-pressed={Boolean(e.autoSlot)}
            title={e.autoSlot ? "P: w godzinach produktywności (kliknij, żeby wyłączyć)" : "P: najbliższa wolna godzina w godzinach produktywności"}
            aria-label={`${e.title}: P`}
            onClick={() => onPlan(e)}
          >
            P
          </button>
        )}
        <button type="button" className="dx-btn" title="Na następny dzień" aria-label={`${e.title}: na następny dzień`} onClick={() => shift([e], 1)}>
          &gt;
        </button>
        <button type="button" className="dx-btn" title="Za tydzień" aria-label={`${e.title}: za tydzień`} onClick={() => shift([e], 7)}>
          &gt;&gt;
        </button>
        <button type="button" className="dx-btn dx-del" title="Usuń" aria-label={`Usuń ${e.title}`} onClick={() => remove(e)}>
          ×
        </button>
      </span>
    </li>
  );

  return (
    <>
      <motion.div
        className="dx-backdrop"
        onClick={onClose}
        aria-hidden
        initial={dayInstant() ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={trDay({ duration: 0.18 })}
      />
      <motion.div
        className="day-expand"
        role="dialog"
        aria-label={`Przegląd dnia: ${longDateLabel(day)}`}
        initial={dayInstant() ? false : origin}
        animate={target}
        exit={origin}
        transition={spring}
      >
        <motion.div
          className="dx-inner"
          initial={dayInstant() ? false : { opacity: 0 }}
          animate={{ opacity: 1, transition: trDay({ delay: reduce ? 0 : 0.1, duration: 0.18 }) }}
          exit={{ opacity: 0, transition: trDay({ duration: 0.08 }) }}
        >
          <header className="dx-head">
            <span className="dx-num">{day.getDate()}</span>
            <span className="dx-date">
              <b>{longDateLabel(day)}</b>
              <span className="hint">{count}</span>
            </span>
            <button
              type="button"
              className="dx-all"
              disabled={!low.length}
              title={`Przenieś na następny dzień wszystko z tagiem „${LOW_PRIORITY_TAG}”`}
              onClick={() => shift(low, 1)}
            >
              &gt; wszystkie {LOW_PRIORITY_TAG}
              {low.length ? ` (${low.length})` : ""}
            </button>
            <button type="button" className="sheet-x dx-x" aria-label="Zamknij" title="Zamknij (Esc)" onClick={onClose}>
              ×
            </button>
          </header>
          <motion.div ref={bodyRef} className="dx-body" layoutScroll>
            {plain ? (
              <ul className="dx-list" style={contentStyle}>
                {list.map(row)}
                {!list.length && <li className="dx-empty hint">Nic tego dnia.</li>}
              </ul>
            ) : (
              <Reorder.Group as="div" axis="y" values={ids} onReorder={reorder} className="dx-groups" style={contentStyle}>
                {ids.map((id) => {
                  const g = byId.get(id)!;
                  const items = itemsOf(id);
                  return (
                    <GroupSection
                      key={id}
                      group={g}
                      info={groupInfo(g, epics)}
                      autoColor={autoInfo(g, epics).color}
                      painting={painting === id}
                      onPaint={() => setPainting((p) => (p === id ? null : id))}
                      onColor={(c) => colorGroup(id, c)}
                      count={items.length}
                      reduce={Boolean(reduce)}
                      dragging={dragging}
                      onDragStart={() => setDragging(true)}
                      onToggle={() => toggleGroup(id)}
                      onShiftAll={() => shift(items, 1)}
                      onRemove={g.kind === "rest" ? undefined : () => removeGroup(id)}
                      onDragEnd={endDrag}
                    >
                      {items.length ? items.map(row) : <li className="dx-empty hint">Tego dnia nic tu nie ma.</li>}
                    </GroupSection>
                  );
                })}
              </Reorder.Group>
            )}
          </motion.div>
          <Grouper
            groups={groups}
            knownTags={knownTags}
            epics={epics}
            open={picking}
            onOpen={setPicking}
            onAdd={addGroup}
            onRemove={removeGroup}
          />
        </motion.div>
      </motion.div>
    </>
  );
}

/** Jedna grupa (bańka) z nagłówkiem: uchwyt ⠿ do przeciągania, nazwa (zwiń/rozwiń), „>” dla całej grupy, „×”. */
function GroupSection({
  group,
  info,
  autoColor,
  painting,
  onPaint,
  onColor,
  count,
  reduce,
  dragging,
  onDragStart,
  onToggle,
  onShiftAll,
  onRemove,
  onDragEnd,
  children,
}: {
  group: DayGroup;
  info: GroupInfo;
  /** Kolor „auto” (tagu / epiku), do przycisku „auto”. */
  autoColor: string | null;
  painting: boolean;
  onPaint: () => void;
  onColor: (color: string | undefined) => void;
  count: number;
  reduce: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onToggle: () => void;
  onShiftAll: () => void;
  onRemove?: () => void;
  onDragEnd: () => void;
  children: ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="section"
      value={group.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`dx-group k-${group.kind}${group.collapsed ? " collapsed" : ""}${info.color ? " tinted" : ""}`}
      style={info.color ? { ["--g" as string]: info.color } : undefined}
      // poza przeciąganiem grupy nie zjeżdżają z animacją (np. gdy zniknie grupa wyżej) — od razu na miejscu
      transition={reduce || !dragging ? { duration: 0 } : undefined}
      whileDrag={{
        scale: 1.015,
        boxShadow: "0 14px 34px rgba(40, 24, 12, 0.22)",
        transition: reduce ? { duration: 0 } : tr({ type: "spring", stiffness: 500, damping: 32 }),
      }}
      aria-label={`${info.name}: ${count}`}
    >
      <header className="dx-ghead">
        <span
          className="dx-grip"
          title="Przeciągnij, żeby przesunąć grupę wyżej albo niżej"
          aria-hidden
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
        >
          ⠿
        </span>
        <button
          type="button"
          className={`dx-gcolor${info.color ? "" : " none"}`}
          aria-expanded={painting}
          aria-label={`Kolor grupy ${info.name}`}
          title="Kolor grupy"
          onClick={onPaint}
        />
        <button type="button" className="dx-gname" aria-expanded={!group.collapsed} onClick={onToggle}>
          <span className="dx-chev" aria-hidden>
            {group.collapsed ? "▸" : "▾"}
          </span>
          <b>{info.name}</b>
          <span className="dx-gsub">
            {info.sub ? `${info.sub} · ` : ""}
            {count}
          </span>
        </button>
        <span className="dx-gactions">
          <button
            type="button"
            className="dx-btn"
            disabled={!count}
            title="Całą grupę na następny dzień"
            aria-label={`${info.name}: wszystko na następny dzień`}
            onClick={onShiftAll}
          >
            &gt;
          </button>
          {onRemove && (
            <button
              type="button"
              className="dx-btn dx-del"
              title="Usuń grupę (wpisy zostają)"
              aria-label={`Usuń grupę ${info.name}`}
              onClick={onRemove}
            >
              ×
            </button>
          )}
        </span>
      </header>
      {painting && (
        <div className="dx-paint swatches small" role="group" aria-label={`Kolor grupy ${info.name}`}>
          <button
            type="button"
            className="dx-auto"
            aria-pressed={!group.color}
            title={autoColor ? "Kolor tagu / epiku" : "Bez koloru"}
            style={autoColor ? { ["--g" as string]: autoColor } : undefined}
            onClick={() => onColor(undefined)}
          >
            auto
          </button>
          {PALETTE.map((c) => (
            <button
              key={c.id}
              type="button"
              className="swatch"
              aria-label={`Kolor ${c.id}`}
              style={{ background: c.value }}
              aria-pressed={group.color === c.value}
              onClick={() => onColor(c.value)}
            />
          ))}
          <button
            type="button"
            className="swatch"
            aria-label="Kolor zielony"
            style={{ background: QUICK_COLOR }}
            aria-pressed={group.color === QUICK_COLOR}
            onClick={() => onColor(QUICK_COLOR)}
          />
        </div>
      )}
      {!group.collapsed && <ul className="dx-list">{children}</ul>}
    </Reorder.Item>
  );
}

type Candidate = { group: DayGroup; label: string; hint: string; color: string };

/** „Grupuj…”: wybierz albo wpisz tag lub epik (albo „5 min”) → nowa grupa; tu też usuwa się grupy bez wpisów. */
function Grouper({
  groups,
  knownTags,
  epics,
  open,
  onOpen,
  onAdd,
  onRemove,
}: {
  groups: DayGroup[];
  knownTags: string[];
  epics: ReadonlyMap<string, EpicInfo>;
  open: boolean;
  onOpen: (v: boolean) => void;
  onAdd: (g: DayGroup) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const q = text.trim().toLocaleLowerCase("pl");
  const taken = new Set(groups.map((g) => g.id));

  const all: Candidate[] = [];
  if (!taken.has(QUICK_GROUP.id)) all.push({ group: QUICK_GROUP, label: `${QUICK_MIN} min`, hint: "na szybko", color: QUICK_COLOR });
  for (const t of knownTags) {
    const g = tagGroup(t);
    if (!taken.has(g.id)) all.push({ group: g, label: t, hint: "tag", color: tagColor(t) });
  }
  for (const [id, ep] of epics) {
    const g = epicGroup(id);
    if (!taken.has(g.id)) all.push({ group: g, label: ep.ancestors.length ? ep.path : ep.title, hint: "epik", color: ep.color });
  }
  const hay = (c: Candidate) => `${c.label}${c.group.kind === "quick" ? " na szybko" : ""}`.toLocaleLowerCase("pl");
  const matches = (q ? all.filter((c) => hay(c).includes(q)) : all)
    .sort((a, b) => Number(hay(b).startsWith(q)) - Number(hay(a).startsWith(q)))
    .slice(0, 8);
  // wpisana nazwa, której nie ma wśród podpowiedzi → nowa grupa dla takiego tagu
  const typed = text.trim();
  const typedNew =
    typed && !matches.some((c) => c.label.toLocaleLowerCase("pl") === q) && !taken.has(tagGroup(typed).id)
      ? tagGroup(typed)
      : null;
  const existing = groups.filter((g) => g.kind !== "rest");

  const pick = (g: DayGroup) => {
    onAdd(g);
    setText("");
  };
  const keep = (e: RPointerEvent) => e.preventDefault(); // klik w podpowiedź nie zabiera fokusu z pola

  return (
    <div className={`dx-grouper${open ? " open" : ""}`}>
      <input
        ref={input}
        className="dx-ginput"
        value={text}
        placeholder="Grupuj… (tag albo epik)"
        title="Wpis trafia do pierwszej pasującej grupy od góry. Kolejność zmienisz, przeciągając ⠿."
        aria-label="Grupuj według tagu albo epiku"
        onFocus={() => onOpen(true)}
        onBlur={() => onOpen(false)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const first = matches[0]?.group ?? typedNew;
            if (first) pick(first);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            if (text) setText("");
            else input.current?.blur();
          }
        }}
      />
      {open && (
        <div className="dx-picks">
          {matches.map((c) => (
            <button
              key={c.group.id}
              type="button"
              className="dx-pick"
              style={{ ["--g" as string]: c.color }}
              onPointerDown={keep}
              onClick={() => pick(c.group)}
            >
              <span className="dx-gdot" aria-hidden />
              {c.label}
              <small>{c.hint}</small>
            </button>
          ))}
          {typedNew && (
            <button type="button" className="dx-pick new" onPointerDown={keep} onClick={() => pick(typedNew)}>
              + grupa „{typed}” <small>tag</small>
            </button>
          )}
          {!matches.length && !typedNew && <span className="hint">Wszystko już zgrupowane.</span>}
          {!q && existing.length > 0 && (
            <span className="dx-mine">
              <span className="hint">twoje grupy:</span>
              {existing.map((g) => {
                const info = groupInfo(g, epics);
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="dx-pick mine"
                    style={info.color ? { ["--g" as string]: info.color } : undefined}
                    title="Usuń grupę (wpisy zostają)"
                    onPointerDown={keep}
                    onClick={() => onRemove(g.id)}
                  >
                    {g.kind === "quick" ? info.sub : info.name} ×
                  </button>
                );
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
