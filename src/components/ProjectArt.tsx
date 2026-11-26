/**
 * Grafiki projektów (symboliczne, „bąblowe”): auto i człowiek. Postęp projektu wypełnia grafikę kolorem
 * od dołu (koralowy → żółty → zielony, jak paski postępu epików), sprężyście.
 */
import { useId, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { tr } from "../motionPrefs";
import type { ProjectArtKind } from "../types";
import { progressColor } from "../work";

/** fill: [góra, dół] sylwetki — w tym pasie postęp wypełnia grafikę (50% = połowa auta, nie widoku). */
type Art = { w: number; h: number; fill: [number, number]; body: ReactNode; extra?: ReactNode };

const CAR_BODY =
  "M40 150C40 126 54 116 78 112L128 106L168 58C176 48 186 44 200 44L292 44C306 44 316 50 324 60L360 106L390 112" +
  "C410 116 420 130 420 150L420 178C420 190 412 196 400 196L380 196A45 45 0 0 0 290 196L150 196A45 45 0 0 0 60 196" +
  "L56 196C46 196 40 190 40 180Z";

const ARTS: Record<ProjectArtKind, Art> = {
  car: {
    w: 440,
    h: 252,
    fill: [42, 233],
    body: <path d={CAR_BODY} />,
    extra: (
      <>
        {/* szyby */}
        <path className="pa-glass" d="M146 104L176 66C180 61 185 58 192 58L222 58L222 104Z" />
        <path className="pa-glass" d="M236 58L290 58C298 58 304 61 308 66L338 104L236 104Z" />
        {/* drzwi, klamka, światła */}
        <path className="pa-line" d="M229 112V184" />
        <rect className="pa-line-fill" x="244" y="122" width="22" height="7" rx="3.5" />
        <ellipse className="pa-light" cx="409" cy="138" rx="7" ry="10" />
        <ellipse className="pa-tail" cx="49" cy="136" rx="5" ry="9" />
        {/* koła */}
        {[105, 335].map((cx) => (
          <g key={cx}>
            <circle className="pa-tire" cx={cx} cy="196" r="37" />
            <circle className="pa-hub" cx={cx} cy="196" r="14" />
          </g>
        ))}
      </>
    ),
  },
  person: {
    w: 230,
    h: 420,
    fill: [16, 414],
    body: (
      <>
        <circle cx="115" cy="60" r="44" />
        <rect x="24" y="128" width="34" height="132" rx="17" transform="rotate(9 41 130)" />
        <rect x="172" y="128" width="34" height="132" rx="17" transform="rotate(-9 189 130)" />
        <rect x="66" y="232" width="44" height="182" rx="22" />
        <rect x="120" y="232" width="44" height="182" rx="22" />
        <rect x="56" y="114" width="118" height="160" rx="50" />
      </>
    ),
  },
};

/** Grafika projektu; `ratio` (0–1) = postęp, wypełnia kolorem od dołu. */
export function ProjectArt({ kind, ratio, className }: { kind: ProjectArtKind; ratio: number; className?: string }) {
  const art = ARTS[kind];
  const clip = `pa-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reduce = useReducedMotion();
  const r = Math.max(0, Math.min(1, ratio));
  const [top, bottom] = art.fill;
  // pełny postęp = cała grafika; 0 = nic (także poza pasem sylwetki)
  const fillH = r >= 1 ? art.h : r <= 0 ? 0 : (bottom - top) * r;
  const fillY = r >= 1 ? 0 : bottom - fillH;
  return (
    <svg
      className={`project-art${r >= 1 ? " full" : ""}${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${art.w} ${art.h}`}
      role="img"
      aria-label={`${kind === "car" ? "auto" : "człowiek"}, postęp ${Math.round(r * 100)}%`}
    >
      <defs>
        <clipPath id={clip}>
          <motion.rect
            x={0}
            width={art.w}
            initial={false}
            animate={{ y: fillY, height: fillH }}
            transition={reduce ? { duration: 0 } : tr({ type: "spring", stiffness: 120, damping: 14 })}
          />
        </clipPath>
      </defs>
      <g className="pa-base">{art.body}</g>
      <g className="pa-fill" style={{ fill: progressColor(r) }} clipPath={`url(#${clip})`}>
        {art.body}
      </g>
      {art.extra}
    </svg>
  );
}
