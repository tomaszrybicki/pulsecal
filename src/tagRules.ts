/**
 * Reguły tagów: „słowo (albo fraza) w tytule lub notatce → tag”, np. „dentysta” → „wizyta”,
 * albo „tytuł zaczyna się od …” (domyślna reguła „!” → „ważne”).
 * Zapisane w localStorage (a kopia w Google — patrz settings.ts). Działają przy zapisie w aplikacji,
 * w szybkim dodawaniu i dla wpisów z Google. Tylko dodają tagi, nigdy nie usuwają.
 */
import { IMPORTANT_TAG, hasTag, normalizeTag, normalizeTags } from "./tags";

/** "word" (domyślnie) = całe słowo w tytule lub notatce; "start" = tytuł zaczyna się od tego tekstu. */
export type RuleKind = "word" | "start";
export type TagRule = { id: string; word: string; tag: string; kind?: RuleKind };

const KEY = "pulsecal:tag-rules";
/** Wersja reguł domyślnych już dodanych na tym urządzeniu (żeby usunięta reguła domyślna nie wracała). */
const DEFAULTS_KEY = "pulsecal:tag-rules-defaults";
const DEFAULTS_VERSION = 1;

/** Reguły domyślne: „!” na początku tytułu → „ważne” (dawniej zaszyte w kodzie, teraz zwykła reguła). */
export const DEFAULT_RULES: TagRule[] = [{ id: "default-bang", word: "!", tag: IMPORTANT_TAG, kind: "start" }];

/** Dopisz brakujące reguły domyślne (np. po odtworzeniu starej kopii ustawień). */
export function withDefaultRules(rules: TagRule[]): TagRule[] {
  const missing = DEFAULT_RULES.filter((d) => !rules.some((r) => r.id === d.id));
  return missing.length ? [...missing, ...rules] : rules;
}
/** Zdarzenie po zmianie ustawień (kopia zapasowa w Google nasłuchuje). */
export const SETTINGS_EVENT = "pulsecal:settings";

export function getTagRules(): TagRule[] {
  if (Number(localStorage.getItem(DEFAULTS_KEY)) < DEFAULTS_VERSION) {
    localStorage.setItem(DEFAULTS_KEY, String(DEFAULTS_VERSION));
    localStorage.setItem(KEY, JSON.stringify(withDefaultRules(readRules())));
  }
  return readRules();
}

function readRules(): TagRule[] {
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

export function makeRule(word: string, tag: string, kind: RuleKind = "word"): TagRule | null {
  const w = word.replace(/\s+/g, " ").trim();
  const t = normalizeTag(tag);
  if (!w || !t) return null;
  const r: TagRule = { id: crypto.randomUUID(), word: w, tag: t };
  return kind === "start" ? { ...r, kind } : r;
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

/** Reguła „start” patrzy tylko na początek tytułu; „word” na cały tytuł i notatkę. */
export function ruleMatches(rule: TagRule, title: string, notes: string): boolean {
  if (rule.kind === "start") {
    return title.trimStart().toLocaleLowerCase("pl").startsWith(rule.word.toLocaleLowerCase("pl"));
  }
  return wordRe(rule.word).test(`${title}\n${notes}`);
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
  let out = tags;
  for (const r of rules) {
    if (!ruleMatches(r, title, notes)) continue;
    if (prev && ruleMatches(r, prev.title, prev.notes)) continue;
    if (!hasTag(out, r.tag)) out = normalizeTags([...out, r.tag]);
  }
  return out;
}
