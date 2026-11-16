import { useEffect, useState } from "react";
import type { CalEvent, WorkItem } from "../types";
import { whenLabel } from "../draft";
import { KIND_LABEL, STATUSES, STATUS_LABEL, epicOptions, progressOf, subtreeIds, type Tree } from "../work";
import { SheetFrame } from "./SheetFrame";

type Props = {
  item: WorkItem;
  tree: Tree;
  now: number;
  onSave: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
  onClose: () => void;
  onOpenItem: (item: WorkItem) => void;
  onOpenEvent: (e: CalEvent) => void;
  /** Nowy wpis w kalendarzu od razu w tym epiku. */
  onPlan: (epicId: string) => void;
};

function dirty(a: WorkItem, b: WorkItem): boolean {
  return (
    a.title !== b.title ||
    a.description !== b.description ||
    a.status !== b.status ||
    a.kind !== b.kind ||
    a.parentId !== b.parentId
  );
}

/** Szczegóły zadania / epiku: nazwa, rodzaj, status, epik nadrzędny, duży opis; w epiku — postęp i zawartość. */
export function WorkItemSheet({ item, tree, now, onSave, onDelete, onClose, onOpenItem, onOpenEvent, onPlan }: Props) {
  const [d, setD] = useState(item);
  const children = tree.children.get(item.id) ?? [];
  const events = tree.events.get(item.id) ?? [];
  // epik z zawartością nie może stać się zadaniem (zawartość nie miałaby gdzie być)
  const lockKind = item.kind === "epic" && (children.length > 0 || events.length > 0);
  const parents = epicOptions(tree, subtreeIds(item.id, tree));

  /** Zapisz zmiany (bez zamykania) — także przed przejściem do zadania / wpisu z listy epiku. */
  const commit = () => {
    const t = { ...d, title: d.title.trim() || item.title };
    if (dirty(t, item)) onSave(t);
  };
  const save = () => {
    commit();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const p = item.kind === "epic" ? progressOf(item.id, tree, now) : null;
  const pct = p && p.total ? Math.round((p.done / p.total) * 100) : 0;

  return (
    <SheetFrame anchor={null} className="work-sheet" label={KIND_LABEL[item.kind]} onDismiss={save}>
      <h2>{d.kind === "epic" ? "Epik" : "Zadanie"}</h2>
      <label className="field">
        Nazwa
        <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
      </label>
      <div className="wk-fields">
        <div className="field">
          Rodzaj
          <div className="seg" role="radiogroup" aria-label="Rodzaj">
            {(["task", "epic"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={d.kind === k}
                className={d.kind === k ? "on" : ""}
                disabled={lockKind && k === "task"}
                title={lockKind && k === "task" ? "Epik ma zawartość — najpierw ją przenieś" : undefined}
                onClick={() => setD({ ...d, kind: k })}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          Status
          <div className="seg" role="radiogroup" aria-label="Status">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={d.status === s}
                className={d.status === s ? "on" : ""}
                onClick={() => setD({ ...d, status: s })}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="field">
        W epiku
        <select value={d.parentId} onChange={(e) => setD({ ...d, parentId: e.target.value })}>
          <option value="">— najwyższy poziom —</option>
          {parents.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Opis
        <textarea
          className="wk-desc"
          rows={12}
          value={d.description}
          placeholder="Szczegóły, kroki, linki, notatki…"
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
      </label>

      {p && (
        <section className="wk-epic-info">
          <div className="wk-progress big">
            <span className="wk-bar">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="wk-pct">{p.total ? `${pct}%` : "—"}</span>
          </div>
          <p className="hint">
            Zadania: {p.tasksDone}/{p.tasks} zrobione
            {p.events ? ` · wpisy w kalendarzu: ${p.eventsDone}/${p.events} odbyte` : ""} (razem z pod-epikami).
          </p>
          {children.length > 0 && (
            <ul className="wk-mini">
              {children.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => {
                    commit();
                    onOpenItem(c);
                  }}>
                    <span className={`wk-status st-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                    {c.kind === "epic" ? "◆ " : ""}
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {events.length > 0 && (
            <ul className="wk-mini">
              {events.map((e) => (
                <li key={e.id}>
                  <button type="button" className={e.end < now ? "past" : ""} onClick={() => {
                    commit();
                    onOpenEvent(e);
                  }}>
                    ◷ {whenLabel(e)} · {e.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="ghost wk-plan" onClick={() => {
                    commit();
                    onPlan(item.id);
                  }}>
            + zaplanuj w kalendarzu
          </button>
        </section>
      )}

      <div className="row-actions">
        <button type="button" className="danger" onClick={() => onDelete(item)}>
          Usuń
        </button>
        <button type="button" className="primary" onClick={save}>
          Gotowe
        </button>
      </div>
    </SheetFrame>
  );
}
