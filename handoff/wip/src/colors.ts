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

export function colorInk(value: string): string {
  return PALETTE.find((c) => c.value === value)?.ink ?? "#1c1917";
}

export function paletteByValue(value: string): PaletteEntry | undefined {
  return PALETTE.find((c) => c.value === value);
}

export function paletteById(id: string | undefined): PaletteEntry | undefined {
  return id ? PALETTE.find((c) => c.id === id) : undefined;
}

/** Google colorId → kolor z palety (najbliższy odcień). */
export const GOOGLE_COLOR_MAP: Record<string, string> = {
  "1": "#c9a4ff", // Lavender
  "2": "#7ddeb2", // Sage
  "3": "#c9a4ff", // Grape
  "4": "#ff6b4a", // Flamingo
  "5": "#f3d36b", // Banana
  "6": "#ffb070", // Tangerine
  "7": "#7eb6ff", // Peacock
  "8": "#c4b5a5", // Graphite
  "9": "#7eb6ff", // Blueberry
  "10": "#7ddeb2", // Basil
  "11": "#ff6b4a", // Tomato
};
