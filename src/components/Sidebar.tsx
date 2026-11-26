import { useState, type ReactNode } from "react";
import { memoView } from "../memoView";
import { useHoldDrag } from "../hooks/useHoldDrag";
import type { TagStat } from "../db";
import type { ThemePref } from "../hooks/useTheme";
import type { ViewMode } from "../types";
import { ALMOST_DONE, progressColor } from "../work";
import { colorInk } from "../colors";
import { DEFAULT_TAGS, UNTAGGED, hasCustomColor, isPainted, tagColor, tagKey } from "../tags";
import { MiniCalendar, type WeekSelection } from "./MiniCalendar";

type Props = {
  /** docked = stała kolumna (komputer), drawer = wysuwana szuflada (telefon). */
  mode: "docked" | "drawer";
  open: boolean;
  onClose: () => void;
  today: Date;
  focus: Date;
  selection: WeekSelection | null;
  onPickDay: (d: Date) => void;
  onPickWeeks: (start: Date, weeks: number) => void;
  /** Przełącznik widoku (w szufladzie na telefonie — w górnym pasku brak miejsca). */
  viewSwitch: ReactNode;
  tags: TagStat[];
  hidden: ReadonlySet<string>;
  onToggleTag: (tag: string) => void;
  onSoloTag: (tag: string) => void;
  onShowAll: () => void;
  theme: ThemePref;
  onTheme: (t: ThemePref) => void;
  onOpenRules: () => void;
  /** Przejdź po wpisach od dziś i dopisz tagi z reguł. */
  onApplyRules: () => void;
  /** Kolor tagu (null = automatyczny). */
  onTagColor: (tag: string, color: string | null) => void;
  /** Wpisy z tym tagiem pokazywane w kolorze tagu. */
  onPaintTag: (tag: string, on: boolean) => void;
  /** Zmiana nazwy tagu we wszystkich wpisach. */
  onRenameTag: (from: string, to: string) => void;
  /** Usunięcie tagu ze wszystkich wpisów (z „Cofnij”). */
  onDeleteTag: (tag: string) => void;
  view: ViewMode;
  /** Odnośniki na dole panelu: kalendarz (ostatni widok kalendarza) / zadania. */
  onView: (v: "calendar" | "tasks" | "projects") => void;
  /** Liczba niezrobionych zadań (przy odnośniku „zadania”). */
  openTasks: number;
  pinned: PinnedEpic[];
  onOpenEpic: (id: string) => void;
  /** Przeciągnięcie przypiętego epiku na dzień w kalendarzu (App). */
  onDragEpic?: (id: string, x: number, y: number) => void;
  onOpenPrefs: () => void;
};

export type PinnedEpic = {
  id: string;
  title: string;
  color: string;
  /** zrobione / wszystkie zadania (z pod-epikami) */
  done: number;
  total: number;
  /** dawno nic się w nim nie zmieniło */
  sleepy: boolean;
  /** suma estymat niezrobionych wpisów, np. „3h 35min” ("" = brak) */
  remaining: string;
};

const THEMES: [ThemePref, string][] = [
  ["auto", "auto"],
  ["light", "jasny"],
  ["dark", "ciemny"],
];

function SidebarImpl(p: Props) {
  // zmiana nazwy tagu: klucz edytowanego wiersza + wpisywana nazwa
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const startEdit = (key: string, label: string) => {
    setEditing(key);
    setName(label);
  };
  const commit = (label: string) => {
    setEditing(null);
    const next = name.trim();
    if (next && next !== label) p.onRenameTag(label, next);
  };
  const rows: { key: string; label: string; count?: number; color: string }[] = [
    ...p.tags.map((t) => ({ key: t.key, label: t.tag, count: t.count, color: tagColor(t.tag) })),
    { key: UNTAGGED, label: "bez tagów", color: "var(--ink-soft)" },
  ];

  return (
    <>
      {p.mode === "drawer" && p.open && <div className="side-backdrop" onClick={p.onClose} aria-hidden />}
      <aside className={`sidebar ${p.mode}${p.open ? " open" : ""}`} aria-label="Panel boczny" aria-hidden={!p.open}>
        {p.mode === "drawer" && (
          <div className="side-views" role="group" aria-label="Widok">
            {p.viewSwitch}
          </div>
        )}

        <MiniCalendar
          today={p.today}
          focus={p.focus}
          selection={p.selection}
          onPickDay={p.onPickDay}
          onPickWeeks={p.onPickWeeks}
        />
        <p className="hint side-hint">Przeciągnij po dniach albo numerach tygodni, żeby pokazać kilka tygodni.</p>

        {p.pinned.length > 0 && (
          <section className="side-pins" aria-label="Przypięte epiki">
            <h3>przypięte epiki</h3>
            <ul>
              {p.pinned.map((e) => (
                <li key={e.id}>
                  <PinnedRow
                    e={e}
                    onOpen={() => p.onOpenEpic(e.id)}
                    onDrag={p.onDragEpic ? (x, y) => p.onDragEpic!(e.id, x, y) : undefined}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="side-tags">
          <header>
            <h3 title="Wpis z kilkoma tagami jest widoczny, jeśli choć jeden z nich jest zaznaczony.">tagi</h3>
            <span className="side-links">
              {p.hidden.size > 0 && (
                <button type="button" className="link-btn" onClick={p.onShowAll}>
                  pokaż wszystkie
                </button>
              )}
              <button type="button" className="link-btn" onClick={p.onOpenRules}>
                reguły
              </button>
              <button
                type="button"
                className="link-btn refresh-btn"
                title="Zastosuj reguły do wpisów od dziś"
                aria-label="Zastosuj reguły tagów do wpisów od dziś"
                onClick={p.onApplyRules}
              >
                ↻
              </button>
            </span>
          </header>
          {p.tags.length === 0 && (
            <p className="hint">Dodaj tag do wpisu (pole „Tagi”), a pojawi się tutaj. Odznacz tag, żeby ukryć jego wpisy.</p>
          )}
          <ul>
            {rows.map((r) => {
              const on = !p.hidden.has(r.key);
              return (
                <li key={r.key} className={on ? "" : "off"}>
                  {editing === r.key ? (
                    <span className="tag-edit">
                      <span className="tag-check" style={{ ["--tag" as string]: r.color }} aria-hidden />
                      <input
                        className="tag-rename"
                        value={name}
                        autoFocus
                        aria-label={`Nowa nazwa tagu ${r.label}`}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => commit(r.label)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditing(null);
                          }
                        }}
                      />
                    </span>
                  ) : (
                    <label>
                      <input type="checkbox" checked={on} onChange={() => p.onToggleTag(r.key)} />
                      <span className="tag-check" style={{ ["--tag" as string]: r.color }} aria-hidden />
                      {r.key === UNTAGGED ? (
                        <span className="tag-name">{r.label}</span>
                      ) : (
                        <button
                          type="button"
                          className="tag-name"
                          title="Zmień nazwę"
                          aria-label={`${r.label} — zmień nazwę`}
                          onClick={() => startEdit(r.key, r.label)}
                        >
                          {r.label}
                        </button>
                      )}
                      {r.count !== undefined && <span className="tag-count">{r.count}</span>}
                    </label>
                  )}
                  {r.key !== UNTAGGED && isPainted(r.label) && (
                    <span className="tag-painted" style={{ background: r.color }} title="Wpisy w kolorze tagu" aria-hidden />
                  )}
                  <span className="tag-actions">
                    {r.key !== UNTAGGED && (
                      <span className="tag-color-ctl">
                        <label className="tag-color" title="Kolor tagu" style={{ background: r.color }}>
                          <input
                            type="color"
                            aria-label={`Kolor tagu ${r.label}`}
                            value={r.color}
                            onChange={(e) => p.onTagColor(r.label, e.target.value)}
                          />
                        </label>
                        {hasCustomColor(r.label) && (
                          <button
                            type="button"
                            className="tag-color-reset"
                            title="Kolor automatyczny"
                            aria-label={`Kolor automatyczny dla ${r.label}`}
                            onClick={() => p.onTagColor(r.label, null)}
                          >
                            ↺
                          </button>
                        )}
                      </span>
                    )}
                    {r.key !== UNTAGGED && (
                      <button
                        type="button"
                        className={`paint-btn${isPainted(r.label) ? " on" : ""}`}
                        style={{ ["--tag" as string]: r.color, ["--tag-ink" as string]: colorInk(r.color) }}
                        aria-pressed={isPainted(r.label)}
                        title="Wpisy z tym tagiem w kolorze tagu"
                        aria-label={`Koloruj wpisy z tagiem ${r.label}`}
                        onClick={() => p.onPaintTag(r.label, !isPainted(r.label))}
                      >
                        koloruj
                      </button>
                    )}
                    <button
                      type="button"
                      className="solo-btn"
                      title="Pokaż tylko ten"
                      aria-label={`Pokaż tylko: ${r.label}`}
                      onClick={() => p.onSoloTag(r.key)}
                    >
                      tylko
                    </button>
                    {r.key !== UNTAGGED && !DEFAULT_TAGS.some((d) => tagKey(d.tag) === r.key) && (
                      <button
                        type="button"
                        className="tag-del"
                        title="Usuń tag ze wszystkich wpisów"
                        aria-label={`Usuń tag ${r.label}`}
                        onClick={() => p.onDeleteTag(r.label)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Odnośniki do funkcji — tu dochodzą kolejne (zawsze na dole panelu). */}
        <nav className="side-nav" aria-label="Funkcje">
          <button type="button" aria-pressed={p.view !== "tasks" && p.view !== "projects"} onClick={() => p.onView("calendar")}>
            <NavIcon d="M3 5.5h14M6 2.5v3M14 2.5v3M4 4h12a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
            kalendarz
          </button>
          <button type="button" aria-pressed={p.view === "tasks"} onClick={() => p.onView("tasks")}>
            <NavIcon d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6.5 10l2.5 2.5 4.5-5" />
            zadania i epiki
            {p.openTasks > 0 && <span className="nav-count">{p.openTasks}</span>}
          </button>
          <button type="button" aria-pressed={p.view === "projects"} onClick={() => p.onView("projects")}>
            <NavIcon d="M10 2.5l7 4v7l-7 4l-7-4v-7zM10 2.5v15M3 6.5l7 4l7-4" />
            projekty
          </button>
          <button type="button" onClick={p.onOpenPrefs}>
            <NavIcon d="M10 7a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
            ustawienia
          </button>
          <div className="side-nav-row">
            <NavIcon d="M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM10 3v14" />
            <span>motyw</span>
            <div className="seg" role="radiogroup" aria-label="Motyw">
            {THEMES.map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={p.theme === v}
                className={p.theme === v ? "on" : ""}
                onClick={() => p.onTheme(v)}
              >
                {label}
              </button>
            ))}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Przypięty epik: pasek postępu w kolorze zależnym od postępu; „śpi” (zZz) albo pulsuje, gdy blisko końca. */
/**
 * Przypięty epik: klik → szczegóły. Przeciągnięcie (mysz: ruch o kilka px, dotyk: przytrzymanie) → epik na kalendarz.
 */
function PinnedRow({ e, onOpen, onDrag }: { e: PinnedEpic; onOpen: () => void; onDrag?: (x: number, y: number) => void }) {
  const { props: dragProps, wasDragged } = useHoldDrag(onDrag);
  const ratio = e.total ? e.done / e.total : 0;
  const complete = e.total > 0 && e.done === e.total;
  const almost = !complete && e.total > 0 && ratio >= ALMOST_DONE;
  const mood = e.sleepy ? " sleepy" : almost ? " almost" : complete ? " complete" : "";
  const state = e.sleepy ? " · dawno bez zmian" : almost ? " · prawie gotowe" : complete ? " · gotowe" : "";
  return (
    <button
      type="button"
      className={`pin-epic${mood}`}
      style={{ ["--fill" as string]: progressColor(ratio), ["--epic" as string]: e.color }}
      title={`${e.title}: ${e.total ? `${e.done}/${e.total} zadań zrobionych` : "brak zadań"}${e.remaining ? `, zostało ~${e.remaining}` : ""}${state}${onDrag ? " · przeciągnij na kalendarz" : ""}`}
      {...dragProps}
      onClick={() => {
        if (!wasDragged()) onOpen();
      }}
    >
      <span className="pin-epic-head">
        <span className="pin-epic-dot" aria-hidden />
        <span className="pin-epic-name">{e.title || "(bez nazwy)"}</span>
        <span className="pin-epic-count">
          {e.total ? `${e.done}/${e.total}` : "—"}
          {e.remaining && <span className="pin-epic-left"> · ~{e.remaining}</span>}
        </span>
      </span>
      <span className="pin-epic-bar">
        <span style={{ width: `${Math.round(ratio * 100)}%` }} />
      </span>
      {e.sleepy && (
        <span className="zzz" aria-hidden>
          <i>z</i>
          <i>z</i>
          <i>Z</i>
        </span>
      )}
    </button>
  );
}

/** Panel boczny bez zbędnych przeliczeń, gdy App zmienia tylko callbacki. */
export const Sidebar = memoView(SidebarImpl);
