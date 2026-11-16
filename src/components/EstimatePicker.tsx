import { ESTIMATES, UNKNOWN_ESTIMATE, estimateLabel } from "../estimate";

type Props = {
  value?: number;
  onChange: (min: number | undefined) => void;
  /** Ustawienie „wymagaj estymaty” i brak wyboru → wyróżnione. */
  missing?: boolean;
  label?: string;
  className?: string;
};

/** Estymata czasowa wpisu: szybkie przyciski (ponowne kliknięcie wybranego czyści). */
export function EstimatePicker({ value, onChange, missing = false, label, className = "" }: Props) {
  return (
    <div className={`est-picker${missing ? " missing" : ""} ${className}`} role="group" aria-label="Estymata czasowa">
      {label && <span className="est-label">{label}</span>}
      {ESTIMATES.map((m) => (
        <button
          key={m}
          type="button"
          className={value === m ? "on" : ""}
          aria-pressed={value === m}
          title={value === m ? "Usuń estymatę" : `Estymata: ${estimateLabel(m)}`}
          onClick={() => onChange(value === m ? undefined : m)}
        >
          {estimateLabel(m)}
        </button>
      ))}
      <button
        type="button"
        className={`est-unknown${value === UNKNOWN_ESTIMATE ? " on" : ""}`}
        aria-pressed={value === UNKNOWN_ESTIMATE}
        aria-label="Nie wiem (bez estymaty)"
        title="Nie wiem — wpis bez estymaty"
        onClick={() => onChange(value === UNKNOWN_ESTIMATE ? undefined : UNKNOWN_ESTIMATE)}
      >
        ?
      </button>
      {missing && <span className="est-need">wybierz estymatę</span>}
    </div>
  );
}

/** „ (30min)” za tytułem wpisu w kalendarzu. */
export function EstSuffix({ min }: { min?: number }) {
  if (!min || min < 0) return null;
  return <span className="est-suffix"> ({estimateLabel(min)})</span>;
}
