/**
 * Wspólne animacje arkuszy: sprężyste wejście z „przestrzeleniem", szybkie wyjście w dół.
 * Funkcje (nie stałe), bo tempo zależy od ustawienia „animacje” (motionPrefs.ts) — czytane przy renderze.
 */
import { animOff, tr } from "../motionPrefs";

export const backdropMotion = () =>
  ({
    initial: animOff() ? false : { opacity: 0 },
    animate: { opacity: 1, transition: tr({ duration: 0.2 }) },
    exit: { opacity: 0, transition: tr({ duration: 0.18 }) },
  }) as const;

export const sheetMotion = () =>
  ({
    initial: animOff() ? false : { y: 60, scale: 0.96 },
    animate: { y: 0, scale: 1, transition: tr({ type: "spring", stiffness: 420, damping: 22 }) },
    exit: { y: 90, scale: 0.98, opacity: 0, transition: tr({ duration: 0.2, ease: "easeIn" }) },
  }) as const;

/** Okienko przy kursorze (komputer): wyskakuje z punktu kliknięcia z lekkim przestrzeleniem. */
export const popMotion = () =>
  ({
    initial: animOff() ? false : { opacity: 0, scale: 0.88 },
    animate: { opacity: 1, scale: 1, transition: tr({ type: "spring", stiffness: 520, damping: 26 }) },
    exit: { opacity: 0, scale: 0.94, transition: tr({ duration: 0.14 }) },
  }) as const;

/** Okno wyszukiwania u góry ekranu: zjeżdża lekko z góry. */
export const paletteMotion = () =>
  ({
    initial: animOff() ? false : { y: -24, scale: 0.97, opacity: 0 },
    animate: { y: 0, scale: 1, opacity: 1, transition: tr({ type: "spring", stiffness: 480, damping: 30 }) },
    exit: { y: -16, opacity: 0, transition: tr({ duration: 0.14 }) },
  }) as const;
