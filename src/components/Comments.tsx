import { useState } from "react";
import type { WorkComment } from "../types";
import { formatClock, formatDayShort } from "../time";

type Props = {
  comments: WorkComment[];
  /** Tekst nowego komentarza (trzymany wyżej, żeby zamknięcie okna go nie zgubiło). */
  draft: string;
  onDraft: (text: string) => void;
  onChange: (comments: WorkComment[]) => void;
};

const when = (t: number) => `${formatDayShort(new Date(t))}, ${formatClock(new Date(t))}`;

/** Komentarze jak w Jirze: pole na nowy na górze, pod nim lista od najnowszego; edycja i usuwanie. */
export function Comments({ comments, draft, onDraft, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([{ id: crypto.randomUUID().slice(0, 8), text, at: Date.now() }, ...comments]);
    onDraft("");
  };
  const saveEdit = () => {
    const text = editText.trim();
    if (editing && text) {
      onChange(comments.map((c) => (c.id === editing && c.text !== text ? { ...c, text, edited: Date.now() } : c)));
    }
    setEditing(null);
  };

  return (
    <section className="ji-section ji-comments">
      <h3>komentarze{comments.length ? ` (${comments.length})` : ""}</h3>
      <div className="cm-new">
        <textarea
          rows={draft ? 3 : 1}
          value={draft}
          placeholder="Dodaj komentarz…"
          aria-label="Nowy komentarz"
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              add();
            }
          }}
        />
        {draft.trim() && (
          <div className="cm-actions">
            <span className="hint">Ctrl+Enter</span>
            <button type="button" className="ghost" onClick={() => onDraft("")}>
              Anuluj
            </button>
            <button type="button" className="primary" onClick={add}>
              Dodaj
            </button>
          </div>
        )}
      </div>
      <ul className="cm-list">
        {comments.map((c) => (
          <li key={c.id} className="cm-item">
            <div className="cm-meta">
              {when(c.at)}
              {c.edited ? <span title={`edytowano ${when(c.edited)}`}> · edytowano</span> : null}
            </div>
            {editing === c.id ? (
              <>
                <textarea
                  rows={3}
                  value={editText}
                  aria-label="Edycja komentarza"
                  autoFocus
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      saveEdit();
                    } else if (e.key === "Escape") {
                      // Esc anuluje edycję, a nie zamyka całego okna
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                />
                <div className="cm-actions">
                  <button type="button" className="ghost" onClick={() => setEditing(null)}>
                    Anuluj
                  </button>
                  <button type="button" className="primary" onClick={saveEdit} disabled={!editText.trim()}>
                    Zapisz
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="cm-text">{c.text}</p>
                <div className="cm-links">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      setEditing(c.id);
                      setEditText(c.text);
                      setConfirmDel(null);
                    }}
                  >
                    edytuj
                  </button>
                  {confirmDel === c.id ? (
                    <>
                      <span>usunąć?</span>
                      <button type="button" className="link-btn danger-link" onClick={() => onChange(comments.filter((x) => x.id !== c.id))}>
                        tak
                      </button>
                      <button type="button" className="link-btn" onClick={() => setConfirmDel(null)}>
                        nie
                      </button>
                    </>
                  ) : (
                    <button type="button" className="link-btn" onClick={() => setConfirmDel(c.id)}>
                      usuń
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
