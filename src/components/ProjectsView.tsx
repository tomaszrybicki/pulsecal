/**
 * Widok „projekty”: grafika projektu (auto, człowiek albo własna, z rozmiarem) i epiki położone wokół niej — swobodnie przeciągane,
 * z opcjonalną łamaną strzałką do punktu na grafice. Postęp projektu (suma zrobionych zadań w epikach)
 * wypełnia grafikę kolorem.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from "react";
import type { NoticeAction } from "../hooks/useGoogleSync";
import {
  ARTS,
  CANVAS_H,
  CANVAS_W,
  CARD_W,
  ART_CENTER,
  artBox,
  artInfo,
  changeProject,
  clamp,
  clampArtScale,
  clampPin,
  defaultArrowTarget,
  elbowPath,
  ensureStarterProjects,
  freeSlot,
  getActiveProject,
  newProject,
  projectProgress,
  saveProject,
  scaleAboutArt,
  setActiveProject,
} from "../projects";
import { dropProjectImage, uploadProjectImage } from "../imageUpload";
import type { Project, ProjectArtKind } from "../types";
import { epicColor, epicOptions, progressColor, progressOf, type Tree } from "../work";
import { EpicPicker } from "./EpicPicker";
import { ProjectArt } from "./ProjectArt";

type Props = {
  projects: Project[];
  tree: Tree;
  now: number;
  onOpenEpic: (id: string) => void;
  onCreateEpic: (name: string) => string;
  /** Po każdej zmianie: synchronizacja z Google. */
  onChanged: () => void;
  notify: (text: string, tone?: "ok" | "warn" | "error", action?: NoticeAction) => void;
};

type Pt = { x: number; y: number };
type DragKind = "card" | "arrow" | "art";
type Notify = Props["notify"];

export function ProjectsView({ projects, tree, now, onOpenEpic, onCreateEpic, onChanged, notify }: Props) {
  useEffect(() => {
    void ensureStarterProjects();
  }, []);

  const sorted = useMemo(() => [...projects].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt), [projects]);
  const [activeId, setActiveId] = useState(getActiveProject);
  const active = sorted.find((p) => p.id === activeId) ?? sorted[0];
  const pick = (id: string) => {
    setActiveId(id);
    setActiveProject(id);
  };

  const [creating, setCreating] = useState(false);
  const create = async (title: string, art: ProjectArtKind, file: File | null) => {
    let p = newProject(title || (art === "car" ? "Auto" : art === "person" ? "Ja" : "Projekt"), art);
    if (art === "custom") {
      if (!file) return notify("Wybierz plik z grafiką", "warn");
      try {
        p = { ...p, image: await uploadProjectImage(file) };
      } catch (err) {
        return notify(err instanceof Error ? err.message : "Nie udało się wczytać grafiki", "error");
      }
    }
    await saveProject(p);
    pick(p.id);
    setCreating(false);
    onChanged();
  };

  return (
    <section className="projects-view" aria-label="Projekty">
      <div className="projects-inner">
        <header className="pj-bar">
          <h2>projekty</h2>
          <div className="pj-chips" role="tablist" aria-label="Projekt">
            {sorted.map((p) => {
              const pr = projectProgress(p, tree, now);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={p.id === active?.id}
                  className={`pj-chip${p.id === active?.id ? " on" : ""}`}
                  onClick={() => pick(p.id)}
                >
                  <span aria-hidden>{artInfo(p.art).icon}</span>
                  {p.title || "bez nazwy"}
                  {pr.total > 0 && (
                    <span className="pj-chip-pct" style={{ color: progressColor(pr.ratio) }}>
                      {pr.ratio >= 1 ? "✓" : `${Math.round(pr.ratio * 100)}%`}
                    </span>
                  )}
                </button>
              );
            })}
            <button type="button" className="pj-chip pj-chip-new" aria-expanded={creating} onClick={() => setCreating((c) => !c)}>
              + projekt
            </button>
          </div>
        </header>

        {creating && <NewProject onCreate={(t, a, f) => void create(t, a, f)} onCancel={() => setCreating(false)} />}

        {active ? (
          <ProjectBoard
            key={active.id}
            project={active}
            tree={tree}
            now={now}
            onOpenEpic={onOpenEpic}
            onCreateEpic={onCreateEpic}
            onChanged={onChanged}
            notify={notify}
            onDelete={() => {
              const snap = active;
              void changeProject(snap.id, (p) => ({ ...p, deleted: true }));
              onChanged();
              notify(`Usunięto projekt „${snap.title}” (epiki zostają)`, "ok", {
                label: "Cofnij",
                run: () => {
                  void saveProject({ ...snap, deleted: false });
                  pick(snap.id);
                  onChanged();
                },
              });
            }}
          />
        ) : (
          !creating && (
            <p className="pj-empty">
              Projekt to grafika z opisem i epiki rozłożone wokół niej.{" "}
              <button type="button" className="link-btn" onClick={() => setCreating(true)}>
                Utwórz pierwszy projekt
              </button>
            </p>
          )
        )}
      </div>
    </section>
  );
}

function NewProject({
  onCreate,
  onCancel,
}: {
  onCreate: (title: string, art: ProjectArtKind, file: File | null) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [art, setArt] = useState<ProjectArtKind>("car");
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="pj-new"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(title.trim(), art, file);
      }}
    >
      <input autoFocus value={title} placeholder="Nazwa projektu, np. Auto" aria-label="Nazwa projektu" onChange={(e) => setTitle(e.target.value)} />
      <ArtSwitch value={art} onChange={setArt} onCustom={() => input.current?.click()} customLabel={file ? file.name : undefined} />
      <ImageInput
        ref={input}
        onFile={(f) => {
          setFile(f);
          setArt("custom");
        }}
      />
      <button type="submit" className="pj-btn primary">
        utwórz
      </button>
      <button type="button" className="pj-btn" onClick={onCancel}>
        anuluj
      </button>
    </form>
  );
}

/** Ukryte pole wyboru pliku (otwierane przyciskiem „własna…”). */
function ImageInput({ ref, onFile }: { ref: Ref<HTMLInputElement>; onFile: (f: File) => void }) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onFile(f);
      }}
    />
  );
}

/**
 * Wybór grafiki: wbudowane (auto, człowiek) + „własna”. `onCustom` = wybór pliku; gdy projekt ma już własną
 * grafikę (`hasCustom`), „własna” wraca do niej, a plik zmienia osobny przycisk.
 */
function ArtSwitch({
  value,
  onChange,
  onCustom,
  hasCustom = false,
  customLabel,
}: {
  value: ProjectArtKind;
  onChange: (a: ProjectArtKind) => void;
  onCustom: () => void;
  hasCustom?: boolean;
  customLabel?: string;
}) {
  return (
    <div className="seg pj-art-seg" role="radiogroup" aria-label="Grafika">
      {ARTS.map((a) => (
        <button
          key={a.kind}
          type="button"
          role="radio"
          aria-checked={value === a.kind}
          className={value === a.kind ? "on" : ""}
          onClick={() => onChange(a.kind)}
        >
          {a.icon} {a.label}
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={value === "custom"}
        className={`pj-custom-btn${value === "custom" ? " on" : ""}`}
        title={hasCustom ? "Twoja grafika" : "Wgraj własną grafikę (zdjęcie, rysunek, PNG z przezroczystym tłem)"}
        onClick={() => (hasCustom ? onChange("custom") : onCustom())}
      >
        🖼️ {customLabel ?? (hasCustom ? "własna" : "własna…")}
      </button>
    </div>
  );
}

type BoardProps = {
  project: Project;
  tree: Tree;
  now: number;
  onOpenEpic: (id: string) => void;
  onCreateEpic: (name: string) => string;
  onChanged: () => void;
  notify: Notify;
  onDelete: () => void;
};

function ProjectBoard({ project, tree, now, onOpenEpic, onCreateEpic, onChanged, notify, onDelete }: BoardProps) {
  const progress = projectProgress(project, tree, now);
  const change = (fn: (p: Project) => Project) => {
    void changeProject(project.id, fn);
    onChanged();
  };

  // tytuł i opis: edycja lokalnie, zapis po wyjściu z pola
  const [title, setTitle] = useState(project.title);
  const [desc, setDesc] = useState(project.description);
  useEffect(() => setTitle(project.title), [project.title]);
  useEffect(() => setDesc(project.description), [project.description]);
  const saveText = () => {
    const t = title.trim() || project.title;
    if (t !== project.title || desc !== project.description) change((p) => ({ ...p, title: t, description: desc }));
    if (!title.trim()) setTitle(project.title);
  };

  // skala płótna: całe płótno mieści się w szerokości (na telefonie nie mniej niż 0.5 — wtedy przewijanie w bok)
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(clamp(el.clientWidth / CANVAS_W, 0.5, 1.2));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // wysokości kart (do zaczepienia strzałek)
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [heights, setHeights] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    let changed = false;
    const next: Record<string, number> = {};
    for (const [id, el] of cards.current) {
      next[id] = el.offsetHeight;
      if (Math.abs((heights[id] ?? 0) - next[id]) > 1) changed = true;
    }
    if (changed) setHeights(next);
  });

  // przeciąganie kart i końców strzałek; po upuszczeniu pozycja zostaje, dopóki baza jej nie potwierdzi
  const dragRef = useRef<{ kind: DragKind; epicId: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<({ kind: DragKind; epicId: string } & Pt) | null>(null);
  const [held, setHeld] = useState<Record<string, Pt>>({});
  useEffect(() => {
    setHeld((h) => {
      const keep: Record<string, Pt> = {};
      for (const [k, v] of Object.entries(h)) {
        const [kind, id] = k.split("|");
        const pin = project.pins.find((p) => p.epicId === id);
        const cur = kind === "card" ? pin : pin?.arrow;
        if (cur && (Math.abs(cur.x - v.x) > 0.5 || Math.abs(cur.y - v.y) > 0.5)) keep[k] = v;
      }
      return Object.keys(keep).length === Object.keys(h).length ? h : keep;
    });
  }, [project.pins]);

  // rozmiar grafiki: podczas przeciągania uchwytu (i chwilę po, dopóki baza nie potwierdzi) — artLive
  const savedScale = project.artScale ?? 1;
  const [artLive, setArtLive] = useState<number | null>(null);
  const artScale = artLive ?? savedScale;
  const artFactor = artScale / savedScale;
  useEffect(() => {
    if (artLive !== null && dragRef.current?.kind !== "art" && Math.abs(savedScale - artLive) < 0.005) setArtLive(null);
  }, [savedScale, artLive]);

  const posOf = (kind: DragKind, epicId: string, stored: Pt): Pt => {
    if (drag && drag.kind === kind && drag.epicId === epicId) return drag;
    const p = held[`${kind}|${epicId}`] ?? stored;
    // końce strzałek rosną / maleją razem z grafiką
    return kind === "arrow" && artFactor !== 1 ? scaleAboutArt(p, artFactor) : p;
  };

  /** Zapis nowego rozmiaru grafiki; końce strzałek zostają w tym samym miejscu grafiki. */
  const commitScale = (s: number) => {
    if (Math.abs(s - savedScale) < 0.005) {
      setArtLive(null);
      return;
    }
    setArtLive(s);
    change((cur) => {
      const f = s / (cur.artScale ?? 1);
      return { ...cur, artScale: s, pins: cur.pins.map((x) => (x.arrow ? { ...x, arrow: scaleAboutArt(x.arrow, f) } : x)) };
    });
  };

  const artAt = (e: ReactPointerEvent, d: NonNullable<typeof dragRef.current>): number => {
    const x = d.ox + (e.clientX - d.sx) / scale;
    const y = d.oy + (e.clientY - d.sy) / scale;
    const d0 = Math.hypot(d.ox - ART_CENTER.x, d.oy - ART_CENTER.y) || 1;
    return clampArtScale(project, savedScale * (Math.hypot(x - ART_CENTER.x, y - ART_CENTER.y) / d0));
  };

  const dragTo = (e: ReactPointerEvent, d: NonNullable<typeof dragRef.current>): Pt => {
    const x = d.ox + (e.clientX - d.sx) / scale;
    const y = d.oy + (e.clientY - d.sy) / scale;
    return d.kind === "card" ? clampPin(x, y) : { x: Math.round(clamp(x, 0, CANVAS_W)), y: Math.round(clamp(y, 0, CANVAS_H)) };
  };

  const startDrag = (e: ReactPointerEvent<Element>, kind: DragKind, epicId: string, at: Pt) => {
    if (e.button !== 0) return;
    if (kind === "card" && (e.target as Element).closest("button")) return;
    if (kind === "art") e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind, epicId, sx: e.clientX, sy: e.clientY, ox: at.x, oy: at.y, moved: false };
  };
  const moveDrag = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    d.moved = true;
    if (d.kind === "art") setArtLive(artAt(e, d));
    else setDrag({ kind: d.kind, epicId: d.epicId, ...dragTo(e, d) });
  };
  const endDrag = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) {
      if (d.kind === "card") onOpenEpic(d.epicId);
      return;
    }
    if (d.kind === "art") {
      commitScale(artAt(e, d));
      return;
    }
    const p = dragTo(e, d);
    const at = { x: Math.round(p.x), y: Math.round(p.y) };
    setHeld((h) => ({ ...h, [`${d.kind}|${d.epicId}`]: at }));
    change((cur) => ({
      ...cur,
      pins: cur.pins.map((x) => (x.epicId !== d.epicId ? x : d.kind === "card" ? { ...x, ...at } : { ...x, arrow: at })),
    }));
  };
  const cancelDrag = () => {
    if (dragRef.current?.kind === "art") setArtLive(null);
    dragRef.current = null;
    setDrag(null);
  };

  // własna grafika: wybór pliku → zmniejszony obraz; poprzedni plik znika, jeśli nikt go nie używa
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const image = await uploadProjectImage(file);
      const old = project.image?.id;
      await changeProject(project.id, (p) => ({ ...p, art: "custom", image, artScale: 1 }));
      onChanged();
      if (old && old !== image.id) await dropProjectImage(old);
      notify("Grafika wgrana. Rozmiar zmienisz uchwytem w rogu grafiki.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Nie udało się wczytać grafiki", "error");
    } finally {
      setUploading(false);
    }
  };

  const pinned = new Set(project.pins.map((p) => p.epicId));
  const addEpic = (id: string | undefined) => {
    if (!id || pinned.has(id)) return;
    change((cur) => (cur.pins.some((x) => x.epicId === id) ? cur : { ...cur, pins: [...cur.pins, { epicId: id, ...freeSlot(cur.pins), arrow: null }] }));
  };
  const toggleArrow = (epicId: string, card: Pt) =>
    change((cur) => ({
      ...cur,
      pins: cur.pins.map((x) => (x.epicId !== epicId ? x : { ...x, arrow: x.arrow ? null : defaultArrowTarget(cur, card) })),
    }));
  const removePin = (epicId: string) => change((cur) => ({ ...cur, pins: cur.pins.filter((x) => x.epicId !== epicId) }));

  const box = artBox(project, artScale);
  const done = progress.total > 0 && progress.ratio >= 1;

  return (
    <div className="pj-main">
      <div className="pj-head">
        <input
          className="pj-title"
          value={title}
          aria-label="Nazwa projektu"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveText}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <div className="pj-tools">
          <ArtSwitch
            value={project.art}
            hasCustom={Boolean(project.image)}
            customLabel={uploading ? "wczytuję…" : undefined}
            onChange={(art) => change((p) => (p.art === art ? p : { ...p, art }))}
            onCustom={() => fileInput.current?.click()}
          />
          {project.image && (
            <button type="button" className="pj-btn" onClick={() => fileInput.current?.click()} title="Wgraj inną grafikę">
              zmień plik…
            </button>
          )}
          <ImageInput ref={fileInput} onFile={(f) => void onFile(f)} />
          {Math.abs(artScale - 1) > 0.005 && (
            <button type="button" className="pj-btn" onClick={() => commitScale(1)} title="Przywróć domyślny rozmiar grafiki">
              {Math.round(artScale * 100)}% ↺
            </button>
          )}
          <button type="button" className="pj-btn danger" onClick={onDelete} title="Usuń projekt (epiki i zadania zostają)">
            usuń
          </button>
        </div>
      </div>
      <textarea
        className="pj-desc"
        value={desc}
        rows={2}
        placeholder="Opis projektu: po co, kiedy będzie gotowy…"
        aria-label="Opis projektu"
        onChange={(e) => setDesc(e.target.value)}
        onBlur={saveText}
      />
      <div className={`pj-progress${done ? " done" : ""}`}>
        <span className="pj-bar-track">
          <i style={{ width: `${Math.round(progress.ratio * 100)}%`, background: progressColor(progress.ratio) }} />
        </span>
        <span className="pj-progress-text">
          {done
            ? "🏁 projekt ukończony!"
            : progress.total
              ? `${progress.done} z ${progress.total} zadań · ${Math.round(progress.ratio * 100)}%`
              : "dodaj epiki, żeby liczyć postęp"}
        </span>
      </div>

      <div className="pj-add-row">
        <EpicPicker
          className="pj-add"
          epics={epicOptions(tree, pinned)}
          onChange={addEpic}
          onCreateEpic={onCreateEpic}
          placeholder="+ połóż epik obok grafiki — wpisz nazwę, Enter"
        />
        <span className="pj-hint">Przeciągaj karty. ↗ dodaje strzałkę; jej koniec też przeciągniesz, np. na koło.</span>
      </div>

      <div className="pj-canvas-wrap" ref={wrap}>
        <div className="pj-canvas-size" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
          <div className="pj-canvas" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}>
            <div className="pj-art" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
              <ProjectArt kind={project.art} image={project.image} ratio={progress.ratio} />
            </div>
            <div
              className={`pj-art-handle${artLive !== null ? " live" : ""}`}
              style={{ left: box.x + box.w, top: box.y + box.h }}
              role="slider"
              tabIndex={0}
              aria-label="Rozmiar grafiki"
              aria-valuemin={35}
              aria-valuemax={240}
              aria-valuenow={Math.round(artScale * 100)}
              title="Przeciągnij, żeby zmienić rozmiar grafiki (strzałki zostają na swoich miejscach)"
              onPointerDown={(e) => startDrag(e, "art", "", { x: box.x + box.w, y: box.y + box.h })}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              onKeyDown={(e) => {
                const step = e.key === "ArrowUp" || e.key === "ArrowRight" ? 0.05 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -0.05 : 0;
                if (!step) return;
                e.preventDefault();
                commitScale(clampArtScale(project, artScale + step));
              }}
            >
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="M11 4V11H4M11 11L6 6" />
              </svg>
            </div>

            <svg className="pj-arrows" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} width={CANVAS_W} height={CANVAS_H} aria-hidden>
              <defs>
                <marker id="pj-head" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path className="pj-head" d="M0 0.8L9.5 5L0 9.2Z" />
                </marker>
              </defs>
              {project.pins.map((pin) => {
                if (!pin.arrow) return null;
                const c = posOf("card", pin.epicId, pin);
                const t = posOf("arrow", pin.epicId, pin.arrow);
                return (
                  <g key={pin.epicId} className={`pj-arrow${drag?.epicId === pin.epicId ? " live" : ""}`}>
                    <path d={elbowPath({ ...c, h: heights[pin.epicId] ?? 60 }, t)} markerEnd="url(#pj-head)" />
                    <g
                      className="pj-target"
                      onPointerDown={(e) => startDrag(e, "arrow", pin.epicId, t)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={cancelDrag}
                    >
                      <circle className="hit" cx={t.x} cy={t.y} r={16} />
                      <circle className="ring" cx={t.x} cy={t.y} r={10} />
                    </g>
                  </g>
                );
              })}
            </svg>

            {project.pins.map((pin) => {
              const epic = tree.byId.get(pin.epicId);
              const live = epic?.kind === "epic";
              const pr = live ? progressOf(pin.epicId, tree, now) : null;
              const ratio = pr && pr.total ? pr.done / pr.total : 0;
              const at = posOf("card", pin.epicId, pin);
              return (
                <div
                  key={pin.epicId}
                  ref={(el) => {
                    if (el) cards.current.set(pin.epicId, el);
                    else cards.current.delete(pin.epicId);
                  }}
                  className={`pj-card${drag?.kind === "card" && drag.epicId === pin.epicId ? " dragging" : ""}${live ? "" : " gone"}${pr && pr.total && ratio >= 1 ? " complete" : ""}`}
                  style={{ left: at.x, top: at.y, width: CARD_W }}
                  role="button"
                  tabIndex={0}
                  aria-label={live ? `Epik ${epic.title}: otwórz` : "Usunięty epik"}
                  onPointerDown={(e) => startDrag(e, "card", pin.epicId, at)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={cancelDrag}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && live) {
                      e.preventDefault();
                      onOpenEpic(pin.epicId);
                    }
                  }}
                >
                  <div className="pj-card-top">
                    <span className="pj-dot" style={{ background: live ? epicColor(pin.epicId) : "var(--ink-faint)" }} aria-hidden />
                    <span className="pj-card-title">{live ? epic.title : "(usunięty epik)"}</span>
                    <span className="pj-card-btns">
                      {live && (
                        <button
                          type="button"
                          className={`pj-mini${pin.arrow ? " on" : ""}`}
                          aria-pressed={Boolean(pin.arrow)}
                          title={pin.arrow ? "Usuń strzałkę" : "Dodaj strzałkę do grafiki"}
                          aria-label={pin.arrow ? "Usuń strzałkę" : "Dodaj strzałkę"}
                          onClick={() => toggleArrow(pin.epicId, at)}
                        >
                          ↗
                        </button>
                      )}
                      <button
                        type="button"
                        className="pj-mini"
                        title="Zdejmij z projektu (epik zostaje)"
                        aria-label="Zdejmij z projektu"
                        onClick={() => removePin(pin.epicId)}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                  {pr && (
                    <div className="pj-card-prog">
                      <span className="pj-bar-track">
                        <i style={{ width: `${Math.round(ratio * 100)}%`, background: progressColor(ratio) }} />
                      </span>
                      <span className="pj-card-num">{pr.total ? `${pr.done}/${pr.total}` : "0 zadań"}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {project.pins.length === 0 && (
              <p className="pj-canvas-hint">
                Połóż tu epiki (pole „+ połóż epik” nad grafiką), np.{" "}
                {project.art === "car" ? "„zmień opony”, „wymień szybę”" : "„siłownia 3× w tygodniu”, „dentysta”"}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
