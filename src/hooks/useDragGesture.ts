import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";

export type Pt = { x: number; y: number };

export type DragCallbacks = {
  /** Gest aktywny: mysz po przesunięciu o kilka px, dotyk po przytrzymaniu. `start` = punkt chwytu. */
  onStart: (start: Pt) => void;
  onMove: (p: Pt) => void;
  /** `null` = anulowano (Esc, touchcancel). */
  onEnd: (p: Pt | null) => void;
};

type Edges = { top: number; right: number; bottom: number; left: number };

type Options = {
  /** Element przewijany automatycznie, gdy kursor/palec jest przy krawędzi. */
  scroller?: RefObject<HTMLElement | null>;
  /** Szerokość stref auto-przewijania (px) — większa tam, gdzie są przyklejone nagłówki albo dock. */
  edges?: Partial<Edges>;
};

const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
const LONG_PRESS_MS = 280;
const MAX_SCROLL_STEP = 18;

type Session = {
  cb: DragCallbacks;
  kind: "mouse" | "touch";
  start: Pt;
  last: Pt;
  active: boolean;
  timer?: number;
  raf?: number;
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Przeciąganie myszą i dotykiem.
 * - Mysz: start po 4 px.
 * - Dotyk: przytrzymanie 280 ms, potem `touchmove` z `preventDefault` (nie przewija strony — także na iOS).
 *   Ruch przed aktywacją = zwykłe przewijanie, gest się anuluje.
 * Element, na którym zaczął się dotyk, musi zostać w DOM do końca gestu (iOS wysyła mu touchmove),
 * dlatego widoki rysują osobny „duch" zamiast przenosić oryginał.
 */
export function useDragGesture(opts: Options = {}) {
  const session = useRef<Session | null>(null);
  const suppressClickUntil = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const finish = useCallback((p: Pt | null) => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    window.clearTimeout(s.timer);
    if (s.raf) cancelAnimationFrame(s.raf);
    if (!s.active) return;
    document.body.classList.remove("is-dragging");
    suppressClickUntil.current = Date.now() + 450;
    s.cb.onEnd(p);
  }, []);

  const autoScroll = useCallback((s: Session) => {
    const el = optsRef.current.scroller?.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const e: Edges = { top: 48, right: 40, bottom: 48, left: 40, ...optsRef.current.edges };
    const step = (d: number, zone: number) =>
      Math.ceil(Math.min(1, (zone - Math.max(0, d)) / zone) * MAX_SCROLL_STEP);
    let dx = 0;
    let dy = 0;
    if (s.last.x < r.left + e.left) dx = -step(s.last.x - r.left, e.left);
    else if (s.last.x > r.right - e.right) dx = step(r.right - s.last.x, e.right);
    if (s.last.y < r.top + e.top) dy = -step(s.last.y - r.top, e.top);
    else if (s.last.y > r.bottom - e.bottom) dy = step(r.bottom - s.last.y, e.bottom);
    if (!dx && !dy) return;
    const { scrollLeft, scrollTop } = el;
    el.scrollBy(dx, dy);
    if (el.scrollLeft !== scrollLeft || el.scrollTop !== scrollTop) s.cb.onMove(s.last);
  }, []);

  const activate = useCallback(
    (s: Session) => {
      s.active = true;
      document.body.classList.add("is-dragging");
      navigator.vibrate?.(8);
      s.cb.onStart(s.start);
      s.cb.onMove(s.last);
      const loop = () => {
        if (session.current !== s) return;
        autoScroll(s);
        s.raf = requestAnimationFrame(loop);
      };
      s.raf = requestAnimationFrame(loop);
    },
    [autoScroll],
  );

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const s = session.current;
      if (!s || s.kind !== "mouse") return;
      s.last = { x: e.clientX, y: e.clientY };
      if (!s.active) {
        if (dist(s.start, s.last) > MOUSE_SLOP) activate(s);
        return;
      }
      s.cb.onMove(s.last);
    };
    const onPointerUp = (e: PointerEvent) => {
      const s = session.current;
      if (!s || s.kind !== "mouse") return;
      finish({ x: e.clientX, y: e.clientY });
    };
    const onPointerCancel = () => {
      if (session.current?.kind === "mouse") finish(null);
    };
    const onTouchMove = (e: TouchEvent) => {
      const s = session.current;
      if (!s || s.kind !== "touch") return;
      const t = e.touches[0];
      if (!t) return;
      s.last = { x: t.clientX, y: t.clientY };
      if (!s.active) {
        // palec ruszył przed przytrzymaniem → to przewijanie, nie przeciąganie
        if (dist(s.start, s.last) > TOUCH_SLOP) finish(null);
        return;
      }
      e.preventDefault();
      s.cb.onMove(s.last);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const s = session.current;
      if (!s || s.kind !== "touch") return;
      const t = e.changedTouches[0];
      finish(e.type === "touchend" && t ? { x: t.clientX, y: t.clientY } : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && session.current?.active) finish(null);
    };
    const onScroll = () => {
      // przewijanie (np. bezwładność) przed aktywacją → nie przeciągamy
      const s = session.current;
      if (s && s.kind === "touch" && !s.active) finish(null);
    };
    const onContextMenu = (e: Event) => {
      if (session.current?.kind === "touch") e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      // kliknięcie, które przeglądarka wysyła po upuszczeniu, nie może otwierać karty/tworzyć wpisu
      if (Date.now() < suppressClickUntil.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("click", onClick, true);
    return () => {
      finish(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [activate, finish]);

  /** Propsy dla elementu, który można chwycić. */
  const bind = useCallback(
    (cb: DragCallbacks) => ({
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.pointerType === "touch" || e.button !== 0) return;
        e.stopPropagation();
        finish(null);
        const p = { x: e.clientX, y: e.clientY };
        session.current = { cb, kind: "mouse", start: p, last: p, active: false };
      },
      onTouchStart: (e: ReactTouchEvent) => {
        e.stopPropagation();
        finish(null);
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        const p = { x: t.clientX, y: t.clientY };
        const s: Session = { cb, kind: "touch", start: p, last: p, active: false };
        s.timer = window.setTimeout(() => {
          if (session.current === s && !s.active) activate(s);
        }, LONG_PRESS_MS);
        session.current = s;
      },
    }),
    [activate, finish],
  );

  return { bind };
}
