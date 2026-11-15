/**
 * Paleta Pulsecal + odpowiadający jej colorId w Google Calendar.
 * Dokładny kolor trzymamy dodatkowo w extendedProperties.private.pulseColor,
 * więc wraca 1:1 nawet jeśli Google ma tylko zbliżony odcień.
 */
export const PALETTE = [
  { id: "coral", value: "#ff6b4a", ink: "#3a120c", gid: "4" },
  { id: "peach", value: "#ffb070", ink: "#3d2410", gid: "6" },
  { id: "mint", value: "#7ddeb2", ink: "#0f2e22", gid: "2" },
  { id: "sky", value: "#7eb6ff", ink: "#0e2440", gid: "7" },
  { id: "lilac", value: "#c9a4ff", ink: "#2a1644", gid: "1" },
  { id: "butter", value: "#f3d36b", ink: "#3a2c08", gid: "5" },
] as const;

export type PaletteEntry = (typeof PALETTE)[number];

export const DEFAULT_GOOGLE_COLOR = PALETTE[3].value;

/**
 * Kolory wydarzeń Google Calendar (colorId 1–11) w odcieniach z obecnej aplikacji Google — tak, jak je widzisz
 * w GCal (etykiety kolorów w Google to te same colorId z nadaną nazwą). Endpoint /colors zwraca starsze,
 * pastelowe wartości, więc go nie używamy.
 */
export const GOOGLE_EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb", // Lavender
  "2": "#33b679", // Sage
  "3": "#8e24aa", // Grape
  "4": "#e67c73", // Flamingo
  "5": "#f6bf26", // Banana
  "6": "#f4511e", // Tangerine
  "7": "#039be5", // Peacock
  "8": "#616161", // Graphite
  "9": "#3f51b5", // Blueberry
  "10": "#0b8043", // Basil
  "11": "#d50000", // Tomato
};

/** colorId Google dla dokładnego koloru Google (do wysłania z powrotem bez zmiany). */
export function googleIdForColor(value: string): string | undefined {
  const v = value.toLowerCase();
  return Object.keys(GOOGLE_EVENT_COLORS).find((k) => GOOGLE_EVENT_COLORS[k] === v);
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Kolor tekstu na wpisie. Paleta Pulsecal ma dobrane odcienie; dla innych kolorów (z Google, kolor kalendarza)
 * liczymy jasność tła tak, jak je rysujemy (82% koloru + 18% bieli) i wybieramy jasny albo ciemny tekst.
 */
export function colorInk(value: string): string {
  const own = PALETTE.find((c) => c.value === value)?.ink;
  if (own) return own;
  const rgb = hexRgb(value);
  if (!rgb) return "#1c1917";
  const [r, g, b] = rgb.map((c) => (c * 0.82 + 255 * 0.18) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum < 0.36 ? "#fffaf2" : "#1c1917";
}

export function paletteByValue(value: string): PaletteEntry | undefined {
  return PALETTE.find((c) => c.value === value);
}

export function paletteById(id: string | undefined): PaletteEntry | undefined {
  return id ? PALETTE.find((c) => c.id === id) : undefined;
}

