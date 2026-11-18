import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { onCheer, type Achievement, type Cheer } from "../cheers";
import { animOff, tr } from "../motionPrefs";

const CHEER_MS = 1700;
const AWARD_MS = 3400;
/** Iskierki wokół dymka (kąty w stopniach). */
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Zachęty u góry ekranu: mały, sprężysty dymek („Świetna robota!”, „On fire! 🔥 ×3”) i pod nim nowe
 * osiągnięcie. Nie łapie kliknięć (pointer-events: none), więc niczego nie zasłania na dłużej niż chwilę.
 */
export function Cheers() {
  const reduce = useReducedMotion();
  const [cheer, setCheer] = useState<Cheer | null>(null);
  const [award, setAward] = useState<{ id: number; a: Achievement } | null>(null);
  const queue = useRef<Achievement[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(
    () =>
      onCheer((c) => {
        if (c.text) setCheer(c);
        if (c.unlocked.length) {
          queue.current.push(...c.unlocked);
          setTick((n) => n + 1);
        }
      }),
    [],
  );

  // dymek znika po chwili; kolejny (seria) przedłuża go i „podskakuje” od nowa
  useEffect(() => {
    if (!cheer) return;
    const t = window.setTimeout(() => setCheer(null), CHEER_MS);
    return () => window.clearTimeout(t);
  }, [cheer]);

  // osiągnięcia po kolei, każde przez chwilę
  useEffect(() => {
    if (award) {
      const t = window.setTimeout(() => setAward(null), AWARD_MS);
      return () => window.clearTimeout(t);
    }
    const next = queue.current.shift();
    if (next) setAward({ id: Date.now(), a: next });
  }, [award, tick]);

  const off = animOff();
  const still = off || Boolean(reduce);
  const pop = tr({ type: "spring", stiffness: 520, damping: 17 });

  return (
    <div className="cheer-layer" aria-live="polite">
      <AnimatePresence>
        {cheer && (
          <motion.div
            key="cheer"
            className={`cheer t-${cheer.tone}`}
            role="status"
            initial={off ? false : reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: pop }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.85, transition: tr({ duration: 0.22 }) }}
          >
            <motion.span
              key={cheer.id}
              className="cheer-text"
              initial={still ? false : { scale: 0.72, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={tr({ type: "spring", stiffness: 640, damping: 13 })}
            >
              {cheer.text}
              {cheer.combo >= 2 && <b className="cheer-combo">×{cheer.combo}</b>}
            </motion.span>
            {!still && (
              <span key={`s${cheer.id}`} className="cheer-sparks" aria-hidden>
                {SPARKS.map((deg, i) => (
                  <i key={deg} style={{ ["--a" as string]: `${deg + (cheer.id % 3) * 15}deg`, ["--d" as string]: `${i % 2 ? 30 : 40}px` }} />
                ))}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {award && (
          <motion.div
            key={award.id}
            className="award"
            role="status"
            initial={off ? false : reduce ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.6, rotate: -4 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0, transition: pop }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.9, transition: tr({ duration: 0.22 }) }}
          >
            <motion.span
              className="award-icon"
              aria-hidden
              initial={still ? false : { scale: 0.3, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={tr({ type: "spring", stiffness: 420, damping: 10, delay: 0.08 })}
            >
              {award.a.icon}
            </motion.span>
            <span className="award-text">
              <small>nowe osiągnięcie</small>
              <b>{award.a.name}</b>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
