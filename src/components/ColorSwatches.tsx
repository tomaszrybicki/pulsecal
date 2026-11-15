import { PALETTE } from "../colors";

/**
 * Wybór koloru: paleta Pulsecal, a jeśli wpis ma kolor spoza niej (z Google / kolor kalendarza) —
 * dodatkowe, zaznaczone kółko z tym kolorem, żeby było widać, jaki jest teraz.
 */
export function ColorSwatches({
  value,
  onChange,
  small,
}: {
  value: string;
  onChange: (color: string) => void;
  small?: boolean;
}) {
  const custom = !PALETTE.some((c) => c.value === value);
  return (
    <div className={`swatches${small ? " small" : ""}`}>
      {custom && (
        <button
          type="button"
          className="swatch"
          aria-label="Kolor z Google"
          title="Kolor z Google"
          style={{ background: value }}
          aria-pressed
          onClick={() => onChange(value)}
        />
      )}
      {PALETTE.map((c) => (
        <button
          key={c.id}
          type="button"
          className="swatch"
          aria-label={`Kolor ${c.id}`}
          style={{ background: c.value }}
          aria-pressed={value === c.value}
          onClick={() => onChange(c.value)}
        />
      ))}
    </div>
  );
}
