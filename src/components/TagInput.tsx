import { useMemo, useState } from "react";
import { hasTag, normalizeTag, tagColor, tagKey } from "../tags";

type Props = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Znane tagi (najczęstsze pierwsze) — podpowiedzi do dodania jednym tapnięciem. */
  known: string[];
  maxSuggestions?: number;
};

/**
 * Edytor tagów: wybrane jako pigułki (× usuwa), pole do wpisania nowego (Enter / przecinek dodaje,
 * Backspace na pustym usuwa ostatni), poniżej podpowiedzi z już używanych tagów.
 */
export function TagInput({ value, onChange, known, maxSuggestions = 8 }: Props) {
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return setText("");
    // znany tag w innej wielkości liter → bierzemy istniejącą pisownię
    const known1 = known.find((k) => tagKey(k) === tagKey(t));
    if (!hasTag(value, t)) onChange([...value, known1 ?? t]);
    setText("");
  };

  const suggestions = useMemo(() => {
    const q = normalizeTag(text);
    const qk = tagKey(q);
    return known.filter((t) => !hasTag(value, t) && (!qk || tagKey(t).includes(qk))).slice(0, maxSuggestions);
  }, [known, value, text, maxSuggestions]);

  const typed = normalizeTag(text);

  return (
    <div className="tag-input">
      <div className="tag-box">
        {value.map((t) => (
          <span key={t} className="tag-chip" style={{ ["--tag" as string]: tagColor(t) }}>
            <i className="tag-dot" />
            {t}
            <button type="button" aria-label={`Usuń tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          placeholder={value.length ? "+ tag" : "dodaj tag…"}
          aria-label="Dodaj tag"
          enterKeyHint="enter"
          autoCapitalize="off"
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) {
              // wklejone/wpisane „a, b" → kilka tagów naraz
              const parts = v.split(",");
              const rest = parts.pop() ?? "";
              const next = [...value];
              for (const p of parts) {
                const t = normalizeTag(p);
                if (t && !hasTag(next, t)) next.push(known.find((k) => tagKey(k) === tagKey(t)) ?? t);
              }
              onChange(next);
              setText(rest);
            } else {
              setText(v);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              if (typed) add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (typed) add(text);
          }}
        />
      </div>
      {(suggestions.length > 0 || (typed && !hasTag(known, typed) && !hasTag(value, typed))) && (
        <div className="tag-suggest">
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              className="tag-chip ghost-chip"
              style={{ ["--tag" as string]: tagColor(t) }}
              // mousedown zamiast click: nie zabiera fokusu z pola, więc blur nie dodaje wpisanego tekstu
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(t)}
            >
              <i className="tag-dot" />
              {t}
            </button>
          ))}
          {typed && !hasTag(known, typed) && !hasTag(value, typed) && (
            <button
              type="button"
              className="tag-chip ghost-chip new"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(text)}
            >
              + nowy: {typed}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
