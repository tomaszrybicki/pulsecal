import { useHoldDrag } from "../hooks/useHoldDrag";

/**
 * Epik na kalendarzu (WorkItem.showOn): specjalny wpis całodniowy na dwa wiersze — nazwa epiku, a pod nią
 * przesuwający się pasek z nazwami jego zadań (jak pasek wiadomości w telewizji). Klik → szczegóły epiku.
 */
export type Banner = {
  id: string;
  title: string;
  color: string;
  /** dzień (lokalna północ, epoch ms) */
  day: number;
  tasks: { title: string; done: boolean }[];
};

export function EpicBanner({ b, onOpen, onDrag, className = "", style }: {
  b: Banner;
  onOpen: (id: string) => void;
  /** Przeciągnięcie banera na inny dzień (App: ten sam mechanizm co z panelu bocznego). */
  onDrag?: (id: string, x: number, y: number) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { props: dragProps, wasDragged } = useHoldDrag(onDrag ? (x, y) => onDrag(b.id, x, y) : undefined);
  const items = b.tasks.length ? b.tasks : [{ title: "brak zadań", done: false }];
  const chars = items.reduce((n, t) => n + t.title.length + 4, 0);
  // stała prędkość czytania: im więcej tekstu, tym dłuższy obieg
  const duration = Math.max(9, chars * 0.22);
  const todo = b.tasks.filter((t) => !t.done).length;
  const run = (hidden: boolean) => (
    <span className="eb-run" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={i} className={`eb-item${t.done ? " done" : ""}`}>
          {t.done ? "✓ " : ""}
          {t.title}
        </span>
      ))}
    </span>
  );
  return (
    <button
      type="button"
      className={`epic-banner ${className}`}
      style={{ ...style, ["--epic" as string]: b.color, ["--ticker-dur" as string]: `${duration}s` }}
      title={`Epik: ${b.title} — ${todo} ${todo === 1 ? "zadanie" : "zadań"} do zrobienia${onDrag ? " · przeciągnij na inny dzień" : ""}`}
      {...dragProps}
      onPointerDown={(e) => {
        // nie zaczynaj przeciągania wpisów / tworzenia wpisu w kalendarzu pod spodem
        e.stopPropagation();
        dragProps.onPointerDown?.(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!wasDragged()) onOpen(b.id);
      }}
    >
      <span className="eb-title">
        <span className="eb-mark" aria-hidden>
          ◆
        </span>
        {b.title || "(bez nazwy)"}
      </span>
      <span className="eb-ticker">
        <span className="eb-track">
          {run(false)}
          {run(true)}
        </span>
      </span>
    </button>
  );
}
