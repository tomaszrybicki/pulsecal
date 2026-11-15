import { tagColor } from "../tags";

/** Tagi wpisu jako małe kolorowe kropki (kolor tagu jak w panelu bocznym). */
export function TagDots({ tags, max = 5 }: { tags?: string[]; max?: number }) {
  if (!tags?.length) return null;
  return (
    <span className="tag-dots" aria-label={`Tagi: ${tags.join(", ")}`}>
      {tags.slice(0, max).map((t) => (
        <i key={t} style={{ background: tagColor(t) }} title={t} />
      ))}
    </span>
  );
}
