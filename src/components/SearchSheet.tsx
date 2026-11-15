import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { eventsInRange, searchEvents } from "../db";
import { whenLabel } from "../draft";
import { useLiveQuery } from "../hooks/useLiveQuery";
import { parseQuickEntry, type ParsedEntry } from "../quickParse";
import { tagColor } from "../tags";
import type { CalEvent } from "../types";
import { DAY } from "../time";
import { SheetFrame } from "./SheetFrame";

type Props = {
  knownTags: string[];
  onClose: () => void;
  onOpenEvent: (e: CalEvent) => void;
  onCreate: (p: ParsedEntry) => void;
};

type Item = { kind: "create"; p: ParsedEntry } | { kind: "event"; e: CalEvent; past: boolean };

/** Najbliższe wpisy (gdy pole jest puste). */
async function upcoming(): Promise<CalEvent[]> {
  const now = Date.now();
  const list = await eventsInRange(now, now + 60 * DAY);
  return list.sort((a, b) => a.start - b.start).slice(0, 8);
}

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function when(e: Pick<CalEvent, "start" | "end" | "allDay">): string {
  const y = new Date(e.start).getFullYear();
  return `${whenLabel(e)}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
}

/**
 * Szukaj albo dodaj: jedno pole. Wyniki z tytułów, notatek i tagów (nadchodzące, potem minione),
 * a na górze „Utwórz …" z podglądem tego, co zrozumieliśmy z tekstu („jutro 14:30 1h #tag").
 * Strzałki wybierają, Enter otwiera/tworzy, Esc zamyka.
 */
export function SearchSheet({ knownTags, onClose, onOpenEvent, onCreate }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const query = q.trim().replace(/^#/, "");
  const results = useLiveQuery(() => (query ? searchEvents(query, 30) : upcoming()), [query], [] as CalEvent[]);
  const parsed = useMemo(() => (q.trim() ? parseQuickEntry(q, knownTags) : null), [q, knownTags]);
  const canCreate = Boolean(parsed && parsed.title);

  const items: Item[] = useMemo(() => {
    const now = Date.now();
    const out: Item[] = [];
    if (canCreate && parsed) out.push({ kind: "create", p: parsed });
    for (const e of results) out.push({ kind: "event", e, past: e.end < now });
    return out;
  }, [canCreate, parsed, results]);

  // Domyślnie: z datą/godziną w tekście (albo bez wyników) Enter tworzy wpis, inaczej otwiera pierwszy wynik.
  useEffect(() => {
    if (!canCreate) setActive(0);
    else setActive(parsed?.hasWhen || results.length === 0 ? 0 : 1);
  }, [q, results, canCreate, parsed?.hasWhen]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const activate = (it: Item | undefined) => {
    if (!it) return;
    if (it.kind === "create") onCreate(it.p);
    else onOpenEvent(it.e);
  };

  let shownPast = false;

  return (
    <SheetFrame anchor={null} variant="palette" className="search" label="Szukaj albo dodaj" onDismiss={onClose}>
      <div className="search-box">
        <span className="search-icon" aria-hidden>
          ⌕
        </span>
        <input
          ref={input}
          value={q}
          placeholder="Szukaj albo dodaj, np. „dentysta jutro 14:30 1h #wizyta”"
          aria-label="Szukaj albo dodaj wpis"
          enterKeyHint="go"
          autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              activate(items[active]);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
        />
      </div>

      <div className="search-list" ref={list} role="listbox" aria-label="Wyniki">
        {!query && results.length > 0 && <div className="search-section">najbliższe</div>}
        {items.map((it, i) => {
          if (it.kind === "create") {
            return (
              <button
                key="create"
                type="button"
                data-i={i}
                role="option"
                aria-selected={i === active}
                className={`search-row create${i === active ? " active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => activate(it)}
              >
                <span className="sr-plus" aria-hidden>
                  +
                </span>
                <span className="sr-main">
                  <span className="sr-title">Utwórz „{it.p.title}”</span>
                  <span className="sr-when">{when(it.p)}</span>
                </span>
                {it.p.tags.length > 0 && (
                  <span className="sr-tags">
                    {it.p.tags.map((t) => (
                      <i key={t} style={{ ["--tag" as string]: tagColor(t) }}>
                        {t}
                      </i>
                    ))}
                  </span>
                )}
              </button>
            );
          }
          const firstPast = query && it.past && !shownPast;
          if (firstPast) shownPast = true;
          return (
            <div key={it.e.id}>
              {firstPast && <div className="search-section">minione</div>}
              <button
                type="button"
                data-i={i}
                role="option"
                aria-selected={i === active}
                className={`search-row${i === active ? " active" : ""}${it.past ? " past" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => activate(it)}
              >
                <span className="sr-dot" style={{ background: it.e.color }} aria-hidden />
                <span className="sr-main">
                  <span className="sr-title">{highlight(it.e.title || "(bez tytułu)", query)}</span>
                  <span className="sr-when">{when(it.e)}</span>
                </span>
                {it.e.tags.length > 0 && (
                  <span className="sr-tags">
                    {it.e.tags.map((t) => (
                      <i key={t} style={{ ["--tag" as string]: tagColor(t) }}>
                        {highlight(t, query)}
                      </i>
                    ))}
                  </span>
                )}
              </button>
            </div>
          );
        })}
        {query && results.length === 0 && <p className="hint search-empty">Nic nie znaleziono.</p>}
        {!q.trim() && (
          <p className="hint search-help">
            Szuka w tytułach, notatkach i tagach. Żeby dodać wpis, wpisz np. „urodziny mamy 26.11”, „faktury w piątek
            o 10 #komputer”, „spacer jutro 7:30 30m”. Enter tworzy albo otwiera zaznaczone, strzałki wybierają.
          </p>
        )}
      </div>
    </SheetFrame>
  );
}
