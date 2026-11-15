import { startOfMonth, monthGrid, sameDay } from "../time";
import type { CalEvent } from "../types";

type Props = {
  now: Date;
  cursor: Date;
  events: CalEvent[];
  onDay: (d: Date) => void;
};

export function MonthView({ now, cursor, events, onDay }: Props) {
  const cells = monthGrid(cursor);
  const month = startOfMonth(cursor).getMonth();
  return (
    <div className="month">
      {["pn", "wt", "śr", "cz", "pt", "sb", "nd"].map((d) => (
        <div key={d} className="hint" style={{ textAlign: "center" }}>
          {d}
        </div>
      ))}
      {cells.map((d) => {
        const dayEvents = events.filter((e) => sameDay(new Date(e.start), d));
        return (
          <button
            key={d.toISOString()}
            className={`cell${d.getMonth() !== month ? " out" : ""}${sameDay(d, now) ? " today" : ""}`}
            onClick={() => onDay(d)}
          >
            {d.getDate()}
            <span className="dots">
              {dayEvents.slice(0, 3).map((e) => (
                <i key={e.id} style={{ background: e.color }} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
