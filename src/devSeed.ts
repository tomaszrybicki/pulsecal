/**
 * Dane testowe (tylko tryb dev: „ustawienia” → „dane testowe”). Wpisy i zadania mają ID zaczynające się od
 * SEED, więc „Usuń dane testowe” kasuje dokładnie je i nic więcej. Zapisywane z pending = 0 — nie lecą do Google
 * (dopóki ich nie zmienisz). Daty liczone od dzisiaj.
 */
import { db } from "./db";
import { PALETTE } from "./colors";
import type { CalEvent, Priority, WorkComment, WorkItem, WorkStatus } from "./types";
import { addDays, endOfDay, startOfDay } from "./time";
import { nextNum } from "./work";

export const SEED = "5eed";

const H = 3_600_000;
const M = 60_000;
const DAY = 24 * H;
const C = Object.fromEntries(PALETTE.map((p) => [p.id, p.value])) as Record<(typeof PALETTE)[number]["id"], string>;

let n = 0;
const seedId = () => `${SEED}${(++n).toString(16).padStart(4, "0")}${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

type Ev = {
  title: string;
  day: number;
  /** "9:30" albo brak = cały dzień */
  at?: string;
  min?: number;
  /** dni (całodniowe kilkudniowe) */
  days?: number;
  color?: string;
  tags?: string[];
  notes?: string;
  epic?: string;
  moves?: number;
  auto?: boolean;
};

export async function hasSeed(): Promise<boolean> {
  return (await db.events.where("id").startsWith(SEED).count()) > 0;
}

export async function clearSeed(): Promise<number> {
  const a = await db.events.where("id").startsWith(SEED).delete();
  const b = await db.items.where("id").startsWith(SEED).delete();
  return a + b;
}

export async function seedTestData(): Promise<{ events: number; items: number }> {
  await clearSeed();
  const today = startOfDay(new Date());
  const now = Date.now();
  const at = (day: number, hm: string) => {
    const [h, m] = hm.split(":").map(Number);
    return addDays(today, day).getTime() + h * H + m * M;
  };

  /* ── epiki i zadania ── */
  const existing = await db.items.toArray();
  let num = nextNum(existing);
  const items: WorkItem[] = [];
  const ids: Record<string, string> = {};
  const item = (
    key: string,
    kind: WorkItem["kind"],
    title: string,
    o: {
      parent?: string;
      status?: WorkStatus;
      priority?: Priority;
      due?: number;
      estimate?: number;
      description?: string;
      pinned?: boolean;
      ageDays?: number;
      comments?: WorkComment[];
    } = {},
  ) => {
    const id = seedId();
    ids[key] = id;
    const t = now - (o.ageDays ?? 0) * DAY;
    items.push({
      id,
      kind,
      title,
      description: o.description ?? "",
      status: o.status ?? "todo",
      parentId: o.parent ? ids[o.parent] : "",
      order: now + items.length,
      createdAt: t - 3 * DAY,
      updatedAt: t,
      deleted: false,
      pending: 0,
      num: num++,
      priority: o.priority ?? "medium",
      due: o.due ?? null,
      estimate: o.estimate ?? null,
      pinned: o.pinned,
      comments: o.comments,
    });
  };
  const due = (d: number) => addDays(today, d).getTime();

  item("kuchnia", "epic", "Remont kuchni", {
    pinned: true,
    description: "Budżet: 15 tys. Termin: przed świętami.\n\n- płytki\n- elektryka\n- malowanie",
  });
  item("k1", "task", "Wybrać płytki", { parent: "kuchnia", status: "done", estimate: 2 });
  item("k2", "task", "Zamówić fachowca", {
    parent: "kuchnia",
    status: "doing",
    priority: "high",
    due: due(2),
    comments: [
      { id: "c2", text: "Pan Marek oddzwoni w czwartek.", at: now - 2 * H },
      { id: "c1", text: "Dzwoniłem do dwóch firm, jedna ma termin dopiero w styczniu.", at: now - 2 * DAY },
    ],
  });
  item("k3", "task", "Kupić farbę", { parent: "kuchnia", estimate: 1, due: due(5) });
  item("k4", "task", "Pomalować ściany", { parent: "kuchnia", estimate: 6, priority: "low" });
  item("elektryka", "epic", "Elektryka", { parent: "kuchnia" });
  item("e1", "task", "Wymienić gniazdka", { parent: "elektryka", priority: "highest", due: due(-1) });
  item("e2", "task", "Lampa nad blatem", { parent: "elektryka", status: "done" });

  item("hiszp", "epic", "Nauka hiszpańskiego", { pinned: true, ageDays: 10 });
  item("h1", "task", "Lekcja 1: powitania", { parent: "hiszp", status: "done", ageDays: 10 });
  item("h2", "task", "Lekcja 2: liczby", { parent: "hiszp", ageDays: 10 });
  item("h3", "task", "Lekcja 3: w restauracji", { parent: "hiszp", ageDays: 10 });

  item("gory", "epic", "Wyjazd w góry", { pinned: true });
  item("g1", "task", "Zarezerwować nocleg", { parent: "gory", status: "done" });
  item("g2", "task", "Kupić bilety na pociąg", { parent: "gory", status: "done" });
  item("g3", "task", "Sprawdzić prognozę", { parent: "gory", status: "done" });
  item("g4", "task", "Spakować się", { parent: "gory", due: due(6), estimate: 1 });

  item("t1", "task", "Zapłacić rachunek za prąd", { priority: "highest", due: due(1) });
  item("t2", "task", "Oddać książki do biblioteki", { priority: "low", due: due(-2) });
  item("t3", "task", "Umówić przegląd auta", { status: "doing" });

  /* ── wpisy w kalendarzu ── */
  const evs: Ev[] = [
    // praca: stand-up w dni robocze
    ...Array.from({ length: 35 }, (_, i) => i - 14)
      .filter((d) => {
        const wd = addDays(today, d).getDay();
        return wd !== 0 && wd !== 6;
      })
      .map((d) => ({ title: "Stand-up", day: d, at: "9:30", min: 15, color: C.sky, tags: ["praca"] })),
    { title: "Przegląd projektu", day: 0, at: "15:00", min: 90, color: C.sky, tags: ["praca"] },
    { title: "Rozmowa z klientem", day: 0, at: "15:30", min: 45, color: C.lilac, tags: ["praca", "pilne"] },
    { title: "Lunch z Anią", day: 0, at: "12:00", min: 60, color: C.peach, tags: ["spotkanie"] },
    { title: "Urodziny mamy", day: 0, color: C.coral, tags: ["rodzina", "ważne"] },
    { title: "Posprzątać piwnicę", day: 0, color: C.butter, moves: 9, notes: "Następne przeniesienie pokaże podpowiedź." },
    { title: "Dentysta", day: 1, at: "14:30", min: 30, color: C.mint, tags: ["wizyta", "ważne"] },
    { title: "Odpisać na maile", day: 1, at: "10:00", min: 15, color: C.sky, tags: ["praca"], auto: true },
    { title: "Kino: nowy film Villeneuve'a", day: 2, at: "19:00", min: 150, color: C.lilac, tags: ["rozrywka"] },
    { title: "Umyć okna", day: 2, color: C.butter, moves: 3, tags: ["low priority"] },
    { title: "Odebrać paczkę", day: 2, color: C.peach, tags: ["low priority"] },
    { title: "Zakupy spożywcze", day: 2, at: "17:00", min: 45, color: C.mint, tags: ["low priority"] },
    { title: "Telefon do babci", day: 2, at: "20:00", min: 20, color: C.coral, tags: ["rodzina"] },
    { title: "Rower", day: 2, at: "7:00", min: 60, color: C.mint, tags: ["zdrowie"] },
    { title: "!Zadzwonić do urzędu", day: 3, at: "11:00", min: 15, color: C.coral, tags: ["ważne"] },
    { title: "Fachowiec — kuchnia", day: 4, at: "10:00", min: 60, color: C.butter, epic: "kuchnia" },
    { title: "Market budowlany", day: 5, at: "11:00", min: 90, color: C.butter, epic: "kuchnia", auto: true },
    { title: "Hiszpański — lekcja", day: -4, at: "18:00", min: 60, color: C.lilac, epic: "hiszp" },
    { title: "Hiszpański — lekcja", day: 3, at: "18:00", min: 60, color: C.lilac, epic: "hiszp" },
    { title: "Wyjazd w góry", day: 7, days: 4, color: C.mint, epic: "gory", tags: ["urlop"] },
    { title: "Konferencja", day: -3, days: 3, color: C.sky, tags: ["praca"] },
    { title: "Dzień wolny", day: 12, color: C.peach, tags: ["urlop"] },
    { title: "Zapłacić rachunek za prąd", day: 1, color: C.coral, tags: ["pilne"] },
    { title: "Wizyta u weterynarza", day: -1, at: "16:00", min: 30, color: C.mint, tags: ["wizyta"], moves: 2 },
    { title: "Kolacja ze znajomymi", day: 5, at: "19:30", min: 120, color: C.peach, tags: ["spotkanie"] },
    { title: "Webinar: TypeScript", day: 8, at: "13:00", min: 60, color: C.sky, tags: ["praca", "nauka"] },
  ];
  // siłownia co drugi dzień
  for (let d = -13; d <= 20; d += 2) {
    evs.push({ title: "Siłownia", day: d, at: "7:30", min: 60, color: C.mint, tags: ["zdrowie"] });
  }

  const events: CalEvent[] = evs.map((e) => {
    const allDay = !e.at;
    const start = allDay ? addDays(today, e.day).getTime() : at(e.day, e.at!);
    const end = allDay ? endOfDay(addDays(today, e.day + (e.days ?? 1) - 1)).getTime() : start + (e.min ?? 60) * M;
    return {
      id: seedId(),
      title: e.title,
      notes: e.notes ?? "",
      start,
      end,
      allDay,
      color: e.color ?? C.sky,
      tags: e.tags ?? [],
      moves: e.moves,
      epicId: e.epic ? ids[e.epic] : undefined,
      autoSlot: e.auto || undefined,
      origin: "local",
      updatedAt: now,
      deleted: false,
      pending: 0,
    };
  });

  await db.transaction("rw", db.events, db.items, async () => {
    await db.items.bulkPut(items);
    await db.events.bulkPut(events);
  });
  return { events: events.length, items: items.length };
}
