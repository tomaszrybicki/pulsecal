import { useContext, useRef, useState } from "react";
import { EpicContext } from "./EpicTag";

type Props = {
  value?: string;
  epics: { id: string; label: string }[];
  onChange: (epicId: string | undefined) => void;
  /** Utwórz epik o tej nazwie i zwróć jego ID (wpis od razu do niego trafia). */
  onCreateEpic: (name: string) => string;
  className?: string;
  placeholder?: string;
};

const norm = (s: string) => s.trim().toLocaleLowerCase("pl");

/**
 * Epik wpisu bez tarcia: pole tekstowe z listą epików pod spodem. Wpisz nazwę i Enter —
 * istniejący epik zostaje wybrany, a nowa nazwa od razu tworzy epik i przypisuje do niego wpis.
 */
export function EpicPicker({ value, epics, onChange, onCreateEpic, className = "", placeholder = "Epik — wpisz nazwę, Enter" }: Props) {
  const info = useContext(EpicContext);
  const current = value ? info.get(value) : undefined;
  const currentLabel = value ? (epics.find((o) => o.id === value)?.label ?? current?.path ?? "") : "";
  const [text, setText] = useState<string | null>(null); // null = pole pokazuje wybrany epik
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const open = text !== null;

  const q = norm(text ?? "");
  const matches = epics.filter((o) => !q || norm(o.label).includes(q) || norm(info.get(o.id)?.title ?? "").includes(q));
  const exact = epics.find((o) => norm(info.get(o.id)?.title ?? o.label) === q || norm(o.label) === q);
  const canCreate = Boolean(q) && !exact;
  // pozycje listy: istniejące epiki, na końcu „+ utwórz …”
  const options: ({ kind: "epic"; id: string; label: string } | { kind: "new" })[] = [
    ...matches.slice(0, 8).map((o) => ({ kind: "epic" as const, ...o })),
    ...(canCreate ? [{ kind: "new" as const }] : []),
  ];

  const close = () => {
    setText(null);
    setActive(0);
  };
  const pick = (id: string | undefined) => {
    onChange(id);
    close();
    input.current?.blur();
  };
  const create = () => {
    const name = (text ?? "").trim();
    if (name) pick(onCreateEpic(name));
  };
  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.kind === "new") create();
    else pick(o.id);
  };

  return (
    <div className={`epic-picker${open ? " open" : ""} ${className}`}>
      <div className="ep-field">
        {current && !open && <span className="ep-dot" style={{ background: current.color }} aria-hidden />}
        <input
          ref={input}
          value={open ? text : currentLabel}
          placeholder={placeholder}
          aria-label="Epik"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          onFocus={() => {
            setText("");
            setActive(0);
          }}
          onBlur={() => window.setTimeout(close, 120)}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const n = options.length;
              if (n) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
            } else if (e.key === "Enter") {
              // Enter tylko tutaj — nie zapisuje / nie zamyka okna wpisu
              e.preventDefault();
              e.stopPropagation();
              if (!q) close();
              // pełna nazwa istniejącego epiku wygrywa z pierwszą częściową podpowiedzią (chyba że wybrano strzałkami)
              else if (exact && active === 0) pick(exact.id);
              else choose(active);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              close();
              input.current?.blur();
            }
          }}
        />
        {value && !open && (
          <button type="button" className="ep-clear" aria-label="Usuń wpis z epiku" title="Bez epiku" onClick={() => pick(undefined)}>
            ×
          </button>
        )}
      </div>
      {open && options.length > 0 && (
        <div className="ep-list" role="listbox">
          {options.map((o, i) => (
            <button
              key={o.kind === "new" ? "__new" : o.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`ep-opt${i === active ? " active" : ""}${o.kind === "epic" && o.id === value ? " current" : ""}`}
              // mousedown: zanim pole straci fokus
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
            >
              {o.kind === "new" ? (
                <span className="ep-new">+ nowy epik „{(text ?? "").trim()}”</span>
              ) : (
                <>
                  <span className="ep-dot" style={{ background: info.get(o.id)?.color }} aria-hidden />
                  <span className="ep-name">{o.label}</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
      {open && !options.length && <p className="ep-empty">Wpisz nazwę nowego epiku i naciśnij Enter.</p>}
    </div>
  );
}
