/**
 * Epiki: w epiku są tylko zadania, a zadanie MOŻE mieć wpis w kalendarzu (WorkItem.eventId) albo całą serię
 * wpisów powtarzalnych (WorkItem.seriesId). Wpis dodany do epiku (CalEvent.epicId, pole „Epik”) dostaje
 * powiązane zadanie automatycznie.
 *
 * `reconcileLinks()` (App, po każdej zmianie zadań / wpisów w epikach i co minutę) pilnuje, żeby para się zgadzała:
 * - wpis z epikiem bez zadania → nowe zadanie (stałe ID z ID wpisu / serii, więc bez duplikatów między urządzeniami);
 * - epik / nazwa różne → wygrywa nowsza zmiana (wpis usunięty z epiku → jego zadanie znika);
 * - status zadania z jednym wpisem jest automatyczny („zrobione” po zakończeniu wpisu), dopóki nie zmienisz go ręcznie;
 * - seria: zadanie decyduje, wystąpienia dostają jego epik lokalnie (nigdy nie wysyłamy wystąpień do Google).
 */
import { db, saveLocal } from "./db";
import type { CalEvent, WorkItem } from "./types";
import { autoStatus, linkedTaskId, nextNum, saveItem } from "./work";

async function dropTask(t: WorkItem): Promise<void> {
  // znane w Google → usunięcie jedzie jako „cancelled”; tylko lokalne → po prostu kasujemy
  if (t.remote) await saveItem({ ...t, deleted: true });
  else await db.items.delete(t.id);
}

/** Wpis wystąpienia serii z Google (nie wysyłamy go — zmiana odłączyłaby go od serii). */
const isInstance = (e: CalEvent) => Boolean(e.recurring && e.seriesId);

export async function reconcileLinks(now: number): Promise<number> {
  const all = await db.items.toArray();
  const items = all.filter((i) => !i.deleted);
  const events = (await db.events.toArray()).filter((e) => !e.deleted);
  const anyById = new Map(all.map((i) => [i.id, i]));
  const byEvent = new Map<string, WorkItem>();
  const bySeries = new Map<string, WorkItem>();
  for (const i of items) {
    if (i.kind !== "task") continue;
    if (i.eventId) byEvent.set(i.eventId, i);
    if (i.seriesId) bySeries.set(i.seriesId, i);
  }
  let num = nextNum(all);
  let writes = 0;

  /** Zadanie dla wpisu / serii: wskrzesza wcześniej usunięte o tym samym stałym ID (z komentarzami itd.). */
  const createTask = async (id: string, e: CalEvent, patch: Partial<WorkItem>): Promise<WorkItem> => {
    const old = anyById.get(id);
    const t: WorkItem = {
      priority: "medium",
      description: "",
      order: now,
      createdAt: now,
      ...old,
      id,
      kind: "task",
      title: e.title || "(bez tytułu)",
      status: old?.statusManual ? old.status : "todo",
      parentId: e.epicId ?? "",
      updatedAt: now,
      deleted: false,
      pending: 1,
      num: old?.num ?? num++,
      ...patch,
    };
    await saveItem(t);
    writes++;
    return t;
  };

  /* ── pojedyncze wpisy ── */
  for (const e of events) {
    if (isInstance(e)) continue;
    const epic = e.epicId ?? "";
    const t = byEvent.get(e.id);
    if (!t) {
      if (!epic) continue;
      const created = await createTask(linkedTaskId(`ev:${e.id}`), e, { eventId: e.id, status: autoStatus(e, now) });
      byEvent.set(e.id, created);
      continue;
    }
    const patch: Partial<WorkItem> = {};
    let evPatch: Partial<CalEvent> | null = null;
    const eventNewer = e.updatedAt > t.updatedAt;
    if (t.parentId !== epic) {
      if (eventNewer && !epic) {
        // wpis usunięty z epiku → jego zadanie też
        await dropTask(t);
        writes++;
        continue;
      }
      if (eventNewer) patch.parentId = epic;
      else evPatch = { epicId: t.parentId || undefined };
    }
    if (e.title && t.title !== e.title) {
      if (eventNewer || !t.title) patch.title = e.title;
      else evPatch = { ...evPatch, title: t.title };
    }
    if (!t.statusManual) {
      const s = autoStatus(e, now);
      if (t.status !== s) patch.status = s;
    }
    if (Object.keys(patch).length) {
      await saveItem({ ...t, ...patch });
      writes++;
    }
    if (evPatch) {
      await saveLocal({ ...e, ...evPatch, updatedAt: Date.now() });
      writes++;
    }
  }

  /* ── serie (wpisy powtarzalne): jedno zadanie na serię ── */
  const series = new Map<string, CalEvent[]>();
  for (const e of events) {
    if (!isInstance(e)) continue;
    const list = series.get(e.seriesId!);
    if (list) list.push(e);
    else series.set(e.seriesId!, [e]);
  }
  for (const [sid, list] of series) {
    let t = bySeries.get(sid);
    // tylko jawnie ustawiony epik na wystąpieniu się liczy (świeżo pobrane z Google go nie mają)
    const withEpic = list.filter((e) => e.epicId).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!t) {
      if (!withEpic.length) continue;
      t = await createTask(linkedTaskId(`series:${sid}`), withEpic[0], { seriesId: sid, statusManual: true });
      bySeries.set(sid, t);
    } else {
      const newer = withEpic.find((e) => e.epicId !== t!.parentId && e.updatedAt > t!.updatedAt);
      if (newer) {
        t = { ...t, parentId: newer.epicId! };
        await saveItem(t);
        writes++;
      }
    }
    const want = t.parentId || undefined;
    for (const e of list) {
      if ((e.epicId ?? "") !== t.parentId) {
        await db.events.put({ ...e, epicId: want });
        writes++;
      }
    }
  }
  return writes;
}

/** Wystąpienie serii wyjęte z epiku w oknie wpisu → cała seria wypada z epiku (zadanie serii znika). */
export async function unlinkSeries(seriesId: string): Promise<void> {
  await db.transaction("rw", db.items, db.events, async () => {
    const tasks = await db.items.filter((i) => i.seriesId === seriesId && !i.deleted).toArray();
    for (const t of tasks) await dropTask(t);
    const inst = await db.events.filter((e) => e.seriesId === seriesId && Boolean(e.epicId)).toArray();
    for (const e of inst) await db.events.put({ ...e, epicId: undefined });
  });
}
