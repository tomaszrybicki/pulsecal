import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { animOff, tr } from "../motionPrefs";
import { useEffect, useState } from "react";
import type { SyncNotice } from "../hooks/useGoogleSync";

const VISIBLE_MS = 3200;

/** Krótki, „sprężysty" komunikat nad dockiem. Nowy komunikat zastępuje poprzedni. */
export function Toast({ notice }: { notice: SyncNotice | null }) {
  const [shown, setShown] = useState<SyncNotice | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!notice) return;
    setShown(notice);
    // z przyciskiem „Cofnij" dłużej — trzeba zdążyć kliknąć
    const ms = notice.action ? VISIBLE_MS * 2.2 : notice.tone === "ok" ? VISIBLE_MS : VISIBLE_MS * 1.8;
    const id = window.setTimeout(() => setShown(null), ms);
    return () => window.clearTimeout(id);
  }, [notice]);

  return (
    <div className="toast-layer" aria-live="polite">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            className={`toast ${shown.tone}`}
            role="status"
            onClick={() => setShown(null)}
            initial={animOff() ? false : reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.85, borderRadius: 40 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, borderRadius: 22 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
            transition={tr({ type: "spring", stiffness: 520, damping: 24 })}
          >
            <span>{shown.text}</span>
            {shown.action && (
              <button
                type="button"
                className="toast-action"
                onClick={(e) => {
                  e.stopPropagation();
                  shown.action?.run();
                  setShown(null);
                }}
              >
                {shown.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
