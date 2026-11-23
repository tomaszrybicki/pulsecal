/** „↷ przeniesiony N×” + dyskretny przełącznik podpowiedzi „prosty krok” dla tego jednego wpisu (moves.ts). */
export function MovesHint({
  moves,
  off = false,
  onToggle,
}: {
  moves: number;
  off?: boolean;
  onToggle?: (off: boolean) => void;
}) {
  return (
    <p className="moves-hint">
      ↷ przeniesiony {moves}×
      {onToggle && (
        <button
          type="button"
          className={`nudge-toggle${off ? " off" : ""}`}
          aria-pressed={off}
          title={
            off
              ? "Podpowiedź po kolejnych przeniesieniach jest wyłączona dla tego wpisu. Kliknij, żeby ją włączyć."
              : "Nie pokazuj dla tego wpisu podpowiedzi po kolejnych przeniesieniach (licznik dalej liczy)"
          }
          onClick={() => onToggle(!off)}
        >
          {off ? "🔕 bez podpowiedzi" : "wyłącz podpowiedź"}
        </button>
      )}
    </p>
  );
}
