import { useState, type ReactNode } from "react";
import type { CalEvent, WorkItem, WorkKind, WorkStatus } from "../types";
import { whenLabel } from "../draft";
import { STATUS_LABEL, epicColor, progressOf, type Progress, type Tree } from "../work";

type Props = {
  tree: Tree;
  now: number;
  onOpen: (item: WorkItem) => void;
  onCreate: (kind: WorkKind, title: string, parentId: string) => void;
  /** Następny status (do zrobienia → w toku → zrobione → …). */
  onStatus: (item: WorkItem) => void;
  onOpenEvent: (e: CalEvent) => void;
};

const HIDE_DONE_KEY = "pulsecal:tasks-hide-done";

function readHideDone(): boolean {
  try {
    return localStorage.getItem(HIDE_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Widok „zadania”: drzewo epików i zadań, status, postęp, wpisy z kalendarza w epiku. */
export function TasksView({ tree, now, onOpen, onCreate, onStatus, onOpenEvent }: Props) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [hideDone, setHideDone] = useState(readHideDone);
  const roots = tree.children.get("") ?? [];
  const all = [...tree.byId.values()];
  const count = (s: WorkStatus) => all.filter((i) => i.kind === "task" && i.status === s).length;

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = (parent: string, depth: number): ReactNode => {
    const list = (tree.children.get(parent) ?? []).filter((i) => !(hideDone && i.status === "done"));
    const events = parent ? (tree.events.get(parent) ?? []) : [];
    return (
      <>
        {list.map((i) => {
          const open = i.kind === "epic" && !collapsed.has(i.id);
          return (
            <li key={i.id} className="wk-item">
              <div className={`wk-row ${i.kind} st-${i.status}`} style={{ ["--depth" as string]: depth }}>
                {i.kind === "epic" ? (
                  <button
                    type="button"
                    className={`wk-fold${open ? " open" : ""}`}
                    aria-expanded={open}
                    aria-label={open ? `Zwiń ${i.title}` : `Rozwiń ${i.title}`}
                    onClick={() => toggle(i.id)}
                  >
                    ▸
                  </button>
                ) : (
                  <span className="wk-fold" aria-hidden />
                )}
                <button
                  type="button"
                  className={`wk-status st-${i.status}`}
                  title="Zmień status"
                  aria-label={`Status: ${STATUS_LABEL[i.status]} — zmień`}
                  onClick={() => onStatus(i)}
                >
                  {STATUS_LABEL[i.status]}
                </button>
                <button type="button" className="wk-title" onClick={() => onOpen(i)}>
                  {i.kind === "epic" && <i className="wk-epic-mark" style={{ background: epicColor(i.id) }} aria-hidden />}
                  <span>{i.title || "(bez nazwy)"}</span>
                  {i.description.trim() && (
                    <span className="wk-has-desc" title="Ma opis" aria-hidden>
                      ≡
                    </span>
                  )}
                </button>
                {i.kind === "epic" && <ProgressBar p={progressOf(i.id, tree, now)} />}
              </div>
              {open && <ul className="wk-list">{rows(i.id, depth + 1)}</ul>}
            </li>
          );
        })}
        {events.map((e) => (
          <li key={e.id} className="wk-item">
            <button
              type="button"
              className={`wk-row wk-event${e.end < now ? " past" : ""}`}
              style={{ ["--depth" as string]: depth }}
              onClick={() => onOpenEvent(e)}
            >
              <span className="wk-fold" aria-hidden />
              <span className="wk-cal" aria-hidden>
                ◷
              </span>
              <span className="wk-when">{whenLabel(e)}</span>
              <span className="wk-ev-title">{e.title || "(bez tytułu)"}</span>
            </button>
          </li>
        ))}
        {parent && (
          <li className="wk-item">
            <AddRow depth={depth} parentId={parent} onCreate={onCreate} compact />
          </li>
        )}
      </>
    );
  };

  return (
    <div className="tasks-view">
      <div className="tasks-inner">
        <header className="tasks-head">
          <h2>zadania</h2>
          <span className="tasks-counts">
            {count("doing")} w toku · {count("todo")} do zrobienia · {count("done")} zrobione
          </span>
          <label className="tasks-hide">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => {
                setHideDone(e.target.checked);
                try {
                  localStorage.setItem(HIDE_DONE_KEY, e.target.checked ? "1" : "0");
                } catch {
                  /* bez zapamiętania */
                }
              }}
            />
            ukryj zrobione
          </label>
        </header>
        <AddRow depth={0} parentId="" onCreate={onCreate} />
        {roots.length === 0 ? (
          <p className="hint tasks-empty">
            Epik to większa sprawa (np. „remont kuchni”), a w nim zadania, mniejsze epiki i wpisy z kalendarza.
            Wpisz nazwę i wybierz „+ epik” albo „+ zadanie”. Wpis z kalendarza dodasz do epiku w jego edycji (pole
            „Epik”).
          </p>
        ) : (
          <ul className="wk-list root">{rows("", 0)}</ul>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ p }: { p: Progress }) {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const title =
    `Zadania: ${p.tasksDone}/${p.tasks} zrobione` + (p.events ? ` · wpisy w kalendarzu: ${p.eventsDone}/${p.events} odbyte` : "");
  return (
    <span className="wk-progress" title={title} aria-label={`Postęp ${pct}% (${title})`}>
      <span className="wk-bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="wk-pct">{p.total ? `${p.done}/${p.total}` : "—"}</span>
    </span>
  );
}

/** Szybkie dodawanie: nazwa + Enter = zadanie, „+ epik” = epik. W epiku najpierw tylko „+ dodaj”. */
function AddRow({
  depth,
  parentId,
  onCreate,
  compact = false,
}: {
  depth: number;
  parentId: string;
  onCreate: Props["onCreate"];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState("");
  const add = (kind: WorkKind) => {
    if (!text.trim()) return;
    onCreate(kind, text, parentId);
    setText("");
  };

  if (!open) {
    return (
      <button type="button" className="wk-add-link" style={{ ["--depth" as string]: depth }} onClick={() => setOpen(true)}>
        + dodaj
      </button>
    );
  }
  return (
    <form
      className={`wk-add${compact ? " compact" : ""}`}
      style={{ ["--depth" as string]: depth }}
      onSubmit={(e) => {
        e.preventDefault();
        add("task");
      }}
    >
      <input
        value={text}
        autoFocus={compact}
        placeholder={compact ? "Nazwa — Enter dodaje zadanie" : "Nowe zadanie albo epik…"}
        aria-label="Nazwa nowego zadania albo epiku"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && compact) {
            setText("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (compact && !text.trim()) setOpen(false);
        }}
      />
      <button type="submit" className="ghost" disabled={!text.trim()}>
        + zadanie
      </button>
      <button
        type="button"
        className="ghost"
        disabled={!text.trim()}
        // mousedown przed blur — inaczej puste pole zwinęłoby się, zanim kliknięcie dotrze
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => add("epic")}
      >
        + epik
      </button>
    </form>
  );
}
