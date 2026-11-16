import { useMemo, useState, type ReactNode } from "react";
import type { CalEvent, Priority, WorkItem, WorkKind, WorkStatus } from "../types";
import { formatDayShort } from "../time";
import { whenLabel } from "../draft";
import { estimateLabel, formatMinutes } from "../estimate";
import {
  PRIORITIES,
  PRIORITY_ICON,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  epicColor,
  epicPath,
  isOverdue,
  itemKey,
  priorityOf,
  progressOf,
  subtreeIds,
  remainingEstimate,
  taskWhen,
  whenShort,
  type Progress,
  type Tree,
} from "../work";

type Props = {
  tree: Tree;
  now: number;
  onOpen: (item: WorkItem) => void;
  onCreate: (kind: WorkKind, title: string, parentId: string, patch?: Partial<WorkItem>) => void;
  onPatch: (item: WorkItem, patch: Partial<WorkItem>) => void;
  onOpenEvent: (e: CalEvent) => void;
  onEditFields: () => void;
};

type Tab = "list" | "board";
type GroupBy = "epic" | "status" | "priority" | "none";
type SortBy = "rank" | "priority" | "due";

/** Filtr epiku: "" = wszystko, NO_EPIC = bez epiku, inaczej ID epiku (z pod-epikami). */
const NO_EPIC = "__none__";

function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T | null) ?? fallback;
    } catch {
      return fallback;
    }
  });
  return [
    v,
    (next: T) => {
      setV(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* bez zapamiętania */
      }
    },
  ];
}

const PRIORITY_RANK: Record<Priority, number> = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };

/**
 * Widok „zadania” w układzie Jiry: po lewej panel epików (filtr), u góry pasek narzędzi,
 * w środku lista (pogrupowana) albo tablica ze statusami. Szczegóły zadania — WorkItemSheet.
 */
export function TasksView({ tree, now, onOpen, onCreate, onPatch, onOpenEvent, onEditFields }: Props) {
  const [tab, setTab] = usePref<Tab>("pulsecal:jira-tab", "list");
  const [groupBy, setGroupBy] = usePref<GroupBy>("pulsecal:jira-group", "epic");
  const [sortBy, setSortBy] = usePref<SortBy>("pulsecal:jira-sort", "rank");
  const [hideDone, setHideDone] = usePref<"0" | "1">("pulsecal:tasks-hide-done", "0");
  const [epicFilter, setEpicFilter] = useState("");
  const [query, setQuery] = useState("");

  const all = [...tree.byId.values()];
  const epics = all.filter((i) => i.kind === "epic");
  const scope = useMemo(
    () => (epicFilter && epicFilter !== NO_EPIC && tree.byId.has(epicFilter) ? subtreeIds(epicFilter, tree) : null),
    [epicFilter, tree],
  );
  const parentOf = (i: WorkItem) => (i.parentId && tree.byId.has(i.parentId) ? i.parentId : "");

  const q = query.trim().toLocaleLowerCase("pl");
  const tasks = all
    .filter((i) => i.kind === "task")
    .filter((i) => (epicFilter === NO_EPIC ? !parentOf(i) : scope ? scope.has(parentOf(i)) : true))
    .filter(
      (i) =>
        !q ||
        i.title.toLocaleLowerCase("pl").includes(q) ||
        i.description.toLocaleLowerCase("pl").includes(q) ||
        (i.comments ?? []).some((c) => c.text.toLocaleLowerCase("pl").includes(q)) ||
        itemKey(i).toLowerCase().includes(q),
    )
    .sort((a, b) => {
      if (sortBy === "priority") return PRIORITY_RANK[priorityOf(a)] - PRIORITY_RANK[priorityOf(b)] || a.order - b.order;
      if (sortBy === "due") return (a.due ?? Infinity) - (b.due ?? Infinity) || a.order - b.order;
      return a.order - b.order;
    });

  const filterParent = epicFilter && epicFilter !== NO_EPIC && tree.byId.has(epicFilter) ? epicFilter : "";
  const counts = (s: WorkStatus) => tasks.filter((t) => t.status === s).length;

  return (
    <div className="jira">
      <EpicPanel
        tree={tree}
        now={now}
        selected={epicFilter}
        onSelect={setEpicFilter}
        onOpen={onOpen}
        onCreate={onCreate}
        onPin={(e) => onPatch(e, { pinned: !e.pinned })}
        noEpicCount={all.filter((i) => i.kind === "task" && !parentOf(i)).length}
        taskCount={all.filter((i) => i.kind === "task").length}
      />

      <section className="jr-main">
        <header className="jr-head">
          <div className="jr-crumbs">
            zadania
            {filterParent && <> / {epicPath(filterParent, tree.byId)}</>}
            {epicFilter === NO_EPIC && <> / bez epiku</>}
          </div>
          <div className="jr-title-row">
            <h2>{tab === "list" ? "lista" : "tablica"}</h2>
            <div className="seg" role="tablist" aria-label="Widok zadań">
              {(["list", "board"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? "on" : ""}
                  onClick={() => setTab(t)}
                >
                  {t === "list" ? "lista" : "tablica"}
                </button>
              ))}
            </div>
            <span className="jr-counts">
              {counts("todo")} do zrobienia · {counts("doing")} w toku · {counts("done")} zrobione
            </span>
            <HelpButton />
          </div>
          <div className="jr-toolbar">
            <input
              className="jr-search"
              type="search"
              value={query}
              placeholder="Szukaj w zadaniach"
              aria-label="Szukaj w zadaniach"
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* telefon: panel epików schowany — filtr jako lista */}
            <select
              className="jr-epic-select"
              aria-label="Epik"
              value={epicFilter}
              onChange={(e) => setEpicFilter(e.target.value)}
            >
              <option value="">wszystkie epiki</option>
              <option value={NO_EPIC}>bez epiku</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {epicPath(e.id, tree.byId)}
                </option>
              ))}
            </select>
            {tab === "list" && (
              <label className="jr-pick">
                grupuj
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
                  <option value="epic">epik</option>
                  <option value="status">status</option>
                  <option value="priority">priorytet</option>
                  <option value="none">bez grup</option>
                </select>
              </label>
            )}
            <label className="jr-pick">
              sortuj
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                <option value="rank">kolejność</option>
                <option value="priority">priorytet</option>
                <option value="due">termin</option>
              </select>
            </label>
            {tab === "list" && (
              <label className="jr-check">
                <input type="checkbox" checked={hideDone === "1"} onChange={(e) => setHideDone(e.target.checked ? "1" : "0")} />
                ukryj zrobione
              </label>
            )}
            <button type="button" className="jr-btn" onClick={onEditFields}>
              pola
            </button>
          </div>
        </header>

        {tab === "list" ? (
          <ListView
            tree={tree}
            now={now}
            tasks={hideDone === "1" ? tasks.filter((t) => t.status !== "done") : tasks}
            groupBy={groupBy}
            epicFilter={epicFilter}
            scope={scope}
            hasQuery={Boolean(q)}
            parentOf={parentOf}
            onOpen={onOpen}
            onCreate={onCreate}
            onPatch={onPatch}
            onOpenEvent={onOpenEvent}
          />
        ) : (
          <BoardView
            tree={tree}
            now={now}
            tasks={tasks}
            showEpic={!filterParent}
            parentId={filterParent}
            onOpen={onOpen}
            onCreate={onCreate}
            onPatch={onPatch}
          />
        )}
      </section>
    </div>
  );
}

/* ───────────── panel epików ───────────── */

function EpicPanel({
  tree,
  now,
  selected,
  onSelect,
  onOpen,
  onCreate,
  onPin,
  noEpicCount,
  taskCount,
}: {
  tree: Tree;
  now: number;
  selected: string;
  onSelect: (id: string) => void;
  onOpen: (i: WorkItem) => void;
  onCreate: Props["onCreate"];
  onPin: (e: WorkItem) => void;
  noEpicCount: number;
  taskCount: number;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const rows = (parent: string, depth: number): ReactNode =>
    (tree.children.get(parent) ?? [])
      .filter((i) => i.kind === "epic")
      .map((e) => {
        const p = progressOf(e.id, tree, now);
        return (
          <li key={e.id}>
            <div
              className={`jr-epic${selected === e.id ? " on" : ""}${e.status === "done" ? " done" : ""}`}
              style={{ ["--depth" as string]: depth, ["--epic" as string]: epicColor(e.id) }}
            >
              <button type="button" className="jr-epic-pick" onClick={() => onSelect(selected === e.id ? "" : e.id)}>
                <span className="jr-epic-name">{e.title || "(bez nazwy)"}</span>
                <ProgressBar p={p} small />
              </button>
              <button
                type="button"
                className={`jr-epic-open jr-epic-pin${e.pinned ? " on" : ""}`}
                aria-pressed={Boolean(e.pinned)}
                title={e.pinned ? "Odepnij z panelu bocznego" : "Przypnij w panelu bocznym"}
                aria-label={`${e.pinned ? "Odepnij" : "Przypnij"}: ${e.title}`}
                onClick={() => onPin(e)}
              >
                <PinIcon />
              </button>
              <button
                type="button"
                className="jr-epic-open"
                title="Szczegóły epiku"
                aria-label={`Szczegóły: ${e.title}`}
                onClick={() => onOpen(e)}
              >
                ⋯
              </button>
            </div>
            <ul>{rows(e.id, depth + 1)}</ul>
          </li>
        );
      });

  return (
    <aside className="jr-epics" aria-label="Epiki">
      <header>
        <h3>epiki</h3>
        <button type="button" className="jr-btn" onClick={() => setAdding((a) => !a)}>
          + epik
        </button>
      </header>
      {adding && (
        <form
          className="jr-epic-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate("epic", name, "");
            setName("");
            setAdding(false);
          }}
        >
          <input
            autoFocus
            value={name}
            placeholder="Nazwa epiku — Enter"
            aria-label="Nazwa nowego epiku"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAdding(false);
            }}
          />
        </form>
      )}
      <button type="button" className={`jr-epic-all${selected === "" ? " on" : ""}`} onClick={() => onSelect("")}>
        wszystkie zadania <span>{taskCount}</span>
      </button>
      <ul className="jr-epic-list">{rows("", 0)}</ul>
      <button
        type="button"
        className={`jr-epic-all${selected === NO_EPIC ? " on" : ""}`}
        onClick={() => onSelect(selected === NO_EPIC ? "" : NO_EPIC)}
      >
        bez epiku <span>{noEpicCount}</span>
      </button>
    </aside>
  );
}

/* ───────────── lista ───────────── */

type Group = {
  key: string;
  epic?: WorkItem;
  label?: string;
  status?: WorkStatus;
  priority?: Priority;
  items: WorkItem[];
};

function ListView({
  tree,
  now,
  tasks,
  groupBy,
  epicFilter,
  scope,
  hasQuery,
  parentOf,
  onOpen,
  onCreate,
  onPatch,
  onOpenEvent,
}: {
  tree: Tree;
  now: number;
  tasks: WorkItem[];
  groupBy: GroupBy;
  epicFilter: string;
  scope: Set<string> | null;
  hasQuery: boolean;
  parentOf: (i: WorkItem) => string;
  onOpen: Props["onOpen"];
  onCreate: Props["onCreate"];
  onPatch: Props["onPatch"];
  onOpenEvent: Props["onOpenEvent"];
}) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const fold = (k: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const groups: Group[] = [];
  if (groupBy === "epic") {
    // epiki w kolejności drzewa (rodzic, potem jego pod-epiki)
    const walk = (parent: string) => {
      for (const e of tree.children.get(parent) ?? []) {
        if (e.kind !== "epic") continue;
        if (!scope || scope.has(e.id)) {
          groups.push({
            key: e.id,
            epic: e,
            items: tasks.filter((t) => parentOf(t) === e.id),
          });
        }
        walk(e.id);
      }
    };
    if (epicFilter !== NO_EPIC) walk("");
    if (!scope) groups.push({ key: "", label: "bez epiku", items: tasks.filter((t) => !parentOf(t)) });
    // przy szukaniu chowamy puste grupy
    if (hasQuery) for (let i = groups.length - 1; i >= 0; i--) if (!groups[i].items.length) groups.splice(i, 1);
  } else if (groupBy === "status") {
    for (const s of STATUSES) {
      groups.push({ key: s, status: s, label: STATUS_LABEL[s], items: tasks.filter((t) => t.status === s) });
    }
  } else if (groupBy === "priority") {
    for (const p of PRIORITIES) {
      groups.push({ key: p, priority: p, items: tasks.filter((t) => priorityOf(t) === p) });
    }
  } else {
    groups.push({ key: "all", items: tasks });
  }

  // nowe zadanie poza grupą epiku trafia do wybranego w panelu epiku
  const defaultParent = scope && epicFilter ? epicFilter : "";

  if (!tree.byId.size) {
    return (
      <div className="jr-empty">
        <p className="hint">
          Epik to większa sprawa (np. „remont kuchni”), a w nim zadania i mniejsze epiki. Zadanie może mieć termin
          w kalendarzu. Zacznij od „+ epik” po lewej albo dodaj zadanie poniżej. Wpis z kalendarza dodasz do epiku
          w jego oknie (pole „Epik”) — w epiku pojawi się jako zadanie.
        </p>
        <InlineCreate parentId="" onCreate={onCreate} />
      </div>
    );
  }

  return (
    <div className="jr-list" role="table" aria-label="Zadania">
      <div className={`jr-row jr-th${groupBy === "epic" ? " no-epic" : ""}`} role="row">
        <span role="columnheader" className="c-type" aria-label="Typ" />
        <span role="columnheader" className="c-key">
          klucz
        </span>
        <span role="columnheader" className="c-sum">
          podsumowanie
        </span>
        {groupBy !== "epic" && (
          <span role="columnheader" className="c-epic">
            epik
          </span>
        )}
        <span role="columnheader" className="c-prio">
          prio.
        </span>
        <span role="columnheader" className="c-due">
          termin
        </span>
        <span role="columnheader" className="c-est">
          szac.
        </span>
        <span role="columnheader" className="c-status">
          status
        </span>
      </div>
      {groups.map((g) => {
        const isFolded = folded.has(g.key);
        const p = g.epic ? progressOf(g.epic.id, tree, now) : null;
        const createParent = g.epic ? g.epic.id : groupBy === "epic" ? "" : defaultParent;
        return (
          <div key={g.key || "none"} className="jr-group" role="rowgroup">
            {groupBy !== "none" && (
              <div className="jr-group-head" style={g.epic ? { ["--epic" as string]: epicColor(g.epic.id) } : undefined}>
                <button
                  type="button"
                  className={`wk-fold${isFolded ? "" : " open"}`}
                  aria-expanded={!isFolded}
                  aria-label="Zwiń / rozwiń grupę"
                  onClick={() => fold(g.key)}
                >
                  ▸
                </button>
                {g.epic ? (
                  <>
                    <TypeIcon kind="epic" />
                    <button type="button" className="jr-group-title" onClick={() => onOpen(g.epic!)}>
                      <span className="jr-key">{itemKey(g.epic)}</span>
                      <span className="jr-group-name">{epicPath(g.epic.id, tree.byId)}</span>
                    </button>
                    <StatusSelect item={g.epic} onPatch={onPatch} />
                    {p && <ProgressBar p={p} />}
                    <Remaining id={g.epic.id} tree={tree} now={now} />
                  </>
                ) : (
                  <span className="jr-group-title plain">
                    {g.status && <span className={`jr-lozenge st-${g.status}`}>{g.label}</span>}
                    {g.priority && <PriorityIcon p={g.priority} withLabel />}
                    {!g.status && !g.priority && g.label}
                  </span>
                )}
                <span className="jr-group-count">{g.items.length}</span>
              </div>
            )}
            {!isFolded && (
              <>
                {g.items.map((t) => (
                  <div key={t.id} className={`jr-row st-${t.status}${groupBy === "epic" ? " no-epic" : ""}`} role="row">
                    <span className="c-type">
                      <TypeIcon kind="task" />
                    </span>
                    <span className="c-key jr-key">{itemKey(t)}</span>
                    <span className="c-sum jr-sum-cell">
                      <button type="button" className="jr-sum" onClick={() => onOpen(t)}>
                        <span>{t.title || "(bez nazwy)"}</span>
                        {t.description.trim() && (
                          <span className="wk-has-desc" title="Ma opis">
                            ≡
                          </span>
                        )}
                        <CommentCount item={t} />
                      </button>
                      <WhenChip task={t} tree={tree} now={now} onOpenEvent={onOpenEvent} />
                    </span>
                    {groupBy !== "epic" && (
                      <span className="c-epic">
                        <EpicLozenge tree={tree} id={parentOf(t)} />
                      </span>
                    )}
                    <span className="c-prio">
                      <PriorityIcon p={priorityOf(t)} />
                    </span>
                    <span className={`c-due${isOverdue(t, now) ? " overdue" : ""}`}>
                      {t.due ? formatDayShort(new Date(t.due)) : ""}
                    </span>
                    <span className="c-est">{t.estimate ?? ""}</span>
                    <span className="c-status">
                      <StatusSelect item={t} onPatch={onPatch} />
                    </span>
                  </div>
                ))}
                <InlineCreate
                  parentId={createParent}
                  patch={g.status ? { status: g.status } : g.priority ? { priority: g.priority } : undefined}
                  onCreate={onCreate}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── tablica ───────────── */

function BoardView({
  tree,
  now,
  tasks,
  showEpic,
  parentId,
  onOpen,
  onCreate,
  onPatch,
}: {
  tree: Tree;
  now: number;
  tasks: WorkItem[];
  showEpic: boolean;
  parentId: string;
  onOpen: Props["onOpen"];
  onCreate: Props["onCreate"];
  onPatch: Props["onPatch"];
}) {
  const [over, setOver] = useState<WorkStatus | null>(null);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="jr-board">
      {STATUSES.map((s) => {
        const col = tasks.filter((t) => t.status === s);
        return (
          <section
            key={s}
            className={`jr-col${over === s ? " over" : ""}`}
            aria-label={STATUS_LABEL[s]}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== s) setOver(s);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const t = byId.get(e.dataTransfer.getData("text/plain"));
              if (t && t.status !== s) onPatch(t, { status: s });
            }}
          >
            <header>
              <span className={`jr-lozenge st-${s}`}>{STATUS_LABEL[s]}</span>
              <span className="jr-col-count">{col.length}</span>
            </header>
            <div className="jr-cards">
              {col.map((t) => (
                <article
                  key={t.id}
                  className={`jr-card st-${t.status}`}
                  draggable
                  tabIndex={0}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", t.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onOpen(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(t);
                  }}
                >
                  <div className="jr-card-title">{t.title || "(bez nazwy)"}</div>
                  {showEpic && <EpicLozenge tree={tree} id={t.parentId} />}
                  <WhenChip task={t} tree={tree} now={now} />
                  <div className="jr-card-foot">
                    <TypeIcon kind="task" />
                    <span className="jr-key">{itemKey(t)}</span>
                    {t.due ? (
                      <span className={`jr-due${isOverdue(t, now) ? " overdue" : ""}`}>{formatDayShort(new Date(t.due))}</span>
                    ) : null}
                    <span className="jr-card-right">
                      <CommentCount item={t} />
                      {t.estimate != null && <span className="jr-est">{t.estimate}</span>}
                      <PriorityIcon p={priorityOf(t)} />
                    </span>
                  </div>
                </article>
              ))}
              <InlineCreate parentId={parentId} patch={{ status: s }} onCreate={onCreate} compact />
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ───────────── drobne ───────────── */

export function TypeIcon({ kind }: { kind: WorkKind }) {
  return (
    <span className={`jr-type ${kind}`} title={kind === "epic" ? "Epik" : "Zadanie"} aria-label={kind === "epic" ? "Epik" : "Zadanie"}>
      {kind === "epic" ? "ϟ" : "✓"}
    </span>
  );
}

export function PriorityIcon({ p, withLabel = false }: { p: Priority; withLabel?: boolean }) {
  return (
    <span className={`jr-prio p-${p}`} title={`Priorytet: ${PRIORITY_LABEL[p]}`}>
      <b aria-hidden>{PRIORITY_ICON[p]}</b>
      {withLabel ? ` ${PRIORITY_LABEL[p]}` : <span className="sr-only">{PRIORITY_LABEL[p]}</span>}
    </span>
  );
}

export function StatusSelect({ item, onPatch }: { item: WorkItem; onPatch: Props["onPatch"] }) {
  return (
    <select
      className={`jr-lozenge jr-status st-${item.status}`}
      aria-label={`Status: ${item.title}`}
      value={item.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onPatch(item, { status: e.target.value as WorkStatus })}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

function EpicLozenge({ tree, id }: { tree: Tree; id: string }) {
  const e = id ? tree.byId.get(id) : undefined;
  if (!e) return null;
  return (
    <span className="epic-tag" style={{ ["--epic" as string]: epicColor(e.id) }} title={`Epik: ${epicPath(e.id, tree.byId)}`}>
      {e.title}
    </span>
  );
}

export function ProgressBar({ p, small = false }: { p: Progress; small?: boolean }) {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const title =
    `Zadania: ${p.tasksDone}/${p.tasks} zrobione` + (p.events ? ` · wpisy w kalendarzu: ${p.eventsDone}/${p.events} odbyte` : "");
  return (
    <span className={`wk-progress${small ? " small" : ""}`} title={title} aria-label={`Postęp ${pct}% (${title})`}>
      <span className="wk-bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      {!small && <span className="wk-pct">{p.total ? `${p.done}/${p.total}` : "—"}</span>}
    </span>
  );
}

/** „+ utwórz” — jak w Jirze: kliknięcie zamienia się w pole, Enter tworzy zadanie (pole zostaje na kolejne). */
export function InlineCreate({
  parentId,
  patch,
  onCreate,
  compact = false,
}: {
  parentId: string;
  patch?: Partial<WorkItem>;
  onCreate: Props["onCreate"];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button type="button" className={`jr-create${compact ? " compact" : ""}`} onClick={() => setOpen(true)}>
        + utwórz
      </button>
    );
  }
  return (
    <form
      className={`jr-create-form${compact ? " compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onCreate("task", text, parentId, patch);
        setText("");
      }}
    >
      <input
        autoFocus
        value={text}
        placeholder="Co trzeba zrobić? Enter dodaje"
        aria-label="Nazwa nowego zadania"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setText("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!text.trim()) setOpen(false);
        }}
      />
    </form>
  );
}

/** Dymek z liczbą komentarzy (nic, gdy ich brak). */
export function CommentCount({ item }: { item: WorkItem }) {
  const n = item.comments?.length ?? 0;
  if (!n) return null;
  return (
    <span className="jr-comments" title={`Komentarze: ${n}`}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path
          d="M3 2.5h10a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3.5 3v-3H3A1.5 1.5 0 0 1 1.5 10V4A1.5 1.5 0 0 1 3 2.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {n}
    </span>
  );
}

/** Pinezka (przypięcie epiku w panelu bocznym). */
export function PinIcon() {
  return (
    <svg className="pin-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden>
      <path
        d="M9.8 1.8l4.4 4.4-1.6.5-2.3 2.3.3 3.2-1.2 1.2-2.6-2.6-3.6 3.6-.7-.7 3.6-3.6-2.6-2.6 1.2-1.2 3.2.3 2.3-2.3z"
        fill="currentColor"
      />
    </svg>
  );
}

/** ◷ kiedy jest wpis zadania w kalendarzu (seria: ↻ najbliższe wystąpienie). Z `onOpenEvent` — klikalne. */
function WhenChip({
  task,
  tree,
  now,
  onOpenEvent,
}: {
  task: WorkItem;
  tree: Tree;
  now: number;
  onOpenEvent?: (e: CalEvent) => void;
}) {
  const e = taskWhen(task.id, tree, now);
  if (!e) return null;
  const label = `${task.seriesId ? "↻" : "◷"} ${whenShort(e, now)}${e.estimate ? ` · ${estimateLabel(e.estimate)}` : ""}`;
  const past = e.end < now;
  if (!onOpenEvent) return <span className={`jr-when static${past ? " past" : ""}`}>{label}</span>;
  return (
    <button
      type="button"
      className={`jr-when${past ? " past" : ""}`}
      title={`Wpis w kalendarzu: ${whenLabel(e)}`}
      onClick={() => onOpenEvent(e)}
    >
      {label}
    </button>
  );
}

/** „?” w widoku zadań: krótko, jak działają epiki. */
function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <span className="jr-help-wrap">
      <button
        type="button"
        className={`jr-help-btn${open ? " on" : ""}`}
        aria-expanded={open}
        aria-label="Jak działają epiki"
        title="Jak działają epiki"
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div className="jr-help" role="note">
          <button type="button" className="sheet-x" aria-label="Zamknij" onClick={() => setOpen(false)}>
            ×
          </button>
          <h3>jak działają epiki</h3>
          <ul>
            <li>
              <b>Epik</b> to większa sprawa. W środku są <b>zadania</b> i mniejsze epiki.
            </li>
            <li>
              Zadanie <b>może</b> mieć termin w kalendarzu (◷), ale nie musi. „+ zaplanuj” w szczegółach zadania tworzy
              powiązany wpis.
            </li>
            <li>
              <b>Dowolny wpis</b> z kalendarza dodasz do epiku polem „Epik” we wpisie — w epiku pojawi się jako zadanie
              z datą, ze statusem, priorytetem i komentarzami.
            </li>
            <li>
              Status zadania z wpisem zmienia się <b>sam</b>: „zrobione”, gdy wpis się skończy. Zmienisz go ręcznie — wtedy
              zostaje Twój.
            </li>
            <li>Wpis powtarzalny to jedno zadanie dla całej serii (↻), ze statusem ręcznym.</li>
            <li>Postęp epiku = zrobione zadania (razem z pod-epikami).</li>
            <li>
              Usunięcie wpisu zostawia zadanie bez terminu. Usunięcie zadania zostawia wpis bez epiku. Wyjęcie wpisu z
              epiku usuwa jego zadanie.
            </li>
            <li>Nazwa i epik zadania i jego wpisu zmieniają się razem.</li>
          </ul>
        </div>
      )}
    </span>
  );
}

/** „zostało ~3h 35min” — suma estymat wpisów niezrobionych zadań epiku (nic, gdy brak estymat). */
export function Remaining({ id, tree, now }: { id: string; tree: Tree; now: number }) {
  const r = remainingEstimate(id, tree, now);
  if (!r.minutes) return null;
  return (
    <span className="jr-remaining" title={`Zostało wg estymat ${r.tasks} ${r.tasks === 1 ? "wpisu" : "wpisów"} w kalendarzu`}>
      zostało ~{formatMinutes(r.minutes)}
    </span>
  );
}
