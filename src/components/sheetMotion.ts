/** Wspólne animacje arkuszy: sprężyste wejście z „przestrzeleniem", szybkie wyjście w dół. */
export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.18 } },
} as const;

export const sheetMotion = {
  initial: { y: 60, scale: 0.96 },
  animate: { y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 22 } },
  exit: { y: 90, scale: 0.98, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
} as const;
