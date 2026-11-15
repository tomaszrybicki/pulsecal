import { useLayoutEffect, useState, type RefObject } from "react";

export type Anchor = { x: number; y: number };

export type Placement = { left: number; top: number; origin: string };

const GAP = 14;
const MARGIN = 8;
/** Okno startuje trochę nad kursorem, żeby pole tytułu było na wysokości kliknięcia. */
const LIFT = 48;

/**
 * Gdzie postawić okienko przy kursorze (jak popover w Google Calendar):
 * obok kursora z prawej, a gdy brak miejsca — z lewej, żeby nie zasłaniać klikniętego miejsca.
 * W pionie dosunięte do krawędzi ekranu, jeśli się nie mieści.
 */
export function place(a: Anchor, w: number, h: number, vw: number, vh: number): Placement {
  let left = a.x + GAP;
  let side: "left" | "right" | "center" = "left";
  if (left + w > vw - MARGIN) {
    left = a.x - GAP - w;
    side = "right";
  }
  if (left < MARGIN) {
    left = Math.min(Math.max(MARGIN, a.x - w / 2), Math.max(MARGIN, vw - w - MARGIN));
    side = "center";
  }
  const top = Math.min(Math.max(MARGIN, a.y - LIFT), Math.max(MARGIN, vh - h - MARGIN));
  const oy = Math.min(Math.max(a.y - top, 0), h);
  const ox = side === "left" ? "0px" : side === "right" ? `${w}px` : `${a.x - left}px`;
  return { left, top, origin: `${ox} ${oy}px` };
}

/**
 * Pozycja okna przy punkcie `anchor`. Mierzy element (offset* — bez wpływu animowanego `scale`)
 * i poprawia pozycję, gdy okno urośnie (np. „Więcej", tagi) albo zmieni się rozmiar ekranu.
 * Zwraca null do pierwszego pomiaru — wtedy okno jest niewidoczne, żeby nie mignęło w złym miejscu.
 */
export function useAnchoredPlacement(anchor: Anchor | null, ref: RefObject<HTMLElement | null>): Placement | null {
  const [pos, setPos] = useState<Placement | null>(null);
  const ax = anchor?.x;
  const ay = anchor?.y;

  useLayoutEffect(() => {
    if (ax === undefined || ay === undefined) {
      setPos(null);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = place({ x: ax, y: ay }, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight);
      setPos((prev) =>
        prev && prev.left === next.left && prev.top === next.top && prev.origin === next.origin ? prev : next,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ax, ay, ref]);

  return pos;
}
