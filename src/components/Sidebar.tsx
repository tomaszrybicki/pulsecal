import { useState, type ReactNode } from "react";
import type { TagStat } from "../db";
import type { ThemePref } from "../hooks/useTheme";
import { colorInk } from "../colors";
import { UNTAGGED, hasCustomColor, isPainted, tagColor } from "../tags";
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
  /** Przejdź po wpisach od dziś i dopisz tagi z reguł. */
  onApplyRules: () => void;
  /** Kolor tagu (null = automatyczny). */
  onTagColor: (tag: string, color: string | null) => void;
  /** Wpisy z tym tagiem pokazywane w kolorze tagu. */
  onPaintTag: (tag: string, on: boolean) => void;
  /** Zmiana nazwy tagu we wszystkich wpisach. */
  onRenameTag: (from: string, to: string) => void;
};

const THEMES: [ThemePref, string][] = [
  ["auto", "auto"],
  ["light", "jasny"],
  ["dark", "ciemny"],
];

export function Sidebar(p: Props) {
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
