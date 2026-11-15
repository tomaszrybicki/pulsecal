import type { ReactNode } from "react";
import type { TagStat } from "../db";
import type { ThemePref } from "../hooks/useTheme";
import { UNTAGGED, tagColor } from "../tags";
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
  onCreate: () => void;
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
};

const THEMES: [ThemePref, string][] = [
  ["auto", "auto"],
  ["light", "jasny"],
  ["dark", "ciemny"],
];

export function Sidebar(p: Props) {
  const rows: { key: string; label: string; count?: number; color: string }[] = [
    ...p.tags.map((t) => ({ key: t.key, label: t.tag, count: t.count, color: tagColor(t.tag) })),
    { key: UNTAGGED, label: "bez tagów", color: "var(--ink-soft)" },
  ];

  return (
    <>
      {p.mode === "drawer" && p.open && <div className="side-backdrop" onClick={p.onClose} aria-hidden />}
      <aside className={`sidebar ${p.mode}${p.open ? " open" : ""}`} aria-label="Panel boczny" aria-hidden={!p.open}>
        {/* Przyciski funkcyjne — tu dochodzą kolejne akcje. */}
        <div className="side-actions">
          <button type="button" className="create-btn" onClick={p.onCreate}>
            <span className="pill-plus" aria-hidden>
              +
            </span>
            nowy wpis
          </button>
        </div>

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

        <section className="side-tags">
          <header>
            <h3>tagi</h3>
            <span className="side-links">
              {p.hidden.size > 0 && (
                <button type="button" className="link-btn" onClick={p.onShowAll}>
                  pokaż wszystkie
                </button>
              )}
              <button type="button" className="link-btn" onClick={p.onOpenRules}>
                reguły
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
                  <label>
                    <input type="checkbox" checked={on} onChange={() => p.onToggleTag(r.key)} />
                    <span className="tag-check" style={{ ["--tag" as string]: r.color }} aria-hidden />
                    <span className="tag-name">{r.label}</span>
                    {r.count !== undefined && <span className="tag-count">{r.count}</span>}
                  </label>
                  <button
                    type="button"
                    className="solo-btn"
                    title="Pokaż tylko ten"
                    aria-label={`Pokaż tylko: ${r.label}`}
                    onClick={() => p.onSoloTag(r.key)}
                  >
                    tylko
                  </button>
                </li>
              );
            })}
          </ul>
          {p.tags.length > 1 && (
            <p className="hint">Wpis z kilkoma tagami jest widoczny, jeśli choć jeden z nich jest zaznaczony.</p>
          )}
        </section>

        <section className="side-theme">
          <h3>motyw</h3>
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
        </section>
      </aside>
    </>
  );
}
