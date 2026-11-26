/**
 * Własna grafika projektu: plik → zmniejszony obraz (data URL) w tabeli `assets`.
 * Zmniejszamy (najdłuższy bok do 640 px, a gdy wciąż za duży — mniej), żeby kopia zmieściła się w opisie
 * ukrytego wpisu w Google. WebP, a gdzie przeglądarka go nie zapisze (Safari): PNG dla przezroczystych, inaczej JPEG.
 */
import { db, newEventId } from "./db";
import type { ProjectAsset } from "./types";

/** Najdłuższy dopuszczalny data URL (znaki). */
const MAX_DATA = 150_000;
const SIDES = [640, 512, 400, 320, 256];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nie udało się wczytać grafiki"));
    img.src = src;
  });
}

function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const px = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < px.length; i += 16) if (px[i] < 250) return true;
  return false;
}

function encode(img: HTMLImageElement, nw: number, nh: number, side: number, quality: number) {
  const k = Math.min(1, side / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * k));
  const h = Math.max(1, Math.round(nh * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Przeglądarka nie obsługuje rysowania grafiki");
  ctx.drawImage(img, 0, 0, w, h);
  let data = c.toDataURL("image/webp", quality);
  if (!data.startsWith("data:image/webp")) data = hasAlpha(ctx, w, h) ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", quality);
  return { data, w, h };
}

/** Plik obrazka → zapisana (lokalnie, do wysłania) grafika projektu. */
export async function uploadProjectImage(file: File): Promise<{ id: string; w: number; h: number }> {
  if (!file.type.startsWith("image/")) throw new Error("To nie jest plik graficzny");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // SVG bez wymiarów zgłasza 0 — wtedy rysujemy jako 512×512
    const nw = img.naturalWidth || 512;
    const nh = img.naturalHeight || 512;
    let out = encode(img, nw, nh, SIDES[0], 0.82);
    for (const side of SIDES.slice(1)) {
      if (out.data.length <= MAX_DATA) break;
      out = encode(img, nw, nh, side, 0.76);
    }
    const asset: ProjectAsset = { id: newEventId(), ...out, updatedAt: Date.now(), deleted: false, pending: 1 };
    await db.assets.put(asset);
    return { id: asset.id, w: out.w, h: out.h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Grafika już niepotrzebna (zastąpiona inną) — usuń, o ile żaden projekt jej nie używa. */
export async function dropProjectImage(id: string | undefined): Promise<void> {
  if (!id) return;
  const used = await db.projects.filter((p) => !p.deleted && p.image?.id === id).count();
  if (used) return;
  const a = await db.assets.get(id);
  if (!a) return;
  if (a.remote === 1) await db.assets.put({ ...a, deleted: true, pending: 1, updatedAt: Date.now() });
  else await db.assets.delete(id);
}
