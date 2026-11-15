/**
 * Reguły tagów: „słowo (albo fraza) w tytule lub notatce → tag”, np. „dentysta” → „wizyta”.
 * Zapisane w localStorage (a kopia w Google — patrz settings.ts). Działają przy zapisie w aplikacji,
 * w szybkim dodawaniu i dla wpisów z Google. Tylko dodają tagi, nigdy nie usuwają.
 */
import { hasTag, normalizeTag, normalizeTags } from "./tags";

export type TagRule = { id: string; word: string; tag: string };

const KEY = "pulsecal:tag-rules";
/** Zdarzenie po zmianie ustawień (kopia zapasowa w Google nasłuchuje). */
export const SETTINGS_EVENT = "pulsecal:settings";

export function getTagRules(): TagRule[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (r): r is TagRule =>
        r && typeof r.id === "string" && typeof r.word === "string" && typeof r.tag === "string" && r.word.trim() !== "",
    );
  } catch {
    return [];
  }
}

export function setTagRules(rules: TagRule[]): void {
  localStorage.setItem(KEY, JSON.stringify(rules));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function makeRule(word: string, tag: string): TagRule | null {
  const w = word.replace(/\s+/g, " ").trim();
  const t = normalizeTag(tag);
  if (!w || !t) return null;
  return { id: crypto.randomUUID(), word: w, tag: t };
}

const cache = new Map<string, RegExp>();

/** Całe słowo/fraza, bez względu na wielkość liter (także ą, Ś…). „kot” nie pasuje do „kotlet”. */
function wordRe(word: string): RegExp {
  let re = cache.get(word);
  if (!re) {
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    re = new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?=$|[^\\p{L}\\p{N}])`, "iu");
    cache.set(word, re);
  }
  return re;
}

export function ruleMatches(rule: TagRule, text: string): boolean {
  return wordRe(rule.word).test(text);
}

/**
 * Dodaj tagi z reguł. `prev` = poprzednia wersja wpisu: reguła działa tylko, gdy jej słowo pojawiło się
 * teraz (wcześniej go nie było), żeby tag usunięty ręcznie nie wracał przy każdym zapisie.
 */
export function applyTagRules(
  title: string,
  notes: string,
  tags: string[],
  prev?: { title: string; notes: string },
  rules: TagRule[] = getTagRules(),
): string[] {
  if (!rules.length) return tags;
  const now = `${title}\n${notes}`;
  const before = prev ? `${prev.title}\n${prev.notes}` : null;
  let out = tags;
  for (const r of rules) {
    if (!ruleMatches(r, now)) continue;
    if (before !== null && ruleMatches(r, before)) continue;
    if (!hasTag(out, r.tag)) out = normalizeTags([...out, r.tag]);
  }
  return out;
}
