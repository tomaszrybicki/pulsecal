/**
 * Projekty: grafika (auto, człowiek…) + opis + epiki „położone” wokół grafiki, opcjonalnie z łamaną strzałką
 * do punktu na grafice (np. „zmień opony” → koło). Postęp projektu = zrobione zadania we wszystkich jego epikach.
 * Lokalnie tabela `projects` (Dexie v5), kopia w Google jako ukryte wpisy 2.01.2000 (sync/google.ts).
 */
import { db, newEventId } from "./db";
import { ancestorIds, progressOf, type Tree } from "./work";
import type { Project, ProjectArtKind, ProjectPin, WorkItem } from "./types";

/** Płótno projektu w jednostkach logicznych; na ekranie skalowane w całości (te same pozycje na każdym urządzeniu). */
export const CANVAS_W = 1000;
export const CANVAS_H = 660;
/** Szerokość karty epiku na płótnie. */
export const CARD_W = 184;

export const ARTS: { kind: ProjectArtKind; label: string; icon: string }[] = [
  { kind: "car", label: "auto", icon: "🚗" },
  { kind: "person", label: "człowiek", icon: "🧍" },
];

export const artInfo = (kind: ProjectArtKind) => ARTS.find((a) => a.kind === kind) ?? ARTS[0];

/** Prostokąt grafiki na płótnie (środek płótna; proporcje grafiki — ProjectArt.tsx). */
export function artBox(kind: ProjectArtKind): { x: number; y: number; w: number; h: number } {
  const [w, h] = kind === "car" ? [440, 252] : [230, 420];
  return { x: (CANVAS_W - w) / 2, y: (CANVAS_H - h) / 2 + 10, w, h };
}

export function newProject(title: string, art: ProjectArtKind, id = newEventId()): Project {
  const now = Date.now();
  return {
    id,
    title: title.trim(),
    description: "",
    art,
    pins: [],
    order: now,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    pending: 1,
  };
}

/** Każda lokalna zmiana projektu → do wysłania (kopia w Google). */
export async function saveProject(p: Project): Promise<void> {
  await db.projects.put({ ...p, pending: 1, updatedAt: Date.now() });
}

const STARTERS_KEY = "pulsecal:projects-started";

/**
 * Dwa projekty na start (auto, człowiek), raz na urządzenie i tylko gdy nie ma żadnego projektu.
 * Stałe ID i `pending: 0` (bez wysyłki, dopóki ich nie zmienisz): drugie urządzenie nie nadpisze
 * w Google projektu, który już tam jest, tylko pobierze go przy synchronizacji.
 */
export async function ensureStarterProjects(): Promise<void> {
  try {
    if (localStorage.getItem(STARTERS_KEY)) return;
    localStorage.setItem(STARTERS_KEY, "1");
  } catch {
    return;
  }
  if ((await db.projects.count()) > 0) return;
  const starters = [
    { ...newProject("Auto", "car", "starterauto"), description: "Wszystko, co trzeba zrobić przy samochodzie." },
    { ...newProject("Ja", "person", "starterja"), description: "Zdrowie, forma i rozwój." },
  ].map((p, i) => ({ ...p, order: i, createdAt: 1, updatedAt: 1, pending: 0 as const }));
  await db.projects.bulkPut(starters);
}

export type ProjectProgress = { done: number; total: number; ratio: number };

/** Postęp projektu: zadania ze wszystkich epików na płótnie (pod-epik leżący obok swojego epiku liczy się raz). */
export function projectProgress(p: Project, tree: Tree, now: number): ProjectProgress {
  const ids = new Set(p.pins.map((x) => x.epicId).filter((id) => tree.byId.get(id)?.kind === "epic"));
  let done = 0;
  let total = 0;
  for (const id of ids) {
    if (ancestorIds(id, tree.byId).some((a) => ids.has(a))) continue;
    const pr = progressOf(id, tree, now);
    done += pr.done;
    total += pr.total;
  }
  return { done, total, ratio: total ? done / total : 0 };
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Środek karty mieści się na płótnie. */
export function clampPin(x: number, y: number): { x: number; y: number } {
  return { x: clamp(x, CARD_W / 2 + 6, CANVAS_W - CARD_W / 2 - 6), y: clamp(y, 34, CANVAS_H - 34) };
}

/** Miejsce dla nowo położonego epiku: pierwsze wolne wokół grafiki (lewa, prawa kolumna, góra, dół). */
export function freeSlot(pins: ProjectPin[]): { x: number; y: number } {
  const L = CARD_W / 2 + 24;
  const R = CANVAS_W - L;
  const slots = [
    [L, 120], [R, 120], [L, 330], [R, 330], [L, 540], [R, 540],
    [CANVAS_W / 2, 50], [CANVAS_W / 2, CANVAS_H - 40], [L + 210, 50], [R - 210, CANVAS_H - 40],
  ];
  for (const [x, y] of slots) {
    if (pins.every((p) => Math.abs(p.x - x) > CARD_W * 0.7 || Math.abs(p.y - y) > 70)) return { x, y };
  }
  return clampPin(L + ((pins.length * 37) % 300), 120 + ((pins.length * 53) % 420));
}

/** Charakterystyczne punkty grafik (we współrzędnych grafiki, ProjectArt.tsx): koła, szyby, głowa, ręce… */
const ANCHORS: Record<ProjectArtKind, [number, number][]> = {
  car: [
    [105, 196], [335, 196], // koła
    [190, 84], [282, 84], // szyby
    [236, 46], // dach
    [388, 128], [58, 128], // maska, bagażnik
    [229, 150], [409, 138], // drzwi, światło
  ],
  person: [
    [115, 60], // głowa
    [115, 170], [115, 245], // klatka, brzuch
    [40, 200], [190, 200], // ręce
    [88, 340], [142, 340], // nogi
    [88, 405], [142, 405], // stopy
  ],
};

/** Domyślny koniec strzałki: najbliższy karcie charakterystyczny punkt grafiki (np. koło dla karty pod autem). */
export function defaultArrowTarget(kind: ProjectArtKind, from: { x: number; y: number }): { x: number; y: number } {
  const b = artBox(kind);
  let best = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  let dist = Infinity;
  for (const [ax, ay] of ANCHORS[kind]) {
    const p = { x: b.x + ax, y: b.y + ay };
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d < dist) {
      dist = d;
      best = p;
    }
  }
  return { x: Math.round(best.x), y: Math.round(best.y) };
}

/**
 * Łamana strzałka (same odcinki poziome i pionowe) od brzegu karty do celu.
 * Bardziej w bok niż w pionie → wychodzi z boku karty: poziomo, pionowo, poziomo; inaczej z góry/dołu.
 */
export function elbowPath(card: { x: number; y: number; h: number }, to: { x: number; y: number }): string {
  const hw = CARD_W / 2;
  const hh = card.h / 2;
  const dx = to.x - card.x;
  const dy = to.y - card.y;
  const r = (n: number) => Math.round(n * 10) / 10;
  if (Math.abs(dx) - hw >= Math.abs(dy) - hh) {
    const sx = card.x + Math.sign(dx || 1) * hw;
    const mx = (sx + to.x) / 2;
    return `M${r(sx)} ${r(card.y)} H${r(mx)} V${r(to.y)} H${r(to.x)}`;
  }
  const sy = card.y + Math.sign(dy || 1) * hh;
  const my = (sy + to.y) / 2;
  return `M${r(card.x)} ${r(sy)} V${r(my)} H${r(to.x)} V${r(to.y)}`;
}

/** Poprawny projekt z kopii w Google (null = nie projekt / uszkodzony). */
export function cleanProject(d: Partial<Project> | null | undefined): Omit<Project, "deleted" | "pending"> | null {
  if (!d || typeof d.id !== "string" || typeof d.title !== "string") return null;
  const pins: ProjectPin[] = Array.isArray(d.pins)
    ? d.pins
        .filter((p) => p && typeof p.epicId === "string" && Number.isFinite(p.x) && Number.isFinite(p.y))
        .map((p) => ({
          epicId: p.epicId,
          ...clampPin(Number(p.x), Number(p.y)),
          arrow:
            p.arrow && Number.isFinite(p.arrow.x) && Number.isFinite(p.arrow.y)
              ? { x: clamp(Number(p.arrow.x), 0, CANVAS_W), y: clamp(Number(p.arrow.y), 0, CANVAS_H) }
              : null,
        }))
    : [];
  return {
    id: d.id,
    title: d.title,
    description: typeof d.description === "string" ? d.description : "",
    art: ARTS.some((a) => a.kind === d.art) ? (d.art as ProjectArtKind) : "car",
    pins,
    order: Number(d.order) || 0,
    createdAt: Number(d.createdAt) || 0,
    updatedAt: Number(d.updatedAt) || 0,
  };
}

let chain: Promise<void> = Promise.resolve();

/** Zmiany projektu po kolei, każda od aktualnego stanu w bazie (szybkie przeciągnięcia się nie gubią). */
export function changeProject(id: string, fn: (p: Project) => Project): Promise<void> {
  chain = chain
    .then(async () => {
      const cur = await db.projects.get(id);
      if (cur && !cur.deleted) await saveProject(fn(cur));
    })
    .catch(() => {});
  return chain;
}

/** Projekty, w których leży ten epik albo któryś z jego epików nadrzędnych. */
export function projectsForEpic(epicId: string, projects: Project[], byId: Map<string, WorkItem>): Project[] {
  const chain = new Set([epicId, ...ancestorIds(epicId, byId)]);
  return projects.filter((p) => !p.deleted && p.pins.some((x) => chain.has(x.epicId)));
}

const ACTIVE_KEY = "pulsecal:project";

/** Projekt otwierany w widoku „projekty” (zapamiętany na urządzeniu). */
export function getActiveProject(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setActiveProject(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* prywatne okno */
  }
}
