import { useRef } from "react";

/**
 * Początek przeciągania na kalendarz (przypięty epik, baner epiku): mysz — ruch o kilka px z wciśniętym
 * przyciskiem, dotyk — przytrzymanie (ruch palcem przed czasem anuluje). Dalej prowadzi App (startPlanDrag).
 * `wasDragged()` w onClick: true, gdy kliknięcie kończy przeciąganie (wtedy nie otwieramy szczegółów).
 */
export function useHoldDrag(onDrag?: (x: number, y: number) => void, holdMs = 380) {
  const start = useRef<{ x: number; y: number; mouse: boolean } | null>(null);
  const timer = useRef<number | null>(null);
  const dragged = useRef(false);

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  const begin = (x: number, y: number) => {
    stop();
    dragged.current = true;
    onDrag?.(x, y);
  };

  const props = onDrag
    ? {
        onPointerDown: (ev: React.PointerEvent) => {
          dragged.current = false;
          if (ev.button !== 0) return;
          const mouse = ev.pointerType === "mouse";
          start.current = { x: ev.clientX, y: ev.clientY, mouse };
          if (!mouse) {
            const { clientX, clientY } = ev;
            timer.current = window.setTimeout(() => begin(clientX, clientY), holdMs);
          }
        },
        onPointerMove: (ev: React.PointerEvent) => {
          const s = start.current;
          if (!s) return;
          const dist = Math.hypot(ev.clientX - s.x, ev.clientY - s.y);
          if (s.mouse && dist > 6) begin(ev.clientX, ev.clientY);
          else if (!s.mouse && dist > 8) stop();
        },
        onPointerUp: stop,
        onPointerCancel: stop,
        onPointerLeave: (ev: React.PointerEvent) => {
          // mysz wyjechała poza element zanim ruszyliśmy o próg — i tak to przeciąganie
          const s = start.current;
          if (s?.mouse && ev.buttons === 1) begin(ev.clientX, ev.clientY);
          else if (s?.mouse) stop();
        },
        onContextMenu: (ev: React.MouseEvent) => ev.preventDefault(),
      }
    : {};

  const wasDragged = () => {
    if (!dragged.current) return false;
    dragged.current = false;
    return true;
  };

  return { props, wasDragged };
}
