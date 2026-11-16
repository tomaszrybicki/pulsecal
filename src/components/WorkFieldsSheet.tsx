import { useEffect, useState } from "react";
import type { WorkField } from "../types";
import { SheetFrame } from "./SheetFrame";

type Props = {
  fields: WorkField[];
  onChange: (fields: WorkField[]) => void;
  onClose: () => void;
};

const TYPE_LABEL: Record<WorkField["type"], string> = { text: "tekst", number: "liczba", select: "lista wyboru" };

const parseOptions = (s: string) =>
  s
    .split(",")
    .map((o) => o.trim())
    .filter((o, i, a) => o && a.indexOf(o) === i);

/** Własne pola zadań (jak „custom fields” w Jirze): nazwa + rodzaj (tekst / liczba / lista wyboru). */
export function WorkFieldsSheet({ fields, onChange, onClose }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkField["type"]>("text");
  const [options, setOptions] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canAdd = name.trim() && (type !== "select" || parseOptions(options).length > 0);
  const add = () => {
    if (!canAdd) return;
    onChange([...fields, { id: crypto.randomUUID().slice(0, 8), name: name.trim(), type, options: type === "select" ? parseOptions(options) : [] }]);
    setName("");
    setOptions("");
  };
  const update = (id: string, patch: Partial<WorkField>) => onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <SheetFrame anchor={null} className="fields-sheet" label="Własne pola" onDismiss={onClose}>
      <h2>własne pola</h2>
      <p className="hint">
        Dodatkowe pola w szczegółach każdego zadania i epiku (obok statusu, priorytetu, terminu i szacunku), np.
        „kontekst”, „energia”, „koszt”. Usunięcie pola nie kasuje wpisanych wartości — wrócą, gdy dodasz je ponownie.
      </p>
      <ul className="fields-list">
        {fields.map((f) => (
          <li key={f.id}>
            <input
              value={f.name}
              aria-label="Nazwa pola"
              onChange={(e) => update(f.id, { name: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && update(f.id, { name: "pole" })}
            />
            <span className="fields-type">{TYPE_LABEL[f.type]}</span>
            {f.type === "select" && (
              <input
                className="fields-options"
                defaultValue={f.options.join(", ")}
                aria-label={`Opcje pola ${f.name}`}
                placeholder="opcje po przecinku"
                onBlur={(e) => update(f.id, { options: parseOptions(e.target.value) })}
              />
            )}
            <button type="button" className="ghost" aria-label={`Usuń pole ${f.name}`} onClick={() => onChange(fields.filter((x) => x.id !== f.id))}>
              ×
            </button>
          </li>
        ))}
        {!fields.length && <li className="hint">Brak własnych pól.</li>}
      </ul>
      <form
        className="fields-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input value={name} placeholder="nazwa, np. kontekst" aria-label="Nazwa nowego pola" onChange={(e) => setName(e.target.value)} />
        <select value={type} aria-label="Rodzaj pola" onChange={(e) => setType(e.target.value as WorkField["type"])}>
          {(Object.keys(TYPE_LABEL) as WorkField["type"][]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        {type === "select" && (
          <input value={options} placeholder="opcje po przecinku: dom, praca" aria-label="Opcje" onChange={(e) => setOptions(e.target.value)} />
        )}
        <button type="submit" className="primary" disabled={!canAdd}>
          Dodaj
        </button>
      </form>
      <div className="row-actions">
        <button type="button" className="primary" onClick={onClose}>
          Gotowe
        </button>
      </div>
    </SheetFrame>
  );
}
