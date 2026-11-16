import { useState } from "react";

const NEW = "__new__";

type Props = {
  value?: string;
  epics: { id: string; label: string }[];
  onChange: (epicId: string | undefined) => void;
  /** Utwórz epik o tej nazwie i zwróć jego ID (wpis od razu do niego trafia). */
  onCreateEpic: (name: string) => string;
  className?: string;
};

/** Wybór epiku dla wpisu z kalendarza, z opcją „+ nowy epik…” (nazwa wpisywana na miejscu). */
export function EpicPicker({ value, epics, onChange, onCreateEpic, className = "" }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const create = () => {
    const n = name.trim();
    if (!n) return;
    onChange(onCreateEpic(n));
    setName("");
    setCreating(false);
  };

  if (creating) {
    return (
      <span className={`epic-picker creating ${className}`}>
        <input
          autoFocus
          value={name}
          placeholder="Nazwa nowego epiku"
          aria-label="Nazwa nowego epiku"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              create();
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              setCreating(false);
            }
          }}
        />
        <button type="button" className="primary" disabled={!name.trim()} onClick={create}>
          Utwórz
        </button>
        <button type="button" className="ghost" aria-label="Anuluj" onClick={() => setCreating(false)}>
          ×
        </button>
      </span>
    );
  }

  // wybrany epik mógł jeszcze nie dotrzeć do listy (właśnie utworzony) — nie gubimy wyboru
  const known = !value || epics.some((o) => o.id === value);
  return (
    <select
      className={`epic-picker ${className}`}
      aria-label="Epik"
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === NEW) setCreating(true);
        else onChange(e.target.value || undefined);
      }}
    >
      <option value="">— bez epiku —</option>
      {!known && <option value={value}>(nowy epik)</option>}
      {epics.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
      <option value={NEW}>+ nowy epik…</option>
    </select>
  );
}
