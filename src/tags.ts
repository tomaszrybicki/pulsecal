/**
 * Tagi. Google Calendar ich nie ma, więc na granicy z Google zapisujemy je jako ostatnią linię opisu:
 *
 *     Notatka do wpisu…
 *
 *     Tagi: przypomnienie, remont mieszkania, przy komputerze
 *
 * Czytelne dla człowieka w Google, łatwe do sparsowania i odporne na edycję w Google (także HTML).
 * Lokalnie tagi to osobne pole `CalEvent.tags` (indeks multiEntry w IndexedDB), a `notes` jest bez tej linii.
 */

const TAG_LINE = /^\s*(?:tagi|tags)\s*:\s*(.*)$/i;
export const TAG_LINE_PREFIX = "Tagi: ";

/** Klucz filtra dla wpisów bez tagów. */
export const UNTAGGED = "__untagged__";

/** Normalizacja: małe litery, pojedyncze spacje, bez przecinków (to separator). */
export function normalizeTag(raw: string): string {
  return raw.replace(/[,\n\r]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
}

export function normalizeTags(raw: string[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const t = normalizeTag(r);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Opis edytowany w Google bywa HTML-em (<br>, <b>, <a>…) — zamieniamy na zwykły tekst. */
export function htmlToText(s: string): string {
  if (!/<\/?[a-z][^>]*>/i.test(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTITIES[e] ?? "")
    .replace(/\n{3,}/g, "\n\n");
}

/** Opis z Google → notatka + tagi. Linia tagów musi być ostatnią niepustą linią. */
export function splitTags(description: string): { notes: string; tags: string[] } {
  const text = htmlToText(description ?? "");
  const lines = text.split(/\r?\n/);
  let last = lines.length - 1;
  while (last >= 0 && !lines[last].trim()) last -= 1;
  const m = last >= 0 ? TAG_LINE.exec(lines[last]) : null;
  if (!m) return { notes: text.trimEnd(), tags: [] };
  return {
    notes: lines.slice(0, last).join("\n").trimEnd(),
    tags: normalizeTags(m[1].split(",")),
  };
}

/** Notatka + tagi → opis dla Google. */
export function joinTags(notes: string, tags: string[]): string {
  const body = (notes ?? "").trimEnd();
  if (!tags.length) return body;
  return `${body}${body ? "\n\n" : ""}${TAG_LINE_PREFIX}${tags.join(", ")}`;
}

/**
 * Widoczność przy filtrze: wpis jest widoczny, jeśli ma choć jeden widoczny tag
 * (wpis bez tagów — jeśli widoczne są „bez tagów"). Dzięki temu „pokaż tylko X" pokazuje wszystko z X.
 */
export function isVisible(tags: string[] | undefined, hidden: ReadonlySet<string>): boolean {
  if (!hidden.size) return true;
  if (!tags?.length) return !hidden.has(UNTAGGED);
  return tags.some((t) => !hidden.has(t));
}

/** Stały kolor tagu z nazwy (ten sam na każdym urządzeniu, bez zapisywania). */
export function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 58% 58%)`;
}
