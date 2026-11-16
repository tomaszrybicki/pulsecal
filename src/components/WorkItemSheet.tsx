import { useEffect, useState } from "react";
import type { CalEvent, Priority, WorkComment, WorkField, WorkItem, WorkKind } from "../types";
import { formatClock, formatDayShort } from "../time";
import {
  KIND_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  epicOptions,
  epicPath,
  isOverdue,
  itemKey,
  priorityOf,
  progressOf,
  subtreeIds,
  taskWhen,
  whenShort,
  type Tree,
} from "../work";
import { DateField } from "./DateField";
import { SheetFrame } from "./SheetFrame";
import { InlineCreate, PinIcon, PlanButton, PriorityIcon, ProgressBar, Remaining, TypeIcon } from "./TasksView";
import { estimateLabel } from "../estimate";
import { Comments } from "./Comments";

type Props = {
  item: WorkItem;
  tree: Tree;
  now: number;
  fields: WorkField[];
  onSave: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
  onClose: () => void;
  onOpenItem: (item: WorkItem) => void;
  onOpenEvent: (e: CalEvent) => void;
  /** Nowy wpis w kalendarzu od razu w tym epiku. */
  onPlan: (epicId: string) => void;
  /** Zadanie: nowy wpis w kalendarzu powiązany z tym zadaniem. */
  onPlanTask: (task: WorkItem) => void;
  /** Przytrzymanie „zaplanuj”: przeciąganie zadania na dzień w kalendarzu. */
  onPlanHold?: (task: WorkItem, x: number, y: number) => void;
  onCreate: (kind: WorkKind, title: string, parentId: string, patch?: Partial<WorkItem>) => void;
  onEditFields: () => void;
};

function dirty(a: WorkItem, b: WorkItem): boolean {
  return (
    a.title !== b.title ||
    a.description !== b.description ||
    a.status !== b.status ||
    a.kind !== b.kind ||
    a.parentId !== b.parentId ||
    priorityOf(a) !== priorityOf(b) ||
    (a.due ?? null) !== (b.due ?? null) ||
    (a.estimate ?? null) !== (b.estimate ?? null) ||
    JSON.stringify(a.fields ?? {}) !== JSON.stringify(b.fields ?? {}) ||
    JSON.stringify(a.comments ?? []) !== JSON.stringify(b.comments ?? []) ||
    Boolean(a.statusManual) !== Boolean(b.statusManual) ||
    (a.showOn ?? null) !== (b.showOn ?? null) ||
    Boolean(a.pinned) !== Boolean(b.pinned)
  );
}

const stamp = (t: number) => (t ? `${formatDayShort(new Date(t))}, ${formatClock(new Date(t))}` : "—");

/**
 * Szczegóły zadania / epiku jak w Jirze: po lewej nazwa, opis i zawartość epiku,
 * po prawej panel „szczegóły” (status, priorytet, termin, szacunek, epik, własne pola).
 */
export function WorkItemSheet(props: Props) {
  const { item, tree, now, fields, onSave, onDelete, onClose, onOpenItem, onOpenEvent, onPlan, onPlanTask, onCreate, onEditFields } =
    props;
  const { onPlanHold } = props;
  const [d, setD] = useState(item);
  // niewysłany komentarz — zamknięcie okna go dodaje, żeby nie przepadł
  const [note, setNote] = useState("");
  const children = tree.children.get(item.id) ?? [];
  // wpis w kalendarzu tego zadania (seria: najbliższe wystąpienie)
  const when = item.kind === "task" ? taskWhen(item.id, tree, now) : undefined;
  const linked = Boolean(item.eventId || item.seriesId);
  const autoOn = Boolean(item.eventId && when && !d.statusManual);
  // epik z zawartością nie może stać się zadaniem (zawartość nie miałaby gdzie być)
  const lockKind = item.kind === "epic" && children.length > 0;
  // zadanie z wpisem w kalendarzu zostaje zadaniem (w epiku są tylko zadania z terminami)
  const lockEpic = item.kind === "task" && linked;
  const parents = epicOptions(tree, subtreeIds(item.id, tree));

  /** Zapisz zmiany (bez zamykania) — także przed przejściem do zadania / wpisu z listy epiku. */
  const commit = () => {
    const t = { ...d, title: d.title.trim() || item.title };
    if (note.trim()) {
      t.comments = [{ id: crypto.randomUUID().slice(0, 8), text: note.trim(), at: Date.now() }, ...(t.comments ?? [])];
      setNote("");
    }
    if (dirty(t, item)) onSave(t);
  };
  /** Komentarze i przypięcie zapisują się od razu (razem z resztą zmian w oknie). */
  const saveNow = (patch: Partial<WorkItem>) => {
    setD({ ...d, ...patch });
    const t = { ...d, ...patch, title: d.title.trim() || item.title };
    if (dirty(t, item)) onSave(t);
  };
  const setComments = (comments: WorkComment[]) => saveNow({ comments });
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
  const setField = (id: string, v: string) => {
    const next = { ...(d.fields ?? {}) };
    if (v === "") delete next[id];
    else next[id] = v;
    setD({ ...d, fields: next });
  };

  return (
    <SheetFrame anchor={null} className="work-sheet jira-issue" label={KIND_LABEL[item.kind]} onDismiss={save}>
      <div className="ji-crumbs">
        {item.parentId && tree.byId.has(item.parentId) && (
          <>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                commit();
                onOpenItem(tree.byId.get(item.parentId)!);
              }}
            >
              {epicPath(item.parentId, tree.byId)}
            </button>
            <span aria-hidden> / </span>
          </>
        )}
        <TypeIcon kind={d.kind} />
        <span className="jr-key">{itemKey(item) || KIND_LABEL[item.kind]}</span>
        {d.kind === "epic" && (
          <button
            type="button"
            className={`ji-pin${d.pinned ? " on" : ""}`}
            aria-pressed={Boolean(d.pinned)}
            title={d.pinned ? "Odepnij z panelu bocznego" : "Przypnij w panelu bocznym (podgląd postępu)"}
            onClick={() => saveNow({ pinned: !d.pinned })}
          >
            <PinIcon /> {d.pinned ? "przypięty" : "przypnij"}
          </button>
        )}
      </div>

      <div className="ji-layout">
        <div className="ji-main">
          <textarea
            className="ji-title"
            rows={1}
            value={d.title}
            aria-label="Nazwa"
            onChange={(e) => setD({ ...d, title: e.target.value.replace(/\n/g, " ") })}
          />
          <label className="field">
            Opis
            <textarea
              className="wk-desc"
              rows={10}
              value={d.description}
              placeholder="Szczegóły, kroki, linki, notatki…"
              onChange={(e) => setD({ ...d, description: e.target.value })}
            />
          </label>

          {p && (
            <section className="ji-section">
              <h3>zawartość epiku</h3>
              <ProgressBar p={p} />
              <Remaining id={item.id} tree={tree} now={now} />
              <p className="hint">
                Zadania: {p.tasksDone}/{p.tasks} zrobione
                {p.events ? ` · wpisy w kalendarzu: ${p.eventsDone}/${p.events} odbyte` : ""} (razem z pod-epikami).
              </p>
              <ul className="wk-mini">
                {children.map((c) => {
                  const open = () => {
                    commit();
                    onOpenItem(c);
                  };
                  const cw = c.kind === "task" ? taskWhen(c.id, tree, now) : undefined;
                  return (
                    <li key={c.id}>
                      <button type="button" className="wk-open wk-open-main" onClick={open}>
                        <TypeIcon kind={c.kind} />
                        <span className="jr-key">{itemKey(c)}</span>
                        <span className="ji-child-title">{c.title}</span>
                      </button>
                      {/* data albo „zaplanuj” tuż za nazwą */}
                      {cw ? (
                        <span className="jr-when static">◷ {whenShort(cw, now)}</span>
                      ) : (
                        c.kind === "task" &&
                        c.status !== "done" && (
                          <PlanButton
                            task={c}
                            onPlan={(t) => {
                              commit();
                              onPlanTask(t);
                            }}
                            onHold={
                              onPlanHold
                                ? (t, x, y) => {
                                    commit();
                                    onPlanHold(t, x, y);
                                  }
                                : undefined
                            }
                          />
                        )
                      )}
                      <button type="button" className="wk-open wk-open-rest" tabIndex={-1} onClick={open}>
                        <PriorityIcon p={priorityOf(c)} />
                        <span className={`jr-lozenge st-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <InlineCreate parentId={item.id} onCreate={onCreate} />
              <button
                type="button"
                className="ghost wk-plan"
                onClick={() => {
                  commit();
                  onPlan(item.id);
                }}
              >
                + zaplanuj w kalendarzu
              </button>
            </section>
          )}

          <Comments comments={d.comments ?? []} draft={note} onDraft={setNote} onChange={setComments} />
        </div>

        <aside className="ji-side">
          <select
            className={`jr-lozenge jr-status big st-${d.status}`}
            aria-label="Status"
            value={d.status}
            onChange={(e) => setD({ ...d, status: e.target.value as WorkItem["status"], statusManual: true })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {item.eventId && when && (
            <p className="ji-auto hint">
              {autoOn ? (
                "Status automatyczny: „zrobione” po zakończeniu wpisu. Zmień go ręcznie, żeby został Twój."
              ) : (
                <>
                  Status ustawiony ręcznie.{" "}
                  <button type="button" className="link-btn" onClick={() => setD({ ...d, statusManual: false })}>
                    przywróć automatyczny
                  </button>
                </>
              )}
            </p>
          )}

          <div className="ji-details">
            <h3>szczegóły</h3>
            <label className="ji-field">
              <span>rodzaj</span>
              <select
                value={d.kind}
                onChange={(e) => setD({ ...d, kind: e.target.value as WorkKind })}
                title={lockKind ? "Epik ma zawartość — najpierw ją przenieś" : undefined}
              >
                <option value="task" disabled={lockKind}>
                  zadanie
                </option>
                <option value="epic" disabled={lockEpic}>
                  epik
                </option>
              </select>
            </label>
            <label className="ji-field">
              <span>priorytet</span>
              <span className="ji-with-icon">
                <PriorityIcon p={priorityOf(d)} />
                <select value={priorityOf(d)} onChange={(e) => setD({ ...d, priority: e.target.value as Priority })}>
                  {PRIORITIES.map((x) => (
                    <option key={x} value={x}>
                      {PRIORITY_LABEL[x]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            {d.kind === "epic" && (
              <div className="ji-field">
                <span>na kalendarzu</span>
                {d.showOn ? (
                  <span className="ji-due">
                    <DateField label="Dzień epiku na kalendarzu" value={d.showOn} onChange={(day) => setD({ ...d, showOn: day })} />
                    <button
                      type="button"
                      className="ji-clear"
                      aria-label="Zdejmij epik z kalendarza"
                      onClick={() => setD({ ...d, showOn: null })}
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ji-set"
                    title="Albo przeciągnij przypięty epik z panelu bocznego na dzień w kalendarzu"
                    onClick={() => {
                      const t = new Date(now);
                      t.setHours(0, 0, 0, 0);
                      setD({ ...d, showOn: t.getTime() });
                    }}
                  >
                    + pokaż
                  </button>
                )}
              </div>
            )}
            <div className="ji-field">
              <span>termin</span>
              {d.due ? (
                <span className={`ji-due${isOverdue(d, now) ? " overdue" : ""}`}>
                  <DateField label="Termin" value={d.due} onChange={(day) => setD({ ...d, due: day })} />
                  <button type="button" className="ji-clear" aria-label="Usuń termin" onClick={() => setD({ ...d, due: null })}>
                    ×
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="ji-set"
                  onClick={() => {
                    const t = new Date(now);
                    t.setHours(0, 0, 0, 0);
                    setD({ ...d, due: t.getTime() });
                  }}
                >
                  + ustaw
                </button>
              )}
            </div>
            {item.kind === "task" && (
              <div className="ji-field">
                <span>kalendarz</span>
                {when ? (
                  <button
                    type="button"
                    className="ji-set ji-when"
                    title="Otwórz wpis w kalendarzu"
                    onClick={() => {
                      commit();
                      onOpenEvent(when);
                    }}
                  >
                    {item.seriesId ? "↻ " : "◷ "}
                    {whenShort(when, now)}
                    {when.estimate ? ` · ${estimateLabel(when.estimate)}` : ""}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ji-set"
                    onClick={() => {
                      commit();
                      onPlanTask({ ...d, title: d.title.trim() || item.title });
                    }}
                  >
                    + zaplanuj
                  </button>
                )}
              </div>
            )}
            <label className="ji-field">
              <span>szacunek</span>
              <input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="—"
                value={d.estimate ?? ""}
                onChange={(e) => setD({ ...d, estimate: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
            <label className="ji-field">
              <span>epik</span>
              <select value={d.parentId} onChange={(e) => setD({ ...d, parentId: e.target.value })}>
                <option value="">— brak —</option>
                {parents.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {fields.map((f) => (
              <label key={f.id} className="ji-field">
                <span>{f.name}</span>
                {f.type === "select" ? (
                  <select value={d.fields?.[f.id] ?? ""} onChange={(e) => setField(f.id, e.target.value)}>
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    step="any"
                    placeholder="—"
                    value={d.fields?.[f.id] ?? ""}
                    onChange={(e) => setField(f.id, e.target.value)}
                  />
                )}
              </label>
            ))}
            <button type="button" className="link-btn ji-fields-link" onClick={onEditFields}>
              {fields.length ? "zarządzaj polami" : "+ własne pole"}
            </button>
          </div>
          <p className="ji-stamps">
            utworzono {stamp(item.createdAt)}
            <br />
            zmieniono {stamp(item.updatedAt)}
          </p>
        </aside>
      </div>

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
