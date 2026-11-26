/**
 * Podgląd projektu na kilka sekund po zamknięciu zadania (albo usunięciu wpisu) z epiku, który leży w projekcie:
 * wysuwa się z boku (po stronie, gdzie nie ma przeglądu dnia), grafika dopełnia się kolorem do nowego postępu.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { animOff, tr } from "../motionPrefs";
import { artInfo, type ProjectProgress } from "../projects";
import type { Project } from "../types";
import { progressColor } from "../work";
import { ProjectArt } from "./ProjectArt";

export type PeekState = { id: number; projectId: string; from: ProjectProgress; side: "left" | "right" };

const SHOW_MS = 4800;

type Props = {
  peek: PeekState;
  project: Project;
  /** Aktualny postęp (na żywo — zmiana z bazy dochodzi chwilę po kliknięciu). */
  progress: ProjectProgress;
  onOpen: () => void;
  onClose: () => void;
};

export function ProjectPeek({ peek, project, progress, onOpen, onClose }: Props) {
  const reduce = useReducedMotion();
  const still = reduce || animOff();
  // najpierw stary postęp, po chwili nowy — żeby było widać, jak grafika się dopełnia
  const [grown, setGrown] = useState(still);
  useEffect(() => {
    if (still) return;
    const t = window.setTimeout(() => setGrown(true), 380);
    return () => window.clearTimeout(t);
  }, [still]);

  // samo się chowa; najechanie myszą wstrzymuje
  const hover = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    let left = SHOW_MS;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      if (!hover.current) left -= now - last;
      last = now;
      if (left <= 0) close.current();
    }, 200);
    return () => window.clearInterval(t);
  }, []);

  const shown = grown ? progress : peek.from;
  const delta = progress.done - peek.from.done;
  const done = progress.total > 0 && progress.ratio >= 1;
  const dx = peek.side === "right" ? 56 : -56;

  return (
    <motion.aside
      className={`pj-peek ${peek.side}${still ? " still" : ""}${done && grown ? " done" : ""}`}
      role="status"
      aria-live="polite"
      initial={still ? false : { opacity: 0, x: dx, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={still ? { opacity: 0 } : { opacity: 0, x: dx, scale: 0.96 }}
      transition={tr({ type: "spring", stiffness: 380, damping: 26 })}
      onPointerEnter={() => (hover.current = true)}
      onPointerLeave={() => (hover.current = false)}
    >
      <button type="button" className="pj-peek-body" onClick={onOpen} title="Otwórz projekt">
        <span className="pj-peek-label">projekt</span>
        <strong className="pj-peek-title">
          {artInfo(project.art).icon} {project.title}
        </strong>
        <span className="pj-peek-art">
          <ProjectArt kind={project.art} ratio={shown.ratio} />
        </span>
        <span className="pj-bar-track">
          <i style={{ width: `${Math.round(shown.ratio * 100)}%`, background: progressColor(shown.ratio) }} />
        </span>
        <span className="pj-peek-text">
          {done && grown
            ? "🏁 projekt ukończony!"
            : `${shown.done} z ${shown.total} zadań · ${Math.round(shown.ratio * 100)}%`}
          {grown && delta > 0 && <span className="pj-peek-delta">+{delta}</span>}
        </span>
      </button>
      <button type="button" className="pj-peek-close" aria-label="Zamknij podgląd projektu" onClick={onClose}>
        ×
      </button>
    </motion.aside>
  );
}
