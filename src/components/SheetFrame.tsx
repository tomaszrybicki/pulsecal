import { motion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useAnchoredPlacement, type Anchor } from "../hooks/useAnchoredPlacement";
import { backdropMotion, popMotion, sheetMotion } from "./sheetMotion";

type Props = {
  /** Punkt kliknięcia (komputer) → okienko przy kursorze. null → arkusz od dołu (telefon) / panel. */
  anchor: Anchor | null;
  className?: string;
  backdropClass?: string;
  label: string;
  onDismiss: () => void;
  children: ReactNode;
};

/** Wspólna oprawa okien wpisu: tło (klik obok = zamknij) + arkusz albo okienko przy kursorze. */
export function SheetFrame({ anchor, className = "", backdropClass = "", label, onDismiss, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPlacement(anchor, ref);
  const floating = anchor !== null;

  return (
    <motion.div
      className={`sheet-backdrop ${backdropClass}${floating ? " anchored" : ""}`}
      onClick={onDismiss}
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
        {...(floating ? popMotion : sheetMotion)}
      >
        <div className="grab" />
        {children}
      </motion.div>
    </motion.div>
  );
}
