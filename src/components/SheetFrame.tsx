import { motion, useIsPresent } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { useAnchoredPlacement, type Anchor } from "../hooks/useAnchoredPlacement";
import { backdropMotion, paletteMotion, popMotion, sheetMotion } from "./sheetMotion";

type Props = {
  /** Punkt kliknięcia (komputer) → okienko przy kursorze. null → arkusz od dołu (telefon) / panel. */
  anchor: Anchor | null;
  className?: string;
  backdropClass?: string;
  label: string;
  onDismiss: () => void;
  children: ReactNode;
  /** palette = okno u góry ekranu (wyszukiwanie) — klawiatura telefonu nie zasłania wyników. */
  variant?: "sheet" | "palette";
};

/** Otwarte okienka przy kursorze, od najstarszego — kliknięcie w okienko „wyżej” nie zamyka niższych. */
const floatingStack: HTMLElement[] = [];

/**
 * Wspólna oprawa okien wpisu.
 * - Arkusz (telefon) / panel: tło przyciemnia ekran, klik w tło zamyka.
 * - Okienko przy kursorze (komputer): tło nie łapie kliknięć — klik obok zamyka okienko i od razu działa
 *   na tym, co kliknięto (inny wpis, slot, dzień), bez drugiego kliknięcia.
 */
export function SheetFrame({ anchor, className = "", backdropClass = "", label, onDismiss, children, variant = "sheet" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPlacement(anchor, ref);
  const floating = anchor !== null;
  const palette = variant === "palette";
  const shown = !floating || pos !== null;
  const isPresent = useIsPresent();
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const presentRef = useRef(isPresent);
  presentRef.current = isPresent;

  useEffect(() => {
    const el = ref.current;
    if (!floating || !el) return;
    floatingStack.push(el);
    const onDown = (e: PointerEvent) => {
      if (!presentRef.current) return; // okno już się zamyka (animacja wyjścia)
      const t = e.target as Node;
      const mine = floatingStack.indexOf(el);
      if (floatingStack.slice(mine).some((s) => s.contains(t))) return;
      dismissRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      const i = floatingStack.indexOf(el);
      if (i >= 0) floatingStack.splice(i, 1);
    };
  }, [floating]);

  // Fokus na polu oznaczonym data-autofocus dopiero, gdy okno jest widoczne — okno przy kursorze jest
  // przez pierwszą klatkę ukryte (visibility: hidden), a przeglądarka ignoruje focus() na ukrytym elemencie.
  useEffect(() => {
    if (shown) ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [shown]);

  return (
    <motion.div
      className={`sheet-backdrop ${backdropClass}${floating ? " anchored" : ""}${palette ? " palette" : ""}`}
      onClick={floating ? undefined : onDismiss}
      role="presentation"
      {...backdropMotion}
    >
      <motion.div
        ref={ref}
        className={`sheet ${className}${floating ? " floating" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={label}
        style={
          floating
            ? {
                left: pos?.left ?? 0,
                top: pos?.top ?? 0,
                transformOrigin: pos?.origin,
                visibility: pos ? "visible" : "hidden",
              }
            : undefined
        }
        {...(floating ? popMotion : palette ? paletteMotion : sheetMotion)}
      >
        {!palette && <div className="grab" />}
        {children}
      </motion.div>
    </motion.div>
  );
}
