import { useEffect, useState } from "react";
import { makeRule, type RuleKind, type TagRule } from "../tagRules";
import { tagColor } from "../tags";
import { SheetFrame } from "./SheetFrame";

type Props = {
  rules: TagRule[];
  knownTags: string[];
  onChange: (rules: TagRule[]) => void;
  /** Dopisz tagi z reguł do wszystkich istniejących wpisów. */
  onApplyAll: () => void;
  onClose: () => void;
};

/** Edycja reguł tagów: „słowo → tag”. */
export function TagRulesSheet({ rules, knownTags, onChange, onApplyAll, onClose }: Props) {
  const [word, setWord] = useState("");
  const [tag, setTag] = useState("");
  const [kind, setKind] = useState<RuleKind>("word");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const add = () => {
    const r = makeRule(word, tag, kind);
    if (!r) return;
    onChange([...rules, r]);
    setWord("");
    setTag("");
  };

  return (
    <SheetFrame anchor={null} className="rules-sheet" label="Reguły tagów" onDismiss={onClose}>
      <h2>reguły tagów</h2>
      <p className="hint">
        Gdy tytuł albo notatka zawiera słowo (całe, bez względu na wielkość liter) albo tytuł zaczyna się od
        podanego tekstu, wpis dostaje tag. Działa przy zapisie, w szybkim dodawaniu i dla wpisów z Google; reguły
        tylko dodają tagi.
      </p>
      <ul className="rules-list">
        {rules.map((r) => (
          <li key={r.id}>
            <span className="rule-word">
              {r.kind === "start" && <small>tytuł zaczyna się od </small>}„{r.word}”
            </span>
            <span aria-hidden>→</span>
            <span className="tag-chip" style={{ ["--tag" as string]: tagColor(r.tag) }}>
              <i className="tag-dot" />
              {r.tag}
              <button
                type="button"
                aria-label={`Usuń regułę ${r.word} → ${r.tag}`}
                onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
              >
                ×
              </button>
            </span>
          </li>
        ))}
        {!rules.length && <li className="hint">Brak reguł.</li>}
      </ul>
      <form
        className="rule-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <select value={kind} aria-label="Rodzaj reguły" onChange={(e) => setKind(e.target.value as RuleKind)}>
          <option value="word">zawiera słowo</option>
          <option value="start">tytuł zaczyna się od</option>
        </select>
        <input
          value={word}
          placeholder={kind === "start" ? "np. !" : "słowo, np. dentysta"}
          aria-label="Słowo"
          onChange={(e) => setWord(e.target.value)}
        />
        <span aria-hidden>→</span>
        <input
          value={tag}
          placeholder="tag"
          aria-label="Tag"
          list="pulsecal-known-tags"
          onChange={(e) => setTag(e.target.value)}
        />
        <datalist id="pulsecal-known-tags">
          {knownTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button type="submit" className="primary" disabled={!word.trim() || !tag.trim()}>
          Dodaj
        </button>
      </form>
      <div className="row-actions">
        <button type="button" className="ghost" disabled={!rules.length} onClick={onApplyAll}>
          Zastosuj do wpisów od dziś
        </button>
        <button type="button" className="primary" onClick={onClose}>
          Gotowe
        </button>
      </div>
    </SheetFrame>
  );
}
