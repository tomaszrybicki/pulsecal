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

/** Normalizacja: pojedyncze spacje, bez przecinków (to separator). Wielkość liter zostaje taka, jak wpisano. */
export function normalizeTag(raw: string): string {
  return raw.replace(/[,\n\r]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** Klucz porównań: „Praca” i „praca” to ten sam tag (filtr, kolor, duplikaty, podpowiedzi). */
export function tagKey(tag: string): string {
  return tag.toLocaleLowerCase("pl");
}

export function hasTag(tags: string[], tag: string): boolean {
  const k = tagKey(tag);
  return tags.some((t) => tagKey(t) === k);
}

export function normalizeTags(raw: string[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const t = normalizeTag(r);
    if (t && !hasTag(out, t)) out.push(t);
  }
  return out;
}

/** Tag z domyślnej reguły „!” na początku tytułu (DEFAULT_RULES w tagRules.ts). */
export const IMPORTANT_TAG = "ważne";

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
  return tags.some((t) => !hidden.has(tagKey(t)));
}

/* ── kolory tagów ── */

const COLORS_KEY = "pulsecal:tag-colors";

function loadColors(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(COLORS_KEY) || "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

let customColors = loadColors();

/** Kolory ustawione ręcznie (klucz tagu → #rrggbb). */
export function getTagColors(): Record<string, string> {
  return customColors;
}

/** Ustaw kolor tagu (null = z powrotem automatyczny). Zapis w localStorage, kopia w Google (settings.ts). */
export function setTagColor(tag: string, color: string | null): void {
  const next = { ...customColors };
  if (color) next[tagKey(tag)] = color.toLowerCase();
  else delete next[tagKey(tag)];
  customColors = next;
  localStorage.setItem(COLORS_KEY, JSON.stringify(next));
}

/** Podmień wszystkie kolory naraz (cofnięcie zmiany nazwy tagu). */
export function replaceTagColors(colors: Record<string, string>): void {
  customColors = { ...colors };
  localStorage.setItem(COLORS_KEY, JSON.stringify(customColors));
}

/** Po odtworzeniu ustawień z kopii. */
export function reloadTagColors(): void {
  customColors = loadColors();
}

function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Kolor automatyczny z nazwy — ten sam na każdym urządzeniu. */
export function autoTagColor(tag: string): string {
  const k = tagKey(tag);
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return hslHex(h % 360, 0.58, 0.58);
}

/** Kolor tagu: ustawiony ręcznie albo automatyczny (#rrggbb — działa też z <input type="color">). */
export function tagColor(tag: string): string {
  return customColors[tagKey(tag)] ?? autoTagColor(tag);
}

export function hasCustomColor(tag: string): boolean {
  return tagKey(tag) in customColors;
}

/* ── tagi kolorujące wpisy ── */

const PAINT_KEY = "pulsecal:tag-paint";

function loadPaint(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PAINT_KEY) || "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let paintTags = loadPaint();

/** Klucze tagów, których kolor przejmują wpisy (tylko wygląd — kolor wpisu w bazie i w Google się nie zmienia). */
export function getPaintTags(): string[] {
  return paintTags;
}

export function isPainted(tag: string): boolean {
  return paintTags.includes(tagKey(tag));
}

export function setPainted(tag: string, on: boolean): void {
  const k = tagKey(tag);
  replacePaintTags(on ? [...paintTags.filter((x) => x !== k), k] : paintTags.filter((x) => x !== k));
}

export function replacePaintTags(keys: string[]): void {
  paintTags = [...keys];
  localStorage.setItem(PAINT_KEY, JSON.stringify(paintTags));
}

/** Po odtworzeniu ustawień z kopii. */
export function reloadPaintTags(): void {
  paintTags = loadPaint();
}

/** Kolor, w jakim pokazać wpis: kolor pierwszego jego tagu „kolorującego”, inaczej kolor wpisu. */
export function shownColor(e: { tags?: string[]; color: string }): string {
  if (paintTags.length) {
    for (const t of e.tags ?? []) if (paintTags.includes(tagKey(t))) return tagColor(t);
  }
  return e.color;
}
