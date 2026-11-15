/**
 * Szybkie dodawanie z jednego zdania, po polsku:
 *   „dentysta jutro 14:30 1h #wizyta"  → jutro 14:30–15:30, tag „wizyta"
 *   „urodziny mamy 26.11"              → 26 listopada, cały dzień
 *   „faktury w piątek o 10 #komp"      → piątek 10:00 (+ domyślna długość), tag pasujący do „komp…"
 *   „kupić mleko"                      → dziś od najbliższego kwadransa
 * Bez daty i godziny: dziś, od najbliższego kwadransa. Z datą bez godziny: cały dzień.
 */
import { DEFAULT_TIMED_MIN } from "./draft";
import { normalizeTag, tagKey } from "./tags";
import { MINUTE, addDays, atMinutes, endOfDay, nextQuarter, startOfDay } from "./time";

export type ParsedEntry = {
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  tags: string[];
  /** Czy w tekście była data albo godzina (wtedy Enter domyślnie tworzy wpis, a nie otwiera wynik). */
  hasWhen: boolean;
};

const WEEKDAYS: [RegExp, number][] = [
  [/^(pn|pon|poniedzia[lł]ek|poniedzia[lł]ku)$/, 1],
  [/^(wt|wto|wtorek|wtorku)$/, 2],
  [/^([sś]r|[sś]roda|[sś]rod[eę]|[sś]rody)$/, 3],
  [/^(cz|czw|czwartek|czwartku)$/, 4],
  [/^(pt|pi[aą]|pi[aą]tek|pi[aą]tku)$/, 5],
  [/^(sb|sob|sobota|sobot[eę]|soboty)$/, 6],
  // bez „nie" — to zwykłe słowo („nie zapomnieć")
  [/^(nd|ndz|niedziela|niedziel[eę]|niedzieli)$/, 0],
];

const strip = (s: string) => s.toLowerCase().normalize("NFC");

function nextWeekday(from: Date, dow: number): Date {
  const d = startOfDay(from);
  const diff = (dow - d.getDay() + 7) % 7;
  return addDays(d, diff);
}

/** Dopasowanie tagu: dokładnie znany → ten; jedyny znany zaczynający się tak samo → ten; inaczej nowy. */
function resolveTag(raw: string, known: string[]): string {
  const t = normalizeTag(raw.replace(/[_]/g, " "));
  if (!t) return "";
  const same = (a: string, b: string) => tagKey(a) === tagKey(b);
  const exact = known.find((k) => same(k, t));
  if (exact) return exact;
  const spaced = normalizeTag(t.replace(/-/g, " "));
  const exactSpaced = known.find((k) => same(k, spaced));
  if (exactSpaced) return exactSpaced;
  const prefixed = known.filter((k) => tagKey(k).startsWith(tagKey(t)) || tagKey(k).startsWith(tagKey(spaced)));
  return prefixed.length === 1 ? prefixed[0] : t;
}

export function parseQuickEntry(text: string, knownTags: string[] = [], now = new Date()): ParsedEntry {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const used = new Array(words.length).fill(false);
  const tags: string[] = [];
  let day: Date | null = null;
  let startMin: number | null = null;
  let endMin: number | null = null;
  let duration: number | null = null;
  let forceAllDay = false;

  const take = (...idx: number[]) => idx.forEach((i) => (used[i] = true));
  // przyimek przed datą/godziną („w piątek", „o 14", „na jutro") też znika z tytułu
  const takePrep = (i: number, preps: string[]) => {
    if (i > 0 && !used[i - 1] && preps.includes(strip(words[i - 1]))) used[i - 1] = true;
  };

  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    const wClean = strip(raw).replace(/[,;!?]+$/, "");

    if (raw.startsWith("#") && raw.length > 1) {
      const t = resolveTag(raw.slice(1), knownTags);
      if (t && !tags.includes(t)) tags.push(t);
      take(i);
      continue;
    }

    if (!day) {
      if (/^(dzi[sś]|dzisiaj)$/.test(wClean)) {
        day = startOfDay(now);
        take(i);
        takePrep(i, ["na"]);
        continue;
      }
      if (wClean === "jutro") {
        day = addDays(startOfDay(now), 1);
        take(i);
        takePrep(i, ["na"]);
        continue;
      }
      if (wClean === "pojutro") {
        day = addDays(startOfDay(now), 2);
        take(i);
        takePrep(i, ["na"]);
        continue;
      }
      const wd = WEEKDAYS.find(([re]) => re.test(wClean));
      if (wd) {
        day = nextWeekday(now, wd[1]);
        take(i);
        takePrep(i, ["w", "we", "na"]);
        continue;
      }
      // „za 3 dni", „za tydzień"
      if (wClean === "za" && i + 1 < words.length) {
        const n = strip(words[i + 1]);
        if (/^tydzie[nń]$/.test(n)) {
          day = addDays(startOfDay(now), 7);
          take(i, i + 1);
          continue;
        }
        if (/^\d+$/.test(n) && i + 2 < words.length && /^(dni|dzie[nń])$/.test(strip(words[i + 2]))) {
          day = addDays(startOfDay(now), Number(n));
          take(i, i + 1, i + 2);
          continue;
        }
      }
      // 26.11, 26.11.2026, 26/11, 2026-11-26
      let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(wClean);
      if (m) {
        day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        take(i);
        continue;
      }
      m = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\.?$/.exec(wClean);
      if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
        let y = m[3] ? Number(m[3]) : now.getFullYear();
        if (y < 100) y += 2000;
        let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
        // bez roku i już minęło → przyszły rok
        if (!m[3] && d < startOfDay(now)) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]));
        day = d;
        take(i);
        takePrep(i, ["na"]);
        continue;
      }
    }

    if (startMin === null) {
      // 14:30, 14:30-15:15, 9-10 (z „o"/„od"), „o 14"
      let m = /^(\d{1,2}):(\d{2})(?:[-–](\d{1,2}):(\d{2}))?$/.exec(wClean);
      if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
        startMin = Number(m[1]) * 60 + Number(m[2]);
        if (m[3]) endMin = Number(m[3]) * 60 + Number(m[4]);
        take(i);
        takePrep(i, ["o", "od"]);
        continue;
      }
      m = /^(\d{1,2})[-–](\d{1,2})$/.exec(wClean);
      if (m && i > 0 && ["o", "od"].includes(strip(words[i - 1])) && Number(m[1]) < 24 && Number(m[2]) <= 24) {
        startMin = Number(m[1]) * 60;
        endMin = Number(m[2]) * 60;
        take(i);
        takePrep(i, ["o", "od"]);
        continue;
      }
      m = /^(\d{1,2})$/.exec(wClean);
      if (m && i > 0 && ["o", "od"].includes(strip(words[i - 1])) && Number(m[1]) < 24) {
        startMin = Number(m[1]) * 60;
        take(i);
        takePrep(i, ["o", "od"]);
        continue;
      }
    }

    if (duration === null) {
      // 30m, 30min, 1h, 1.5h, 1,5 h, 2 godz
      let m = /^(\d+(?:[.,]\d+)?)(m|min|h|godz|g)$/.exec(wClean);
      let unit = m?.[2];
      let num = m?.[1];
      if (!m && /^\d+(?:[.,]\d+)?$/.test(wClean) && i + 1 < words.length) {
        const u = strip(words[i + 1]).replace(/[.,]$/, "");
        if (/^(m|min|minut|minuty|h|godz|godziny|godzin|godzina)$/.test(u)) {
          num = wClean;
          unit = u;
          take(i + 1);
        }
      }
      if (num && unit) {
        const v = Number(num.replace(",", "."));
        duration = Math.round(/^(h|g)/.test(unit) ? v * 60 : v);
        take(i);
        takePrep(i, ["na"]);
        continue;
      }
    }

    if (/^(ca[lł]y)$/.test(wClean) && i + 1 < words.length && /^dzie[nń]$/.test(strip(words[i + 1]))) {
      forceAllDay = true;
      take(i, i + 1);
      continue;
    }
    if (/^ca[lł]odniow[eya]$/.test(wClean)) {
      forceAllDay = true;
      take(i);
    }
  }

  const title = words
    .filter((_, i) => !used[i])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const hasWhen = day !== null || startMin !== null;
  const base = day ?? startOfDay(now);

  if (forceAllDay || (day !== null && startMin === null)) {
    return {
      title,
      tags,
      hasWhen: true,
      allDay: true,
      start: startOfDay(base).getTime(),
      end: endOfDay(base).getTime(),
    };
  }

  let start: Date;
  if (startMin !== null) start = atMinutes(base, startMin);
  else start = nextQuarter(now);
  let end: number;
  if (endMin !== null && endMin > (startMin ?? 0)) end = atMinutes(base, endMin).getTime();
  else end = start.getTime() + (duration ?? DEFAULT_TIMED_MIN) * MINUTE;

  return { title, tags, hasWhen, allDay: false, start: start.getTime(), end };
}
